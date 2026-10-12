require "rails_helper"
require_relative "../support/amelia3_fixture"

RSpec.describe Amelia3::Commands do
  include Amelia3Fixture
  let(:fixture) { commercial_fixture }
  let(:admin) { fixture[:admin] }
  let(:agent) { fixture[:agent] }
  let(:id) { SecureRandom.uuid }
  after { FileUtils.remove_entry(fixture[:directory]) }

  def intent(user, type, payload, operation: SecureRandom.uuid)
    { "operationId" => operation, "baseVersion" => user.commercial_tenant.reload.revision, "epoch" => 1, "type" => type,
      "payload" => payload.merge("batchId" => user.commercial_tenant.active_batch_id) }
  end

  def draft(user = admin, customer = "C001")
    described_class.call(user: user, command: intent(user, "CREATE_DRAFT", { "id" => id, "customerId" => customer }))
    Amelia3::Order.find(id)
  end

  def add(user = admin, quantity: "3", order: Amelia3::Order.find(id), price: "1.1913504", product: "P001")
    described_class.call(user: user, command: intent(user, "ADD_LINE", { "orderId" => order.id, "lineId" => SecureRandom.uuid, "productId" => product,
      "quantity" => quantity, "expectedUnitPrice" => price, "expectedVersion" => order.version }))
  end

  it "shares one canonical Admin order with its assigned agent and preserves the creator" do
    order = draft
    add
    shared = Amelia3::Scope.new(agent).order(order.id)
    expect(shared.created_by_user_id).to eq(admin.id)
    expect(shared.assigned_agent_code).to eq("34")
    expect(shared.lines.first["unitPrice"]).to eq("1.1913504")
    expect(shared.net_cents).to eq(357)
    expect(Amelia3::Order.where(id: id).count).to eq(1)
  end

  it "replays lost acknowledgements without duplicating orders or lines" do
    value = intent(admin, "CREATE_DRAFT", { "id" => id, "customerId" => "C001" })
    2.times { described_class.call(user: admin, command: value) }
    line = intent(admin, "ADD_LINE", { "orderId" => id, "lineId" => SecureRandom.uuid, "productId" => "P001", "quantity" => "3", "expectedUnitPrice" => "1.1913504", "expectedVersion" => 0 })
    2.times { described_class.call(user: admin, command: line) }
    expect(Amelia3::Order.find(id).lines.length).to eq(1)
    expect(Amelia3::Receipt.where(user: admin).count).to eq(2)
  end

  it "rejects operation ID reuse with another payload" do
    value = intent(admin, "CREATE_DRAFT", { "id" => id, "customerId" => "C001" })
    described_class.call(user: admin, command: value)
    value["payload"]["customerId"] = "C003"
    expect { described_class.call(user: admin, command: value) }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("IDEMPOTENCY_CONFLICT") }
  end

  it "enforces portfolio scope on direct IDs and tenant boundaries" do
    expect { draft(agent, "C003") }.to raise_error(ActiveRecord::RecordNotFound)
    order = draft(admin, "C003")
    expect { Amelia3::Scope.new(agent).order(order.id) }.to raise_error(ActiveRecord::RecordNotFound)
    expect(Amelia3::Snapshot.for(agent)[:state]["data"]["customers"].map { |row| row["id"] }).to contain_exactly("C001", "C002")
  end

  it "blocks blocked customers for Admin and Agent" do
    [ admin, agent ].each do |user|
      expect { draft(user, "C002") }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("CUSTOMER_BLOCKED") }
    end
    expect(Amelia3::Order.count).to eq(0)
  end

  it "requires an attested delivery point and never expands scope through its billing parent" do
    draft; add
    customer = Amelia3::Scope.new(agent).customer("C001")
    customer.update!(delivery_point: false)
    order = Amelia3::Order.find(id)
    expect { described_class.call(user: agent, command: intent(agent, "CONFIRM_ORDER", { "orderId" => id, "expectedVersion" => order.version })) }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("INVALID_DESTINATION") }
    foreign = Amelia3::Customer.find_by!(batch_id: fixture[:batch].id, external_code: "C003")
    foreign.update!(parent_code: "C001")
    expect(Amelia3::Scope.new(agent).destinations(customer).count).to eq(0)
    expect { described_class.call(user: agent, command: intent(agent, "SAVE_REVIEW", { "orderId" => id, "expectedVersion" => order.version, "destinationId" => "C003", "deliveryDate" => (Time.zone.today + 1).iso8601 })) }.to raise_error(ActiveRecord::RecordNotFound)
    expect(order.reload.status).to eq("DRAFT")
  end

  it "rejects unverified unit conversions and aggregate stock overcommit in a cart" do
    draft
    expect { add(product: "K001", price: "5") }.to raise_error(Amelia3::Error)
    add(quantity: "60")
    expect { add(quantity: "41") }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("INSUFFICIENT_STOCK") }
    expect(Amelia3::Order.find(id).lines.length).to eq(1)
  end

  it "detects stale versions and stale quoted prices without silently repricing" do
    order = draft
    expect { add(price: "1.19") }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("PRICE_CHANGED") }
    add
    stale = intent(agent, "REMOVE_LINE", { "orderId" => id, "lineId" => order.reload.lines.first["id"], "expectedVersion" => 0 })
    expect { described_class.call(user: agent, command: stale) }.to raise_error(Amelia3::Error) { |error| expect(error.code).to eq("ORDER_CONFLICT") }
  end

  it "preserves a saved price and order across an import with changed list values" do
    draft; add
    original = Amelia3::Order.find(id).lines.first.deep_dup
    file = File.join(fixture[:directory], "LISTINI.csv")
    File.write(file, File.read(file).sub("1.23456", "2.5"))
    Amelia3::Importer.call(tenant: fixture[:tenant], directory: fixture[:directory])
    order = Amelia3::Order.find(id)
    described_class.call(user: agent, command: intent(agent, "UPDATE_LINE", { "orderId" => id, "lineId" => original["id"], "quantity" => "4", "expectedVersion" => order.version }))
    line = order.reload.lines.first
    expect(line["unitPrice"]).to eq(original["unitPrice"])
    expect(line["priceSnapshot"]).to eq(original["priceSnapshot"])
    expect(line["lineNetCents"]).to eq(477)
  end

  it "confirms locally and rejects every outbound or reset operation" do
    draft; add
    order = Amelia3::Order.find(id)
    described_class.call(user: agent, command: intent(agent, "CONFIRM_ORDER", { "orderId" => id, "expectedVersion" => order.version }))
    expect(order.reload.status).to eq("CONFIRMED_LOCAL")
    %w[SEND_ORDER RESET_DEMO SEND_WHATSAPP UPLOAD_FTP].each do |type|
      expect { described_class.call(user: admin, command: intent(admin, type, {})) }.to raise_error(Amelia3::Error)
    end
    expect { Hfs::Snapshot.for(agent) }.to raise_error(Hfs::Forbidden)
    expect(Workspace.where(user: [ admin, agent ]).count).to eq(0)
  end

  it "keeps Capoarea denied and rejects the previous agent code" do
    agent.update!(role: "capoarea")
    expect { Amelia3::Scope.new(agent) }.to raise_error(Amelia3::Error) { |error| expect(error.status).to eq(403) }
    agent.assign_attributes(role: "agent", agent_id: "99")
    expect(agent).not_to be_valid
  end

  it "changes the cache identity when the assigned portfolio changes" do
    before = Amelia3::Snapshot.identity(agent)
    Amelia3::Customer.find_by!(batch_id: fixture[:batch].id, external_code: "C001").update!(agent_code: "99")
    expect(Amelia3::Snapshot.identity(agent)).not_to eq(before)
  end
end
