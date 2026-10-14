module Amelia3
  class SalesAlertRules
    VERSION = "HFS-AMELIA3-SALES-ALERTS-SUBSTITUTION-v3".freeze
    TYPES = %w[CUSTOMER_STOPPED USUAL_PRODUCT_MISSING PURCHASE_FREQUENCY_DROP].freeze
    REACTIVATION = "CUSTOMER_REACTIVATION".freeze
    ALL_TYPES = (TYPES + [ REACTIVATION ]).freeze

    def self.call(product_dates:, as_of:, blocked_products: [], missing_limit: 5)
      new(product_dates, as_of, blocked_products).call(missing_limit: missing_limit)
    end

    def initialize(product_dates, as_of, blocked_products)
      @date = as_of
      historical = product_dates.transform_values { |dates| dates.map { |value| Date.iso8601(value) }.uniq.sort.select { |date| date < as_of } }
      @last_purchase = historical.values.filter_map(&:last).max
      @products = historical.transform_values { |dates| dates.select { |date| date >= as_of.prev_year } }.reject { |_, dates| dates.empty? }
      @dates = @products.values.flatten.uniq.sort
      @blocked = blocked_products.to_set
    end

    def call(missing_limit: 5)
      if @last_purchase && (elapsed = (@date - @last_purchase).to_i) > 90
        return [ { rule_type: REACTIVATION, product_code: "", severity_numerator: elapsed, severity_denominator: 90, days_late: elapsed - 90,
                   evidence: { "lastDelivery" => @last_purchase.iso8601, "daysSinceLast" => elapsed, "thresholdDays" => 90 } } ]
      end
      return [] if @dates.empty?
      if @dates.length >= 4 && (@dates.last - @dates.first).to_i >= 45
        stopped = cadence("CUSTOMER_STOPPED", @dates, 21)
        return [ stopped ] if stopped
      end
      missing = @products.filter_map do |code, dates|
        next if @blocked.include?(code) || dates.length < 5 || dates.map { |date| [ date.year, date.month ] }.uniq.length < 2
        next if (@date - dates.last).to_i > 180 || @dates.last <= dates.last
        cadence("USUAL_PRODUCT_MISSING", dates, 30, code)
      end
      missing.sort_by! { |row| [ -Rational(row[:severity_numerator], row[:severity_denominator]), -row[:evidence]["daysSinceLast"], row[:product_code] ] }
      result = missing_limit ? missing.take(missing_limit) : missing
      prior = @dates.count { |date| date >= @date - 240 && date < @date - 60 }
      recent = @dates.count { |date| date >= @date - 60 }
      if prior >= 9 && recent >= 1 && recent * 6 <= prior && prior - recent * 3 >= 6
        result << { rule_type: "PURCHASE_FREQUENCY_DROP", product_code: "", severity_numerator: prior - recent * 3, severity_denominator: prior,
                    days_late: 0, evidence: { "priorDates" => prior, "recentDates" => recent, "expectedRecent" => { "n" => prior, "d" => 3 },
                                            "decline" => { "n" => prior - recent * 3, "d" => prior }, "lastDelivery" => @dates.last.iso8601,
                                            "priorFrom" => (@date - 240).iso8601, "recentFrom" => (@date - 60).iso8601 } }
      end
      result
    end

    private

    def cadence(type, dates, minimum, product = "")
      gaps = dates.each_cons(2).map { |first, last| (last - first).to_i }.sort
      middle = gaps.length / 2
      median = gaps.length.odd? ? Rational(gaps[middle]) : Rational(gaps[middle - 1] + gaps[middle], 2)
      threshold = [ minimum, (median * Rational(5, 2)).ceil ].max
      elapsed = (@date - dates.last).to_i
      return if elapsed < threshold
      { rule_type: type, product_code: product, severity_numerator: elapsed, severity_denominator: threshold, days_late: elapsed - threshold,
        evidence: { "datesCount" => dates.length, "firstDelivery" => dates.first.iso8601, "lastDelivery" => dates.last.iso8601,
                    "medianDays" => { "n" => median.numerator, "d" => median.denominator }, "thresholdDays" => threshold,
                    "daysSinceLast" => elapsed, "daysLate" => elapsed - threshold } }
    end
  end
end
