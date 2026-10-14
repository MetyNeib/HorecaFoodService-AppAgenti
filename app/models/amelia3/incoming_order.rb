class Amelia3::IncomingOrder < ApplicationRecord
  belongs_to :tenant
  belongs_to :claimed_by, class_name: "User", optional: true
  scope :awaiting_confirmation, -> { where(status: %w[pending claimed]) }
  validates :status, inclusion: { in: %w[archived pending claimed confirmed_demo] }

  def self.receive!(tenant:, name:, bytes:, archived:, received_at: Time.current)
    sha = Digest::SHA256.hexdigest(bytes)
    return find_by(tenant: tenant, source_sha: sha) if exists?(tenant: tenant, source_sha: sha)
    parsed = Amelia3::IncomingOrderParser.call(bytes)
    previous = where(tenant: tenant, customer_code: parsed.fetch("customerCode"), external_reference: parsed.fetch("externalReference"))
      .where("original ->> 'orderDate' = ?", parsed.fetch("orderDate")).first
    if previous
      return previous if previous.original == parsed
      raise Amelia3::Error.new("Una sorgente già acquisita è cambiata: necessaria verifica, originale conservato.", code: "INBOX_SOURCE_CHANGED")
    end
    create!(tenant: tenant, customer_code: parsed.fetch("customerCode"), external_reference: parsed.fetch("externalReference"),
      source_name: name, source_sha: sha, original: parsed, draft: parsed.except("header").deep_dup,
      status: archived ? "archived" : "pending", received_at: received_at, confirmation_due_at: received_at + 30.minutes)
  rescue ActiveRecord::RecordNotUnique
    find_by!(tenant: tenant, source_sha: sha)
  end

  def change!(scope:, actor:, operation:, expected_version:, attributes: {})
    with_lock do
      raise Amelia3::Error.new("Ordine aggiornato da un altro account: ricarica prima di modificarlo.", code: "INBOX_CONFLICT", status: 409) unless lock_version == expected_version
      customer = scope.customer(customer_code)
      raise Amelia3::Error.new("Cliente bloccato: ordine consultabile ma non modificabile.", code: "CUSTOMER_BLOCKED", status: 422) if customer.blocked
      raise Amelia3::Error.new("La modifica è disponibile soltanto nella demo.", code: "DEMO_ONLY", status: 403) unless Amelia3::DemoAccess.new(actor).enabled?
      raise Amelia3::Error.new("Conferma demo già registrata.", code: "INBOX_CLOSED", status: 409) if status == "confirmed_demo"
      case operation
      when "claim"
        raise Amelia3::Error.new("Ordine già preso in carico da un altro account.", code: "INBOX_CLAIMED", status: 409) if claimed_by_id && claimed_by_id != scope.user.id
        self.claimed_by = scope.user
        self.status = "claimed" unless status == "archived"
      when "save", "confirm"
        raise Amelia3::Error.new("Prendi in carico l’ordine prima di modificarlo.", code: "INBOX_NOT_CLAIMED", status: 409) unless claimed_by_id == scope.user.id
        self.draft = validated_draft(attributes, scope) if operation == "save"
        if operation == "confirm"
          self.status = "confirmed_demo"
          self.confirmed_at = Time.current
        end
      else
        raise Amelia3::Error.new("Operazione non valida.", code: "INBOX_OPERATION")
      end
      self.audit = audit + [ { "operation" => operation, "userId" => scope.user.id, "adminId" => actor.id, "at" => Time.current.iso8601, "version" => lock_version + 1 } ]
      save!
    end
  end

  private

  def validated_draft(attributes, scope)
    rows = Array(attributes["lines"]).reject { |line| line["remove"] == "1" || line["productCode"].blank? }
    raise Amelia3::Error.new("Inserisci almeno un prodotto (massimo 1000).", code: "INBOX_LINES") unless rows.length.between?(1, 1000)
    existing = original.fetch("lines").index_by { |line| line["id"] }
    products = scope.products.where(external_code: rows.map { |row| row["productCode"] }).index_by(&:external_code)
    lines = rows.map.with_index do |line, index|
      product = products[line["productCode"]]
      old = existing[line["id"]]
      same_source = old && old["productCode"] == line["productCode"] && old["sourceUnit"] == line["sourceUnit"]
      unless same_source || (product && !product.blocked && product.canonical_units["orderableUms"].include?(Amelia3::IncomingOrderParser::UNIT_MAP[line["sourceUnit"]]))
        raise Amelia3::Error.new("Prodotto o unità aggiunti non disponibili nel catalogo.", code: "INBOX_PRODUCT")
      end
      quantity = Amelia3::CsvReader.decimal(line["quantity"])
      raise Amelia3::Error.new("La quantità deve essere positiva.", code: "INBOX_QUANTITY") unless quantity.positive?
      { "id" => same_source ? old["id"] : "demo-#{index}", "productCode" => line["productCode"], "sourceUnit" => line["sourceUnit"],
        "unit" => Amelia3::IncomingOrderParser::UNIT_MAP[line["sourceUnit"]], "quantity" => quantity.to_s("F"), "note" => line["note"].to_s.first(1000) }
    end
    draft.merge("lines" => lines, "note" => attributes["note"].to_s.first(2000), "deliveryDate" => Amelia3::CsvReader.date(attributes["deliveryDate"]).iso8601)
  end
end
