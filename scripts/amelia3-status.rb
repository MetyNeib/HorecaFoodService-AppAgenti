tenant = Amelia3::Tenant.find_by!(code: "amelia3")
runs = Amelia3::SyncOccurrence.where(tenant: tenant).order(local_date: :desc).limit(7).map do |run|
  { local_date: run.local_date.iso8601, scheduled_at: run.scheduled_at.in_time_zone("Europe/Rome").iso8601, status: run.status, attempts: run.attempts,
    error_code: run.error_code, completed_at: run.completed_at&.iso8601, active_batch_matches: run.batch_id == tenant.active_batch_id }
end
result = { scheduler: Amelia3::Scheduler.status, occurrences: runs, revision: tenant.revision,
  active_counts: tenant.active_batch.counts, agent34: tenant.active_batch.metrics["agent34"],
  canonical_orders: Amelia3::Order.where(tenant: tenant).count }
puts JSON.generate(result)
FileUtils.mkdir_p(Rails.root.join("qa/amelia3"))
File.write(Rails.root.join("qa/amelia3/scheduler-status.json"), JSON.pretty_generate(result) + "\n")
