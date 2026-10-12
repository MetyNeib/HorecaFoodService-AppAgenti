# Explicit, repeatable provisioning for parallel local UI/PWA QA only.
abort "Local development only" unless Rails.env.development?
%w[ui@hfs.invalid pwa@hfs.invalid].each do |email|
  user = User.find_or_initialize_by(email: email)
  if user.new_record?
    user.password = ENV.fetch("HFS_DEMO_PASSWORD", "HfsDemoLocale2026!")
    user.agent_id = "AG-014"
    user.save!
  end
  Hfs::Snapshot.for(user)
  puts "Prepared local QA account: #{email}"
end
