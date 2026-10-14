require "rails_helper"
require_relative "../support/amelia3_fixture"

RSpec.describe "Amelia3 canonical units and attested conversions" do
  include Amelia3Fixture
  let(:fixture) { commercial_fixture }
  let(:scope) { Amelia3::Scope.new(fixture[:agent]) }
  let(:product) { scope.products.find_by!(external_code: "K001") }
  after { FileUtils.remove_entry(fixture[:directory]) }

  it "derives preferred-first units from both divisibility flags without a reference CSV" do
    expect(product.canonical_units["orderableUms"]).to eq(%w[COLL KG])
    expect(product.canonical_units["unitKind"]).to eq("multiple_el")
    product.case_indivisible = true
    expect(product.canonical_units["orderableUms"]).to eq([ "COLL" ])
    product.base_unit = "X"
    expect(product.canonical_units["orderableUms"]).to eq([])
    expect(product.canonical_units["reason"]).to be_present
  end

  it "does not certify price or stock merely because raw units coincide" do
    fixture[:tenant].then { |tenant| Amelia3::UnitVerification.where(tenant: tenant).delete_all }
    pz = scope.products.find_by!(external_code: "P001")
    quote = Amelia3::Quote.for(scope, pz)
    expect(quote.wire["status"]).to eq("QUOTE_NEEDS_EVIDENCE")
    expect(quote.unit_price).to be_nil
    expect(quote.wire["reason"]).to include("listino 000")
  end

  def weight_evidence
    attest_fixture_units(fixture[:tenant], base: "K", order: "L", contract: {
      "stockFields" => { "weight" => "KG" }, "primaryStockField" => "weight",
      "verifiedFactors" => %w[weightPerPack packsPerCase], "fixedWeight" => true,
      "steps" => { "KG" => "0.1", "COLL" => "1" }
    })
  end

  it "accepts free decimal KG and stock below one without certifying nominal-weight conversions" do
    rule = attest_fixture_units(fixture[:tenant], base: "K", order: "L", contract: {
      "stockFields" => { "weight" => "KG", "pieces" => "PZ" }, "primaryStockField" => "weight",
      "verifiedFactors" => %w[piecesPerPack packsPerCase], "steps" => { "KG" => "any", "COLL" => "1" }
    })
    Amelia3::Stock.find_by!(batch_id: scope.batch_id, product_code: product.external_code).update!(weight: "0.125", pieces: 100)
    kg = Amelia3::Quote.for(scope, product, unit: "KG")
    expect(kg.terms["quantityStep"]).to eq("any")
    expect(kg.line(id: SecureRandom.uuid, quantity: BigDecimal("0.123456"))["lineNetCents"]).to eq(62)
    expect { kg.validate_quantity!(BigDecimal("0.126")) }.to raise_error(Amelia3::Error)
    expect(Amelia3::Quote.for(scope, product, unit: "COLL").unavailable_reason).to include("non attestato")
    product.update!(pack_indivisible: true)
    expect(Amelia3::Quote.for(scope, product, unit: "KG").unavailable_reason).to be_present
    expect(rule.contract).not_to have_key("fixedWeight")
  end

  it "does not silently substitute list 000 for a different customer list" do
    customer = scope.customer("C001")
    customer.update!(source_fields: customer.source_fields.merge("cod_lis" => "123"))
    pz = scope.products.find_by!(external_code: "P001")
    expect(Amelia3::Quote.for(scope, pz, customer).unavailable_reason).to include("Listino cliente 123")
  end

  it "uses another attested representation only when the primary channel is absent, never zero" do
    pz = scope.products.find_by!(external_code: "P001")
    evidence = Amelia3::UnitVerification.find_by!(tenant: fixture[:tenant], base_unit: "P")
    evidence.update!(contract: evidence.contract.merge("stockFields" => { "pieces" => "PZ", "packs" => "CONF" }))
    stock = Amelia3::Stock.find_by!(batch_id: scope.batch_id, product_code: pz.external_code)
    stock.update!(pieces: nil, packs: 10)
    quote = Amelia3::Quote.for(scope, pz)
    expect(quote.available).to eq(100)
    expect(quote.terms.values_at("stockField", "stockUnit")).to eq(%w[packs CONF])
    expect(quote.line(id: SecureRandom.uuid, quantity: BigDecimal("1"))["lineNetCents"]).to eq(123)
    stock.update!(pieces: 0)
    expect(Amelia3::Quote.for(scope, pz).unavailable_reason).to include("non disponibile")
  end

  it "quotes both certified candidate units with exact verified weight factors and decimal steps" do
    weight_evidence
    product.update!(weight_per_pack: "2.5", packs_per_case: "2")
    kg = Amelia3::Quote.for(scope, product, unit: "KG")
    cases = Amelia3::Quote.for(scope, product, unit: "COLL")
    expect(kg.step).to eq(BigDecimal("0.1"))
    expect(kg.line(id: SecureRandom.uuid, quantity: BigDecimal("0.3"))["lineNetCents"]).to eq(150)
    expect(cases.exact_unit_price).to eq(Rational(25))
    expect(cases.available).to eq(Rational(2))
    expect(cases.terms["stockUnit"]).to eq("KG")
    expect(cases.terms["priceUnit"]).to eq("KG")
    expect { cases.validate_quantity!(BigDecimal("3")) }.to raise_error(Amelia3::Error)
    expect { kg.validate_quantity!(BigDecimal("0.15")) }.to raise_error(Amelia3::Error)
    expect(Amelia3::Quote.for(scope, product, unit: "PZ").unavailable_reason).to include("mappa")
  end

  it "never substitutes another stock channel, and detects discordant attested channels" do
    rule = weight_evidence
    rule.update!(contract: rule.contract.merge("stockFields" => { "weight" => "KG", "packs" => "CONF" }))
    product.update!(weight_per_pack: 2)
    expect(Amelia3::Quote.for(scope, product).unavailable_reason).to include("discordanti")
    rule.update!(contract: rule.contract.merge("stockFields" => { "weight" => "KG" }))
    Amelia3::Stock.find_by!(batch_id: scope.batch_id, product_code: product.external_code).update!(weight: -1, pieces: 1000)
    expect(Amelia3::Quote.for(scope, product).unavailable_reason).to include("non disponibile")
  end

  it "blocks variable-weight conversions and requires a separately attested fractional step" do
    rule = weight_evidence
    expect { rule.update!(contract: rule.contract.merge("fixedWeight" => false)) }.to raise_error(ActiveRecord::RecordInvalid)
    rule.reload.update!(contract: rule.reload.contract.merge("steps" => { "COLL" => "1" }))
    expect(Amelia3::Quote.for(scope, product, unit: "KG").unavailable_reason).to include("non attestato")
  end

  it "rounds a recurring converted price only once per line and preserves exact evidence" do
    product.update!(base_unit: "C", order_unit: "P", pieces_per_pack: 3)
    attest_fixture_units(fixture[:tenant], base: "C", order: "P")
    Amelia3::Price.find_by!(batch_id: scope.batch_id, product_code: product.external_code, list_code: "000").update!(amount: "1")
    quote = Amelia3::Quote.for(scope, product, unit: "PZ")
    line = quote.line(id: SecureRandom.uuid, quantity: BigDecimal("3"))
    expect(line["exactUnitPrice"]).to eq({ "n" => "1", "d" => "3" })
    expect(line["lineNetCents"]).to eq(100)
    expect(line.dig("priceSnapshot", "priceUnit")).to eq("CONF")
    expect(line.dig("priceSnapshot", "conversionVersion")).to be_present
    product.update!(blocked: true)
    expect(Amelia3::Quote.for(scope, product).wire["status"]).to eq("BLOCKED_BY_SOURCE")
  end

  it "aggregates different order units against one physical stock and preserves orders on rule changes" do
    weight_evidence
    product.update!(weight_per_pack: "2.5", packs_per_case: "2")
    id = SecureRandom.uuid
    submit = lambda do |type, payload|
      Amelia3::Commands.call(user: fixture[:agent], command: { "operationId" => SecureRandom.uuid, "epoch" => 1,
        "baseVersion" => scope.tenant.revision, "type" => type, "payload" => payload.merge("batchId" => scope.batch_id) })
    end
    submit.call("CREATE_DRAFT", { "id" => id, "customerId" => "C001" })
    add = lambda do |unit, count|
      quote = Amelia3::Quote.for(scope, product, unit: unit)
      submit.call("ADD_LINE", { "orderId" => id, "lineId" => SecureRandom.uuid, "productId" => product.external_code,
        "unit" => unit, "quantity" => count, "expectedConversionVersion" => quote.terms["conversionVersion"],
        "expectedExactPrice" => Amelia3::ExactValue.wire(quote.exact_unit_price), "expectedVersion" => Amelia3::Order.find(id).version })
    end
    add.call("COLL", "1")
    add.call("KG", "5")
    order = Amelia3::Order.find(id)
    expect(order.net_cents).to eq(5000)
    expect { add.call("KG", "0.1") }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("INSUFFICIENT_STOCK") }
    saved = order.lines.deep_dup
    product.update!(weight_per_pack: "3")
    expect { submit.call("CONFIRM_ORDER", { "orderId" => id, "expectedVersion" => order.version }) }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("CONVERSION_CHANGED") }
    expect(order.reload.lines).to eq(saved)
    expect(order.status).to eq("DRAFT")
  end
end
