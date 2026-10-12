module Amelia3
  class Quote
    attr_reader :product, :customer, :stock, :price, :conditions

    def initialize(product:, customer: nil, stock: nil, price: nil, conditions: [])
      @product, @customer, @stock, @price, @conditions = product, customer, stock, price, conditions
    end

    def condition
      active = conditions.select { |row| row.valid_from <= Time.zone.today && row.valid_to >= Time.zone.today }
      raise Error.new("Condizioni sovrapposte: prezzo non attestato.", code: "AMBIGUOUS_PRICE") if active.length > 1
      active.first
    end

    def unit_price
      return nil unless price&.valid_price && price.amount&.positive?
      return nil unless (price.amount * 1_000_000).frac.zero?
      personal = condition
      amount = personal&.price || price.amount
      discount = personal&.discount || BigDecimal("0")
      return nil unless amount.positive? && discount.between?(0, 100)
      return nil unless (amount * 1_000_000).frac.zero? && (discount * 10_000).frac.zero?
      return nil if personal&.price.present? && discount.positive?
      amount * (1 - discount / 100)
    end

    def step
      return nil unless product.base_unit == "P" && product.order_unit == "P"
      value = BigDecimal("1")
      if product.pack_indivisible || product.case_indivisible
        pack = product.pieces_per_pack
        return nil unless pack&.positive? && pack.frac.zero?
        value = pack
      end
      if product.case_indivisible
        cases = product.packs_per_case
        return nil unless cases&.positive? && cases.frac.zero?
        value *= cases
      end
      value
    end

    def unavailable_reason
      return "Cliente bloccato" if customer&.blocked
      return "Articolo bloccato" if product.blocked
      return "UM o conversione non attestata" unless step
      return "Prezzo 000 o personalizzazione non validi" unless unit_price&.positive?
      return "Giacenza in pz non disponibile" unless stock&.pieces&.positive?
      nil
    rescue Error => error
      error.message
    end

    def validate_quantity!(quantity)
      reason = unavailable_reason
      raise Error.new(reason, code: "NOT_ORDERABLE") if reason
      unless quantity.positive? && quantity <= 100_000 && (quantity % step).zero? && quantity <= stock.pieces
        raise Error.new("Quantità non valida per divisibilità o disponibilità attestata.", code: "INVALID_QUANTITY")
      end
    end

    def line(id:, quantity:)
      validate_quantity!(quantity)
      amount = unit_price
      { "id" => id, "productId" => product.external_code, "name" => product.name,
        "unit" => "P", "quantity" => quantity.to_s("F"), "unitPrice" => amount.to_s("F"),
        "lineNetCents" => (quantity * amount * 100).round(0, BigDecimal::ROUND_HALF_UP).to_i,
        "priceSnapshot" => { "batchId" => product.batch_id, "listCode" => "000", "basePrice" => price.amount.to_s("F"),
          "discount" => (condition&.discount || BigDecimal("0")).to_s("F"), "conditionRow" => condition&.source_row, "pricedAt" => Time.current.iso8601 } }
    end

    def self.for(scope, product, customer = nil)
      new(product: product, customer: customer,
          stock: Stock.find_by(batch_id: scope.batch_id, product_code: product.external_code),
          price: Price.find_by(batch_id: scope.batch_id, product_code: product.external_code, list_code: "000"),
          conditions: customer ? Condition.where(batch_id: scope.batch_id, product_code: product.external_code, customer_code: customer.external_code).to_a : [])
    end
  end
end
