# Docker exports development: tests must never inherit that database.
ENV["RAILS_ENV"] = "test"
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
