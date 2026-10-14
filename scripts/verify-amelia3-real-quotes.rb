abort "Local development only" unless Rails.env.development?
tenant = Amelia3::Tenant.find_by!(code: "amelia3")
agent = User.find_by!(commercial_tenant: tenant, role: "agent", agent_id: "34")
scope = Amelia3::Scope.new(agent)
products = scope.products.order(:external_code).to_a
catalog = Amelia3::Catalog.new(scope, products)
before = Digest::SHA256.hexdigest(JSON.generate(Amelia3::Order.where(tenant: tenant).order(:id).map(&:attributes)))
counts, reasons, pairs = Hash.new(0), Hash.new(0), []
products.each do |product|
  product.canonical_units.fetch("orderableUms").each do |unit|
    quote = catalog.quote(product, unit: unit)
    counts[quote.wire["status"]] += 1
    if quote.unavailable_reason
      reasons[quote.unavailable_reason] += 1
      next
    end
    # Independent formula: count units per CONF; no nominal weight edge.
    base = Amelia3::CanonicalUnits::MAP.fetch(product.base_unit)
    per_conf = { "CONF" => Rational(1), "PZ" => product.pieces_per_pack&.to_r, "COLL" => product.packs_per_case&.positive? ? 1 / product.packs_per_case.to_r : nil }
    factor = unit == base ? Rational(1) : per_conf.fetch(base) / per_conf.fetch(unit)
    expected = quote.price.amount.to_r * factor
    abort "Exact conversion mismatch" unless expected == quote.exact_unit_price
    quantity = quote.terms["quantityStep"] == "any" ? [ Rational(123_456, 1_000_000), quote.available ].min : quote.step.to_r
    decimal = BigDecimal(Amelia3::ExactValue.text(quantity))
    line = quote.line(id: SecureRandom.uuid, quantity: decimal)
    expected_cents = (quantity * expected * 100 + Rational(1, 2)).floor
    abort "Line rounding mismatch" unless line.fetch("lineNetCents") == expected_cents
    pairs << { product: Amelia3::Snapshot.product_data(product, quote), unit: unit, quantity: decimal.to_s("F"), expectedCents: expected_cents, exactPrice: Amelia3::ExactValue.wire(expected) }
  end
end
after = Digest::SHA256.hexdigest(JSON.generate(Amelia3::Order.where(tenant: tenant).order(:id).map(&:attributes)))
abort "Existing orders changed" unless before == after
private_path = Rails.root.join("imports/private/amelia3/verification-v5/quote-parity-private.json")
File.write(private_path, JSON.generate(pairs))
customers = scope.customers.to_a
recent_codes = scope.history.where("shipped > 0 AND delivery_date >= ? AND delivery_date < ?", Time.zone.today.prev_year, Time.zone.today).distinct.pluck(:product_code).to_set
historical_codes = scope.history.distinct.pluck(:product_code).to_set
verified_codes = pairs.map { |pair| pair[:product]["id"] }.to_set
cohorts = { "all" => products.map(&:external_code).to_set, "agent34_historical" => historical_codes, "agent34_recent12m" => recent_codes }.transform_values do |codes|
  { "products" => codes.size, "atLeastOneVerifiedOffer" => (codes & verified_codes).size }
end
contacts = customers.reject(&:blocked).map { |customer| Amelia3::ContactNumbers.call(customer.telephone) }
report = { status: "PASS", fingerprint: tenant.active_batch.fingerprint, records: products.length, quotes: counts, reasons: reasons,
           independently_verified_quotes: pairs.length, existing_orders_preserved: before == after,
           cohorts: cohorts,
           agent34_list_codes: customers.group_by { |customer| customer.source_fields["cod_lis"].presence || "not_supplied" }.transform_values(&:length),
           agent34_contactable: contacts.count(&:any?), agent34_contact_candidates: contacts.sum(&:length),
           evidence_source: "user supplied source review; no independent access to referenced source repository", nominal_weight_conversions_enabled: false }
File.write(Rails.root.join("qa/amelia3-v5/real-quotes.json"), JSON.pretty_generate(report) + "\n")
puts JSON.generate(report)
