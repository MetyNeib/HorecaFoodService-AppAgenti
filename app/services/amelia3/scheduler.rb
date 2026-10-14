module Amelia3
  class Scheduler
    HEARTBEAT_KEY = "hfs:amelia3:scheduler:v1".freeze

    def self.scheduled_at(date)
      Time.find_zone!("Europe/Rome").local(date.year, date.month, date.day, 6, 5)
    end

    def self.tick(now = Time.current, settings: FtpSettings.new)
      return unless settings.enabled?
      local = now.in_time_zone(settings.timezone)
      target = scheduled_at(local.to_date)
      tenant = Tenant.find_by(code: "amelia3")
      return unless tenant&.active_batch_id
      if now >= target
        occurrence = SyncOccurrence.find_or_create_by!(tenant: tenant, local_date: local.to_date) { |row| row.scheduled_at = target }
        occurrence.with_lock do
          if occurrence.status == "pending" && occurrence.job_id.nil?
            occurrence.update!(job_id: SyncJob.perform_async(occurrence.id), status: "queued")
          end
        end
      end
      AlertSchedule.tick(tenant, now)
      next_date = occurrence&.status == "success" || now >= target ? local.to_date + 1 : local.to_date
      alert_date = now >= AlertSchedule.scheduled_at(local.to_date) ? local.to_date + 1 : local.to_date
      info = { observed_at: now.iso8601, next_run_at: scheduled_at(next_date).iso8601, timezone: settings.timezone, cron: settings.cron, enabled: true,
               alert_next_run_at: AlertSchedule.scheduled_at(alert_date).iso8601, alert_time: "06:30 Europe/Rome" }
      Sidekiq.redis { |redis| redis.call("SET", HEARTBEAT_KEY, JSON.generate(info), "EX", 90) }
      occurrence
    rescue ActiveRecord::RecordNotUnique
      retry
    end

    def self.start
      @stopped = false
      @thread = Thread.new do
        Thread.current.name = "amelia3-scheduler"
        until @stopped
          begin
            IncomingSchedule.tick
            tick
          rescue StandardError
            Rails.logger.warn("AMELIA3_SCHEDULER_WAITING")
          end
          20.times { break if @stopped; sleep 1 }
        end
      end
    end

    def self.stop
      @stopped = true
      @thread&.join(2)
    end

    def self.status
      raw = Sidekiq.redis { |redis| redis.call("GET", HEARTBEAT_KEY) }
      raw ? JSON.parse(raw) : { "enabled" => false }
    rescue StandardError
      { "enabled" => false }
    end
  end
end
