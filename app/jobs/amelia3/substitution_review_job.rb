class Amelia3::SubstitutionReviewJob
  include Sidekiq::Job
  sidekiq_options queue: "amelia3_reviews", retry: false

  def perform(tenant_id)
    ApplicationRecord.connection_pool.with_connection do |connection|
      key = 750_000_000 + tenant_id.to_i
      return unless connection.select_value("SELECT pg_try_advisory_lock(#{key})")
      begin
        Amelia3::SubstitutionReview.call(tenant: Amelia3::Tenant.find(tenant_id))
      ensure
        connection.execute("SELECT pg_advisory_unlock(#{key})")
      end
    end
  end
end
