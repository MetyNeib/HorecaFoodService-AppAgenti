abort "Synthetic browser fixtures are only allowed in development" unless Rails.env.development?
require_relative "../spec/support/amelia3_fixture"
include Amelia3Fixture

tenant = Amelia3::Tenant.find_or_create_by!(code: "amelia3-browser-qa") { |row| row.name = "Amelia3 QA sintetica" }
# Only this explicitly synthetic tenant is reset; real Amelia3 orders are untouched.
Amelia3::Receipt.where(tenant: tenant).delete_all
Amelia3::Order.where(tenant: tenant).delete_all
directory = csv_fixture
begin
  Amelia3::Importer.call(tenant: tenant, directory: directory, source: "synthetic-browser-test")
ensure
  FileUtils.remove_entry(directory)
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
