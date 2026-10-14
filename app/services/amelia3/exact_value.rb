module Amelia3
  module ExactValue
    def self.fraction(value)
      return value if value.is_a?(Rational)
      value.is_a?(BigDecimal) ? value.to_r : Rational(value.to_s)
    rescue ArgumentError, TypeError, ZeroDivisionError
      raise Error.new("Valore decimale non valido.", code: "INVALID_DECIMAL")
    end

    def self.wire(value)
      number = fraction(value)
      { "n" => number.numerator.to_s, "d" => number.denominator.to_s }
    end

    def self.from_wire(value)
      raise Error.new("Rapporto non valido.", code: "INVALID_DECIMAL") unless value.is_a?(Hash) && value.keys.sort == %w[d n] && value.values.all? { |part| part.is_a?(String) && part.match?(/\A\d{1,100}\z/) }
      Rational(Integer(value.fetch("n"), 10), Integer(value.fetch("d"), 10))
    rescue ZeroDivisionError
      raise Error.new("Rapporto non valido.", code: "INVALID_DECIMAL")
    end

    # This decimal is presentation only. Totals and comparisons use the fraction.
    def self.text(value, scale: 12)
      number = fraction(value)
      scaled = (number * (10**scale) + Rational(1, 2)).floor
      whole, decimals = scaled.divmod(10**scale)
      tail = decimals.to_s.rjust(scale, "0").sub(/0+\z/, "")
      "#{whole}.#{tail.presence || '0'}"
    end

    def self.cents(quantity, price)
      result = (fraction(quantity) * fraction(price) * 100 + Rational(1, 2)).floor
      unless result.between?(0, Hfs::Calculations::MAX_SAFE_INTEGER)
        raise Error.new("Totale fuori intervallo.", code: "INVALID_AMOUNT")
      end
      result
    end
  end
end
