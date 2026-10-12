require "spec_helper"
require_relative "../../app/services/hfs/validation_error"
require_relative "../../app/services/hfs/seed"
require_relative "../../app/services/hfs/calculations"

RSpec.describe Hfs::Calculations do
  let(:data) { Hfs::Seed.data }
  let(:product) { data.fetch("products").find { |item| item["demoKey"] == "lager" } }
  let(:customer) { data.fetch("customers").find { |item| item["id"] == "CLI-061001" } }
  let(:clock) { data.fetch("meta").fetch("demoClock") }

  it("rounds positive half-up ties") { expect(described_class.half_up(5, 2)).to eq(3) }
  it("rounds negative half-up ties symmetrically") { expect(described_class.half_up(-5, 2)).to eq(-3) }
  it("rounds values below the tie") { expect(described_class.half_up(249, 100)).to eq(2) }
  it("rejects a zero divisor") { expect { described_class.half_up(2, 0) }.to raise_error(Hfs::ValidationError) }
  it("keeps leading-zero product codes") { expect(product.fetch("code")).to eq("0107417") }
  it("converts two cases once") { expect(described_class.base_quantity(product, 2, "CT")).to eq("quantity" => 30, "estimated" => false) }
  it("accepts COLLI as CT") { expect(described_class.base_quantity(product, 1, "COLLI")).to eq(described_class.base_quantity(product, 1, "CT")) }
  it("leaves base pieces unchanged") { expect(described_class.base_quantity(product, 3, "PZ")["quantity"]).to eq(3) }

  [ [ 0, "CT" ], [ -1, "CT" ], [ 1, "KG" ], [ 1.5, "CT" ], [ Float::NAN, "PZ" ], [ "2", "CT" ] ].each do |quantity, unit|
    it("rejects invalid quantity/unit #{quantity.inspect} #{unit}") do
      expect { described_class.base_quantity(product, quantity, unit) }.to raise_error(Hfs::ValidationError)
    end
  end

  it "calculates line revenue, cost and margin" do
    expect(described_class.line_amounts(15, 120, 91)).to eq("netCents" => 1800, "costCents" => 1365, "marginCents" => 435, "marginPercent" => 24.17)
  end
  it("rounds half-cent once per line") { expect(described_class.line_amounts(0.5, 125, 90)["netCents"]).to eq(63) }
  it "keeps the cost of gifts" do
    expect(described_class.line_amounts(15, 120, 91, true)).to eq("netCents" => 0, "costCents" => 1365, "marginCents" => -1365, "marginPercent" => nil)
  end
  it("rejects fractional cents") { expect { described_class.line_amounts(1, 120.1, 90) }.to raise_error(Hfs::ValidationError) }
  it("rejects negative price") { expect { described_class.line_amounts(1, -1, 90) }.to raise_error(Hfs::ValidationError) }
  it("rejects fourth quantity decimal") { expect { described_class.line_amounts(0.1234, 100, 90) }.to raise_error(Hfs::ValidationError) }
  it "weights the order margin by revenue" do
    expect(described_class.sum_amounts([ described_class.line_amounts(1, 100, 50), described_class.line_amounts(1, 900, 720) ])["marginPercent"]).to eq(23)
  end
  it("gives an empty cart no margin percentage") { expect(described_class.sum_amounts([])).to eq("netCents" => 0, "costCents" => 0, "marginCents" => 0, "marginPercent" => nil) }
  it("includes the first day") { expect(described_class.condition_active?(data["customerConditions"][0], "2026-09-01")).to be(true) }
  it("includes the last day") { expect(described_class.condition_active?(data["customerConditions"][0], "2026-09-30")).to be(true) }
  it("ignores expired conditions") { expect(described_class.condition_active?(data["customerConditions"][4], clock)).to be(false) }
  it("ignores future conditions") { expect(described_class.condition_active?(data["customerConditions"][5], clock)).to be(false) }
  it "prefers active fixed prices" do
    expect(described_class.resolve_price(data, customer, product, clock)).to eq("unitPriceBaseCents" => 120, "source" => "FIXED_PRICE", "conditionId" => "COND-001")
  end
  it("falls back to the customer list") { expect(described_class.resolve_price(data, customer, product, "2026-10-01")["source"]).to eq("CUSTOMER_LIST") }
  it "rejects overlapping conditions" do
    data.fetch("customerConditions") << data.fetch("customerConditions").first.merge("id" => "DUPLICATE")
    expect { described_class.resolve_price(data, customer, product, clock) }.to raise_error(Hfs::ValidationError, /sovrapposte/)
  end
  it "discounts the reference price once" do
    condition = data.fetch("customerConditions").find { |item| item["type"] == "DISCOUNT" }
    item = data.fetch("products").find { |entry| entry["id"] == condition["productId"] }
    reference = described_class.list_price(data, item, condition.fetch("priceListId"))
    expect(described_class.resolve_price(data, customer, item, clock)["unitPriceBaseCents"]).to eq(described_class.half_up(reference * 9500, 10_000))
  end
  it("normalizes accents and spaces") { expect(described_class.normalize_search("  AGORÀ   SRL ")).to eq("agora srl") }
  it "derives all home counters from canonical orders" do
    expect(described_class.home_counts(data, "AG-014", data["demoDefaults"]["activeCustomerIds"])).to eq("drafts" => 2, "pending" => 1, "sent" => 24, "whatsapp" => 3)
  end
  it("scopes counters by agent") { expect(described_class.home_counts(data, "NO_AGENT", data["demoDefaults"]["activeCustomerIds"]).values).to all(eq(0)) }
  it "handles the credit note once" do
    expect(described_class.receivables_summary(data, customer["id"], clock)).to eq("balanceCents" => 58_746, "overdueCents" => 45_000, "receivedCents" => 10_000)
  end
  it("returns an empty ledger for an unknown customer") { expect(described_class.receivables_summary(data, "NO_CUSTOMER", clock).values).to all(eq(0)) }
  it "does not duplicate the total of an invoice with two instalments" do
    rows = data["receivables"].select { |row| row["invoiceId"] == "DOC-F-26-00872" }
    expect(rows.length).to eq(2)
    expect(rows.sum { |row| row["faceValueCents"] }).to eq(48_000)
    expect(described_class.receivables_summary(data, "CLI-061002", clock)).to eq("balanceCents" => 36_000, "overdueCents" => 12_000, "receivedCents" => 12_000)
  end
  it("rejects impossible ISO dates") { expect { described_class.day("2026-02-31") }.to raise_error(Hfs::ValidationError) }
  it("rejects amounts outside JavaScript's safe integer range") { expect { described_class.line_amounts(1, 10**18, 0) }.to raise_error(Hfs::ValidationError) }
end
