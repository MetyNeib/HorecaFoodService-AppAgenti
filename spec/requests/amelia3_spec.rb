require "rails_helper"
require_relative "../support/amelia3_fixture"

RSpec.describe "Amelia3 HTTP authorization", type: :request do
  include Amelia3Fixture
  before(:all) { Rails.application.reload_routes! }
  let(:fixture) { commercial_fixture }
  let(:agent) { fixture[:agent] }
  after { FileUtils.remove_entry(fixture[:directory]) }

  def snapshot
    get "/amelia3/snapshot", headers: { "Accept" => "application/json" }
    expect(response).to have_http_status(:ok)
    JSON.parse(response.body)
  end

  def create(data, code = "C001", owner = data.dig("user", "id"))
    post "/amelia3/commands", as: :json,
      headers: { "X-CSRF-Token" => data["csrfToken"], "X-HFS-User-Id" => owner },
      params: { operationId: SecureRandom.uuid, baseVersion: data["version"], epoch: 1, type: "CREATE_DRAFT",
                payload: { id: SecureRandom.uuid, customerId: code, batchId: data.dig("state", "data", "batchId") } }
  end

  it "requires login and denies synthetic accounts and inactive capoarea" do
    get "/amelia3/snapshot", headers: { "Accept" => "application/json" }
    expect(response).to have_http_status(:unauthorized)
    user = User.create!(email: "synthetic@example.invalid", password: "TestHfsLocale2026!", agent_id: "AG-014")
    sign_in user
    get "/amelia3/snapshot", headers: { "Accept" => "application/json" }
    expect(response).to have_http_status(:forbidden)
    agent.update!(role: "capoarea")
    sign_in agent
    get "/amelia3", headers: { "Accept" => "application/json" }
    expect(response).to have_http_status(:forbidden)
  end

  it "scopes pages, history, finance, requested cache codes and admin synchronization" do
    sign_in agent
    data = snapshot
    expect(data.dig("state", "data", "customers").map { |row| row["id"] }).to match_array(%w[C001 C002])
    expect(data.dig("state", "data")).not_to have_key("history")
    expect(response.headers["Cache-Control"]).to include("no-store")
    get "/amelia3/snapshot", params: { customers: [ "C003" ] }, headers: { "Accept" => "application/json" }
    expect(response.body).not_to include("Cliente sintetico esterno")
    %w[/amelia3/customers/C003 /amelia3/history?customer_id=C003 /amelia3/insights?customer_id=C003].each do |path|
      get path
      expect(response).to have_http_status(:not_found)
      expect(response.body).not_to include("Cliente sintetico esterno")
    end
    get "/amelia3/history"
    expect(response.body).to include("SYNTHETIC-ORDER-1")
    expect(response.body).not_to include("SYNTHETIC-ORDER-2")
    get "/amelia3/customers/C001?tab=open_items"
    expect(response.body).to include("DOC-SYNTHETIC")
    get "/amelia3/sync"
    expect(response).to have_http_status(:forbidden)
  end

  it "shares an Admin-created order with the assigned agent but hides unrelated orders" do
    sign_in fixture[:admin]
    create(snapshot)
    expect(response).to have_http_status(:ok)
    own_id = JSON.parse(response.body).dig("state", "data", "orders").first["id"]
    create(snapshot, "C003")
    expect(response).to have_http_status(:ok)
    foreign_id = JSON.parse(response.body).dig("state", "data", "orders").first["id"]
    sign_in agent
    get "/amelia3/orders/#{own_id}"
    expect(response).to have_http_status(:ok)
    get "/amelia3/orders/#{foreign_id}"
    expect(response).to have_http_status(:not_found)
    get "/amelia3/snapshot", params: { order_id: foreign_id }, headers: { "Accept" => "application/json" }
    expect(response).to have_http_status(:not_found)
    expect(Amelia3::Order.count).to eq(2)
  end

  it "denies foreign and blocked customers at the API and rejects stale account namespaces" do
    sign_in agent
    data = snapshot
    create(data, "C003")
    expect(response).to have_http_status(:not_found)
    create(data, "C002")
    expect(response).to have_http_status(:unprocessable_content)
    expect(JSON.parse(response.body)["code"]).to eq("CUSTOMER_BLOCKED")
    create(data, "C001", "amelia3-wrong-owner")
    expect(response).to have_http_status(:unauthorized)
    expect(Amelia3::Order.count).to eq(0)
  end

  it "denies synthetic reset and ignores a logout from an obsolete account tab" do
    sign_in agent
    data = snapshot
    post "/commands", params: { type: "RESET_DEMO" }, as: :json, headers: { "X-CSRF-Token" => data["csrfToken"], "X-HFS-User-Id" => data.dig("user", "id") }
    expect(response).to have_http_status(:forbidden)
    expect(fixture[:tenant].reload.active_batch_id).to eq(fixture[:batch].id)
    expect(Workspace.count).to eq(0)
    delete "/users/sign_out", headers: { "X-HFS-User-Id" => "wrong-account", "X-CSRF-Token" => data["csrfToken"] }
    expect(response).to have_http_status(:unauthorized)
    expect(snapshot.dig("user", "ownerId")).to eq(agent.id)
  end

  it "requires CSRF and never reveals data from another tenant" do
    sign_in agent
    data = snapshot
    previous = ActionController::Base.allow_forgery_protection
    begin
      ActionController::Base.allow_forgery_protection = true
      post "/amelia3/commands", params: {}, as: :json, headers: { "X-HFS-User-Id" => data.dig("user", "id") }
      expect(response).to have_http_status(:unprocessable_content)
      expect(JSON.parse(response.body)["code"]).to eq("CSRF_EXPIRED")
    ensure
      ActionController::Base.allow_forgery_protection = previous
    end
    other = Amelia3::Tenant.create!(code: "other-synthetic", name: "Altro tenant sintetico")
    order = Amelia3::Order.create!(tenant: other, created_by_user: fixture[:admin], customer_code: "C001", assigned_agent_code: "34")
    get "/amelia3/orders/#{order.id}"
    expect(response).to have_http_status(:not_found)
  end

  it "supports native HTML forms with a concrete order redirect when offline storage is unavailable" do
    sign_in agent
    data = snapshot
    id = SecureRandom.uuid
    post "/amelia3/commands", params: { type: "CREATE_DRAFT", operationId: SecureRandom.uuid,
      baseVersion: data["version"].to_s, epoch: "1", owner_user_id: data.dig("user", "id"), authenticity_token: data["csrfToken"],
      return_to: "/amelia3/catalog?order_id=:id", payload: { id: id, customerId: "C001", batchId: fixture[:batch].id } }
    expect(response).to have_http_status(:see_other)
    expect(response.location).to end_with("/amelia3/catalog?order_id=#{id}")
    follow_redirect!
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Prodotto sintetico P")
  end

  it "rejects an incomplete native form without exposing an exception or mutating orders" do
    sign_in agent
    data = snapshot
    post "/amelia3/commands", params: { type: "ADD_LINE", operationId: SecureRandom.uuid, baseVersion: "1", epoch: "1",
      owner_user_id: data.dig("user", "id"), authenticity_token: data["csrfToken"] }
    expect(response).to have_http_status(:unprocessable_content)
    expect(response.body).to include("Operazione non consentita")
    expect(Amelia3::Order.count).to eq(0)
  end
end
