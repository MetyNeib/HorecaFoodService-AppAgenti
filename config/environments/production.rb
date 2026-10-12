Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = true
  config.consider_all_requests_local = false
  config.force_ssl = true
  config.log_level = :info
  config.log_tags = [ :request_id ]
  config.logger = ActiveSupport::TaggedLogging.logger(STDOUT)
  config.action_mailer.delivery_method = :test
  config.active_record.dump_schema_after_migration = false
  config.secret_key_base = ENV.fetch("SECRET_KEY_BASE")
  config.hosts = ENV.fetch("HFS_ALLOWED_HOSTS").split(",")
end
