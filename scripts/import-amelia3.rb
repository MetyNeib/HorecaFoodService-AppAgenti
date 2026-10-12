tenant = Amelia3::Tenant.find_or_create_by!(code: "amelia3") { |row| row.name = "Amelia3" }
dry_run = ARGV.include?("--dry-run")
started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
batch = Amelia3::Importer.call(tenant: tenant, directory: Rails.root.join("imports/private/amelia3"), dry_run: dry_run)
puts JSON.generate(status: batch.status, fingerprint: batch.fingerprint, counts: batch.counts, anomalies: batch.anomalies)
elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - started
puts JSON.generate(elapsed_seconds: elapsed.round(3), dry_run: dry_run)
result = { status: batch.status, fingerprint: batch.fingerprint, counts: batch.counts, anomalies: batch.anomalies,
           metrics: batch.metrics, elapsed_seconds: elapsed.round(3), dry_run: dry_run,
           peak_rss_kb: File.read("/proc/self/status")[/^VmHWM:\s+(\d+)/, 1]&.to_i }
FileUtils.mkdir_p(Rails.root.join("qa/amelia3"))
File.write(Rails.root.join("qa/amelia3", dry_run ? "dry-run.json" : "local-import.json"), JSON.pretty_generate(result) + "\n")
