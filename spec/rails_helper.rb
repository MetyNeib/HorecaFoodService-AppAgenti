# Docker exports development: tests must never inherit that database.
ENV["RAILS_ENV"] = "test"
# Automated fixtures never consume an API key configured for the local demo.
ENV['OPENAI_API_KEY'] = ''
require_relative "../config/environment"
abort "Production database forbidden" if Rails.env.production?
require "rspec/rails"
ActiveRecord::Migration.maintain_test_schema!

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!
  config.include Devise::Test::IntegrationHelpers, type: :request
end
