abort "Synthetic browser fixtures are only allowed in development" unless Rails.env.development?
require_relative "../spec/support/amelia3_fixture"
include Amelia3Fixture

tenant = Amelia3::Tenant.find_or_create_by!(code: "amelia3-browser-qa") { |row| row.name = "Amelia3 QA sintetica" }
attest_fixture_units(tenant) unless Amelia3::UnitVerification.exists?(tenant: tenant, active: true)
# Only this explicitly synthetic tenant is reset; real Amelia3 orders are untouched.
Amelia3::Receipt.where(tenant: tenant).delete_all
Amelia3::Order.where(tenant: tenant).delete_all
directory = csv_fixture
begin
  Amelia3::Importer.call(tenant: tenant, directory: directory, source: "synthetic-browser-test")
ensure
  FileUtils.remove_entry(directory)
end
batch = tenant.reload.active_batch
# A validly priced generic placeholder must still be absent from the demo lists.
generic = Amelia3::Product.find_or_initialize_by(batch: batch, external_code: "MISC001")
generic.assign_attributes(name: "**ARTICOLO VARIO SINTETICO", base_unit: "P", order_unit: "P", blocked: false, pack_indivisible: false, case_indivisible: false)
generic.save!
Amelia3::Stock.find_or_initialize_by(batch: batch, product_code: "MISC001").tap { |row| row.pieces = 100; row.save! }
Amelia3::Price.find_or_initialize_by(batch: batch, product_code: "MISC001", list_code: "000").tap { |row| row.amount = 1; row.valid_price = true; row.save! }
# Extra fixtures are synthetic and restricted to this QA tenant; no real SKU is used.
{ "KG002" => false, "KG005" => true }.each do |code, fixed|
  product = Amelia3::Product.find_or_initialize_by(batch_id: batch.id, external_code: code)
  product.assign_attributes(name: fixed ? "Peso fisso sintetico verificato" : "Peso nominale sintetico non attestato", base_unit: "K", order_unit: "L",
    pieces_per_pack: 2, weight_per_pack: "2.5", packs_per_case: 2, blocked: false, pack_indivisible: false, case_indivisible: false)
  product.save!
  stock = Amelia3::Stock.find_or_initialize_by(batch_id: batch.id, product_code: code)
  stock.assign_attributes(packs: 20, pieces: 40, weight: 50)
  stock.save!
  price = Amelia3::Price.find_or_initialize_by(batch_id: batch.id, product_code: code, list_code: "000")
  price.assign_attributes(amount: "3.2", valid_price: true)
  price.save!
  evidence = Amelia3::UnitVerification.find_or_initialize_by(tenant: tenant, product_code: code, base_unit: "K", order_unit: "L", active: true)
  evidence.assign_attributes(version: "SYNTHETIC-KG-20261012-v1", evidence_reference: "SYNTHETIC FIXTURE ONLY", approved_by: "Browser tests", approved_at: Time.current,
    contract: { "priceUnit" => "base", "stockFields" => { "weight" => "KG", "packs" => "CONF", "pieces" => "PZ" }, "primaryStockField" => "weight",
                "verifiedFactors" => %w[piecesPerPack packsPerCase] + (fixed ? [ "weightPerPack" ] : []), "fixedWeight" => fixed, "steps" => { "KG" => "any", "COLL" => "1" } })
  evidence.save!
end
{ "amelia-admin-qa@example.invalid" => "admin", "amelia-agent-qa@example.invalid" => "agent" }.each do |email, role|
  user = User.find_or_initialize_by(email: email)
  abort "Refusing to overwrite another dataset" if user.persisted? && user.commercial_tenant_id != tenant.id
  user.assign_attributes(password: "TestHfsLocale2026!", password_confirmation: "TestHfsLocale2026!", dataset_mode: "amelia3",
                         role: role, agent_id: role == "agent" ? "34" : "AMELIA3-ADMIN", commercial_tenant: tenant,
                         display_name: role == "agent" ? "Agente sintetico 34" : "Admin sintetico")
  user.save!
end
puts "Amelia3 synthetic browser accounts prepared in their separate QA tenant."
load Rails.root.join("scripts/prepare-amelia3-v5-browser-alerts.rb")
