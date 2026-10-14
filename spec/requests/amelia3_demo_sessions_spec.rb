require "rails_helper"
require_relative "../support/amelia3_fixture"

RSpec.describe "Amelia3 demo account selection", type: :request do
  include Amelia3Fixture
  let(:fixture) { commercial_fixture }
  before do
    Rails.application.reload_routes!
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("AMELIA3_DEMO_SWITCH").and_return("1")
    allow(ENV).to receive(:[]).with("AMELIA3_DEMO_ADMIN_ID").and_return(fixture[:admin].id.to_s)
    allow(ENV).to receive(:[]).with("AMELIA3_DEMO_AGENT_ID").and_return(fixture[:agent].id.to_s)
  end
  after { FileUtils.remove_entry(fixture[:directory]) }

  def switch(from, to, path = "/amelia3/customers")
    get "/amelia3/snapshot", as: :json
    token = response.parsed_body["csrfToken"]
    post "/amelia3/demo_session", params: { account_id: to.id, return_to: path }, headers: { "X-CSRF-Token" => token, "X-HFS-User-Id" => Amelia3::Snapshot.identity(from) }, as: :json
  end

  it "preserves allowed pages, limits the portfolio, attributes writes and returns to Admin without passwords" do
    sign_in fixture[:admin]
    switch(fixture[:admin], fixture[:agent])
    expect(response.parsed_body["location"]).to eq("/amelia3/customers")
    get "/amelia3/customers/C003"
    expect(response).to have_http_status(:not_found)
    get "/amelia3/snapshot", as: :json
    expect(response.parsed_body.dig("user", "role")).to eq("agent")
    scope = Amelia3::Scope.new(fixture[:agent])
    post "/amelia3/commands", params: { operationId: SecureRandom.uuid, baseVersion: scope.tenant.revision, epoch: 1, type: "CREATE_DRAFT", payload: { id: SecureRandom.uuid, customerId: "C001", batchId: scope.batch_id } }, headers: { "X-CSRF-Token" => response.parsed_body["csrfToken"], "X-HFS-User-Id" => Amelia3::Snapshot.identity(fixture[:agent]) }, as: :json
    expect(response).to have_http_status(:ok)
    expect(Amelia3::Receipt.last).to have_attributes(user_id: fixture[:agent].id, originating_admin_id: fixture[:admin].id)
    switch(fixture[:agent], fixture[:admin])
    expect(response).to have_http_status(:ok)
    get "/amelia3/customers/C003"
    expect(response).to have_http_status(:ok)
  end

  it "falls back to Home for unauthorized pages and refuses stale owner headers" do
    sign_in fixture[:admin]
    switch(fixture[:admin], fixture[:agent], "/amelia3/customers/C003")
    expect(response.parsed_body["location"]).to eq("/amelia3")
    switch(fixture[:admin], fixture[:admin])
    expect(response).to have_http_status(:conflict)
    switch(fixture[:agent], fixture[:admin], "https://example.org/amelia3")
    expect(response.parsed_body["location"]).to eq("/amelia3")
  end

  it "can sign out while viewing the agent and rejects foreign accounts" do
    sign_in fixture[:admin]
    foreign = User.create!(email: "foreign-demo@example.invalid", password: "TestForeign123!", role: "admin", dataset_mode: "amelia3", commercial_tenant: fixture[:tenant], agent_id: "ADMIN")
    switch(fixture[:admin], foreign)
    expect(response).to have_http_status(:not_found)
    switch(fixture[:admin], fixture[:agent])
    get "/amelia3/snapshot", as: :json
    delete "/users/sign_out", headers: { "X-CSRF-Token" => response.parsed_body["csrfToken"], "X-HFS-User-Id" => Amelia3::Snapshot.identity(fixture[:agent]) }
    expect(response).to have_http_status(:see_other).or have_http_status(:found)
    get "/amelia3/snapshot", as: :json
    expect(response).to have_http_status(:unauthorized)
  end

  it "denies direct agents and disabled demo access" do
    sign_in fixture[:agent]
    switch(fixture[:agent], fixture[:admin])
    expect(response).to have_http_status(:not_found)
    sign_in fixture[:admin]
    allow(ENV).to receive(:[]).with("AMELIA3_DEMO_SWITCH").and_return(nil)
    switch(fixture[:admin], fixture[:agent])
    expect(response).to have_http_status(:not_found)
  end
end
