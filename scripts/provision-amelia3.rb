require "securerandom"

tenant = Amelia3::Tenant.find_by!(code: "amelia3")
raise "Valid bootstrap required" unless tenant.active_batch_id
path = Rails.root.join("imports/private/amelia3/local_accounts.json")
if path.file?
  accounts = JSON.parse(path.read)
else
  manifest = JSON.parse(Rails.root.join("docs/amelia3/HFS_Amelia3_Manifest_Codex_20261012.json").read)
  accounts = [ { "role" => "admin", "email" => "admin@amelia3.invalid", "display_name" => "Admin Amelia3", "password" => SecureRandom.urlsafe_base64(24) },
               { "role" => "agent", "email" => "agente34@amelia3.invalid", "display_name" => manifest.fetch("selected_agent").fetch("display_name"), "password" => SecureRandom.urlsafe_base64(24) } ]
  File.write(path, JSON.pretty_generate(accounts) + "\n")
end
accounts.each do |account|
  user = User.find_or_initialize_by(email: account.fetch("email"))
  raise "Account belongs to another dataset" if user.persisted? && (!user.amelia3? || user.commercial_tenant_id != tenant.id)
  user.assign_attributes(dataset_mode: "amelia3", role: account.fetch("role"), commercial_tenant: tenant,
                         agent_id: account["role"] == "agent" ? "34" : "AMELIA3-ADMIN", display_name: account.fetch("display_name"))
  user.password = account.fetch("password") if user.new_record?
  user.save!
end
puts JSON.generate(status: "PROVISIONED", roles: accounts.map { |account| account["role"] }, agent_code: "34", credentials: "imports/private/amelia3/local_accounts.json")
