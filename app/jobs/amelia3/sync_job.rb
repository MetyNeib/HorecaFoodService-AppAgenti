class Amelia3::SyncJob
  include Sidekiq::Job
  sidekiq_options queue: "amelia3_import", retry: 5, backtrace: false
  sidekiq_retry_in { |count| [ 60 * (2**count), 3600 ].min }
  sidekiq_retries_exhausted do |job, _error|
    Amelia3::SyncOccurrence.where(id: job.fetch("args").first).where.not(status: "success").update_all(status: "failed", updated_at: Time.current)
  end

  def perform(occurrence_id)
    occurrence = Amelia3::SyncOccurrence.find(occurrence_id)
    return if occurrence.status == "success"
    settings = Amelia3::FtpSettings.new
    unless settings.enabled?
      occurrence.update!(status: "disabled", error_code: "SYNC_DISABLED")
      return
    end
    ApplicationRecord.connection_pool.with_connection do |connection|
      key = 730_000_000 + occurrence.tenant_id
      raise Amelia3::Error.new("Import già in corso.", code: "IMPORT_BUSY") unless connection.select_value("SELECT pg_try_advisory_lock(#{key})")
      begin
        occurrence.reload
        return if occurrence.status == "success"
        occurrence.update!(status: "running", attempts: occurrence.attempts + 1, error_code: nil)
        started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        source = Amelia3::FtpDownloader.new(settings: settings).call
        occurrence.update!(source_files: source.fetch(:files))
        batch = Amelia3::Importer.call(tenant: occurrence.tenant, directory: source.fetch(:directory), source: "ftp")
        duration = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round
        occurrence.update!(status: "success", batch_id: batch.id, completed_at: Time.current, duration_ms: duration)
        Rails.logger.info("AMELIA3_FTP_SYNC_SUCCESS")
      ensure
        connection.execute("SELECT pg_advisory_unlock(#{key})")
      end
    end
  rescue Amelia3::Error => error
    occurrence&.update!(status: "retrying", error_code: error.code)
    raise
  rescue StandardError
    occurrence&.update!(status: "retrying", error_code: "SYNC_FAILURE")
    raise Amelia3::Error.new("Sincronizzazione non completata.", code: "SYNC_FAILURE"), cause: nil
  end
end
