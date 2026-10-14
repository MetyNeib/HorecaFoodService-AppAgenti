require "digest"

module Amelia3
  class UnitContract
    VERSION = "AMELIA3-QUOTE-v2".freeze
    attr_reader :product, :verification, :canonical

    def initialize(product, verification)
      @product, @verification = product, verification
      @canonical = CanonicalUnits.for(product)
    end

    def conversion_version
      Digest::SHA256.hexdigest(JSON.generate([ VERSION, canonical, verification&.id, verification&.version, verification&.contract,
        product.pieces_per_pack&.to_s("F"), product.packs_per_case&.to_s("F"), product.weight_per_pack&.to_s("F") ]))
    end

    def for(unit, stock)
      result = { "unit" => unit, "conversionVersion" => conversion_version, "contractVersion" => VERSION,
                 "evidenceId" => verification&.id&.to_s, "status" => "QUOTE_NEEDS_EVIDENCE" }
      return result.merge("reason" => canonical["reason"]) if canonical["reason"]
      return result.merge("reason" => "UM non prevista dalla mappa certificata") unless canonical["orderableUms"].include?(unit)
      return result.merge("reason" => "Unità prezzo listino 000, giacenza e passo da verificare con Amelia3") unless verification
      rules = verification.contract
      price_unit = resolved(rules.fetch("priceUnit"))
      stock_field = rules.fetch("primaryStockField")
      stock_unit = rules.fetch("stockFields").fetch(stock_field)
      if stock&.public_send(stock_field).nil?
        # A missing representation may use another explicitly attested, convertible
        # channel. Zero/negative values never trigger this fallback.
        alternative = rules.fetch("stockFields").find do |field, raw_unit|
          field != stock_field && stock&.public_send(field)&.positive? && ratio(raw_unit, stock_unit)
        end
        stock_field, stock_unit = alternative if alternative
      end
      price_factor = ratio(unit, price_unit)
      stock_factor = ratio(stock_unit, unit)
      step = step_for(unit)
      return result.merge("reason" => "Fattore di conversione prezzo, giacenza o divisibilità non attestato") unless price_factor && stock_factor && step
      quantity = stock&.public_send(stock_field)
      return result.merge("reason" => "Giacenza autorevole non disponibile") unless quantity&.positive?
      rules.fetch("stockFields").each do |field, raw_unit|
        comparable = ratio(raw_unit, stock_unit)
        next unless comparable
        other = stock&.public_send(field)
        next if other.nil?
        return result.merge("reason" => "Giacenze confrontabili discordanti o mancanti") unless other.to_r * comparable == quantity.to_r
      end
      available = quantity.to_r * stock_factor
      personal_unit = resolved(rules["personalPriceUnit"])
      result.merge("priceUnit" => price_unit, "priceFactor" => ExactValue.wire(price_factor),
        "personalPriceUnit" => personal_unit, "personalPriceFactor" => personal_unit && ratio(unit, personal_unit) && ExactValue.wire(ratio(unit, personal_unit)),
        "stockUnit" => stock_unit, "stockField" => stock_field, "stockQuantity" => quantity.to_s("F"),
        "stockFactor" => ExactValue.wire(stock_factor), "available" => ExactValue.wire(available),
        "quantityStep" => step == "any" ? "any" : ExactValue.text(step), "maxQuantity" => ExactValue.text(step == "any" ? available : (available / step).floor * step),
        "status" => price_factor == 1 && stock_factor == 1 ? "QUOTE_VERIFIED_DIRECT" : "QUOTE_VERIFIED_CONVERTED",
        "reason" => step != "any" && available < step ? "Giacenza insufficiente per quantità minima" : nil)
    end

    def ratio(from, to)
      return Rational(1) if from == to && CanonicalUnits::KINDS.key?(from)
      visited = [ from ]
      queue = [ [ from, Rational(1) ] ]
      until queue.empty?
        current, factor = queue.shift
        graph.fetch(current, {}).each do |next_unit, multiplier|
          next if visited.include?(next_unit)
          value = factor * multiplier
          return value if next_unit == to
          visited << next_unit
          queue << [ next_unit, value ]
        end
      end
      nil
    end

    private

    def resolved(value)
      value == "base" ? canonical["pricingCandidateUm"] : value
    end

    def step_for(unit)
      raw = verification.contract.fetch("steps")[unit]
      return nil unless raw
      step = raw == "any" ? nil : ExactValue.fraction(raw)
      [ [ product.pack_indivisible, "CONF" ], [ product.case_indivisible, "COLL" ] ].each do |required, target|
        next unless required
        factor = ratio(unit, target)
        return nil unless factor&.positive?
        multiple = 1 / factor
        step = step ? Rational(step.numerator.lcm(multiple.numerator), step.denominator.gcd(multiple.denominator)) : multiple
      end
      step || "any"
    end

    def graph
      @graph ||= begin
        result = {}
        rules = verification&.contract || {}
        { "piecesPerPack" => [ "CONF", "PZ", product.pieces_per_pack ],
          "packsPerCase" => [ "COLL", "CONF", product.packs_per_case ],
          "weightPerPack" => [ "CONF", "KG", product.weight_per_pack ] }.each do |key, (from, to, raw)|
          next unless Array(rules["verifiedFactors"]).include?(key) && raw&.positive?
          next if key == "weightPerPack" && rules["fixedWeight"] != true
          next if key != "weightPerPack" && !raw.frac.zero?
          factor = raw.to_r
          (result[from] ||= {})[to] = factor
          (result[to] ||= {})[from] = 1 / factor
        end
        result
      end
    end
  end
end
