module Amelia3
  class Quote
    attr_reader :product, :customer, :stock, :price, :conditions, :unit, :unit_contract

    def initialize(product:, customer: nil, stock: nil, price: nil, conditions: [], unit: nil, verification: nil)
      @product, @customer, @stock, @price, @conditions = product, customer, stock, price, conditions
      @unit_contract = UnitContract.new(product, verification)
      @unit = unit || unit_contract.canonical["preferredUm"]
    end

    def terms
      @terms ||= unit_contract.for(unit, stock)
    end

    def condition
      active = conditions.select { |row| row.valid_from <= Time.zone.today && row.valid_to >= Time.zone.today }
      raise Error.new("Condizioni sovrapposte: prezzo non attestato.", code: "AMBIGUOUS_PRICE") if active.length > 1
      active.first
    end

    def exact_unit_price
      return nil if terms["reason"]
      return nil unless price&.valid_price && price.amount&.positive?
      return nil unless (price.amount * 1_000_000).frac.zero?
      personal = condition
      amount = personal&.price || price.amount
      discount = personal&.discount || BigDecimal("0")
      return nil unless amount.positive? && discount.between?(0, 100)
      return nil unless (amount * 1_000_000).frac.zero? && (discount * 10_000).frac.zero?
      return nil if personal&.price.present? && discount.positive?
      factor = personal&.price ? terms["personalPriceFactor"] : terms["priceFactor"]
      return nil unless factor
      amount.to_r * (1 - discount.to_r / 100) * ExactValue.from_wire(factor)
    end

    def unit_price
      value = exact_unit_price
      value && BigDecimal(ExactValue.text(value))
    end

    def step
      terms["quantityStep"] && terms["quantityStep"] != "any" ? BigDecimal(terms["quantityStep"]) : nil
    end

    def available
      terms["available"] && ExactValue.from_wire(terms["available"])
    end

    def unavailable_reason
      return "Cliente bloccato" if customer&.blocked
      return "Articolo bloccato" if product.blocked
      assigned_list = customer&.source_fields&.fetch("cod_lis", nil).presence
      return "Listino cliente #{assigned_list}: applicazione del prezzo da verificare" if assigned_list && assigned_list != "000"
      return terms["reason"] if terms["reason"]
      return "Prezzo 000 o personalizzazione non validi o non attestati" unless exact_unit_price&.positive?
      nil
    rescue Error => error
      error.message
    end

    def validate_quantity!(quantity)
      reason = unavailable_reason
      raise Error.new(reason, code: "NOT_ORDERABLE") if reason
      value = quantity.to_r
      compatible = terms["quantityStep"] == "any" || step && (value / step.to_r).denominator == 1
      unless value.positive? && value <= 100_000 && compatible && value <= available
        raise Error.new("Quantità non valida per divisibilità o disponibilità attestata.", code: "INVALID_QUANTITY")
      end
    end

    def line(id:, quantity:)
      validate_quantity!(quantity)
      amount = exact_unit_price
      { "id" => id, "productId" => product.external_code, "name" => product.name,
        "unit" => unit, "quantity" => quantity.to_s("F"), "unitPrice" => ExactValue.text(amount), "exactUnitPrice" => ExactValue.wire(amount),
        "lineNetCents" => ExactValue.cents(quantity, amount),
        "priceSnapshot" => terms.except("available", "maxQuantity", "reason", "status").merge(
          "batchId" => product.batch_id, "batchFingerprint" => product.batch.fingerprint, "listCode" => "000", "basePrice" => price.amount.to_s("F"),
          "discount" => (condition&.discount || BigDecimal("0")).to_s("F"), "conditionRow" => condition&.source_row, "pricedAt" => Time.current.iso8601) }
    end

    def wire
      reason = unavailable_reason
      terms.merge("reason" => reason, "status" => customer&.blocked || product.blocked ? "BLOCKED_BY_SOURCE" : reason ? "QUOTE_NEEDS_EVIDENCE" : terms["status"])
    end

    def validate_saved!(line)
      unless line.dig("priceSnapshot", "conversionVersion") == terms["conversionVersion"] && line["unit"] == unit
        raise Error.new("Regole UM aggiornate: conserva la riga e verifica la conversione prima di modificarla o confermarla.", code: "CONVERSION_CHANGED", status: 409)
      end
    end

    def self.for(scope, product, customer = nil, unit: nil)
      verifications = UnitVerification.where(tenant: scope.tenant, active: true).to_a
      new(product: product, customer: customer, unit: unit, verification: UnitVerification.for_product(product, verifications),
          stock: Stock.find_by(batch_id: scope.batch_id, product_code: product.external_code),
          price: Price.find_by(batch_id: scope.batch_id, product_code: product.external_code, list_code: "000"),
          conditions: customer ? Condition.where(batch_id: scope.batch_id, product_code: product.external_code, customer_code: customer.external_code).to_a : [])
    end
  end
end
