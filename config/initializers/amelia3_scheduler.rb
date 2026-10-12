Sidekiq.configure_server do |config|
  config.redis = { url: ENV.fetch("REDIS_URL", "redis://127.0.0.1:6379/0") }
  config.on(:startup) { Amelia3::Scheduler.start }
  config.on(:quiet) { Amelia3::Scheduler.stop }
  config.on(:shutdown) { Amelia3::Scheduler.stop }
end
Sidekiq.configure_client do |config|
  config.redis = { url: ENV.fetch("REDIS_URL", "redis://127.0.0.1:6379/0") }
end
