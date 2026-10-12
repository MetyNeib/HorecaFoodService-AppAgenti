require "bigdecimal"
require "date"

module Hfs
  # Integer arithmetic and explicit demo dates keep Ruby and offline JavaScript equivalent.
  module Calculations
    MAX_SAFE_INTEGER = 9_007_199_254_740_991
    module_function

    def integer(value, label = "Importo")
      unless value.is_a?(Integer) && value.abs <= MAX_SAFE_INTEGER
        raise ValidationError, "#{label}: richiesto intero sicuro."
      end
      value
    end

    def scaled(value, label = "Quantità")
      raise ValidationError, "#{label}: valore non valido." unless value.is_a?(Numeric) && value.finite? && value >= 0
      decimal = BigDecimal(value.to_s) * 1000
      raise ValidationError, "#{label}: massimo 3 decimali." unless decimal.frac.zero?
      integer(decimal.to_i, label)
    end

    def half_up(numerator, denominator)
      raise ValidationError, "Divisore non valido." unless denominator.positive?
      sign = numerator.negative? ? -1 : 1
      integer(sign * ((numerator.abs * 2 + denominator) / (denominator * 2)))
    end

    def base_quantity(product, quantity, unit_code)
      code = unit_code == "COLLI" ? "CT" : unit_code
      unit = product.fetch("units").find { |entry| entry["code"] == code }
      raise ValidationError, "Unità non disponibile per il prodotto." unless unit
      qty = scaled(quantity)
      step = scaled(unit.fetch("step"), "Step")
      unless qty.positive? && step.positive? && (qty % step).zero?
        raise ValidationError, "Quantità incompatibile con lo step della unità."
      end
      converted = qty * scaled(unit.fetch("factorToBase"), "Fattore")
      raise ValidationError, "Conversione con più di 3 decimali: confermare quantità." unless (converted % 1000).zero?
      { "quantity" => integer(converted / 1000) / 1000.0, "estimated" => unit.fetch("estimated") }
    end

    def amounts(net, cost)
      integer(net, "Ricavo")
      integer(cost, "Costo")
      margin = integer(net - cost, "Margine")
      { "netCents" => net, "costCents" => cost, "marginCents" => margin,
        "marginPercent" => net.zero? ? nil : half_up(margin * 10_000, net) / 100.0 }
    end

    def line_amounts(base, price, cost, gift = false)
      qty = scaled(base, "Quantità base")
      integer(price, "Prezzo")
      integer(cost, "Costo")
      raise ValidationError, "Prezzo e costo non possono essere negativi." if price.negative? || cost.negative?
      amounts(gift ? 0 : half_up(qty * price, 1000), half_up(qty * cost, 1000))
    end

    def sum_amounts(lines)
      amounts(lines.sum { |line| line.fetch("netCents") }, lines.sum { |line| line.fetch("costCents") })
    end

    def day(value)
      raise ValidationError, "Data ISO richiesta." unless value.is_a?(String) && value.match?(/\A\d{4}-\d{2}-\d{2}(?:T.*)?\z/)
      Date.iso8601(value[0, 10]).iso8601
    rescue Date::Error
      raise ValidationError, "Data non valida."
    end

    def condition_active?(condition, date)
      value = day(date)
      (!condition["validFrom"] || condition["validFrom"] <= value) &&
        (!condition["validTo"] || condition["validTo"] >= value)
    end

    def list_price(data, product, list_id)
      item = data.fetch("priceListItems").find { |entry| entry["productId"] == product["id"] && entry["priceListId"] == list_id }
      item ? item.fetch("unitPriceBaseCents") : product.fetch("standardPriceBaseCents")
    end

    def resolve_price(data, customer, product, date)
      active = data.fetch("customerConditions").select do |condition|
        condition["customerId"] == customer["id"] && condition["productId"] == product["id"] && condition_active?(condition, date)
      end
      raise ValidationError, "Condizioni sovrapposte: risolvere esplicitamente." if active.length > 1
      condition = active.first
      unless condition
        return { "unitPriceBaseCents" => list_price(data, product, customer.fetch("defaultPriceListId")),
                 "source" => "CUSTOMER_LIST", "conditionId" => nil }
      end
      reference = list_price(data, product, condition["priceListId"] || customer.fetch("defaultPriceListId"))
      price = case condition.fetch("type")
      when "FIXED_PRICE" then integer(condition["unitPriceBaseCents"], "Prezzo condizione")
      when "DISCOUNT" then discount_price(reference, condition["discountBasisPoints"])
      when "PRICE_LIST" then reference
      else raise ValidationError, "Tipo condizione sconosciuto."
      end
      raise ValidationError, "Prezzo negativo." if price.negative?
      { "unitPriceBaseCents" => price, "source" => condition.fetch("type"), "conditionId" => condition.fetch("id") }
    end

    def discount_price(reference, basis_points)
      integer(basis_points, "Sconto")
      raise ValidationError, "Sconto non valido." unless (0..10_000).cover?(basis_points)
      half_up(integer(reference) * (10_000 - basis_points), 10_000)
    end

    def normalize_search(value)
      value.to_s.unicode_normalize(:nfd).gsub(/\p{Mn}/, "").downcase.gsub(/\s+/, " ").strip
    end

    def home_counts(data, agent_id, customer_ids)
      orders = data.fetch("orders").select { |order| order["agentId"] == agent_id && customer_ids.include?(order["customerId"]) }
      { "drafts" => "DRAFT", "pending" => "PENDING_SEND", "sent" => "SENT", "whatsapp" => "WHATSAPP_REVIEW" }
        .transform_values { |status| orders.count { |order| order["status"] == status } }
    end

    def receivables_summary(data, customer_id, date)
      balance = overdue = received = 0
      data.fetch("receivables").select { |row| row["customerId"] == customer_id }.each do |row|
        paid = data.fetch("payments").select { |payment| payment["receivableId"] == row["id"] }.sum { |payment| payment.fetch("amountCents") }
        residual = row.fetch("faceValueCents") - paid
        balance += residual
        received += paid
        overdue += residual if residual.positive? && row.fetch("dueDate") < day(date)
      end
      { "balanceCents" => balance, "overdueCents" => overdue, "receivedCents" => received }
    end
  end
end
