abort "Browser fixtures are only allowed in development" unless Rails.env.development?

%w[ui@hfs.invalid pwa@hfs.invalid].each do |email|
  user = User.find_or_initialize_by(email: email)
  user.assign_attributes(password: "HfsDemoLocale2026!", password_confirmation: "HfsDemoLocale2026!", agent_id: "AG-014")
  user.save!
  Hfs::Snapshot.for(user)
end
puts "Browser test accounts prepared; existing workspaces preserved."
