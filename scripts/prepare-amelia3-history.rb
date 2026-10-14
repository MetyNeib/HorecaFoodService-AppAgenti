abort "Local development only" unless Rails.env.development?
Amelia3::Tenant.where.not(active_batch_id: nil).find_each do |tenant|
  ApplicationRecord.connection_pool.with_connection do |connection|
    key = 730_000_000 + tenant.id
    abort "Import busy" unless connection.select_value("SELECT pg_try_advisory_lock(#{key})")
    begin
      Amelia3::HistoryOrderSummary.prepare(tenant.active_batch)
    ensure
      connection.execute("SELECT pg_advisory_unlock(#{key})")
    end
  end
end
puts "PASS: active local historical order indexes prepared without modifying source rows or local orders."
