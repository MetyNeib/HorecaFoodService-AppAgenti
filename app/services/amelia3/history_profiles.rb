require "digest"

module Amelia3
  # Immutable compact date profiles. Neither source row order nor batch identity enters the digest.
  class HistoryProfiles
    VERSION = "AMELIA3-HISTORY-DATES-v1".freeze

    def self.prepare(batch, force_scan: false)
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      sha = batch.files.fetch("STORICO.csv").fetch("sha256")
      existing = HistoryProfileSet.find_by(tenant_id: batch.tenant_id, history_sha: sha, profile_version: VERSION, status: "ready")
      if existing && !force_scan
        batch.update!(history_profile_set: existing) unless batch.history_profile_set_id == existing.id
        return [ existing, { "sourceRowsScanned" => 0, "profilesReused" => existing.memberships.count, "profilesBuilt" => 0, "mode" => "checksum_reuse" } ]
      end
      metrics = { "sourceRowsScanned" => 0, "profilesReused" => 0, "profilesBuilt" => 0, "mode" => existing ? "full_comparison" : "source_scan" }
      profile_set = HistoryProfileSet.find_or_create_by!(tenant_id: batch.tenant_id, history_sha: sha, profile_version: VERSION)
      members = []
      current_code = nil
      row_hashes = []
      dates = Hash.new { |hash, key| hash[key] = Set.new }
      finish = lambda do
        next unless current_code
        digest = Digest::SHA256.hexdigest(VERSION + row_hashes.sort.join)
        profile = HistoryProfile.find_by(tenant_id: batch.tenant_id, customer_code: current_code, digest: digest)
        if profile
          metrics["profilesReused"] += 1
        else
          profile = HistoryProfile.create!(tenant_id: batch.tenant_id, customer_code: current_code, digest: digest, row_count: row_hashes.length,
            product_dates: dates.sort.to_h.transform_values { |values| values.to_a.sort })
          metrics["profilesBuilt"] += 1
        end
        members << { profile_set_id: profile_set.id, profile_id: profile.id, customer_code: current_code }
      end
      cursor = nil
      loop do
        query = HistoryRow.where(batch_id: batch.id)
        query = query.where("(customer_code, source_row) > (?, ?)", *cursor) if cursor
        rows = query.order(:customer_code, :source_row).limit(5_000).pluck(:customer_code, :source_row, :product_code, :order_reference, :delivery_date, :packs, :pieces, :weight, :shipped)
        break if rows.empty?
        rows.each do |code, source_row, product, reference, date, *quantities|
          if current_code != code
            finish.call
            current_code = code
            row_hashes = []
            dates = Hash.new { |hash, key| hash[key] = Set.new }
          end
          normalized = [ code, product, reference, date.iso8601, *quantities.map { |value| value.to_s("F") } ]
          row_hashes << Digest::SHA256.hexdigest(JSON.generate(normalized))
          dates[product] << date.iso8601 if quantities.last.positive?
          cursor = [ code, source_row ]
          metrics["sourceRowsScanned"] += 1
        end
      end
      finish.call
      HistoryProfileSet.transaction do
        if existing
          expected = existing.memberships.pluck(:customer_code, :profile_id).sort
          actual = members.map { |member| member.values_at(:customer_code, :profile_id) }.sort
          raise Error.new("Profili completi e incrementali discordanti.", code: "PROFILE_MISMATCH") unless actual == expected
        else
          profile_set.memberships.delete_all
          HistoryProfileMembership.insert_all!(members) if members.any?
        end
        metrics["durationMs"] = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1_000).round
        profile_set.update!(status: "ready", metrics: metrics) unless existing
        batch.update!(history_profile_set: profile_set)
      end
      [ profile_set, metrics ]
    end
  end
end
