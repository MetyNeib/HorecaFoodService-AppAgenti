class Amelia3::IncomingFeedJob
  include Sidekiq::Job
  sidekiq_options queue: "amelia3_inbox", retry: false

  def perform(tenant_id)
    return unless ENV["AMELIA3_INCOMING_ENABLED"] == "true"
    Amelia3::IncomingFeed.new(tenant: Amelia3::Tenant.find(tenant_id)).call
  rescue Amelia3::Error => error
    Rails.logger.warn("AMELIA3_INCOMING_WAITING #{error.code}")
  end
end
