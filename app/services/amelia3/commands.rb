require "digest"

module Amelia3
  class Commands
    FIELDS = {
      "CREATE_DRAFT" => %w[id customerId batchId],
      "ADD_LINE" => %w[orderId lineId productId quantity expectedVersion batchId],
      "UPDATE_LINE" => %w[orderId lineId quantity expectedVersion batchId],
      "REMOVE_LINE" => %w[orderId lineId expectedVersion batchId],
      "SAVE_REVIEW" => %w[orderId destinationId deliveryDate paymentNote note expectedVersion batchId],
      "CONFIRM_ORDER" => %w[orderId expectedVersion batchId],
      "DELETE_DRAFT" => %w[orderId expectedVersion batchId]
    }.freeze

    def self.call(user:, command:)
      new(user, command).call
    end

    def initialize(user, command)
      @user, @command = user, command
    end

    def call
      validate_envelope!
      scope = Scope.new(@user)
      order_id = nil
      scope.tenant.with_lock do
        @scope = Scope.new(@user)
        receipt = Receipt.find_by(user_id: @user.id, operation_id: @command["operationId"])
        if receipt
          fail!("Operazione già usata per un contenuto differente.", "IDEMPOTENCY_CONFLICT", 409) unless receipt.request_digest == digest && receipt.tenant_id == @scope.tenant.id
          @scope.order(receipt.order_id) unless receipt.deleted
          order_id = receipt.deleted ? nil : receipt.order_id
          next
        end
        @payload = @command.fetch("payload")
        @type = @command.fetch("type")
        unless %w[REMOVE_LINE DELETE_DRAFT].include?(@type) || @payload["batchId"] == @scope.batch_id
          fail!("Il catalogo è stato aggiornato. Conserva la copia locale e verifica le condizioni.", "DATASET_CHANGED", 409)
        end
        order = @type == "CREATE_DRAFT" ? create_draft : @scope.order(@payload["orderId"])
        unless @type == "CREATE_DRAFT"
          order.lock!
          fail!("Ordine aggiornato da un altro account. Copia locale conservata.", "ORDER_CONFLICT", 409) unless @payload["expectedVersion"] == order.version
          fail!("Ordine confermato: modifica non consentita.", "ORDER_READ_ONLY") unless order.status == "DRAFT"
          fail!("Cliente bloccato.", "CUSTOMER_BLOCKED") if @scope.customer(order.customer_code).blocked && !%w[REMOVE_LINE DELETE_DRAFT].include?(@type)
          apply(order)
        end
        order_id = @type == "DELETE_DRAFT" ? nil : order.id
        Receipt.create!(user: @user, tenant: @scope.tenant, operation_id: @command["operationId"], request_digest: digest, order_id: order.id, deleted: order_id.nil?)
      end
      Snapshot.for(@user, order_id: order_id)
    end

    private

    def create_draft
      id = @payload["id"]
      fail!("Identificativo ordine non valido.", "INVALID_ID") unless uuid?(id)
      fail!("Identificativo ordine già presente.", "ORDER_CONFLICT", 409) if Order.exists?(id: id)
      customer = @scope.customer(@payload["customerId"])
      fail!("Cliente bloccato.", "CUSTOMER_BLOCKED") if customer.blocked
      Order.create!(id: id, tenant: @scope.tenant, created_by_user: @user, customer_code: customer.external_code,
                    assigned_agent_code: customer.agent_code, destination_code: customer.external_code,
                    customer_snapshot: { name: customer.name, city: customer.city }, delivery_date: Time.zone.today + 1)
    end

    def apply(order)
      case @type
      when "ADD_LINE"
        fail!("Identificativo riga non valido.", "INVALID_ID") unless uuid?(@payload["lineId"])
        fail!("Riga duplicata o limite articoli raggiunto.", "INVALID_LINE") if order.lines.length >= 100 || order.lines.any? { |line| line["id"] == @payload["lineId"] }
        product = @scope.products.find_by!(external_code: @payload["productId"])
        quantity = quantity!
        quote = Quote.for(@scope, product, @scope.customer(order.customer_code))
        aggregate_quantity!(order, product, quantity, quote)
        order.lines = order.lines + [ quote.line(id: @payload["lineId"], quantity: quantity) ]
      when "UPDATE_LINE"
        line = line!(order)
        product = @scope.products.find_by!(external_code: line.fetch("productId"))
        quote = Quote.for(@scope, product, @scope.customer(order.customer_code))
        quantity = quantity!
        quote.validate_quantity!(quantity)
        aggregate_quantity!(order, product, quantity, quote, excluding: line["id"])
        # Quantity changes preserve the saved price, even after another import.
        price = BigDecimal(line.fetch("unitPrice"))
        replacement = line.merge("quantity" => quantity.to_s("F"), "lineNetCents" => (quantity * price * 100).round(0, BigDecimal::ROUND_HALF_UP).to_i)
        order.lines = order.lines.map { |row| row["id"] == line["id"] ? replacement : row }
      when "REMOVE_LINE"
        line!(order)
        order.lines = order.lines.reject { |line| line["id"] == @payload["lineId"] }
      when "SAVE_REVIEW"
        destination = @scope.customer(@payload["destinationId"] || order.customer_code)
        unless destination.external_code == order.customer_code || destination.parent_code == order.customer_code
          fail!("Destinazione fuori anagrafica autorizzata.", "INVALID_DESTINATION")
        end
        date = CsvReader.date(@payload["deliveryDate"].to_s)
        fail!("Data consegna precedente a oggi.", "INVALID_DATE") if date < Time.zone.today
        fail!("Nota troppo lunga.", "INVALID_NOTE") if @payload["note"].to_s.length > 2000 || @payload["paymentNote"].to_s.length > 200
        order.assign_attributes(destination_code: destination.external_code, delivery_date: date, note: @payload["note"].to_s, payment_note: @payload["paymentNote"].to_s)
      when "CONFIRM_ORDER"
        confirm!(order)
      when "DELETE_DRAFT"
        order.destroy!
        return
      end
      order.net_cents = order.lines.sum { |line| line.fetch("lineNetCents") }
      fail!("Totale fuori intervallo.", "INVALID_AMOUNT") unless order.net_cents.between?(0, Hfs::Calculations::MAX_SAFE_INTEGER)
      order.version += 1
      order.save!
    end

    def confirm!(order)
      fail!("Inserisci almeno un articolo.", "EMPTY_ORDER") if order.lines.empty?
      fail!("Data consegna non valida.", "INVALID_DATE") unless order.delivery_date && order.delivery_date >= Time.zone.today
      destination = @scope.customer(order.destination_code)
      fail!("Destinazione bloccata.", "CUSTOMER_BLOCKED") if destination.blocked
      order.lines.group_by { |line| line.fetch("productId") }.each do |code, lines|
        product = @scope.products.find_by!(external_code: code)
        quote = Quote.for(@scope, product, @scope.customer(order.customer_code))
        lines.each { |line| quote.validate_quantity!(BigDecimal(line.fetch("quantity"))) }
        fail!("Disponibilità aggregata insufficiente.", "INSUFFICIENT_STOCK") if lines.sum { |line| BigDecimal(line.fetch("quantity")) } > quote.stock.pieces
      end
      order.assign_attributes(status: "CONFIRMED_LOCAL", confirmed_at: Time.current)
    end

    def aggregate_quantity!(order, product, quantity, quote, excluding: nil)
      quote.validate_quantity!(quantity)
      total = order.lines.select { |line| line["productId"] == product.external_code && line["id"] != excluding }.sum { |line| BigDecimal(line["quantity"]) } + quantity
      fail!("Disponibilità aggregata insufficiente.", "INSUFFICIENT_STOCK") if total > quote.stock.pieces
    end

    def line!(order)
      order.lines.find { |line| line["id"] == @payload["lineId"] } || fail!("Riga non trovata.", "INVALID_LINE", 404)
    end

    def quantity!
      value = CsvReader.decimal(@payload["quantity"])
      fail!("Quantità intera richiesta nell'UM P.", "INVALID_QUANTITY") unless value.frac.zero?
      value
    end

    def validate_envelope!
      unless @command.is_a?(Hash) && (@command.keys - %w[operationId baseVersion epoch type payload]).empty? && @command["operationId"].to_s.match?(/\A[A-Za-z0-9_-]{1,128}\z/)
        fail!("Formato operazione non valido.", "INVALID_COMMAND")
      end
      allowed = FIELDS[@command["type"]]
      payload = @command["payload"]
      unless allowed && payload.is_a?(Hash) && (payload.keys - allowed).empty? && @command["epoch"] == 1 && @command["baseVersion"].is_a?(Integer) && @command["baseVersion"] >= 0
        fail!("Operazione non consentita.", "INVALID_COMMAND")
      end
      fail!("Operazione troppo grande.", "INVALID_COMMAND") if JSON.generate(@command).bytesize > 65_536
    end

    def uuid?(value)
      value.is_a?(String) && value.match?(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
    end

    def digest
      @digest ||= Digest::SHA256.hexdigest(JSON.generate(canonical(@command)))
    end

    def canonical(value)
      case value
      when Hash then value.keys.sort.to_h { |key| [ key, canonical(value[key]) ] }
      when Array then value.map { |row| canonical(row) }
      else value
      end
    end

    def fail!(message, code, status = 422)
      raise Error.new(message, code: code, status: status)
    end
  end
end
