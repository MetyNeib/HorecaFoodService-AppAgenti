tenant = Amelia3::Tenant.find_by!(code: "amelia3")
runs = Amelia3::SyncOccurrence.where(tenant: tenant).order(local_date: :desc).limit(7).map do |run|
  { local_date: run.local_date.iso8601, scheduled_at: run.scheduled_at.in_time_zone("Europe/Rome").iso8601, status: run.status, attempts: run.attempts,
    error_code: run.error_code, completed_at: run.completed_at&.iso8601, active_batch_matches: run.batch_id == tenant.active_batch_id }
end
alerts = Amelia3::AlertOccurrence.where(tenant: tenant).order(local_date: :desc, id: :desc).limit(7).map { |row| { local_date: row.local_date, status: row.status, attempts: row.attempts, error_code: row.error_code, next_attempt_at: row.next_attempt_at } }
result = { scheduler: Amelia3::Scheduler.status, occurrences: runs, alert_occurrences: alerts,
  active_alert_run: tenant.active_alert_run&.slice(:as_of, :rules_version, :source, :status, :metrics, :completed_at), revision: tenant.revision,
  active_counts: tenant.active_batch.counts, agent34: tenant.active_batch.metrics["agent34"],
  canonical_orders: Amelia3::Order.where(tenant: tenant).count }
puts JSON.generate(result)
FileUtils.mkdir_p(Rails.root.join("qa/amelia3-v5"))
File.write(Rails.root.join("qa/amelia3-v5/scheduler-status.json"), JSON.pretty_generate(result) + "\n")
