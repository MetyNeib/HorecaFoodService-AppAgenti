abort "Synthetic local QA only" unless Rails.env.development?
tenant = Amelia3::Tenant.find_by!(code: "amelia3-browser-qa")
batch = tenant.active_batch
abort "Wrong QA source" unless batch.source == "synthetic-browser-test"
day = Time.find_zone!("Europe/Rome").today
customer = Amelia3::Customer.find_by!(batch: batch, external_code: "C001")
customer.update!(telephone: "0711234567; 3331234567")
attributes = { batch_id: batch.id, packs: 1, pieces: 2, weight: "2.5", shipped: 1 }
Amelia3::HistoryRow.where(batch_id: batch.id).where("source_row >= 100").delete_all
[ 100, 90, 80, 70, 60 ].each_with_index do |ago, i|
  Amelia3::HistoryRow.create!(**attributes, source_row: 100 + i, customer_code: "C001", product_code: "KG005", order_reference: "V5-QA-PRODUCT-#{i}", delivery_date: day - ago)
end
[ 151, 131, 111, 91 ].each_with_index do |ago, i|
  Amelia3::HistoryRow.create!(**attributes, source_row: 200 + i, customer_code: "C003", product_code: "P001", order_reference: "V5-QA-STOPPED-#{i}", delivery_date: day - ago)
end
files = batch.files.deep_dup
files["STORICO.csv"]["sha256"] = Digest::SHA256.hexdigest("SYNTHETIC-V5-BROWSER-ALERTS-REACTIVATION-#{day}")
batch.update!(files: files, metrics: batch.metrics.except("historyOrdersVersion"))
Amelia3::HistoryOrderSummary.prepare(batch)
result = Amelia3::SalesAlerts.call(tenant: tenant, as_of: day, source: "development")
puts JSON.generate(status: "PASS", synthetic_alert_counts: result.run.metrics["counts"])
