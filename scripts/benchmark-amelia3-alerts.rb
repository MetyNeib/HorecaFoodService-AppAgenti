abort "Local development only" unless Rails.env.development?
tenant = Amelia3::Tenant.find_by!(code: "amelia3")
date = Time.find_zone!("Europe/Rome").today
report_path = Rails.root.join("qa/amelia3-v5/alerts-benchmark.json")
previous_report = report_path.exist? ? JSON.parse(report_path.read) : {}
before = Digest::SHA256.hexdigest(JSON.generate(Amelia3::Order.where(tenant: tenant).order(:id).map(&:attributes)))
baseline = Amelia3::SalesAlerts.call(tenant: tenant, as_of: date, source: "development", full: tenant.active_alert_run_id.nil?)
unchanged = Amelia3::SalesAlerts.call(tenant: tenant, as_of: date, source: "development")
comparison = Amelia3::SalesAlerts.call(tenant: tenant, as_of: date, source: "development", full: true)
agent = User.find_by!(commercial_tenant: tenant, role: "agent", agent_id: "34")
admin = User.find_by!(commercial_tenant: tenant, role: "admin")
scope = Amelia3::Scope.new(admin)
queries = []
started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
subscription = ActiveSupport::Notifications.subscribe("sql.active_record") { |*, payload| queries << payload[:sql] unless payload[:name] == "SCHEMA" }
page = Amelia3::AlertPage.new(scope, {})
ActiveSupport::Notifications.unsubscribe(subscription)
page_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1_000).round
after = Digest::SHA256.hexdigest(JSON.generate(Amelia3::Order.where(tenant: tenant).order(:id).map(&:attributes)))
abort "Existing orders changed" unless before == after
batch = tenant.reload.active_batch
connection = ApplicationRecord.connection
scans = {
  "profile_cursor" => Amelia3::HistoryRow.where(batch_id: batch.id).order(:customer_code, :source_row).limit(5_000).select(:customer_code, :source_row, :delivery_date).to_sql,
  "history_orders" => Amelia3::HistoryOrderSummary.where(batch_id: batch.id).order(last_delivery: :desc, customer_code: :asc, order_reference: :asc).limit(20).to_sql,
  "alert_page" => baseline.run.items.where(status: "active").order(Arel.sql("severity_numerator::numeric / severity_denominator DESC")).limit(10).to_sql
}
plans = scans.transform_values { |sql| connection.select_value("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) #{sql}").then { |value| JSON.parse(value) } }
report = {
  status: "PASS", mode: "development_local_files", local_date: date.iso8601, batch: batch.id, fingerprint: batch.fingerprint,
  rules_version: Amelia3::SalesAlertRules::VERSION, baseline: previous_report["baseline"] || baseline.metrics, current_baseline: baseline.metrics, unchanged: unchanged.metrics, full_comparison: comparison.metrics,
  agent34_alerts: Amelia3::AlertPage.new(Amelia3::Scope.new(agent), {}).total,
  first_admin_page: { rows: page.items.length, mix: page.items.group_by(&:rule_type).transform_values(&:length), query_count: queries.length, duration_ms: page_ms,
    history_queries: queries.count { |sql| sql.include?("amelia3_history_rows") } },
  existing_orders_preserved: before == after, query_plans: plans
}
FileUtils.mkdir_p(Rails.root.join("qa/amelia3-v5"))
File.write(Rails.root.join("qa/amelia3-v5/alerts-benchmark.json"), JSON.pretty_generate(report) + "\n")
puts JSON.generate(report.except(:query_plans))
