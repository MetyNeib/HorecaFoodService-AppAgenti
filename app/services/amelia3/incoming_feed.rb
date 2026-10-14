require "net/ftp"

module Amelia3
  # This reader exposes no FTP mutations. Only the two agreed directories are read.
  class IncomingFeed
    CATALOG_FILES = %w[catalogo.csv venue_products.csv].freeze

    def initialize(tenant:, ftp: Net::FTP.new(nil, ssl: false), settings: FtpSettings.new, root: Rails.root.join("imports/private/amelia3/incoming"))
      @tenant, @ftp, @settings, @root = tenant, ftp, settings, Pathname(root)
    end

    def call
      ApplicationRecord.connection_pool.with_connection do |connection|
        key = 740_000_000 + @tenant.id
        return false unless connection.select_value("SELECT pg_try_advisory_lock(#{key})")
        begin
          pull
        ensure
          connection.execute("SELECT pg_advisory_unlock(#{key})")
        end
      end
    end

    private

    def pull
      @state = FeedState.find_or_create_by!(tenant: @tenant)
      @state.update!(last_attempt_at: Time.current, next_poll_at: 3.minutes.from_now)
      host, username, password = @settings.credentials
      @ftp.open_timeout = 15
      @ftp.read_timeout = 30
      @ftp.passive = true
      @ftp.connect(host, @settings.port)
      @ftp.login(username, password)
      @root.mkpath
      errors = {}
      @ftp.chdir("/DOWNLOAD/BACKUP")
      raise Error.new("Directory ordini inattesa.", code: "INBOX_DIRECTORY") unless @ftp.pwd == "/DOWNLOAD/BACKUP"
      names = @ftp.nlst.map { |name| File.basename(name) }.select { |name| name.match?(/\A[\w. -]+\.csv\z/i) }.sort
      raise Error.new("Archivio ordini fuori limite.", code: "INBOX_TOO_MANY_FILES") if names.length > 50_000
      @state.update!(initial_files: names, initialized_at: Time.current) unless @state.initialized_at
      metadata = @state.remote_files.dup
      names.each do |name|
        begin
          info = file_info(name, 2_000_000)
          next if metadata[name] == info
          path, sha = download(name, info)
          IncomingOrder.receive!(tenant: @tenant, name: name, bytes: path.binread, archived: @state.initial_files.include?(name))
          metadata[name] = info
        rescue Error => error
          errors[Digest::SHA256.hexdigest(name)] = error.code
        end
      end
      @state.update!(remote_files: metadata, file_errors: errors)
      pull_products
      @state.update!(last_success_at: Time.current, error_code: errors.any? ? "INBOX_FILES_PENDING" : nil, next_poll_at: @state.last_attempt_at + 3.minutes)
      true
    rescue StandardError => error
      code = error.is_a?(Error) ? error.code : "FEED_TRANSFER_FAILED"
      @state&.update!(error_code: code, next_poll_at: 3.minutes.from_now)
      raise Error.new("Aggiornamento FTP non completato; dati precedenti conservati.", code: code), cause: nil
    ensure
      @ftp.close rescue nil
    end

    def pull_products
      @ftp.chdir("/matia_ftp")
      raise Error.new("Directory prodotti inattesa.", code: "FEED_DIRECTORY") unless @ftp.pwd == "/matia_ftp"
      info = CATALOG_FILES.to_h { |name| [ name, file_info(name, 100_000_000) ] }
      current = @tenant.reload.feed_snapshot
      return if current && current.batch_id == @tenant.active_batch_id && info == current.files.transform_values { |value| value.except("sha256") }
      paths = {}
      files = info.to_h do |name, metadata|
        path, sha = download(name, metadata)
        paths[name] = path
        [ name, metadata.merge("sha256" => sha) ]
      end
      raise Error.new("Feed cambiato durante il download.", code: "FEED_UNSTABLE") unless CATALOG_FILES.all? { |name| file_info(name, 100_000_000) == info[name] }
      FeedImporter.call(tenant: @tenant, catalog_path: paths.fetch("catalogo.csv"), venue_path: paths.fetch("venue_products.csv"), files: files)
    end

    def file_info(name, maximum)
      size = @ftp.size(name)
      raise Error.new("File FTP fuori limite.", code: "FEED_SIZE") unless size.is_a?(Integer) && size.between?(1, maximum)
      { "bytes" => size, "modified" => @ftp.mtime(name, false).utc.iso8601 }
    end

    def download(name, info)
      temporary = @root.join("#{SecureRandom.uuid}.part")
      digest = Digest::SHA256.new
      size = 0
      File.open(temporary, "wb", 0o600) do |file|
        @ftp.retrbinary("RETR #{name}", 65_536) do |chunk|
          size += chunk.bytesize
          raise Error.new("File FTP cambiato.", code: "FEED_UNSTABLE") if size > info["bytes"]
          digest.update(chunk)
          file.write(chunk)
        end
        file.flush
        file.fsync
      end
      unless size == info["bytes"] && file_info(name, 100_000_000) == info
        raise Error.new("File FTP incompleto.", code: "FEED_UNSTABLE")
      end
      destination = @root.join("#{digest.hexdigest}.csv")
      File.rename(temporary, destination)
      [ destination, digest.hexdigest ]
    ensure
      File.delete(temporary) if temporary && File.exist?(temporary)
    end
  end
end
