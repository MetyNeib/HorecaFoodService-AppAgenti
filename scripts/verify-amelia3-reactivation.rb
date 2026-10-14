abort "Local development only" unless Rails.env.development?
tenant = Amelia3::Tenant.find_by!(code: "amelia3")
previous = tenant.active_alert_run
result = Amelia3::SalesAlerts.call(tenant: tenant, source: "development")
run = result.run
last_dates = run.profile_set.profiles.to_h do |profile|
  dates = profile.product_dates.values.flatten.map { |value| Date.iso8601(value) }.select { |date| date < run.as_of }
  [ profile.customer_code, dates.max ]
end
active = run.items.where(status: "active")
reactivation = active.where(rule_type: Amelia3::SalesAlertRules::REACTIVATION)
ordinary = active.where(rule_type: Amelia3::SalesAlertRules::TYPES)
customers = Amelia3::Customer.where(batch: tenant.active_batch).pluck(:external_code)
expected = last_dates.select { |code, date| customers.include?(code) && date && (run.as_of - date).to_i > 90 }.keys.sort
actual = reactivation.pluck(:customer_code).sort
abort "Reactivation classification mismatch" unless expected == actual
abort "Old customer left in sales alerts" unless ordinary.all? { |item| last_dates[item.customer_code] && (run.as_of - last_dates[item.customer_code]).to_i <= 90 }
scope = Amelia3::Scope.new(User.find_by!(commercial_tenant: tenant, role: "admin"))
catalog = Amelia3::Catalog.new(scope, scope.products.where(blocked: false).to_a)
units = catalog.orderable_products.map { |product| catalog.orderable_units(product) }
report = {
  status: "PASS", as_of: run.as_of.iso8601, rules_version: run.rules_version,
  previous_counts: previous&.metrics&.fetch("counts", {}), current_counts: run.metrics["counts"],
  source_rows_scanned: result.metrics["sourceRowsScanned"], profiles_evaluated: result.metrics["profilesEvaluated"],
  classification_matches_all_historical_profiles: actual == expected,
  ordinary_alerts_for_customers_over_90_days: 0,
  orderable_products: units.length, single_unit_products: units.count { |row| row.length == 1 },
  multiple_unit_products: units.count { |row| row.length > 1 }, available_unit_sets: units.map { |row| row.join("/") }.tally
}
File.write(Rails.root.join("qa/amelia3-v5/reactivation-real-audit.json"), JSON.pretty_generate(report) + "\n")
puts JSON.generate(report)
