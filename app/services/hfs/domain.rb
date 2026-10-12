require "json"
require "date"

module Hfs
  # Commands receive intent only. Catalog, cost, totals, agent and statuses are server-owned.
  class Domain
    EDITABLE = %w[DRAFT WHATSAPP_REVIEW].freeze
    REVIEW_FIELDS = %w[destinationId deliveryDate deliveryTime warehouseId customerReference contactId paymentId note].freeze
    TYPES = %w[CREATE_DRAFT CHANGE_CUSTOMER ADD_LINE UPDATE_LINE REMOVE_LINE SAVE_REVIEW DELETE_DRAFT
               SAVE_VERIFICATION RESOLVE_REQUEST EXCLUDE_REQUEST CONFIRM_ORDER UPSERT_CONTACT SHARE_SIMULATED
               MARK_INSIGHTS_REVIEWED SET_DEMO_NETWORK SYNC_DEMO RESET_DEMO].freeze
    attr_reader :state, :data, :agent_id

    def initialize(state, agent_id: "AG-014")
      @state = JSON.parse(JSON.generate(state))
      @data = @state.fetch("data")
      @agent_id = agent_id
    end

    def clock = data.fetch("meta").fetch("demoClock")
    def today = clock[0, 10]

    def apply(type, payload)
      raise ValidationError, "Operazione non supportata." unless TYPES.include?(type)
      raise ValidationError, "Payload non valido." unless payload.is_a?(Hash)
      send(type.downcase, payload)
      if state["network"] == "ONLINE" && data.fetch("syncQueue").any? { |job| job["status"] == "WAITING_NETWORK" }
        state["network"] = "SYNCING"
      end
      state
    rescue KeyError => error
      raise ValidationError, "Campo obbligatorio mancante: #{error.key}."
    end

    def stock(product_id, warehouse_id)
      row = data.fetch("stocks").find { |item| item["productId"] == product_id && item["warehouseId"] == warehouse_id }
      row ? row.fetch("availableBaseQuantity") : 0
    end

    def next_delivery(customer, destination_id = nil)
      destination_id ||= customer.fetch("defaultDestinationId")
      destination = data.fetch("destinations").find { |item| item["id"] == destination_id && item["customerId"] == customer["id"] }
      route = find!("deliveryRoutes", destination ? destination.fetch("deliveryRouteId") : customer.fetch("deliveryRouteId"))
      date = Date.iso8601(today) + 1
      date += 1 until route.fetch("weekdaysISO").include?(date.cwday)
      date.iso8601
    end

    def calculate_line(product, line)
      base = Calculations.base_quantity(product, line.fetch("quantity"), line.fetch("unit"))
      values = Calculations.line_amounts(base.fetch("quantity"), line.fetch("unitPriceBaseCents"), line.fetch("costBaseCents"), line.fetch("isGift", false))
      line.merge("baseQuantity" => base.fetch("quantity"), "conversionIsEstimated" => base.fetch("estimated"),
                 "lineNetCents" => values.fetch("netCents"), "lineCostCents" => values.fetch("costCents"),
                 "marginCents" => values.fetch("marginCents"), "marginPercent" => values.fetch("marginPercent"))
    end

    def order_errors(order)
      errors = []
      errors << "Aggiungi almeno un articolo." if order.fetch("lines").empty?
      errors << "Completa destinazione, data e pagamento." if %w[destinationId paymentId deliveryDate].any? { |key| order[key].to_s.empty? }
      customer = customer!(order.fetch("customerId"))
      destination = data.fetch("destinations").find { |item| item["id"] == order["destinationId"] && item["customerId"] == customer["id"] }
      errors << "Destinazione non valida per questo cliente." unless destination
      route = data.fetch("deliveryRoutes").find { |item| item["id"] == (destination ? destination["deliveryRouteId"] : customer["deliveryRouteId"]) }
      begin
        date = Date.iso8601(Calculations.day(order.fetch("deliveryDate")))
        unless date.iso8601 > today && route && route.fetch("weekdaysISO").include?(date.cwday)
          errors << "Scegli una data successiva a oggi prevista dal giro di consegna."
        end
      rescue Date::Error, ValidationError
        errors << "Data di consegna non valida."
      end
      errors << "Pagamento non valido." unless data.fetch("paymentMethods").any? { |item| item["id"] == order["paymentId"] }
      errors << "Deposito non valido." unless data.fetch("warehouses").any? { |item| item["id"] == order["warehouseId"] }
      inbox = data.fetch("whatsappInbox").find { |item| item["orderId"] == order["id"] }
      if inbox && inbox.fetch("requests").any? { |request| unresolved?(request) }
        errors << "Risolvi o escludi tutte le richieste WhatsApp."
      end
      quantities = Hash.new(0)
      order.fetch("lines").each do |line|
        begin
          product = product!(line.fetch("productId"))
          calculated = calculate_line(product, line)
          quantities[product["id"]] += Calculations.scaled(calculated.fetch("baseQuantity"))
        rescue ValidationError => error
          errors << error.message
        end
      end
      quantities.each do |id, quantity|
        if quantity > Calculations.scaled(stock(id, order["warehouseId"]))
          errors << "#{find!("products", id).fetch("name")}: disponibilità insufficiente (#{stock(id, order["warehouseId"])})."
        end
      end
      errors.uniq
    end

    private

    def strict_keys!(payload, allowed)
      unknown = payload.keys - allowed
      raise ValidationError, "Campi non modificabili: #{unknown.join(', ')}." unless unknown.empty?
    end

    def text!(value, label, required: false, max: 2000)
      unless value.is_a?(String) && value.length <= max && (!required || !value.strip.empty?)
        raise ValidationError, "#{label} non valido."
      end
      value
    end

    def id!(value)
      unless value.is_a?(String) && value.match?(/\A[A-Za-z0-9][A-Za-z0-9_-]{0,127}\z/)
        raise ValidationError, "Identificativo non valido."
      end
      value
    end

    def boolean!(value)
      raise ValidationError, "Valore booleano richiesto." unless [ true, false ].include?(value)
      value
    end

    def find!(collection, id)
      data.fetch(collection).find { |entry| entry["id"] == id } || raise(ValidationError, "#{collection}: elemento inesistente.")
    end

    def customer!(id)
      customer = find!("customers", id)
      unless customer["agentId"] == agent_id && data.fetch("demoDefaults").fetch("activeCustomerIds").include?(id)
        raise Forbidden, "Cliente fuori dal portafoglio assegnato."
      end
      customer
    end

    def product!(id)
      product = find!("products", id)
      raise ValidationError, "Articolo non ordinabile." unless product["active"] && !product["blocked"]
      product
    end

    def order!(id, editable: true)
      order = find!("orders", id)
      customer!(order.fetch("customerId"))
      raise Forbidden, "Ordine non assegnato all'agente." unless order["agentId"] == agent_id
      raise ValidationError, "Ordine confermato in sola lettura." if editable && !EDITABLE.include?(order["status"])
      order
    end

    def line!(order, id)
      order.fetch("lines").find { |line| line["id"] == id } || raise(ValidationError, "Riga inesistente.")
    end

    def inbox!(order)
      data.fetch("whatsappInbox").find { |item| item["orderId"] == order["id"] } || raise(ValidationError, "Verifica WhatsApp inesistente.")
    end

    def request!(order, id)
      inbox!(order).fetch("requests").find { |item| item["id"] == id } || raise(ValidationError, "Richiesta WhatsApp inesistente.")
    end

    def unresolved?(request) = !%w[MATCHED RESOLVED EXCLUDED].include?(request["status"])

    def new_order(customer, id)
      { "id" => id, "number" => id, "customerId" => customer.fetch("id"), "agentId" => agent_id,
        "channel" => "AGENT", "status" => "DRAFT", "createdAt" => clock, "updatedAt" => clock, "sentAt" => nil,
        "warehouseId" => customer.fetch("warehouseId"), "destinationId" => customer.fetch("defaultDestinationId"),
        "deliveryDate" => next_delivery(customer), "deliveryTime" => nil, "customerReference" => "",
        "contactId" => data.fetch("contacts").find { |item| item["customerId"] == customer["id"] }&.fetch("id") || "",
        "paymentId" => customer.fetch("defaultPaymentId"), "priceListId" => customer.fetch("defaultPriceListId"),
        "note" => "", "noteDestination" => "DELIVERY_DOCUMENT", "lines" => [],
        "totals" => Calculations.sum_amounts([]), "synthetic" => true }
    end

    def make_line(order, product, quantity, unit, id, request_id = nil)
      price = Calculations.resolve_price(data, customer!(order.fetch("customerId")), product, today)
      calculate_line(product, { "id" => id!(id), "productId" => product.fetch("id"), "quantity" => quantity,
        "unit" => unit == "COLLI" ? "CT" : unit, "unitPriceBaseCents" => price.fetch("unitPriceBaseCents"),
        "costBaseCents" => product.fetch("costBaseCents"), "priceMode" => price.fetch("source"),
        "priceReferenceId" => price["conditionId"], "isGift" => false, "note" => "", "whatsappRequestId" => request_id })
    end

    def recalc(order)
      order["totals"] = Calculations.sum_amounts(order.fetch("lines").map do |line|
        { "netCents" => line.fetch("lineNetCents"), "costCents" => line.fetch("lineCostCents") }
      end)
      order["updatedAt"] = clock
    end

    def create_draft(payload)
      strict_keys!(payload, %w[id customerId])
      id = id!(payload.fetch("id"))
      raise ValidationError, "Identificativo ordine già presente." if data.fetch("orders").any? { |order| order["id"] == id }
      data.fetch("orders") << new_order(customer!(payload.fetch("customerId")), id)
    end

    def change_customer(payload)
      strict_keys!(payload, %w[orderId customerId confirmClear])
      order = order!(payload.fetch("orderId"))
      raise ValidationError, "Il cliente WhatsApp non può essere sostituito." unless order["status"] == "DRAFT"
      customer = customer!(payload.fetch("customerId"))
      return if order["customerId"] == customer["id"]
      if order.fetch("lines").any? && payload["confirmClear"] != true
        raise ValidationError, "Conferma lo svuotamento del carrello prima di cambiare cliente."
      end
      order.replace(new_order(customer, order.fetch("id")))
    end

    def add_line(payload)
      strict_keys!(payload, %w[orderId lineId productId quantity unit])
      order = order!(payload.fetch("orderId"))
      product = product!(payload.fetch("productId"))
      line = make_line(order, product, payload.fetch("quantity"), payload.fetch("unit"), payload.fetch("lineId"))
      raise ValidationError, "Identificativo riga già presente." if order.fetch("lines").any? { |item| item["id"] == line["id"] }
      existing = order.fetch("lines").find do |item|
        item["productId"] == product["id"] && item["unit"] == line["unit"] && item["unitPriceBaseCents"] == line["unitPriceBaseCents"] &&
          !item["isGift"] && !item["whatsappRequestId"] && item["note"].to_s.empty?
      end
      if existing
        quantity = (Calculations.scaled(existing.fetch("quantity")) + Calculations.scaled(line.fetch("quantity"))) / 1000.0
        existing.replace(calculate_line(product, existing.merge("quantity" => quantity)))
      else
        order.fetch("lines") << line
      end
      recalc(order)
    end

    def update_line(payload)
      strict_keys!(payload, %w[orderId lineId quantity unit priceMode priceListId unitPriceBaseCents discountBasisPoints isGift note condition])
      order = order!(payload.fetch("orderId"))
      original = line!(order, payload.fetch("lineId"))
      line = original.dup
      product = product!(line.fetch("productId"))
      %w[quantity unit].each { |key| line[key] = payload[key] if payload.key?(key) }
      line["unit"] = "CT" if line["unit"] == "COLLI"
      line["isGift"] = boolean!(payload["isGift"]) if payload.key?("isGift")
      line["note"] = text!(payload["note"], "Commento") if payload.key?("note")
      price_keys = %w[priceMode priceListId unitPriceBaseCents discountBasisPoints]
      if price_keys.any? { |key| payload.key?(key) }
        mode = payload.fetch("priceMode")
        raise ValidationError, "Modalità prezzo non valida." unless %w[FIXED_PRICE PRICE_LIST DISCOUNT].include?(mode)
        list = payload["priceListId"] || order.fetch("priceListId")
        find!("priceLists", list)
        reference = Calculations.list_price(data, product, list)
        price = case mode
        when "FIXED_PRICE" then Calculations.integer(payload.fetch("unitPriceBaseCents"), "Prezzo")
        when "DISCOUNT" then Calculations.discount_price(reference, payload.fetch("discountBasisPoints"))
        else reference
        end
        line.merge!("unitPriceBaseCents" => price, "priceMode" => mode, "priceReferenceId" => list)
      end
      line = calculate_line(product, line)
      save_condition(order, product, line, payload) if payload["condition"]
      original.replace(line)
      recalc(order)
    end

    def save_condition(order, product, line, payload)
      condition = payload.fetch("condition")
      raise ValidationError, "Condizione non valida." unless condition.is_a?(Hash)
      strict_keys!(condition, %w[id validFrom validTo replaceOverlaps])
      mode = payload.fetch("priceMode")
      first = condition["validFrom"].to_s.empty? ? nil : Calculations.day(condition["validFrom"])
      last = condition["validTo"].to_s.empty? ? nil : Calculations.day(condition["validTo"])
      raise ValidationError, "La data finale deve essere successiva o uguale alla data iniziale." if first && last && first > last
      overlapping = data.fetch("customerConditions").select do |existing|
        existing["customerId"] == order["customerId"] && existing["productId"] == product["id"] &&
          (!existing["validTo"] || !first || existing["validTo"] >= first) && (!last || !existing["validFrom"] || existing["validFrom"] <= last)
      end
      if overlapping.any? && condition["replaceOverlaps"] != true
        raise ValidationError, "Conferma la sostituzione delle condizioni sovrapposte."
      end
      id = id!(condition.fetch("id"))
      if data.fetch("customerConditions").any? { |item| item["id"] == id && !overlapping.include?(item) }
        raise ValidationError, "Identificativo condizione già presente."
      end
      data["customerConditions"] -= overlapping
      data["customerConditions"] << { "id" => id, "customerId" => order.fetch("customerId"), "productId" => product.fetch("id"),
        "type" => mode, "unitPriceBaseCents" => mode == "FIXED_PRICE" ? line.fetch("unitPriceBaseCents") : nil,
        "priceListId" => mode == "FIXED_PRICE" ? nil : line.fetch("priceReferenceId"),
        "discountBasisPoints" => mode == "DISCOUNT" ? payload.fetch("discountBasisPoints") : nil,
        "validFrom" => first, "validTo" => last, "savedByAgentId" => agent_id }
    end

    def remove_line(payload)
      strict_keys!(payload, %w[orderId lineId])
      order = order!(payload.fetch("orderId"))
      line = line!(order, payload.fetch("lineId"))
      raise ValidationError, "Per una riga WhatsApp usa Escludi richiesta." if line["whatsappRequestId"]
      order.fetch("lines").delete(line)
      recalc(order)
    end

    def save_review(payload)
      strict_keys!(payload, [ "orderId" ] + REVIEW_FIELDS)
      order = order!(payload.fetch("orderId"))
      customer = customer!(order.fetch("customerId"))
      REVIEW_FIELDS.each do |key|
        next unless payload.key?(key)
        value = payload[key]
        case key
        when "destinationId", "contactId"
          text!(value, key)
          unless value.empty?
            entry = find!(key == "destinationId" ? "destinations" : "contacts", value)
            raise Forbidden, "Destinazione o referente di un altro cliente." unless entry["customerId"] == customer["id"]
          end
        when "warehouseId", "paymentId"
          text!(value, key)
          find!(key == "warehouseId" ? "warehouses" : "paymentMethods", value) unless value.empty?
        when "deliveryDate"
          text!(value, key)
          raise ValidationError, "Data di consegna non valida." if !value.empty? && Calculations.day(value) != value
        when "deliveryTime"
          unless value.nil? || value == "" || (value.is_a?(String) && value.match?(/\A(?:[01]\d|2[0-3]):[0-5]\d\z/))
            raise ValidationError, "Ora di consegna non valida."
          end
          value = nil if value == ""
        else text!(value, key)
        end
        order[key] = value
      end
      if payload.key?("destinationId") && !payload.key?("deliveryDate") && !order["destinationId"].empty?
        order["deliveryDate"] = next_delivery(customer, order["destinationId"])
      end
      order["updatedAt"] = clock
      inbox!(order)["verificationSaved"] = true if order["status"] == "WHATSAPP_REVIEW"
    end

    def delete_draft(payload)
      strict_keys!(payload, %w[orderId])
      order = order!(payload.fetch("orderId"))
      raise ValidationError, "Eliminazione consentita soltanto alle bozze agente." unless order["status"] == "DRAFT"
      data.fetch("orders").delete(order)
    end

    def save_verification(payload)
      strict_keys!(payload, %w[orderId])
      order = order!(payload.fetch("orderId"))
      inbox!(order)["verificationSaved"] = true
    end

    def resolve_request(payload)
      strict_keys!(payload, %w[orderId requestId productId quantity unit])
      order = order!(payload.fetch("orderId"))
      request = request!(order, payload.fetch("requestId"))
      product = product!(payload.fetch("productId"))
      line = make_line(order, product, payload.fetch("quantity"), payload.fetch("unit"), "#{request.fetch('id')}-LINE", request.fetch("id"))
      others = order.fetch("lines").select { |item| item["whatsappRequestId"] != request["id"] && item["productId"] == product["id"] }
      qty = others.sum { |item| Calculations.scaled(calculate_line(product, item).fetch("baseQuantity")) } + Calculations.scaled(line.fetch("baseQuantity"))
      if qty > Calculations.scaled(stock(product["id"], order["warehouseId"]))
        raise ValidationError, "Quantità superiore alla disponibilità nello stesso deposito."
      end
      order["lines"].reject! { |item| item["whatsappRequestId"] == request["id"] }
      order["lines"] << line
      request.merge!("status" => "RESOLVED", "productId" => product.fetch("id"),
                     "resolution" => { "productId" => product.fetch("id"), "quantity" => line.fetch("quantity"), "unit" => line.fetch("unit") })
      phrase = Calculations.normalize_search(request.fetch("rawText"))
      data.fetch("learnedMappings").reject! { |mapping| mapping["customerId"] == order["customerId"] && mapping["phrase"] == phrase }
      data.fetch("learnedMappings") << { "customerId" => order.fetch("customerId"), "phrase" => phrase, "productId" => product.fetch("id") }
      recalc(order)
    end

    def exclude_request(payload)
      strict_keys!(payload, %w[orderId requestId reason])
      order = order!(payload.fetch("orderId"))
      request = request!(order, payload.fetch("requestId"))
      reason = text!(payload.fetch("reason"), "Motivo", required: true)
      request.merge!("status" => "EXCLUDED", "resolution" => { "reason" => reason.strip })
      order["lines"].reject! { |item| item["whatsappRequestId"] == request["id"] }
      recalc(order)
    end

    def confirm_order(payload)
      strict_keys!(payload, [ "orderId" ] + REVIEW_FIELDS)
      order = order!(payload.fetch("orderId"), editable: false)
      return if %w[PENDING_SEND SENT].include?(order["status"])
      save_review(payload) if (payload.keys & REVIEW_FIELDS).any?
      errors = order_errors(order)
      raise ValidationError.new("Ordine non confermabile.", details: errors) if errors.any?
      order["lines"] = order.fetch("lines").map { |line| calculate_line(product!(line.fetch("productId")), line) }
      recalc(order)
      order["status"] = "PENDING_SEND"
      enqueue("ORDER", order.fetch("id"), "SEND_ORDER", once: true)
    end

    def enqueue(entity_type, entity_id, operation, once: false)
      key = "#{operation}:#{entity_id}#{once ? ':1' : ''}"
      old = data.fetch("syncQueue").find { |job| job["idempotencyKey"] == key }
      if old
        old["status"] = "WAITING_NETWORK" unless once
      else
        data.fetch("syncQueue") << { "id" => once ? "SYNC-#{entity_id}" : key, "entityType" => entity_type, "entityId" => entity_id, "operation" => operation,
          "idempotencyKey" => key, "status" => "WAITING_NETWORK", "attempts" => 0 }
      end
    end

    def upsert_contact(payload)
      strict_keys!(payload, %w[id customerId firstName lastName role phoneDisplay email whatsappEnabled])
      customer!(payload.fetch("customerId"))
      id = id!(payload.fetch("id"))
      old = data.fetch("contacts").find { |item| item["id"] == id }
      raise Forbidden, "Il referente appartiene a un altro cliente." if old && old["customerId"] != payload["customerId"]
      contact = { "id" => id, "customerId" => payload.fetch("customerId"), "synthetic" => true,
                  "whatsappActivationStatus" => "PENDING_SYNC", "whatsappEnabled" => boolean!(payload.fetch("whatsappEnabled")),
                  "email" => text!(payload.fetch("email", old ? old.fetch("email") : "referente@example.invalid"), "Email", max: 254) }
      %w[firstName lastName role phoneDisplay].each { |key| contact[key] = text!(payload.fetch(key), key, required: true, max: 200) }
      old ? old.replace(contact) : data.fetch("contacts").push(contact)
      enqueue("CONTACT", id, "UPSERT_CONTACT")
    end

    def share_simulated(payload)
      strict_keys!(payload, %w[id customerId channel recipient overdue])
      customer!(payload.fetch("customerId"))
      id = id!(payload.fetch("id"))
      raise ValidationError, "Simulazione già presente." if data.fetch("shareJobs").any? { |item| item["id"] == id }
      channel = payload.fetch("channel")
      raise ValidationError, "Canale non valido." unless %w[WHATSAPP EMAIL DOWNLOAD].include?(channel)
      recipient = find!("contacts", payload.fetch("recipient"))
      raise Forbidden, "Destinatario di un altro cliente." unless recipient["customerId"] == payload["customerId"]
      data.fetch("shareJobs") << { "id" => id, "customerId" => payload.fetch("customerId"), "channel" => channel,
        "recipient" => recipient.fetch("id"), "overdue" => boolean!(payload.fetch("overdue")), "status" => "WAITING_NETWORK" }
      enqueue("SHARE", id, "SHARE_SIMULATED")
    end

    def mark_insights_reviewed(payload)
      strict_keys!(payload, %w[customerId])
      customer!(payload.fetch("customerId"))
      data.fetch("insights").select { |item| item["customerId"] == payload["customerId"] }.each { |item| item["status"] = "REVIEWED" }
    end

    def set_demo_network(payload)
      strict_keys!(payload, %w[online])
      state["network"] = boolean!(payload.fetch("online")) ? "SYNCING" : "OFFLINE"
    end

    def sync_demo(payload)
      strict_keys!(payload, [])
      return if state["network"] == "OFFLINE"
      data.fetch("syncQueue").select { |job| job["status"] == "WAITING_NETWORK" }.each do |job|
        case job.fetch("operation")
        when "SEND_ORDER"
          order = order!(job.fetch("entityId"), editable: false)
          raise ValidationError, "Job con ordine non confermato." unless %w[PENDING_SEND SENT].include?(order["status"])
          order.merge!("status" => "SENT", "sentAt" => clock, "updatedAt" => clock) if order["status"] == "PENDING_SEND"
        when "UPSERT_CONTACT"
          contact = find!("contacts", job.fetch("entityId"))
          customer!(contact.fetch("customerId"))
          contact["whatsappActivationStatus"] = contact["whatsappEnabled"] ? "ACTIVE" : "DISABLED"
        when "SHARE_SIMULATED"
          share = find!("shareJobs", job.fetch("entityId"))
          customer!(share.fetch("customerId"))
          share["status"] = "DONE"
        else raise ValidationError, "Operazione di sincronizzazione non supportata."
        end
        job["status"] = "DONE"
        job["attempts"] += 1
      end
      state["network"] = "ONLINE"
      state["lastSyncAt"] = clock
    end

    def reset_demo(payload)
      strict_keys!(payload, [])
      @state = Seed.initial_state
      @data = @state.fetch("data")
    end
  end
end
