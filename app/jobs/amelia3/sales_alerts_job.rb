class Amelia3::SalesAlertsJob
  include Sidekiq::Job
  sidekiq_options queue: "amelia3_import", retry: false

  def perform(occurrence_id)
    occurrence = Amelia3::AlertOccurrence.find(occurrence_id)
    occurrence.with_lock do
      return if %w[success running].include?(occurrence.status)
      occurrence.update!(status: "running")
    end
    tenant = occurrence.tenant
    imported = Amelia3::SyncOccurrence.find_by(tenant: tenant, local_date: occurrence.local_date, status: "success", batch_id: occurrence.batch_id)
    unless imported && tenant.reload.active_batch_id == occurrence.batch_id
      raise Amelia3::Error.new("Importazione del giorno non disponibile.", code: "IMPORT_NOT_READY")
    end
    Amelia3::SalesAlerts.call(tenant: tenant, as_of: occurrence.local_date, source: "scheduled")
    Amelia3::SubstitutionReviewJob.perform_async(tenant.id)
    occurrence.update!(status: "success", error_code: nil)
  rescue StandardError => error
    if occurrence
      occurrence.with_lock do
        occurrence.update!(status: "retrying", attempts: occurrence.attempts + 1, next_attempt_at: 15.minutes.from_now,
          error_code: error.respond_to?(:code) ? error.code : "ALERT_CALCULATION_FAILED")
      end
    end
    Rails.logger.warn("AMELIA3_ALERT_CALCULATION_RETRY")
  end
end
