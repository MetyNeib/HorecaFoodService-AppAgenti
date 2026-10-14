require "rails_helper"
require_relative "../support/amelia3_fixture"

RSpec.describe "Amelia3 v5 navigation, history and alert authorization", type: :request do
  include Amelia3Fixture
  before(:all) { Rails.application.reload_routes! }
  let(:fixture) { commercial_fixture }
  after { FileUtils.remove_entry(fixture[:directory]) }

  def document
    Nokogiri::HTML(response.body)
  end

  it "shows reactivation separately with scoped customer badges and offline snapshot metadata" do
    tenant = fixture[:tenant]
    run = Amelia3::AlertRun.create!(tenant: tenant, batch: fixture[:batch], as_of: Time.zone.today, rules_version: Amelia3::SalesAlertRules::VERSION, source: "development", status: "published")
    evidence = { "lastDelivery" => (Time.zone.today - 91).iso8601, "daysSinceLast" => 91, "thresholdDays" => 90 }
    %w[C001 C003].each { |code| run.items.create!(customer_code: code, rule_type: "CUSTOMER_REACTIVATION", product_code: "", severity_numerator: 91, severity_denominator: 90, days_late: 1, evidence: evidence) }
    tenant.update!(active_alert_run: run)
    sign_in fixture[:agent]
    get "/amelia3/alerts"
    expect(document.css('[data-alert-id]')).to be_empty
    get "/amelia3/alerts", params: { type: "CUSTOMER_REACTIVATION" }
    expect(response).to have_http_status(:ok)
    expect(document.css('[data-alert-id]').length).to eq(1)
    expect(document.at_css('main').text).not_to include("Ti avvisiamo perché")
    bootstrap = JSON.parse(document.at_css('#workspace-bootstrap').text)
    expect(bootstrap.dig("state", "data", "notifications")).to include("salesAlerts" => 0, "unreadOrders" => 0)
    expect(bootstrap.dig("state", "data", "customers").map { |row| row["id"] }).to include("C001")
    expect(document.at_css('[data-alert-id]')['data-customer-code']).to eq("C001")
    expect(document.at_css('h1').text).to eq("Clienti da riattivare")
    get "/amelia3/customers"
    expect(document.at_css('[data-customer-code="C001"]').text).to include("Da riattivare")
    get "/amelia3/customers/C001"
    expect(response.body).to include("Da riattivare")
    snapshot = Amelia3::Snapshot.for(fixture[:agent]).dig(:state, "data", "customers")
    expect(snapshot.find { |row| row["id"] == "C001" }["reactivation"]).to eq(evidence)
    expect(snapshot.map { |row| row["id"] }).not_to include("C003")
    get "/amelia3/alerts", params: { type: "CUSTOMER_REACTIVATION", customer_id: "C003" }
    expect(response).to have_http_status(:not_found)
  end

  it "excludes generic placeholders from selection while preserving source quotes and direct details" do
    product = Amelia3::Product.find_by!(batch: fixture[:batch], external_code: "P001")
    [ "**ARTICOLO VARIO FRESCO", "Articoli vari", "ART. VARIO", "(OM) MERCE VARIA", "PRODOTTO GENERICO", "MERCI DIVERSE" ].each do |name|
      product.name = name
      expect(product.generic_catalog_item?).to be(true)
    end
    [ "Caramelle gusti vari", "Mix verdure", "Articolo variante speciale" ].each do |name|
      product.name = name
      expect(product.generic_catalog_item?).to be(false)
    end
    product.update!(name: "**ARTICOLO VARIO FRESCO")
    sign_in fixture[:agent]
    get "/amelia3/catalog"
    expect(document.css('[data-product-code]')).to be_empty
    get "/amelia3/catalog/P001"
    expect(response).to have_http_status(:ok)
    scope = Amelia3::Scope.new(fixture[:agent])
    expect(Amelia3::Quote.for(scope, product).unavailable_reason).to be_nil
    dto = Amelia3::Snapshot.for(fixture[:agent], product_codes: [ "P001" ]).dig(:state, "data", "products").find { |row| row["id"] == "P001" }
    expect(dto["catalogExcluded"]).to be(true)
    expect(dto["basePriceMicros"]).to eq("1234560")
  end

  it "filters unavailable products before pagination without deleting source data" do
    batch = fixture[:batch]
    template = Amelia3::Product.find_by!(batch: batch, external_code: "P001")
    51.times do |index|
      code = "VALID-#{index.to_s.rjust(3, '0')}"
      template.dup.tap { |row| row.external_code = code; row.name = "Z valido #{code}"; row.save! }
      Amelia3::Stock.create!(batch: batch, product_code: code, pieces: 100)
      Amelia3::Price.create!(batch: batch, product_code: code, list_code: "000", amount: 2, valid_price: true)
    end
    50.times do |index|
      template.dup.tap { |row| row.external_code = "BLOCKED-#{index}"; row.name = "A bloccato #{index}"; row.blocked = true; row.save! }
    end
    sign_in fixture[:agent]
    get "/amelia3/catalog"
    expect(response).to have_http_status(:ok)
    expect(document.css('[data-product-code]').length).to eq(50)
    expect(document.css('[data-product-code]').map { |row| row['data-product-code'] }).to include("P001")
    expect(document.css('[role="status"]').text).to include("52 prodotti ordinabili")
    get "/amelia3/catalog", params: { page: 2 }
    expect(document.css('[data-product-code]').length).to eq(2)
    get "/amelia3/catalog", params: { q: "K001" }
    expect(document.css('[data-product-code]')).to be_empty
    expect(document.css('main').text).to include("Nessun prodotto ordinabile")
    expect(Amelia3::Product.where(batch: batch).count).to eq(103)
    get "/amelia3/catalog/K001"
    expect(response).to have_http_status(:ok)
  end

  it "keeps a verified secondary unit and removes products failing the customer's price rules" do
    batch = fixture[:batch]
    attest_fixture_units(fixture[:tenant], base: "K", order: "L", contract: {
      "stockFields" => { "weight" => "KG" }, "primaryStockField" => "weight", "steps" => { "KG" => "any", "COLL" => "1" }
    })
    order = Amelia3::Order.create!(tenant: fixture[:tenant], created_by_user: fixture[:agent], customer_code: "C001", assigned_agent_code: "34")
    sign_in fixture[:agent]
    get "/amelia3/catalog", params: { order_id: order.id }
    card = document.at_css('[data-product-code="K001"]')
    expect(card.css('[data-unit]').map { |row| row['data-unit'] }).to eq([ "KG" ])
    expect(card.css('button[type="submit"][disabled]')).to be_empty
    condition = Amelia3::Condition.find_by!(batch: batch, customer_code: "C001", product_code: "P001")
    condition.dup.tap { |row| row.source_row += 1; row.save! }
    get "/amelia3/catalog", params: { order_id: order.id }
    expect(document.css('[data-product-code]').map { |row| row['data-product-code'] }).to eq([ "K001" ])
    expect(order.reload.lines).to be_empty
  end

  it "prepares usable offline products while retaining explicitly requested excluded records" do
    snapshot = Amelia3::Snapshot.for(fixture[:agent])
    expect(snapshot.dig(:state, "data", "products").map { |row| row["id"] }).to eq([ "P001" ])
    explicit = Amelia3::Snapshot.for(fixture[:agent], product_codes: [ "K001" ])
    expect(explicit.dig(:state, "data", "products").map { |row| row["id"] }).to contain_exactly("P001", "K001")
  end

  it "renders six drawer destinations, original logo and an isolated neutral offline shell" do
    sign_in fixture[:agent]
    get "/amelia3"
    expect(response).to have_http_status(:ok)
    expect(document.css('.amelia-menu-links a').map { |link| (link.at_css('span') || link).text }).to eq([ "Home", "Nuovo ordine", "Ordini da leggere", "Clienti", "Alert di vendita", "Catalogo" ])
    expect(document.css('header, footer, .header-dock, .status-dock')).to be_empty
    expect(document.at_css('.amelia-logo')['src']).to include("amelia3-logo")
    get "/amelia3/whatsapp"
    expect(document.at_css('main').text).to include("Funzionalità non ancora disponibile")
    sign_out fixture[:agent]
    get "/amelia3/offline"
    expect(response).to have_http_status(:ok)
    expect(response.body).not_to include(fixture[:agent].email, "RESET_DEMO", "SET_DEMO_NETWORK", "Reset demo")
    expect(document.css('.amelia-menu-links a').length).to eq(6)
  end

  it "groups by customer and reference, preserving repeated lines in one shared read-only detail" do
    batch = fixture[:batch]
    first = Amelia3::HistoryRow.find_by!(batch: batch, customer_code: "C001")
    Amelia3::HistoryRow.create!(first.attributes.except("id").merge(source_row: 3, delivery_date: first.delivery_date + 1, shipped: "0.125"))
    other = Amelia3::HistoryRow.find_by!(batch: batch, customer_code: "C003")
    other.update!(order_reference: first.order_reference)
    batch.update!(metrics: batch.metrics.except("historyOrdersVersion"))
    Amelia3::HistoryOrderSummary.prepare(batch)
    sign_in fixture[:admin]
    get "/amelia3/orders", params: { status: "HISTORY" }
    expect(response).to have_http_status(:ok)
    expect(document.css('[aria-label="Ordini storici"] article').length).to eq(2)
    sign_in fixture[:agent]
    get "/amelia3/history"
    expect(document.css('[aria-label="Ordini storici"] article').length).to eq(1)
    expect(document.at_css('main').text).to include("2 righe")
    get "/amelia3/history/detail", params: { customer_id: "C001", reference: first.order_reference }
    expect(response).to have_http_status(:ok)
    expect(document.css('[aria-label="Righe ordine storico"] article').length).to eq(2)
    expect(document.css(".amelia-history-quantity").map(&:text)).to eq([ "Quantità ordinata: 10 PZ", "Quantità ordinata: 10 PZ" ])
    expect(Amelia3::HistoryRow.find_by!(batch: batch, source_row: 3).shipped).to eq(BigDecimal("0.125"))
    expect(document.at_css('main').text).not_to include("€")
    get "/amelia3/history/detail", params: { customer_id: "C003", reference: first.order_reference }
    expect(response).to have_http_status(:not_found)
  end

  it "paginates twenty historical orders and filters before pagination" do
    first = Amelia3::HistoryRow.find_by!(batch: fixture[:batch], customer_code: "C001")
    24.times { |index| Amelia3::HistoryRow.create!(first.attributes.except("id").merge(source_row: index + 3, order_reference: "SYN-#{index}", delivery_date: first.delivery_date + index)) }
    fixture[:batch].update!(metrics: fixture[:batch].metrics.except("historyOrdersVersion"))
    Amelia3::HistoryOrderSummary.prepare(fixture[:batch])
    sign_in fixture[:agent]
    get "/amelia3/history"
    first_links = document.css('[aria-label="Ordini storici"] a').map { |link| link['href'] }
    expect(first_links.length).to eq(20)
    get "/amelia3/history", params: { page: 2 }
    other_links = document.css('[aria-label="Ordini storici"] a').map { |link| link['href'] }
    expect(other_links.length).to eq(5)
    expect(first_links & other_links).to be_empty
    get "/amelia3/orders", params: { status: "HISTORY", q: "SYN-23", customer_id: "C001" }
    expect(document.css('[aria-label="Ordini storici"] article').length).to eq(1)
  end

  it "scopes alert links and static contact candidates without a message or editable contact" do
    customer = Amelia3::Customer.find_by!(batch: fixture[:batch], external_code: "C001")
    customer.update!(telephone: "0711234567; +39 3331234567")
    # The alert customer falls outside the first 100 cached customers.
    101.times do |index|
      customer.dup.tap { |copy| copy.external_code = "A-CACHE-#{index}"; copy.account_code = "A-CACHE-#{index}"; copy.save! }
    end
    run = Amelia3::AlertRun.create!(tenant: fixture[:tenant], batch: fixture[:batch], as_of: Time.zone.today,
      rules_version: Amelia3::SalesAlertRules::VERSION, source: "development", status: "published")
    evidence = { "datesCount" => 4, "firstDelivery" => "2026-01-01", "lastDelivery" => "2026-03-01", "medianDays" => { "n" => 20, "d" => 1 }, "thresholdDays" => 50, "daysSinceLast" => 60, "daysLate" => 10 }
    %w[C001 C003].each { |code| run.items.create!(customer_code: code, rule_type: "CUSTOMER_STOPPED", severity_numerator: 60, severity_denominator: 50, days_late: 10, evidence: evidence) }
    fixture[:tenant].update!(active_alert_run: run)
    sign_in fixture[:agent]
    queries = []
    subscription = ActiveSupport::Notifications.subscribe("sql.active_record") { |*, payload| queries << payload[:sql] }
    get "/amelia3/alerts"
    ActiveSupport::Notifications.unsubscribe(subscription)
    expect(queries.grep(/amelia3_history_rows/)).to be_empty
    expect(response).to have_http_status(:ok)
    expect(document.css('[data-alert-id]').length).to eq(1)
    expect(document.at_css('main').text).not_to include("Ti avvisiamo perché")
    bootstrap = JSON.parse(document.at_css('#workspace-bootstrap').text)
    expect(bootstrap.dig("state", "data", "notifications")).to include("salesAlerts" => 1, "unreadOrders" => 0)
    expect(bootstrap.dig("state", "data", "customers").map { |row| row["id"] }).to include("C001")
    expect(document.at_css('[data-alert-id]')['data-customer-code']).to eq("C001")
    links = document.css('a[target="_blank"]')
    expect(links.map { |link| link['href'] }).to eq(%w[https://wa.me/390711234567 https://wa.me/393331234567])
    expect(links.map { |link| link['rel'] }.uniq).to eq([ "noopener noreferrer" ])
    expect(document.css('[id^="contact-"] input')).to be_empty
    expect(document.at_css('main').text).not_to include("Cliente sintetico esterno")
    queries.clear
    subscription = ActiveSupport::Notifications.subscribe("sql.active_record") { |*, payload| queries << payload[:sql] }
    get "/amelia3/snapshot", params: { context: "alerts" }
    ActiveSupport::Notifications.unsubscribe(subscription)
    expect(response).to have_http_status(:ok)
    expect(queries.grep(/amelia3_history_rows/)).to be_empty
    customer.update!(telephone: "nessun telefono")
    get "/amelia3/alerts"
    expect(document.css('[data-dialog^="contact-"][disabled]').length).to eq(1)
    expect(document.css('a[target="_blank"]')).to be_empty
    get "/amelia3/alerts", params: { customer_id: "C003" }
    expect(response).to have_http_status(:not_found)
    get "/amelia3/alerts", params: { run_id: run.id, agent: "99" }
    expect(document.css('[data-alert-id]')).to be_empty
  end

  it "retains an older explicit order within the twenty-order offline bound" do
    rows = 21.times.map do |index|
      Amelia3::Order.create!(tenant: fixture[:tenant], created_by_user: fixture[:agent], customer_code: "C001",
        assigned_agent_code: "34", updated_at: Time.current - index.minutes)
    end
    snapshot = Amelia3::Snapshot.for(fixture[:agent], order_id: rows.last.id)
    orders = snapshot.fetch(:state).fetch("data").fetch("orders")
    expect(orders.length).to eq(20)
    expect(orders.first.fetch("id")).to eq(rows.last.id)
    expect(orders.map { |row| row.fetch("id") }).not_to include(rows[-2].id)
  end
end
