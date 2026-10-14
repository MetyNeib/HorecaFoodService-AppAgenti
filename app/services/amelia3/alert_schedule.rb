module Amelia3
  class AlertSchedule
    MAX_ATTEMPTS = 8

    def self.scheduled_at(date)
      Time.find_zone!("Europe/Rome").local(date.year, date.month, date.day, 6, 30)
    end

    def self.tick(tenant, now)
      date = now.in_time_zone("Europe/Rome").to_date
      return if now < scheduled_at(date)
      batch = tenant.reload.active_batch
      return unless batch
      occurrence = AlertOccurrence.find_or_create_by!(tenant: tenant, batch: batch, local_date: date)
      occurrence.with_lock do
        if %w[queued running].include?(occurrence.status) && occurrence.updated_at < now - 30.minutes
          occurrence.update!(status: "retrying", attempts: occurrence.attempts + 1, error_code: "JOB_LEASE_EXPIRED", next_attempt_at: now)
        end
        return occurrence if %w[queued running success].include?(occurrence.status)
        return occurrence if occurrence.attempts >= MAX_ATTEMPTS || occurrence.next_attempt_at && now < occurrence.next_attempt_at
        imported = SyncOccurrence.find_by(tenant: tenant, local_date: date)
        if imported&.status == "success" && imported.batch_id == batch.id && batch.status == "published"
          occurrence.update!(status: "queued", job_id: SalesAlertsJob.perform_async(occurrence.id), error_code: nil)
        else
          occurrence.update!(status: "waiting_import", attempts: occurrence.attempts + 1, next_attempt_at: now + 15.minutes,
            error_code: imported&.status == "failed" ? "IMPORT_FAILED" : "IMPORT_NOT_READY")
        end
      end
      occurrence
    rescue ActiveRecord::RecordNotUnique
      retry
    end
  end
end
