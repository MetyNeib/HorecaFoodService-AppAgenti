require "csv"
require "digest"

abort "Audit locale development richiesto" unless Rails.env.development?
tenant = Amelia3::Tenant.find_by!(code: "amelia3")
batch = tenant.active_batch
products = Amelia3::Product.where(batch_id: batch.id).order(:external_code).to_a
prices = Amelia3::Price.where(batch_id: batch.id, list_code: "000").index_by(&:product_code)
stocks = Amelia3::Stock.where(batch_id: batch.id).index_by(&:product_code)
customers = Amelia3::Customer.where(batch_id: batch.id, agent_code: "34")
history = Amelia3::HistoryRow.where(batch_id: batch.id, customer_code: customers.select(:external_code))
date = Date.iso8601(ENV.fetch("AMELIA3_AUDIT_DATE", Time.zone.today.iso8601))
historical = history.distinct.pluck(:product_code)
recent = history.where("shipped > 0 AND delivery_date >= ? AND delivery_date < ?", date.prev_year, date).distinct.pluck(:product_code)
directory = Rails.root.join("imports/private/amelia3/verification-v5")
FileUtils.mkdir_p(directory)
headers = %w[priority product_code base_unit order_unit preferred_um candidate_ums blocked pieces_per_pack packs_per_case weight_per_pack pack_indivisible case_indivisible list_000_price stock_cf stock_pz stock_pe evidence_status]
rows = products.map do |product|
  canonical = Amelia3::CanonicalUnits.for(product)
  stock = stocks[product.external_code]
  price = prices[product.external_code]
  priority = recent.include?(product.external_code) ? 1 : historical.include?(product.external_code) ? 2 : 3
  [ priority, product.external_code, product.base_unit, product.order_unit, canonical["preferredUm"], canonical["orderableUms"].join("|"), product.blocked,
    product.pieces_per_pack&.to_s("F"), product.packs_per_case&.to_s("F"), product.weight_per_pack&.to_s("F"), product.pack_indivisible, product.case_indivisible,
    price&.amount&.to_s("F"), stock&.packs&.to_s("F"), stock&.pieces&.to_s("F"), stock&.weight&.to_s("F"), "DA_VERIFICARE_PREZZO_STOCK_PASSO" ]
end.sort_by { |row| [ row[0], row[1] ] }
CSV.open(directory.join("catalogue-private.csv"), "wb", col_sep: ";") { |csv| csv << headers; rows.each { |row| csv << row } }
samples = rows.reject { |row| row[6] }.group_by { |row| [ row[2], row[3], row[10], row[11] ] }.values.flat_map { |group| group.take(2) }
CSV.open(directory.join("verification-samples-private.csv"), "wb", col_sep: ";") { |csv| csv << headers; samples.each { |row| csv << row } }
summary = { date: date.iso8601, source_batch_fingerprint: batch.fingerprint, products: products.length,
            unblocked: products.count { |product| !product.blocked }, historical_agent34: historical.length, recent_agent34: recent.length,
            canonical_valid: products.count { |product| Amelia3::CanonicalUnits.for(product)["reason"].nil? },
            private_samples: samples.length, economic_evidence: "NOT_ATTESTED", source_data_changed: false,
            groups: products.reject(&:blocked).group_by { |product| "#{product.base_unit}/#{product.order_unit}" }.transform_values(&:length) }
File.write(Rails.root.join("qa/amelia3-v5/economic-audit.json"), JSON.pretty_generate(summary) + "\n")
puts JSON.generate(summary)
