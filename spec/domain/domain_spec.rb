require "spec_helper"
require_relative "../../app/services/hfs/validation_error"
require_relative "../../app/services/hfs/forbidden"
require_relative "../../app/services/hfs/seed"
require_relative "../../app/services/hfs/calculations"
require_relative "../../app/services/hfs/domain"

RSpec.describe Hfs::Domain do
  let(:initial) { Hfs::Seed.initial_state }
  let(:domain) { described_class.new(initial) }
  let(:customer_id) { "CLI-061001" }
  let(:product_id) { "ART-0107417" }

  def run(type, payload = {}) = domain.apply(type, payload)
  def order(id = "TEST-ORDER") = domain.data.fetch("orders").find { |item| item["id"] == id }
  def draft
    run("CREATE_DRAFT", "id" => "TEST-ORDER", "customerId" => customer_id)
    order
  end
  def add(quantity = 1, unit = "CT", id = "LINE-1")
    run("ADD_LINE", "orderId" => "TEST-ORDER", "lineId" => id, "productId" => product_id, "quantity" => quantity, "unit" => unit)
  end

  it "starts exactly from the approved seed except source provenance and schema envelope" do
    seed = JSON.parse(File.read(File.expand_path("../../src/data/hfs_demo_data.json", __dir__)))
    seed["branding"].delete("visualSystem")
    expect(initial.fetch("data")).to eq(seed)
    expect(initial.fetch("schemaVersion")).to eq(2)
  end
  it "creates an empty order with the next delivery day" do
    expect(draft).to include("deliveryDate" => "2026-09-23", "lines" => [], "status" => "DRAFT")
    expect(order["totals"]["marginPercent"]).to be_nil
  end
  it "never mutates its input seed" do
    copy = JSON.generate(initial)
    draft
    add
    expect(JSON.generate(initial)).to eq(copy)
  end
  it "adds repeated items without duplicate conversion" do
    draft
    add(2)
    add(1, "CT", "LINE-2")
    expect(order["lines"].length).to eq(1)
    expect(order["lines"][0]).to include("quantity" => 3, "baseQuantity" => 45, "lineNetCents" => 5400)
  end
  it "aggregates stock across different units and prices" do
    draft
    add(19)
    add(1, "PZ", "LINE-2")
    expect(domain.order_errors(order)).to include(a_string_matching(/disponibilità insufficiente/))
    expect { run("CONFIRM_ORDER", "orderId" => order["id"]) }.to raise_error(Hfs::ValidationError)
    expect(order["status"]).to eq("DRAFT")
  end
  it "recomputes base quantities when checking stock" do
    draft
    add(19)
    order["lines"][0]["quantity"] = 20
    order["lines"][0]["baseQuantity"] = 1
    expect(domain.order_errors(order)).to include(a_string_matching(/disponibilità insufficiente/))
  end
  it "queues a confirmed order only once" do
    draft
    add
    2.times { run("CONFIRM_ORDER", "orderId" => order["id"]) }
    expect(order["status"]).to eq("PENDING_SEND")
    expect(domain.data["syncQueue"].count { |job| job["entityId"] == order["id"] }).to eq(1)
  end
  it "transmits queued demo jobs once after explicit online simulation" do
    draft
    add
    run("CONFIRM_ORDER", "orderId" => order["id"])
    run("SET_DEMO_NETWORK", "online" => true)
    2.times { run("SYNC_DEMO") }
    expect(order["status"]).to eq("SENT")
    expect(domain.data["syncQueue"].find { |job| job["entityId"] == order["id"] }["attempts"]).to eq(1)
    expect(domain.state["lastSyncAt"]).to eq(domain.clock)
  end
  it "does not simulate transmission while demo offline" do
    before = JSON.generate(domain.state)
    run("SYNC_DEMO")
    expect(JSON.generate(domain.state)).to eq(before)
  end
  it "rejects an unknown order" do
    expect { run("CONFIRM_ORDER", "orderId" => "UNKNOWN") }.to raise_error(Hfs::ValidationError)
  end
  it "rejects unresolved WhatsApp confirmation" do
    expect { run("CONFIRM_ORDER", "orderId" => "WA-26-00843") }.to raise_error(Hfs::ValidationError)
    expect(order("WA-26-00843")["status"]).to eq("WHATSAPP_REVIEW")
  end
  it "resets all mutations to the exact original runtime seed" do
    draft
    add
    run("SET_DEMO_NETWORK", "online" => true)
    run("RESET_DEMO")
    run("SYNC_DEMO")
    expect(domain.state).to eq(initial)
  end
  it "preserves canonical WhatsApp order references" do
    expect(domain.data["whatsappInbox"].all? { |item| order(item["orderId"])["status"] == "WHATSAPP_REVIEW" }).to be(true)
    expect(domain.data["whatsappInbox"][0]["requests"].count { |item| item["status"] != "MATCHED" }).to eq(2)
  end
  it "requires a reason to exclude and retains the original request" do
    request = domain.data["whatsappInbox"][2]["requests"].find { |item| item["status"] != "MATCHED" }
    original = request.fetch("rawText")
    payload = { "orderId" => "WA-26-00843", "requestId" => request.fetch("id"), "reason" => " " }
    expect { run("EXCLUDE_REQUEST", payload) }.to raise_error(Hfs::ValidationError)
    run("EXCLUDE_REQUEST", payload.merge("reason" => "Da confermare al prossimo giro"))
    expect(request).to include("rawText" => original, "status" => "EXCLUDED")
    expect(request["resolution"]["reason"]).not_to be_empty
  end
  it "resolves unavailable milk using the alternative's own conversions" do
    inbox = domain.data["whatsappInbox"].find { |item| item["orderId"] == "WA-26-00841" }
    request = inbox["requests"].find { |item| item["status"] == "OUT_OF_STOCK" }
    run("RESOLVE_REQUEST", "orderId" => inbox["orderId"], "requestId" => request["id"], "productId" => "ART-0207430", "quantity" => 2, "unit" => "CT")
    product = domain.data["products"].find { |item| item["id"] == "ART-0207430" }
    line = order(inbox["orderId"])["lines"].find { |item| item["whatsappRequestId"] == request["id"] }
    expect(line["baseQuantity"]).to eq(Hfs::Calculations.base_quantity(product, 2, "CT")["quantity"])
    expect(domain.data["learnedMappings"].last).to include("customerId" => inbox["customerId"], "productId" => product["id"])
  end
  it "requires an explicit available UM for an ambiguous request" do
    inbox = domain.data["whatsappInbox"][2]
    request = inbox["requests"].find { |item| item["status"] != "MATCHED" }
    expect do
      run("RESOLVE_REQUEST", "orderId" => inbox["orderId"], "requestId" => request["id"], "productId" => request["alternatives"][0]["productId"], "quantity" => 2, "unit" => "")
    end.to raise_error(Hfs::ValidationError, /Unità/)
  end
  it "requires confirmation before clearing a nonempty draft" do
    draft
    add
    expect { run("CHANGE_CUSTOMER", "orderId" => order["id"], "customerId" => "CLI-061002") }.to raise_error(Hfs::ValidationError)
    run("CHANGE_CUSTOMER", "orderId" => order["id"], "customerId" => "CLI-061002", "confirmClear" => true)
    expect(order).to include("id" => "TEST-ORDER", "customerId" => "CLI-061002", "lines" => [])
  end
  it "does not rewrite historical prices when saving a condition" do
    historical = JSON.generate(domain.data["orders"].select { |item| item["status"] == "SENT" })
    draft
    add
    payload = { "orderId" => order["id"], "lineId" => "LINE-1", "priceMode" => "FIXED_PRICE", "unitPriceBaseCents" => 150,
                "condition" => { "id" => "NEW-CONDITION", "validFrom" => "2026-09-01", "validTo" => "2026-09-30", "replaceOverlaps" => true } }
    run("UPDATE_LINE", payload)
    expect(order["lines"][0]["unitPriceBaseCents"]).to eq(150)
    expect(domain.data["customerConditions"].any? { |item| item["id"] == "NEW-CONDITION" }).to be(true)
    expect(JSON.generate(domain.data["orders"].select { |item| item["status"] == "SENT" })).to eq(historical)
  end
  it "preserves the customer's default payment after an order override" do
    original = domain.data["customers"].find { |item| item["id"] == customer_id }["defaultPaymentId"]
    draft
    different = domain.data["paymentMethods"].find { |item| item["id"] != original }["id"]
    run("SAVE_REVIEW", "orderId" => order["id"], "paymentId" => different, "note" => "Consegna dal retro")
    expect(order["paymentId"]).to eq(different)
    expect(domain.data["customers"].find { |item| item["id"] == customer_id }["defaultPaymentId"]).to eq(original)
    expect(order["noteDestination"]).to eq("DELIVERY_DOCUMENT")
  end
  it "rejects costs, totals and arbitrary status writes" do
    draft
    add
    expect { run("UPDATE_LINE", "orderId" => order["id"], "lineId" => "LINE-1", "costBaseCents" => 0) }.to raise_error(Hfs::ValidationError)
    expect { run("SAVE_REVIEW", "orderId" => order["id"], "status" => "SENT") }.to raise_error(Hfs::ValidationError)
  end
  it "rejects customers outside the assigned portfolio" do
    other = domain.data["customers"].find { |item| item["agentId"] != "AG-014" }
    expect { run("CREATE_DRAFT", "id" => "CROSS-PORTFOLIO", "customerId" => other["id"]) }.to raise_error(Hfs::Forbidden)
  end
  it "rejects another customer's contact or destination" do
    draft
    contact = domain.data["contacts"].find { |item| item["customerId"] != customer_id }
    expect { run("SAVE_REVIEW", "orderId" => order["id"], "contactId" => contact["id"]) }.to raise_error(Hfs::Forbidden)
  end
  it "keeps confirmed orders read-only" do
    draft
    add
    run("CONFIRM_ORDER", "orderId" => order["id"])
    expect { add(1, "PZ", "LINE-3") }.to raise_error(Hfs::ValidationError, /sola lettura/)
    expect { run("DELETE_DRAFT", "orderId" => order["id"]) }.to raise_error(Hfs::ValidationError)
  end
  it "saves contact changes and performs only simulated activation" do
    contact = domain.data["contacts"].find { |item| item["customerId"] == customer_id }
    payload = contact.slice("id", "customerId", "firstName", "lastName", "role", "phoneDisplay", "email", "whatsappEnabled").merge("firstName" => "Nuovo", "whatsappEnabled" => true)
    run("UPSERT_CONTACT", payload)
    expect(contact["whatsappActivationStatus"]).to eq("PENDING_SYNC")
    run("SET_DEMO_NETWORK", "online" => true)
    run("SYNC_DEMO")
    expect(contact["whatsappActivationStatus"]).to eq("ACTIVE")
  end
  it "records a download simulation without producing a fiscal document" do
    contact = domain.data["contacts"].find { |item| item["customerId"] == customer_id }
    run("SHARE_SIMULATED", "id" => "SHARE-1", "customerId" => customer_id, "channel" => "DOWNLOAD", "recipient" => contact["id"], "overdue" => true)
    expect(domain.data["shareJobs"].last).to include("status" => "WAITING_NETWORK", "channel" => "DOWNLOAD")
  end
  it "reviews insights without deleting order history" do
    before = JSON.generate(domain.data["orders"])
    run("MARK_INSIGHTS_REVIEWED", "customerId" => customer_id)
    expect(domain.data["insights"].select { |item| item["customerId"] == customer_id }.map { |item| item["status"] }).to all(eq("REVIEWED"))
    expect(JSON.generate(domain.data["orders"])).to eq(before)
  end
end
