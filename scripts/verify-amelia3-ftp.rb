abort "Local FTP verification is only allowed in development" unless Rails.env.development?
started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
tenant = Amelia3::Tenant.find_by!(code: "amelia3")
previous = tenant.active_batch_id
source = Amelia3::FtpDownloader.new.call
batch = Amelia3::Importer.call(tenant: tenant, directory: source.fetch(:directory), source: "ftp")
proof = { status: "PASS", scope: "LIVE_FTP_DOWNLOAD_AND_ATOMIC_IMPORT", observed_at: Time.current.iso8601,
          encrypted: source.fetch(:encrypted), read_only: source.fetch(:read_only), files: source.fetch(:files),
          batch_fingerprint: batch.fingerprint, unchanged_batch: previous == batch.id,
          counts: batch.counts, elapsed_seconds: (Process.clock_gettime(Process::CLOCK_MONOTONIC) - started).round(3) }
File.write(Rails.root.join("qa/amelia3/live-ftp.json"), JSON.pretty_generate(proof) + "\n")
puts JSON.generate(proof.except(:files, :batch_fingerprint))
