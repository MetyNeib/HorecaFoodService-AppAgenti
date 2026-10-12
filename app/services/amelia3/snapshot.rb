module Amelia3
  class Snapshot
    CUSTOMER_LIMIT = 100
    PRODUCT_LIMIT = 500
    ORDER_LIMIT = 20

    def self.identity(user)
      "amelia3-#{user.id}-#{user.commercial_tenant_id}-#{user.role}-#{user.agent_id}"
    end

    def self.for(user, customer_codes: [], product_codes: [], order_id: nil)
      scope = Scope.new(user)
      context_order = order_id.present? ? scope.order(order_id) : nil
      requested = Array(customer_codes) + [ context_order&.customer_code ].compact
      # Explicitly requested codes are never trusted to expand the portfolio.
      allowed = scope.customers.where(external_code: requested).pluck(:external_code)
      customers = scope.customers.where(external_code: (allowed + scope.customers.order(:external_code).limit(CUSTOMER_LIMIT - allowed.length.clamp(0, CUSTOMER_LIMIT)).pluck(:external_code)).uniq.take(CUSTOMER_LIMIT)).to_a
      codes = (Catalog.cached_products(scope).pluck(:external_code) + Array(product_codes)).uniq.take(PRODUCT_LIMIT)
      products = scope.products.where(external_code: codes).to_a
      quotes = Catalog.new(scope, products).quotes
      orders = scope.orders.order(updated_at: :desc).limit(ORDER_LIMIT).to_a
      orders.unshift(context_order) if context_order && !orders.any? { |order| order.id == context_order.id }
      customer_ids = customers.map(&:external_code)
      conditions = Condition.where(batch_id: scope.batch_id, customer_code: customer_ids, product_code: codes)
      data = { "tenant" => { "code" => scope.tenant.code, "name" => scope.tenant.name }, "batchId" => scope.batch_id,
               "asOf" => Time.zone.today.iso8601, "expiresAt" => 24.hours.from_now.iso8601,
               "customers" => customers.map { |customer| customer_data(customer, scope) },
               "products" => products.map { |product| product_data(product, quotes.fetch(product.external_code)) },
               "customerConditions" => conditions.map { |row| condition_data(row) }, "orders" => orders.map { |order| order_data(order) } }
      { state: { "schemaVersion" => 2, "datasetMode" => "amelia3", "datasetId" => "AMELIA3-#{scope.tenant.id}", "data" => data },
        version: scope.tenant.revision, epoch: 1,
        user: { id: identity(user), ownerId: user.id, email: user.email, role: user.role, agentId: user.agent_id, displayName: user.display_name } }
    end

    def self.customer_data(customer, scope)
      parent = customer.parent_code.present? && scope.customers.exists?(external_code: customer.parent_code) ? customer.parent_code : nil
      { "id" => customer.external_code, "name" => customer.name, "city" => customer.city, "address" => customer.address,
        "blocked" => customer.blocked, "agentCode" => customer.agent_code, "parentCode" => parent,
        "taxId" => customer.tax_id, "email" => customer.email, "telephone" => customer.telephone,
        "billTo" => customer.bill_to, "deliveryPoint" => customer.delivery_point }
    end

    def self.product_data(product, quote)
      amount = quote.price&.amount
      micros = amount && (amount * 1_000_000).frac.zero? ? (amount * 1_000_000).to_i.to_s : nil
      { "id" => product.external_code, "name" => product.name, "unit" => product.base_unit, "orderUnit" => product.order_unit,
        "blocked" => product.blocked, "quantityStep" => quote.step&.to_i, "basePriceMicros" => micros,
        "unavailableReason" => quote.unavailable_reason, "stockPieces" => quote.stock&.pieces&.to_s("F"),
        "stocks" => { "cf" => quote.stock&.packs&.to_s("F"), "pz" => quote.stock&.pieces&.to_s("F"), "pe" => quote.stock&.weight&.to_s("F") },
        "piecesPerPack" => product.pieces_per_pack&.to_s("F"), "packsPerCase" => product.packs_per_case&.to_s("F") }
    end

    def self.condition_data(row)
      { "id" => row.source_row, "customerId" => row.customer_code, "productId" => row.product_code,
        "validFrom" => row.valid_from.iso8601, "validTo" => row.valid_to.iso8601,
        "priceMicros" => row.price && (row.price * 1_000_000).to_i.to_s,
        "discountUnits" => row.discount && (row.discount * 10_000).to_i.to_s }
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
