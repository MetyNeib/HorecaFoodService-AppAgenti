require "rails_helper"

RSpec.describe "Authenticated command API", type: :request do
  # Rails 8 lazily loads routes; Warden must know the Devise serializer before
  # test sign_in stores the first user in a session.
  before(:all) { Rails.application.reload_routes! }
  let(:user) { User.create!(email: "api@example.invalid", password: "TestHfsLocale2026!", agent_id: "AG-014") }
  let(:headers) { { "ACCEPT" => "application/json" } }

  def mutation_headers(data)
    { "X-CSRF-Token" => data.fetch("csrfToken"), "X-HFS-User-Id" => user.id.to_s }
  end

  def snapshot
    get "/snapshot", headers: headers
    expect(response).to have_http_status(:ok)
    JSON.parse(response.body)
  end

  def command(data, type: "CREATE_DRAFT", payload: { "id" => "API-ORDER", "customerId" => "CLI-061001" })
    { operationId: SecureRandom.uuid, baseVersion: data.fetch("version"), epoch: data.fetch("epoch"), type: type, payload: payload }
  end

  it "requires authentication for snapshots" do
    get "/snapshot", headers: headers
    expect(response).to have_http_status(:unauthorized)
  end

  it "requires authentication for mutations" do
    post "/commands", params: {}, as: :json
    expect(response).to have_http_status(:unauthorized)
  end

  it "serves private scoped snapshots with a CSRF token" do
    sign_in user, scope: :user
    data = snapshot
    expect(data.fetch("csrfToken")).not_to be_empty
    expect(data["state"]["data"]["customers"].length).to eq(8)
    expect(response.headers["Cache-Control"]).to include("no-store")
  end

  it "accepts an authenticated CSRF-protected command and returns the new version" do
    sign_in user, scope: :user
    data = snapshot
    post "/commands", params: command(data), headers: mutation_headers(data), as: :json
    expect(response).to have_http_status(:ok)
    result = JSON.parse(response.body)
    expect(result["version"]).to eq(1)
    expect(result["state"]["data"]["orders"].any? { |order| order["id"] == "API-ORDER" }).to be(true)
  end

  it "rejects a stale write with 409 and preserves its payload on the client" do
    sign_in user, scope: :user
    data = snapshot
    first = command(data)
    post "/commands", params: first, headers: mutation_headers(data), as: :json
    expect(response).to have_http_status(:ok)
    post "/commands", params: command(data, payload: { "id" => "STALE-ORDER", "customerId" => "CLI-061001" }), headers: mutation_headers(data), as: :json
    expect(response).to have_http_status(:conflict)
    expect(JSON.parse(response.body).fetch("snapshot").fetch("version")).to eq(1)
  end

  it "rejects an out-of-portfolio customer instead of trusting UI filtering" do
    sign_in user, scope: :user
    data = snapshot
    unassigned = Hfs::Seed.data["customers"].find { |customer| customer["agentId"] != "AG-014" }
    post "/commands", params: command(data, payload: { "id" => "FORBIDDEN", "customerId" => unassigned["id"] }), headers: mutation_headers(data), as: :json
    expect(response).to have_http_status(:forbidden)
    expect(user.reload.workspace.version).to eq(0)
  end

  it "rejects an invalid order with an explicit validation result" do
    sign_in user, scope: :user
    data = snapshot
    post "/commands", params: command(data, type: "CONFIRM_ORDER", payload: { "orderId" => "WA-26-00843" }), headers: mutation_headers(data), as: :json
    expect(response).to have_http_status(:unprocessable_content)
    expect(JSON.parse(response.body).fetch("details")).to include(a_string_matching(/WhatsApp/))
  end

  it "does not expose arbitrary customer pages" do
    sign_in user, scope: :user
    get "/customers/CLI-061012"
    expect(response).to have_http_status(:not_found)
  end

  it "rejects writes without a CSRF token" do
    sign_in user, scope: :user
    data = snapshot
    previous = ActionController::Base.allow_forgery_protection
    begin
      ActionController::Base.allow_forgery_protection = true
      post "/commands", params: command(data), headers: { "X-HFS-User-Id" => user.id.to_s }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
      expect(JSON.parse(response.body)).to include("code" => "CSRF_EXPIRED")
      expect(user.reload.workspace.version).to eq(0)
    ensure
      ActionController::Base.allow_forgery_protection = previous
    end
  end

  it "rejects a queued command if another tab switched the session account" do
    sign_in user, scope: :user
    data = snapshot
    pending = command(data)
    other = User.create!(email: "switched@example.invalid", password: "TestHfsLocale2026!", agent_id: "AG-014")
    sign_out user
    sign_in other, scope: :user
    current = snapshot
    post "/commands", params: pending, headers: { "X-CSRF-Token" => current.fetch("csrfToken"), "X-HFS-User-Id" => user.id.to_s }, as: :json
    expect(response).to have_http_status(:unauthorized)
    expect(JSON.parse(response.body)).to include("code" => "ACCOUNT_CHANGED")
    expect(other.reload.workspace.version).to eq(0)
    expect(user.reload.workspace.version).to eq(0)
    expect(JSON.parse(response.body)).not_to have_key("snapshot")
  end

  it "requires an explicit account binding on JSON mutations" do
    sign_in user, scope: :user
    data = snapshot
    post "/commands", params: command(data), headers: { "X-CSRF-Token" => data.fetch("csrfToken") }, as: :json
    expect(response).to have_http_status(:unauthorized)
    expect(user.reload.workspace.version).to eq(0)
  end

  it "confirms the submitted HTML review atomically and redirects to pending orders" do
    sign_in user, scope: :user
    data = snapshot
    created = Hfs::Commands.call(user: user, command: command(data).deep_stringify_keys)
    added = Hfs::Commands.call(user: user, command: {
      "operationId" => SecureRandom.uuid, "baseVersion" => created[:version], "epoch" => created[:epoch], "type" => "ADD_LINE",
      "payload" => { "orderId" => "API-ORDER", "lineId" => "API-LINE", "productId" => "ART-0107417", "quantity" => 1, "unit" => "CT" }
    })
    post "/commands", params: {
      operationId: SecureRandom.uuid, baseVersion: added[:version].to_s, epoch: added[:epoch].to_s,
      owner_user_id: user.id.to_s, authenticity_token: data.fetch("csrfToken"), type: "CONFIRM_ORDER", return_to: "/orders?tab=drafts",
      payload: { orderId: "API-ORDER", note: "Consegnare dal retro", deliveryDate: "2026-09-23" }
    }
    expect(response).to have_http_status(:see_other)
    expect(response).to redirect_to("/orders?tab=pending")
    order = user.reload.workspace.state["data"]["orders"].find { |item| item["id"] == "API-ORDER" }
    expect(order).to include("status" => "PENDING_SEND", "note" => "Consegnare dal retro")
  end

  it "does not silently default an HTML form to the newest server version" do
    sign_in user, scope: :user
    data = snapshot
    post "/commands", params: {
      operationId: SecureRandom.uuid, owner_user_id: user.id.to_s, authenticity_token: data.fetch("csrfToken"),
      type: "CREATE_DRAFT", return_to: "/", payload: { id: "NO-VERSION", customerId: "CLI-061001" }
    }
    expect(response).to have_http_status(:see_other)
    expect(user.reload.workspace.version).to eq(0)
  end
end
