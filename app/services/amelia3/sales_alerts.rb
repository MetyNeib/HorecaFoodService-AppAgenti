require "digest"

module Amelia3
  class SalesAlerts
    Result = Struct.new(:run, :metrics, keyword_init: true)

    def self.call(tenant:, as_of: Time.find_zone!("Europe/Rome").today, source: "development", full: false)
      new(tenant, as_of, source, full).call
    end

    def initialize(tenant, as_of, source, full)
      @tenant, @date, @source, @full = tenant, as_of, source, full
    end

    def call
      ApplicationRecord.connection_pool.with_connection do |connection|
        key = 730_000_000 + @tenant.id
        raise Error.new("Importazione o calcolo già in corso.", code: "IMPORT_BUSY", status: 409) unless connection.select_value("SELECT pg_try_advisory_lock(#{key})")
        begin
          calculate
        ensure
          connection.execute("SELECT pg_advisory_unlock(#{key})")
        end
      end
    end

    private

    def calculate
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      batch = @tenant.reload.active_batch
      raise Error.new("Nessun batch disponibile.", code: "NO_BATCH") unless batch
      identity = { tenant: @tenant, batch: batch, as_of: @date, rules_version: SalesAlertRules::VERSION }
      run = AlertRun.find_by(identity)
      if run&.status == "published" && !@full
        return Result.new(run: run, metrics: { "mode" => "idempotent", "sourceRowsScanned" => 0, "profilesEvaluated" => 0 })
      end
      run ||= AlertRun.create!(**identity, source: @source)
      profiles, metrics = HistoryProfiles.prepare(batch, force_scan: @full)
      metrics = metrics.merge("profilesEvaluated" => 0, "evaluationsReused" => 0, "full" => @full)
      customers = Customer.where(batch_id: batch.id).pluck(:external_code, :blocked).to_h
      blocked = Product.where(batch_id: batch.id, blocked: true).pluck(:external_code).to_set
      items = []
      profiles.profiles.find_each do |profile|
        next unless customers.key?(profile.customer_code)
        blocked_codes = (profile.product_dates.keys.to_set & blocked).to_a.sort
        key = Digest::SHA256.hexdigest(JSON.generate([ SalesAlertRules::VERSION, @date.iso8601, profile.digest, blocked_codes ]))
        cached = AlertEvaluation.find_by(tenant: @tenant, evaluation_key: key)
        if cached && !@full
          outcomes = cached.outcomes
          metrics["evaluationsReused"] += 1
        else
          outcomes = SalesAlertRules.call(product_dates: profile.product_dates, as_of: @date, blocked_products: blocked_codes, missing_limit: nil).map(&:stringify_keys)
          metrics["profilesEvaluated"] += 1
          raise Error.new("Cache alert discordante dal calcolo completo.", code: "ALERT_CACHE_MISMATCH") if cached && cached.outcomes != outcomes
          AlertEvaluation.create!(tenant: @tenant, evaluation_key: key, outcomes: outcomes) unless cached
        end
        outcomes.each do |outcome|
          next if customers[profile.customer_code] && outcome["rule_type"] != SalesAlertRules::REACTIVATION
          items << outcome.merge("customer_code" => profile.customer_code, "run_id" => run.id, "status" => "active")
        end
      end
      items.sort_by! { |row| row.values_at("customer_code", "rule_type", "product_code") }
      canonical = items.map { |row| canonical_json(row.except("run_id")) }
      digest = Digest::SHA256.hexdigest(JSON.generate(canonical))
      metrics["counts"] = SalesAlertRules::ALL_TYPES.to_h { |type| [ type, items.count { |row| row["rule_type"] == type } ] }
      metrics["customers"] = items.map { |row| row["customer_code"] }.uniq.length
      metrics["resultDigest"] = digest
      active_keys = items.map { |row| row.values_at("rule_type", "customer_code", "product_code") }.to_set
      previous = run.status == "published" ? AlertRun.find_by(id: run.metrics["previousRunId"], tenant: @tenant) : @tenant.active_alert_run
      resolved = previous ? previous.items.where(status: "active").reject { |row| active_keys.include?([ row.rule_type, row.customer_code, row.product_code ]) }.map do |row|
        row.attributes.except("id", "run_id").merge("run_id" => run.id, "status" => "resolved")
      end : []
      resolved_digest = item_digest(resolved)
      metrics.merge!("previousRunId" => previous&.id, "resolvedCount" => resolved.length, "resolvedDigest" => resolved_digest)
      metrics["durationMs"] = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1_000).round
      if run.status == "published"
        raise Error.new("Alert completi e incrementali discordanti.", code: "ALERT_MISMATCH") unless run.result_digest == digest
        stored_resolved = run.items.where(status: "resolved").map { |row| row.attributes.except("id") }
        raise Error.new("Risoluzioni complete e incrementali discordanti.", code: "ALERT_RESOLUTION_MISMATCH") unless item_digest(stored_resolved) == resolved_digest
        return Result.new(run: run, metrics: metrics.merge("mode" => "full_comparison", "identical" => true))
      end
      Tenant.transaction do
        @tenant.lock!
        raise Error.new("Batch cambiato durante il calcolo.", code: "BATCH_CHANGED") unless @tenant.active_batch_id == batch.id
        run.items.delete_all
        AlertItem.insert_all!(items + resolved) if items.any? || resolved.any?
        run.update!(profile_set: profiles, status: "published", error_code: nil, result_digest: digest, metrics: metrics, completed_at: Time.current)
        @tenant.update!(active_alert_run: run)
      end
      Result.new(run: run, metrics: metrics)
    rescue StandardError => error
      run.update!(status: "failed", error_code: error.respond_to?(:code) ? error.code : "ALERT_CALCULATION_FAILED") if run && run.status != "published"
      raise
    end

    def canonical_json(value)
      case value
      when Hash then value.sort.to_h.transform_values { |item| canonical_json(item) }
      when Array then value.map { |item| canonical_json(item) }
      else value
      end
    end

    def item_digest(items)
      ordered = items.sort_by { |row| row.values_at("customer_code", "rule_type", "product_code") }.map { |row| canonical_json(row.except("run_id")) }
      Digest::SHA256.hexdigest(JSON.generate(ordered))
    end
  end
end
