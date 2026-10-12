require "rails_helper"

RSpec.describe Hfs::Commands do
  let(:user) { User.create!(email: "first@example.invalid", password: "TestHfsLocale2026!", agent_id: "AG-014") }
  let(:other_user) { User.create!(email: "second@example.invalid", password: "TestHfsLocale2026!", agent_id: "AG-014") }

  def command(type = "CREATE_DRAFT", payload = { "id" => "MY-ORDER", "customerId" => "CLI-061001" }, **overrides)
    snapshot = Hfs::Snapshot.for(user)
    { "operationId" => SecureRandom.uuid, "baseVersion" => snapshot.fetch(:version), "epoch" => snapshot.fetch(:epoch), "type" => type, "payload" => payload }.merge(overrides.transform_keys(&:to_s))
  end

  def call(value) = described_class.call(user: user, command: value)

  it "isolates accounts even if both demonstrate the same agent" do
    call(command)
    expect(Hfs::Snapshot.for(user)[:state]["data"]["orders"].any? { |order| order["id"] == "MY-ORDER" }).to be(true)
    expect(Hfs::Snapshot.for(other_user)[:state]["data"]["orders"].any? { |order| order["id"] == "MY-ORDER" }).to be(false)
    expect(Workspace.where(user: [ user, other_user ]).count).to eq(2)
  end

  it "does not serialize unassigned customers or contacts" do
    snapshot = Hfs::Snapshot.for(user)
    data = snapshot[:state]["data"]
    expect(data["customers"].length).to eq(8)
    expect(data["agents"].map { |agent| agent["id"] }).to eq([ "AG-014" ])
    ids = data["customers"].map { |customer| customer["id"] }
    %w[contacts destinations customerConditions orders whatsappInbox invoices receivables insights analyses].each do |collection|
      expect(data[collection].all? { |entry| ids.include?(entry["customerId"]) }).to be(true)
    end
    expect(data["scenarioBank"]).to eq([])
    expect(data["derived"]).to eq({})
    expect(Workspace.find_by!(user: user).state["data"]["customers"].length).to eq(12)
  end

  it "commits a mutation and its receipt atomically" do
    result = call(command)
    expect(result[:version]).to eq(1)
    expect(result[:state]["revision"]).to eq(1)
    receipt = user.command_receipts.sole
    expect(receipt.result_version).to eq(1)
    expect(receipt.workspace_id).to eq(user.reload.workspace.id)
  end

  it "replays a lost response without applying an operation twice" do
    value = command
    first = call(value)
    second = call(value)
    expect(JSON.parse(JSON.generate(second))).to eq(JSON.parse(JSON.generate(first)))
    expect(user.reload.workspace.version).to eq(1)
    expect(user.command_receipts.count).to eq(1)
    expect(second[:state]["data"]["orders"].count { |order| order["id"] == "MY-ORDER" }).to eq(1)
  end

  it "rejects reusing an idempotency key with a different payload" do
    value = command
    call(value)
    value["payload"]["id"] = "OTHER-ORDER"
    expect { call(value) }.to raise_error(Hfs::Conflict, /richiesta diversa/)
    expect(user.reload.workspace.version).to eq(1)
  end

  it "rejects a stale concurrent device with the authoritative snapshot" do
    stale = command("CREATE_DRAFT", { "id" => "SECOND-ORDER", "customerId" => "CLI-061001" })
    call(command)
    expect { call(stale) }.to raise_error(Hfs::Conflict) { |error| expect(error.snapshot[:version]).to eq(1) }
    expect(user.reload.workspace.state["data"]["orders"].any? { |order| order["id"] == "SECOND-ORDER" }).to be(false)
  end

  it "increments the version for valid no-ops so sequential outboxes stay aligned" do
    first = call(command("SYNC_DEMO", {}))
    second = call(command("SYNC_DEMO", {}))
    expect([ first[:version], second[:version] ]).to eq([ 1, 2 ])
    expect(second[:state]["network"]).to eq("OFFLINE")
  end

  it "does not store any state or receipt after failed validation" do
    value = command("ADD_LINE", { "orderId" => "UNKNOWN", "lineId" => "TEST", "productId" => "ART-0107417", "quantity" => 1, "unit" => "CT" })
    before = user.reload.workspace.state
    expect { call(value) }.to raise_error(Hfs::ValidationError)
    expect(user.reload.workspace.version).to eq(0)
    expect(user.workspace.state).to eq(before)
    expect(user.command_receipts.count).to eq(0)
  end

  it "rolls back the mutation if receipt persistence fails" do
    value = command
    allow(CommandReceipt).to receive(:create!).and_raise(ActiveRecord::RecordInvalid)
    expect { call(value) }.to raise_error(ActiveRecord::RecordInvalid)
    expect(user.reload.workspace.version).to eq(0)
    expect(user.workspace.state["data"]["orders"].any? { |order| order["id"] == "MY-ORDER" }).to be(false)
  end

  it "changes epoch at reset and prevents old devices resurrecting deleted drafts" do
    stale = command
    reset = call(command("RESET_DEMO", {}))
    expect(reset[:epoch]).to eq(2)
    expect(reset[:version]).to eq(1)
    expect { call(stale) }.to raise_error(Hfs::Conflict, /ripristinata/)
    expected = Hfs::Snapshot.scoped_state(user, Hfs::Seed.initial_state)
    expected["revision"] = 1
    expect(reset[:state]).to eq(expected)
  end

  it "replays a reset with a lost response without performing a second reset" do
    value = command("RESET_DEMO", {})
    first = call(value)
    expect(call(value)).to eq(first.deep_stringify_keys.transform_keys(&:to_sym))
    expect(user.reload.workspace.epoch).to eq(2)
    expect(user.workspace.version).to eq(1)
  end

  it "does not replay a pre-reset receipt into the new generation" do
    value = command
    call(value)
    call(command("RESET_DEMO", {}))
    expect { call(value) }.to raise_error(Hfs::Conflict, /ripristinata/)
  end

  it "does not share operation ids across users" do
    value = command
    call(value)
    result = described_class.call(user: other_user, command: value)
    expect(result[:version]).to eq(1)
    expect(CommandReceipt.where(operation_id: value["operationId"]).count).to eq(2)
  end

  it "rejects untrusted snapshot writes" do
    expect { call(command("DATA", { "data" => Hfs::Seed.data })) }.to raise_error(Hfs::ValidationError)
    expect(user.reload.workspace.version).to eq(0)
  end

  it "rejects forged monetary fields and forged user ownership" do
    expect { call(command("CREATE_DRAFT", { "id" => "MALICIOUS", "customerId" => "CLI-061001", "agentId" => "AG-999" })) }.to raise_error(Hfs::ValidationError)
    expect { call(command.merge("userId" => other_user.id)) }.to raise_error(Hfs::ValidationError)
  end

  it "uses key order independent digests" do
    value = command
    first = call(value)
    reversed = value.to_a.reverse.to_h
    reversed["payload"] = value["payload"].to_a.reverse.to_h
    expect(JSON.parse(JSON.generate(call(reversed)))).to eq(JSON.parse(JSON.generate(first)))
  end

  it "enforces the operation uniqueness constraint at the database layer" do
    call(command)
    receipt = user.command_receipts.sole
    duplicate = receipt.attributes.except("id", "created_at", "updated_at")
    expect { CommandReceipt.insert_all!([ duplicate ]) }.to raise_error(ActiveRecord::RecordNotUnique)
  end
end
