module Amelia3
  class IncomingSchedule
    def self.tick(now = Time.current)
      return unless ENV["AMELIA3_INCOMING_ENABLED"] == "true"
      tenant = Tenant.find_by(code: "amelia3")
      return unless tenant&.active_batch_id
      state = FeedState.find_or_create_by!(tenant: tenant)
      state.with_lock do
        if state.next_poll_at.nil? || state.next_poll_at <= now
          IncomingFeedJob.perform_async(tenant.id)
          state.update!(next_poll_at: now + 3.minutes)
        end
      end
      slot = "hfs:amelia3:review:#{tenant.id}:#{now.to_i / 900}"
      if Sidekiq.redis { |redis| redis.call("SET", slot, "1", "NX", "EX", 1800) }
        SubstitutionReviewJob.perform_async(tenant.id)
      end
    end
  end
end
