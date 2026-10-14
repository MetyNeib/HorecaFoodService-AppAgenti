require "rails_helper"
require_relative "../support/amelia3_fixture"

RSpec.describe "Amelia3 demo polish", type: :request do
  include Amelia3Fixture
  let(:fixture) { commercial_fixture }
  after { FileUtils.remove_entry(fixture[:directory]) }

  it "separates blocked, dormant and active customers at the 90-day boundary without changing the source" do
    scope = Amelia3::Scope.new(fixture[:admin])
    active = scope.customer("C001")
    expect(Amelia3::CustomerActivity.new(scope, date: Date.new(2026, 10, 1)).for(active)["activity"]).to eq("active")
    expect(Amelia3::CustomerActivity.new(scope, date: Date.new(2026, 12, 30)).for(active)["activity"]).to eq("active")
    expect(Amelia3::CustomerActivity.new(scope, date: Date.new(2026, 12, 31)).for(active)["activity"]).to eq("dormant")
    expect(scope.customer_activity.for(scope.customer("C002"))["activity"]).to eq("blocked")
    expect(scope.customer_activity.for(scope.customer("C003"))).to eq("activity" => "dormant", "lastPurchaseDate" => nil)
    sign_in fixture[:admin]
    get "/amelia3/customers", params: { category: "dormant" }
    expect(response.body).to include("senza storico acquisti", 'data-customer-code="C003"')
    expect(response.body).not_to include('data-customer-code="C002"')
    get "/amelia3/customers", params: { pick: "1", category: "blocked" }
    expect(response.body).to include('data-customer-code="C001"', 'data-customer-code="C003"')
    expect(response.body).not_to include('data-customer-code="C002"', 'aria-label="Categorie clienti"')
    sign_in fixture[:agent]
    get "/amelia3/customers", params: { category: "dormant" }
    expect(response.body).not_to include('data-customer-code="C003"')
  end

  it "changes a draft line's unit atomically, checking evidence, price, divisibility and idempotence" do
    user = fixture[:agent]
    scope = Amelia3::Scope.new(user)
    product = scope.products.find_by!(external_code: "P001")
    product.update!(order_unit: "C")
    attest_fixture_units(fixture[:tenant], base: "P", order: "C", contract: { "steps" => { "CONF" => "1", "PZ" => "1" } })
    order_id, line_id = SecureRandom.uuid, SecureRandom.uuid
    command = lambda do |type, payload|
      { "operationId" => SecureRandom.uuid, "baseVersion" => scope.tenant.reload.revision, "epoch" => 1, "type" => type,
        "payload" => payload.merge("batchId" => scope.batch_id) }
    end
    apply = ->(intent) { Amelia3::Commands.call(user: user, command: intent) }
    apply.call(command.call("CREATE_DRAFT", { "id" => order_id, "customerId" => "C001" }))
    quote = Amelia3::Quote.for(scope, product, scope.customer("C001"), unit: "CONF")
    apply.call(command.call("ADD_LINE", { "orderId" => order_id, "lineId" => line_id, "productId" => "P001", "unit" => "CONF", "quantity" => "2", "expectedVersion" => 0,
      "expectedConversionVersion" => quote.terms["conversionVersion"], "expectedExactPrice" => Amelia3::ExactValue.wire(quote.exact_unit_price) }))
    order = scope.order(order_id)
    original_total = order.net_cents
    target = Amelia3::Quote.for(scope, product, scope.customer("C001"), unit: "PZ")
    payload = { "orderId" => order_id, "lineId" => line_id, "unit" => "PZ", "quantity" => "20", "expectedVersion" => order.version,
      "expectedConversionVersion" => target.terms["conversionVersion"], "expectedExactPrice" => Amelia3::ExactValue.wire(target.exact_unit_price) }
    expect { apply.call(command.call("UPDATE_LINE", payload.merge("quantity" => "0.5"))) }.to raise_error(Amelia3::Error)
    expect { apply.call(command.call("UPDATE_LINE", payload.merge("expectedConversionVersion" => "stale"))) }.to raise_error(Amelia3::Error)
    expect { apply.call(command.call("UPDATE_LINE", payload.merge("expectedExactPrice" => { "n" => "1", "d" => "1" }))) }.to raise_error(Amelia3::Error)
    expect(order.reload.lines.first["unit"]).to eq("CONF")
    change = command.call("UPDATE_LINE", payload)
    2.times { apply.call(change) }
    expect(order.reload.lines.length).to eq(1)
    expect(order.lines.first).to include("id" => line_id, "unit" => "PZ", "quantity" => "20.0")
    expect(order.net_cents).to eq(original_total)
    expect(order.version).to eq(2)
    order.update!(status: "CONFIRMED_LOCAL")
    expect { apply.call(command.call("UPDATE_LINE", payload.merge("expectedVersion" => 2))) }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("ORDER_READ_ONLY") }
  end
end
