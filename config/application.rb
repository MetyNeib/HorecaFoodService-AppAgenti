require_relative "boot"
require "rails"
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "action_mailer/railtie"
require "action_view/railtie"
require "rails/test_unit/railtie"
Bundler.require(*Rails.groups)

module HfsAgents
  class Application < Rails::Application
    config.load_defaults 8.1
    config.time_zone = "Europe/Rome"
    config.i18n.default_locale = :it
    config.i18n.available_locales = [ :it, :en ]
    config.active_job.queue_adapter = :sidekiq
    config.action_controller.include_all_helpers = true
    config.filter_parameters += %i[password password_confirmation authenticity_token token secret]
    config.filter_parameters += %i[payload note address telephone ftp_password q]
    config.generators.system_tests = nil
    config.autoload_lib(ignore: %w[assets tasks])
  end
end
