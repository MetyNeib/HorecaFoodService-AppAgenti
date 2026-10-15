Rails.application.configure do
  public_demo = ENV["HFS_PUBLIC_DEMO"] == "true"
  config.enable_reloading = true
  config.eager_load = false
  config.consider_all_requests_local = !public_demo
  config.server_timing = true
  config.active_record.migration_error = :page_load
  config.active_record.verbose_query_logs = true
  config.action_mailer.delivery_method = :test
  config.action_mailer.default_url_options = { host: "localhost", port: ENV.fetch("PORT", "3000") }
  config.action_controller.perform_caching = false
  config.cache_store = :memory_store
  config.secret_key_base = public_demo ? ENV.fetch("SECRET_KEY_BASE") : ENV.fetch("SECRET_KEY_BASE", "hfs-local-development-only-" * 4)
  config.hosts += ENV.fetch("HFS_ALLOWED_HOSTS", "localhost,127.0.0.1,web").split(",")
  # Docker Desktop bind mounts do not reliably deliver host change notifications.
  config.file_watcher = ActiveSupport::FileUpdateChecker
  config.log_level = :info
end
