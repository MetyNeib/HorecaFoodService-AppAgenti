require 'rails_helper'
require_relative '../support/amelia3_fixture'
require_relative '../support/amelia3_feed_fixture'

RSpec.describe 'Amelia3 incoming orders', type: :request do
  include Amelia3Fixture
  include Amelia3FeedFixture
  let(:fixture) { commercial_fixture }
  let(:incoming) { Amelia3::IncomingOrder.receive!(tenant: fixture[:tenant], name: 'synthetic.csv', bytes: incoming_csv, archived: false) }
  before do
    Rails.application.reload_routes!
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with('AMELIA3_DEMO_SWITCH').and_return('1')
    allow(ENV).to receive(:[]).with('AMELIA3_DEMO_ADMIN_ID').and_return(fixture[:admin].id.to_s)
    allow(ENV).to receive(:[]).with('AMELIA3_DEMO_AGENT_ID').and_return(fixture[:agent].id.to_s)
    sign_in fixture[:admin]
  end
  after { FileUtils.remove_entry(fixture[:directory]) }

  def action(operation, version: incoming.reload.lock_version, draft: nil, owner: fixture[:admin])
    get '/amelia3/snapshot', as: :json
    patch "/amelia3/whatsapp/#{incoming.id}", params: { operation: operation, version: version, draft: draft },
      headers: { 'X-CSRF-Token' => response.parsed_body['csrfToken'], 'X-HFS-User-Id' => Amelia3::Snapshot.identity(owner) }, as: :json
  end

  it 'keeps notification after viewing and claiming, edits only the demo copy, and confirms explicitly' do
    original = incoming.original.deep_dup
    get '/amelia3/whatsapp'
    expect(response).to have_http_status(:ok)
    get "/amelia3/whatsapp/#{incoming.id}"
    expect(response.body).to include('data-incoming-deadline', 'Prendi in carico')
    expect(Amelia3::Scope.new(fixture[:admin]).notifications['unreadOrders']).to eq(1)
    action('claim')
    expect(response).to have_http_status(:ok)
    expect(Amelia3::Scope.new(fixture[:admin]).notifications['unreadOrders']).to eq(1)
    edited = incoming.reload.draft.deep_dup
    edited['lines'][0]['quantity'] = '9,5'
    action('save', draft: edited)
    expect(response).to have_http_status(:ok)
    expect(incoming.reload.draft['lines'][0]['quantity']).to eq('9.5')
    expect(incoming.original).to eq(original)
    expect(incoming.audit.last['adminId']).to eq(fixture[:admin].id)
    action('save', version: 0, draft: edited)
    expect(response).to have_http_status(:conflict)
    action('confirm')
    expect(response).to have_http_status(:ok)
    expect(Amelia3::Scope.new(fixture[:admin]).notifications['unreadOrders']).to eq(0)
    expect(incoming.reload.status).to eq('confirmed_demo')
    expect(Amelia3::Order.where(tenant: fixture[:tenant])).to be_empty
  end

  it 'restricts portfolio, stale identity and direct agent access to demo changes' do
    incoming
    action('claim', owner: fixture[:agent])
    expect(response).to have_http_status(:conflict)
    foreign = Amelia3::IncomingOrder.receive!(tenant: fixture[:tenant], name: 'foreign.csv', bytes: incoming_csv(customer: 'C003', reference: 'QA-foreign'), archived: false)
    sign_in fixture[:agent]
    get "/amelia3/whatsapp/#{foreign.id}"
    expect(response).to have_http_status(:not_found)
    action('claim', owner: fixture[:agent])
    expect(response).to have_http_status(:forbidden)
  end

  it 'preserves blocked incoming orders for reading and rejects writes and missing CSRF' do
    incoming.update!(customer_code: 'C002')
    get "/amelia3/whatsapp/#{incoming.id}"
    expect(response.body).to include('sola lettura')
    action('claim')
    expect(response).to have_http_status(:unprocessable_content)
    previous = ActionController::Base.allow_forgery_protection
    begin
      ActionController::Base.allow_forgery_protection = true
      patch "/amelia3/whatsapp/#{incoming.id}", params: { operation: 'claim' }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body['code']).to eq('CSRF_EXPIRED')
    ensure
      ActionController::Base.allow_forgery_protection = previous
    end
  end

  it 'accepts indexed browser fields, adds a product and removes a line only in the demo copy' do
    action('claim')
    draft = { 'deliveryDate' => '2026-10-15', 'note' => 'Nota QA', 'lines' => { '0' => incoming.original['lines'][0].merge('remove' => '1'), '1' => { 'productCode' => 'P001', 'sourceUnit' => 'PZ', 'quantity' => '7' } } }
    action('save', draft: draft)
    expect(response).to have_http_status(:ok)
    expect(incoming.reload.draft['lines'].sole).to include('productCode' => 'P001', 'quantity' => '7.0')
    expect(incoming.original['lines'].sole['quantity']).to eq('2.5')
  end

  it 'shows unknown customers only to Admin as read-only and isolates the Agent portfolio' do
    incoming.update!(customer_code: 'NEW-QA-CUSTOMER')
    get "/amelia3/whatsapp/#{incoming.id}"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include('Cliente non ancora presente')
    sign_in fixture[:agent]
    get "/amelia3/whatsapp/#{incoming.id}"
    expect(response).to have_http_status(:not_found)
  end
end
