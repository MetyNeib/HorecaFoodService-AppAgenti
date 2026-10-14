require "digest"

module Amelia3
  class Snapshot
    CUSTOMER_LIMIT = 100
    PRODUCT_LIMIT = 500
    ORDER_LIMIT = 20

    def self.identity(user, batch_id: nil)
      base = "amelia3-#{user.id}-#{user.commercial_tenant_id}-#{user.role}-#{user.agent_id}"
      return base unless user.role == "agent"
      batch_id ||= Tenant.where(id: user.commercial_tenant_id).pick(:active_batch_id)
      codes = Customer.where(batch_id: batch_id, agent_code: user.agent_id).order(:external_code).pluck(:external_code)
      base + "-" + Digest::SHA256.hexdigest(JSON.generate(codes))[0, 16]
    end

    def self.for(user, customer_codes: [], product_codes: [], order_id: nil, include_usual: true)
      scope = Scope.new(user)
      context_order = order_id.present? ? scope.order(order_id) : nil
      requested = Array(customer_codes).take(50) + [ context_order&.customer_code, context_order&.destination_code ].compact
      # Explicitly requested codes are never trusted to expand the portfolio.
      allowed = scope.customers.where(external_code: requested).pluck(:external_code)
      customers = scope.customers.where(external_code: (allowed + scope.customers.order(:external_code).limit(CUSTOMER_LIMIT - allowed.length.clamp(0, CUSTOMER_LIMIT)).pluck(:external_code)).uniq.take(CUSTOMER_LIMIT)).to_a
      codes = (Array(product_codes).take(50) + Array(context_order&.lines).map { |line| line["productId"] } + Catalog.cached_products(scope, include_usual: include_usual).pluck(:external_code)).uniq.take(PRODUCT_LIMIT)
      products = scope.products.where(external_code: codes).to_a
      quotes = Catalog.new(scope, products).quotes
      orders = scope.orders.order(updated_at: :desc).limit(ORDER_LIMIT).to_a
      orders.unshift(context_order) if context_order && !orders.any? { |order| order.id == context_order.id }
      orders = orders.take(ORDER_LIMIT)
      customer_ids = customers.map(&:external_code)
      reactivation = scope.reactivation_items.where(customer_code: customer_ids).pluck(:customer_code, :evidence).to_h
      conditions = Condition.where(batch_id: scope.batch_id, customer_code: customer_ids, product_code: codes)
      evidence = UnitVerification.where(tenant: scope.tenant).order(:id).pluck(:id, :version, :active, :updated_at)
      latest_import = SyncOccurrence.where(tenant_id: scope.tenant.id).order(local_date: :desc).first
      data = { "tenant" => { "code" => scope.tenant.code, "name" => scope.tenant.name }, "batchId" => scope.batch_id,
               "batchFingerprint" => scope.tenant.active_batch.fingerprint,
               "importStatus" => latest_import ? "#{latest_import.local_date} · #{latest_import.status}" : "batch locale disponibile; nessuna esecuzione pianificata registrata",
               "quoteContractVersion" => UnitContract::VERSION, "verificationVersion" => Digest::SHA256.hexdigest(JSON.generate(evidence)),
               "notifications" => { "salesAlerts" => scope.sales_alert_count, "unreadOrders" => 0, "whatsappAvailable" => false },
               "portfolioCount" => scope.customers.count, "catalogCount" => scope.products.count,
               "asOf" => Time.zone.today.iso8601, "expiresAt" => 24.hours.from_now.iso8601,
               "customers" => customers.map { |customer| customer_data(customer, scope).merge(scope.customer_activity.for(customer)).merge("reactivation" => reactivation[customer.external_code]) },
               "products" => products.map { |product| product_data(product, quotes.fetch(product.external_code)) },
               "customerConditions" => conditions.map { |row| condition_data(row) }, "orders" => orders.map { |order| order_data(order) } }
      { state: { "schemaVersion" => 2, "datasetMode" => "amelia3", "datasetId" => "AMELIA3-#{scope.tenant.id}", "data" => data },
        version: scope.tenant.revision, epoch: 1,
        user: { id: identity(user, batch_id: scope.batch_id), ownerId: user.id, email: user.email, role: user.role, agentId: user.agent_id, displayName: user.display_name } }
    end

    def self.customer_data(customer, scope)
      parent = customer.parent_code.present? && scope.customers.exists?(external_code: customer.parent_code) ? customer.parent_code : nil
      { "id" => customer.external_code, "name" => customer.name, "city" => customer.city, "address" => customer.address,
        "blocked" => customer.blocked, "agentCode" => customer.agent_code, "parentCode" => parent,
        "taxId" => customer.tax_id, "email" => customer.email, "telephone" => customer.telephone,
        "billTo" => customer.bill_to, "deliveryPoint" => customer.delivery_point, "assignedListCode" => customer.source_fields["cod_lis"].presence }
    end

    def self.product_data(product, quote)
      amount = quote.price&.amount
      micros = amount && (amount * 1_000_000).frac.zero? ? (amount * 1_000_000).to_i.to_s : nil
      canonical = product.canonical_units
      offers = canonical["orderableUms"].to_h do |unit|
        option = Quote.new(product: product, stock: quote.stock, price: quote.price, unit: unit, verification: quote.unit_contract.verification)
        [ unit, option.wire ]
      end
      { "id" => product.external_code, "name" => product.name, "unit" => product.base_unit, "orderUnit" => product.order_unit,
        "blocked" => product.blocked, "catalogExcluded" => product.generic_catalog_item?, "quantityStep" => quote.terms["quantityStep"], "basePriceMicros" => micros,
        "unavailableReason" => quote.unavailable_reason, "canonicalVersion" => canonical["version"],
        "orderableUms" => canonical["orderableUms"], "preferredUm" => canonical["preferredUm"], "unitKind" => canonical["unitKind"], "unitQuotes" => offers,
        "stocks" => { "cf" => quote.stock&.packs&.to_s("F"), "pz" => quote.stock&.pieces&.to_s("F"), "pe" => quote.stock&.weight&.to_s("F") },
        "piecesPerPack" => product.pieces_per_pack&.to_s("F"), "packsPerCase" => product.packs_per_case&.to_s("F") }
    end

    def self.condition_data(row)
      exact_price = row.price.nil? || (row.price * 1_000_000).frac.zero?
      exact_discount = row.discount.nil? || (row.discount * 10_000).frac.zero?
      { "id" => row.source_row, "customerId" => row.customer_code, "productId" => row.product_code,
        "validFrom" => row.valid_from.iso8601, "validTo" => row.valid_to.iso8601,
        "priceMicros" => exact_price && row.price ? (row.price * 1_000_000).to_i.to_s : nil,
        "discountUnits" => exact_discount && row.discount ? (row.discount * 10_000).to_i.to_s : nil,
        "unavailableReason" => exact_price && exact_discount ? nil : "Precisione della condizione non attestata" }
    end

    def self.order_data(order)
      { "id" => order.id, "customerId" => order.customer_code, "customerName" => order.customer_snapshot["name"],
        "agentCode" => order.assigned_agent_code, "createdByUserId" => order.created_by_user_id,
        "status" => order.status, "version" => order.version, "lines" => order.lines,
        "destinationId" => order.destination_code, "deliveryDate" => order.delivery_date&.iso8601,
        "paymentNote" => order.payment_note, "note" => order.note, "netCents" => order.net_cents,
        "confirmedAt" => order.confirmed_at&.iso8601 }
    end
  end
end
