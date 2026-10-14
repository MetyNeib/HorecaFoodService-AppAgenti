abort "Local development only" unless Rails.env.development?

tenant = Amelia3::Tenant.find_by!(code: "amelia3")
results = %w[admin agent].map do |role|
  user = User.find_by!(commercial_tenant: tenant, role: role)
  queries = []
  started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
  subscription = ActiveSupport::Notifications.subscribe("sql.active_record") { |*, payload| queries << payload[:sql] unless payload[:name] == "SCHEMA" }
  # The alert page must not query history, including in its offline bootstrap.
  # Other pages retain the existing bounded agent-only usual-product preparation.
  snapshot = Amelia3::Snapshot.for(user, include_usual: false)
  ActiveSupport::Notifications.unsubscribe(subscription)
  duration = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1_000).round
  data = snapshot.fetch(:state).fetch("data")
  counts = %w[customers products orders customerConditions].to_h { |key| [ key, data.fetch(key).length ] }
  abort "Unbounded snapshot" unless counts["customers"] <= 100 && counts["products"] <= 500 && counts["orders"] <= 20
  abort "History included in snapshot" if data.key?("history") || data.key?("alerts") || queries.any? { |sql| sql.include?("amelia3_history_rows") }
  { role: role, counts: counts, json_bytes: JSON.generate(snapshot).bytesize, query_count: queries.length,
    history_queries: 0, duration_ms: duration }
end
peak = File.read("/proc/self/status")[/^VmHWM:\s+(\d+)/, 1]&.to_i
report = { status: "PASS", observed_at: Time.current.iso8601, scope: "alert-page snapshot generation; excludes HTTP and browser asset requests",
           snapshots: results, ruby_process_peak_rss_kb: peak, business_mutations: 0 }
File.write(Rails.root.join("qa/amelia3-v5/snapshot-benchmark.json"), JSON.pretty_generate(report) + "\n")
puts JSON.generate(report)
