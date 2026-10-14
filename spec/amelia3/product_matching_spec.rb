require 'rails_helper'
require_relative '../support/amelia3_fixture'

RSpec.describe Amelia3::ProductMatching do
  include Amelia3Fixture
  let(:fixture) { commercial_fixture }
  after { FileUtils.remove_entry(fixture[:directory]) }
  let(:ai) { instance_double(Amelia3::OpenaiProductSearch, model: 'test', configured?: true) }

  def candidate(code, name)
    { 'code' => code, 'name' => name }
  end

  it 'accepts broad physical substitutions while protecting nutritional and beverage variants' do
    [ [ 'Funghi freschi interi', 'Funghi surgelati tagliati' ], [ 'Pomodoro secco Italia 1kg', 'Pomodoro fresco Spagna 500gr' ], [ 'Latte marca A', 'Latte marca B' ] ].each do |a, b|
      expect(described_class.local(a, [ candidate('B', b) ], mode: 'substitution').length).to eq(1)
    end
    [ [ 'Latte intero', 'Latte senza lattosio' ], [ 'Cola normale', 'Cola zero' ], [ 'Birra', 'Birra analcolica' ], [ 'Pasta', 'Pasta senza glutine' ] ].each do |a, b|
      expect(described_class.local(a, [ candidate('B', b) ], mode: 'substitution')).to be_empty
      expect(described_class.local(b, [ candidate('A', a) ], mode: 'substitution')).to be_empty
    end
  end

  it 'uses local prefix/fuzzy search first and caches semantic results' do
    candidates = [ candidate('A', 'Mozzarella fresca') ]
    expect(ai).not_to receive(:call)
    expect(described_class.call(tenant: fixture[:tenant], query: 'mozzarela', candidates: candidates, ai: ai).codes).to eq([ 'A' ])
  end

  it 'only falls back to AI on no local result and reuses validated results' do
    candidates = [ candidate('A', 'Ceci lessati') ]
    expect(ai).to receive(:call).once.and_return(described_class::Result.new(codes: [ 'A' ], status: 'complete', method: 'ai'))
    2.times { expect(described_class.call(tenant: fixture[:tenant], query: 'chickpeas', candidates: candidates, ai: ai).codes).to eq([ 'A' ]) }
  end

  it 'marks an unavailable API as pending rather than fabricating a replacement or a negative result' do
    result = described_class.call(tenant: fixture[:tenant], query: 'chickpeas', candidates: [ candidate('A', 'Ceci') ], ai: Amelia3::OpenaiProductSearch.new(env: {}))
    expect(result.status).to eq('pending')
    expect(result.codes).to be_empty
  end

  it 'batches independent comparisons and refuses missing or cross-query result identifiers' do
    client = Amelia3::OpenaiProductSearch.new(env: { 'OPENAI_API_KEY' => 'synthetic-test-key' })
    tasks = [ { query: 'chickpeas', candidates: [ candidate('A', 'Ceci') ] }, { query: 'tomatoes', candidates: [ candidate('B', 'Pomodoro') ] } ]
    allow(client).to receive(:request).and_return([ { 'query' => 'q0', 'ids' => [ 'p0' ] }, { 'query' => 'q1', 'ids' => [] } ])
    expect(client.batch_substitutions(tasks).map(&:codes)).to eq([ [ 'A' ], [] ])
    allow(client).to receive(:request).and_return([ { 'query' => 'q0', 'ids' => [ 'p0' ] } ])
    expect(client.batch_substitutions(tasks).map(&:status)).to eq(%w[pending pending])
    allow(client).to receive(:request).and_return([ { 'query' => 'q0', 'ids' => [ 'p99' ] }, { 'query' => 'q1', 'ids' => [] } ])
    expect(client.batch_substitutions(tasks).first.status).to eq('pending')
  end

  it 'validates structured response IDs, rejects refusals and incomplete replies, and sends no customer data' do
    client = Amelia3::OpenaiProductSearch.new(env: { 'OPENAI_API_KEY' => 'synthetic-test-key' })
    allow(client).to receive(:budget_available?).and_return(true)
    transport = double('HTTPS')
    allow(Net::HTTP).to receive(:start).and_yield(transport)
    response = Net::HTTPOK.new('1.1', '200', 'OK')
    body = { status: 'completed', output: [ { type: 'message', content: [ { type: 'output_text', text: { ids: [ 'p0' ] }.to_json } ] } ] }
    allow(response).to receive(:body).and_return(body.to_json)
    allow(transport).to receive(:request) do |request|
      payload = JSON.parse(request.body)
      expect(payload['store']).to eq(false)
      expect(payload['model']).to eq('gpt-6-luna')
      expect(payload['reasoning']).to eq('effort' => 'low')
      expect(payload.dig('text', 'format', 'strict')).to eq(true)
      expect(payload.to_json).not_to include('customerCode', 'purchasedOn', 'C001')
      response
    end
    args = { query: 'chickpeas', candidates: [ candidate('A', 'Ceci') ], mode: 'search' }
    expect(client.call(**args).codes).to eq([ 'A' ])
    body[:output][0][:content][0][:text] = { ids: [ 'not-supplied' ] }.to_json
    allow(response).to receive(:body).and_return(body.to_json)
    expect(client.call(**args).status).to eq('pending')
    allow(response).to receive(:body).and_return({ status: 'incomplete' }.to_json)
    expect(client.call(**args).status).to eq('pending')
  end
end
