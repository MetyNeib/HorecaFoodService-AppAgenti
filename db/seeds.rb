# Synthetic demo only. Importing a customer's real data is a separate, future
# staging/validation workflow. Never paste customer datasets or secrets here.
email = ENV.fetch("HFS_DEMO_EMAIL", "agente@hfs.invalid")
password = ENV.fetch("HFS_DEMO_PASSWORD", "HfsDemoLocale2026!")
if Rails.env.production? && password == "HfsDemoLocale2026!"
  abort "Set HFS_DEMO_PASSWORD explicitly before preparing a production-mode local environment."
end
user = User.find_or_initialize_by(email: email)
if user.new_record?
  user.password = password
  user.password_confirmation = password
  user.agent_id = "AG-014"
  user.save!
end
Hfs::Snapshot.for(user)
puts "Demo account prepared: #{email}. Existing workspace preserved."
