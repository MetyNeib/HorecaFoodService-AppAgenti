require 'rails_helper'
require_relative '../support/amelia3_fixture'
require_relative '../support/amelia3_feed_fixture'

RSpec.describe Amelia3::SubstitutionReview do
  include Amelia3Fixture
  include Amelia3FeedFixture
  let(:fixture) { commercial_fixture }
  let(:tenant) { fixture[:tenant] }
  let(:day) { Date.new(2026, 10, 15) }
  after { FileUtils.remove_entry(fixture[:directory]) }

  def prepare(original: 'Pomodoro secco', replacement: 'Pomodoro fresco', replacement_days: [ 2 ], replacement_shipped: 1)
    batch = fixture[:batch]
    Amelia3::Product.find_by!(batch: batch, external_code: 'P001').update!(name: original)
    Amelia3::Product.find_by!(batch: batch, external_code: 'K001').update!(name: replacement)
    Amelia3::HistoryRow.where(batch: batch).delete_all
    # Keep the customer active even when B is too old to be a substitute.
    dates = [ [ 'OTHER', 1, 1 ] ] + [ 100, 90, 80, 70, 60 ].map { |ago| [ 'P001', ago, 1 ] } + replacement_days.map { |ago| [ 'K001', ago, replacement_shipped ] }
    prototype = Amelia3::Product.find_by!(batch: batch, external_code: 'P001')
    Amelia3::Product.create!(prototype.attributes.except('id', 'external_code').merge(external_code: 'OTHER', name: 'Carta forno'))
    dates.each_with_index do |(code, ago, shipped), index|
      Amelia3::HistoryRow.create!(batch: batch, source_row: index + 1, customer_code: 'C001', product_code: code, order_reference: "QA#{index}", delivery_date: day - ago, packs: 1, pieces: 1, weight: 1, shipped: shipped)
    end
    files = batch.files.deep_dup
    files['STORICO.csv']['sha256'] = SecureRandom.hex(32)
    batch.update!(files: files)
    Amelia3::SalesAlerts.call(tenant: tenant, as_of: day)
    allow(Amelia3::OpenaiProductSearch).to receive(:new).and_return(double(model: 'test', configured?: true, call: Amelia3::ProductMatching::Result.new(codes: [], status: 'complete', method: 'ai')))
  end

  it 'suppresses on one recent positive delivered substitute, including products previously bought together' do
    prepare(replacement_days: [ 100, 80, 2 ])
    described_class.call(tenant: tenant)
    review = Amelia3::AlertReview.joins(:alert_item).find_by!(amelia3_alert_items: { product_code: 'P001' })
    expect(review.status).to eq('suppressed')
    expect(review.evidence['substitutes']).to eq([ { 'code' => 'K001', 'purchasedOn' => (day - 2).iso8601 } ])
    expect(Amelia3::Scope.new(fixture[:agent]).sales_alert_count).to eq(0)
    expect(Amelia3::SalesAlerts.call(tenant: tenant, as_of: day, full: true).metrics['identical']).to eq(true)
  end

  it 'keeps normal versus zero distinct even if the product was purchased recently' do
    prepare(original: 'Cola normale', replacement: 'Cola zero')
    described_class.call(tenant: tenant)
    expect(Amelia3::AlertReview.sole.status).to eq('kept')
    expect(Amelia3::Scope.new(fixture[:agent]).sales_alert_count).to eq(1)
  end

  it 'requires B after A and within A’s expected purchase window' do
    prepare(replacement_days: [ 50 ])
    described_class.call(tenant: tenant)
    expect(Amelia3::AlertReview.sole.status).to eq('kept')
  end

  it 'ignores zero shipped quantities and incoming WhatsApp copies' do
    prepare(replacement_shipped: 0)
    Amelia3::IncomingOrder.receive!(tenant: tenant, name: 'synthetic.csv', bytes: incoming_csv(product: 'K001'), archived: false)
    described_class.call(tenant: tenant)
    expect(Amelia3::AlertReview.sole.status).to eq('kept')
  end

  it 'excludes unresolved reviews from both pages and counters without claiming substitution' do
    prepare(replacement: 'Articolo con nome ambiguo')
    allow(Amelia3::OpenaiProductSearch).to receive(:new).and_return(double(model: 'test', configured?: false, call: Amelia3::ProductMatching::Result.new(codes: [], status: 'pending', method: 'key_missing')))
    described_class.call(tenant: tenant)
    expect(Amelia3::AlertReview.sole.status).to eq('pending')
    expect(Amelia3::AlertReview.sole.evidence['substitutes']).to be_empty
    scope = Amelia3::Scope.new(fixture[:agent])
    expect(scope.sales_alert_count).to eq(0)
    expect(Amelia3::AlertPage.new(scope, {}).total).to eq(0)
  end
end
