module Amelia3
  class SubstitutionReview
    def self.call(tenant:)
      new(tenant).call
    end

    def initialize(tenant)
      @tenant = tenant
    end

    def call(resolve: true)
      run = @tenant.reload.active_alert_run
      return unless run && run.batch_id == @tenant.active_batch_id && run.profile_set
      products = Product.where(batch_id: run.batch_id).pluck(:external_code, :name).to_h
      extras = @tenant.feed_snapshot&.products&.index_by(&:product_code) || {}
      tasks = []
      # The historical profile, not today's venue snapshot, supplies positive delivered purchases.
      run.items.where(status: "active", rule_type: "USUAL_PRODUCT_MISSING").group_by(&:customer_code).each do |customer, items|
        profile = run.profile_set.profiles.find_by(customer_code: customer)
        next unless profile
        kept = 0
        items.sort_by { |row| [ -Rational(row.severity_numerator, row.severity_denominator), -row.evidence["daysSinceLast"], row.product_code ] }.each do |item|
          last = Date.iso8601(item.evidence.fetch("lastDelivery"))
          recent_from = [ run.as_of - item.evidence.fetch("thresholdDays"), run.as_of.prev_month(6) ].max
          eligible = profile.product_dates.filter_map do |code, dates|
            next if code == item.product_code
            purchase = dates.select { |value| value > last.iso8601 && value >= recent_from.iso8601 && value < run.as_of.iso8601 }.max
            next unless purchase
            { "code" => code, "name" => products[code].to_s, "category" => extras[code]&.search_data&.fetch("category_1_name", nil), "purchasedOn" => purchase }
          end
          result = if products[item.product_code].blank? || eligible.any? { |row| row["name"].blank? }
            ProductMatching::Result.new(codes: [], status: "pending", method: "catalog_incomplete")
          else
            task = { query: products.fetch(item.product_code), candidates: eligible.map { |row| row.except("purchasedOn") } }
            outcome = ProductMatching.call(tenant: @tenant, **task, mode: "substitution", defer: resolve)
            tasks << task if outcome.status == "pending"
            outcome
          end
          status = result.status == "pending" ? "pending" : result.codes.any? ? "suppressed" : "kept"
          kept += 1 if status == "kept"
          status = "limited" if status == "kept" && kept > 5
          row = AlertReview.find_or_initialize_by(alert_item: item)
          row.update!(status: status, evidence: { "version" => ProductMatching::VERSION, "method" => result.method,
            "substitutes" => eligible.select { |candidate| result.codes.include?(candidate["code"]) }.map { |candidate| candidate.slice("code", "purchasedOn") },
            "lastPurchaseOfOriginal" => last.iso8601, "recentFrom" => recent_from.iso8601, "source" => "STORICO.csv" })
        end
      end
      if resolve && tasks.any?
        ProductMatching.resolve_batch(tenant: @tenant, tasks: tasks)
        return call(resolve: false)
      end
      AlertReview.where(alert_item_id: run.items.select(:id)).group(:status).count
    end
  end
end
