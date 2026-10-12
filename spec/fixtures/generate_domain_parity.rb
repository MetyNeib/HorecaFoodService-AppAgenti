# Run with: bundle exec rails runner spec/fixtures/generate_domain_parity.rb
# These expected results come from the authoritative Ruby engine, independently
# of the browser implementation. Only immutable reference collections are shared.
require "json"
require "fileutils"

user = Struct.new(:agent_id).new("AG-014")
initial = Hfs::Snapshot.scoped_state(user, Hfs::Seed.initial_state)
commands = [
  [ "CREATE_DRAFT", { "id" => "PARITY-ORDER", "customerId" => "CLI-061001" } ],
  [ "ADD_LINE", { "orderId" => "PARITY-ORDER", "lineId" => "PARITY-L1", "productId" => "ART-0107417", "quantity" => 1, "unit" => "COLLI" } ],
  [ "ADD_LINE", { "orderId" => "PARITY-ORDER", "lineId" => "PARITY-L2", "productId" => "ART-0107417", "quantity" => 2, "unit" => "CT" } ],
  [ "UPDATE_LINE", { "orderId" => "PARITY-ORDER", "lineId" => "PARITY-L1", "quantity" => 2, "unit" => "COLLI" } ],
  [ "UPDATE_LINE", { "orderId" => "PARITY-ORDER", "lineId" => "PARITY-L1", "priceMode" => "FIXED_PRICE", "unitPriceBaseCents" => 137, "note" => "Prezzo concordato" } ],
  [ "UPDATE_LINE", { "orderId" => "PARITY-ORDER", "lineId" => "PARITY-L1", "priceMode" => "DISCOUNT", "priceListId" => "LIST-100", "discountBasisPoints" => 1250,
                      "condition" => { "id" => "PARITY-C1", "validFrom" => "2026-09-01", "validTo" => "2026-09-30", "replaceOverlaps" => true } } ],
  [ "UPDATE_LINE", { "orderId" => "PARITY-ORDER", "lineId" => "PARITY-L1", "isGift" => true } ],
  [ "UPDATE_LINE", { "orderId" => "PARITY-ORDER", "lineId" => "PARITY-L1", "isGift" => false, "priceMode" => "PRICE_LIST", "priceListId" => "LIST-300",
                      "condition" => { "id" => "PARITY-C2", "validFrom" => "2026-09-01", "validTo" => "2026-09-30", "replaceOverlaps" => true } } ],
  [ "ADD_LINE", { "orderId" => "PARITY-ORDER", "lineId" => "PARITY-W1", "productId" => "ART-0207462", "quantity" => 0.1, "unit" => "KG" } ],
  [ "ADD_LINE", { "orderId" => "PARITY-ORDER", "lineId" => "PARITY-W2", "productId" => "ART-0207462", "quantity" => 0.2, "unit" => "KG" } ],
  [ "UPDATE_LINE", { "orderId" => "PARITY-ORDER", "lineId" => "PARITY-W1", "priceMode" => "FIXED_PRICE", "unitPriceBaseCents" => 125,
                      "condition" => { "id" => "PARITY-C3", "validFrom" => nil, "validTo" => nil, "replaceOverlaps" => true } } ],
  [ "REMOVE_LINE", { "orderId" => "PARITY-ORDER", "lineId" => "PARITY-W1" } ],
  [ "SAVE_REVIEW", { "orderId" => "PARITY-ORDER", "deliveryTime" => "", "paymentId" => "PAY-DELIVERY", "customerReference" => "RIF-42", "note" => "Consegna dal retro" } ],
  [ "CHANGE_CUSTOMER", { "orderId" => "PARITY-ORDER", "customerId" => "CLI-061001" } ],
  [ "CONFIRM_ORDER", { "orderId" => "PARITY-ORDER", "deliveryDate" => "2026-09-23", "deliveryTime" => "10:30", "note" => "Nota finale contestuale alla conferma" } ],
  [ "CONFIRM_ORDER", { "orderId" => "PARITY-ORDER" } ],
  [ "CREATE_DRAFT", { "id" => "PARITY-SECOND", "customerId" => "CLI-061001" } ],
  [ "ADD_LINE", { "orderId" => "PARITY-SECOND", "lineId" => "PARITY-S1", "productId" => "ART-0107417", "quantity" => 1, "unit" => "PZ" } ],
  [ "CHANGE_CUSTOMER", { "orderId" => "PARITY-SECOND", "customerId" => "CLI-061002", "confirmClear" => true } ],
  [ "DELETE_DRAFT", { "orderId" => "PARITY-SECOND" } ]
]
state = initial
steps = commands.each_with_index.map do |(type, payload), index|
  command = { "operationId" => "parity-operation-#{index}", "baseVersion" => index, "epoch" => 1, "type" => type, "payload" => payload }
  state = Hfs::Domain.new(state).apply(type, payload)
  state["revision"] = index + 1
  expected = state.reject { |key, _value| key == "data" }.merge("data" => state.fetch("data").slice("orders", "customerConditions", "syncQueue", "whatsappInbox"))
  { "command" => command, "expected" => expected }
end
rejected = [
  { "afterStep" => 2, "type" => "ADD_LINE", "payload" => { "orderId" => "PARITY-ORDER", "lineId" => "PARITY-L1", "productId" => "ART-0107417", "quantity" => 1, "unit" => "CT" } },
  { "afterStep" => 2, "type" => "REMOVE_LINE", "payload" => { "orderId" => "PARITY-ORDER", "lineId" => "UNKNOWN" } },
  { "afterStep" => 2, "type" => "CHANGE_CUSTOMER", "payload" => { "orderId" => "PARITY-ORDER", "customerId" => "CLI-061002" } },
  { "afterStep" => 2, "type" => "UPDATE_LINE", "payload" => { "orderId" => "PARITY-ORDER", "lineId" => "PARITY-L1", "priceMode" => "FREE_PRICE", "unitPriceBaseCents" => 125 } },
  { "afterStep" => 2, "type" => "UPDATE_LINE", "payload" => { "orderId" => "PARITY-ORDER", "lineId" => "PARITY-L1", "costBaseCents" => 0 } },
  { "afterStep" => 2, "type" => "SAVE_REVIEW", "payload" => { "orderId" => "PARITY-ORDER", "deliveryDate" => "2026-02-31" } },
  { "afterStep" => 2, "type" => "SAVE_REVIEW", "payload" => { "orderId" => "PARITY-ORDER", "contactId" => "CONT-061002-01" } },
  { "afterStep" => 2, "type" => "SAVE_REVIEW", "payload" => { "orderId" => "PARITY-ORDER", "deliveryTime" => "25:00" } },
  { "afterStep" => 16, "type" => "CONFIRM_ORDER", "payload" => { "orderId" => "PARITY-SECOND" } },
  { "afterStep" => 14, "type" => "UPDATE_LINE", "payload" => { "orderId" => "PARITY-ORDER", "lineId" => "PARITY-L1", "quantity" => 2 } }
]
rejected.each do |test|
  expected = steps.fetch(test.fetch("afterStep")).fetch("expected")
  input = initial.merge(expected).merge("data" => initial.fetch("data").merge(expected.fetch("data")))
  begin
    Hfs::Domain.new(input).apply(test.fetch("type"), test.fetch("payload"))
    raise "Expected rejection for #{test.inspect}"
  rescue Hfs::ValidationError => error
    test["error"] = error.message
  end
end
path = Rails.root.join("tests/rails-pwa/fixtures/domain-parity.json")
FileUtils.mkdir_p(path.dirname)
File.write(path, JSON.generate("datasetId" => Hfs::Seed::DATASET_ID, "generatedBy" => "Hfs::Domain (Ruby)", "initialState" => initial, "steps" => steps, "rejectedCases" => rejected) + "\n")
puts "Generated #{steps.length} Ruby expected states and #{rejected.length} rejected commands: #{path}"
