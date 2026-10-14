require "rails_helper"
require_relative "../support/amelia3_fixture"

RSpec.describe Amelia3::Quote do
  include Amelia3Fixture
  let(:fixture) { commercial_fixture }
  let(:scope) { Amelia3::Scope.new(fixture[:agent]) }
  let(:product) { scope.products.find_by!(external_code: "P001") }
  after { FileUtils.remove_entry(fixture[:directory]) }

  it "honors pack and case indivisibility without summing cf, pz or pe" do
    product.update!(pack_indivisible: true, case_indivisible: true)
    quote = described_class.for(scope, product, scope.customer("C001"))
    expect(quote.step).to eq(BigDecimal("20"))
    expect { quote.validate_quantity!(BigDecimal("10")) }.to raise_error(Amelia3::Error)
    expect { quote.validate_quantity!(BigDecimal("20")) }.not_to raise_error
    Amelia3::Stock.find_by!(batch_id: scope.batch_id, product_code: "P001").update!(pieces: 0, packs: 100, weight: 100)
    expect(described_class.for(scope, product).unavailable_reason).to eq("Giacenza autorevole non disponibile")
  end

  it "keeps precision and inclusive validity and rejects overlapping conditions" do
    condition = Amelia3::Condition.find_by!(batch_id: scope.batch_id, customer_code: "C001")
    condition.update!(valid_from: Time.zone.today, valid_to: Time.zone.today)
    expect(described_class.for(scope, product, scope.customer("C001")).unit_price).to eq(BigDecimal("1.1913504"))
    condition.dup.tap { |row| row.source_row += 1; row.save! }
    expect(described_class.for(scope, product, scope.customer("C001")).unavailable_reason).to include("sovrapposte")
  end

  it "does not round a condition price for the offline cache or a source percentage during import" do
    condition = Amelia3::Condition.find_by!(batch_id: scope.batch_id, customer_code: "C001")
    condition.update!(price: "1.1234567", discount: 0)
    expect(described_class.for(scope, product, scope.customer("C001")).unit_price).to be_nil
    dto = Amelia3::Snapshot.condition_data(condition)
    expect(dto["priceMicros"]).to be_nil
    expect(dto["unavailableReason"]).to include("Precisione")
    expect { Amelia3::ImportMapper.new({ "sconto" => "1.00001" }, 1).send(:decimal, "sconto") }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("DECIMAL_PRECISION") }
  end
end
