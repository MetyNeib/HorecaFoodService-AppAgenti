require "net/ftp"
require "digest"
require "securerandom"

module Amelia3
  class FtpDownloader
    MAX_FILE_BYTES = 512 * 1024 * 1024

    def initialize(settings: FtpSettings.new, ftp: Net::FTP.new(nil, ssl: false), root: Rails.root.join("imports/private/amelia3/ftp"), probe_seconds: 2)
      @settings, @ftp, @root, @probe_seconds = settings, ftp, Pathname(root), probe_seconds
    end

    def call
      host, username, password = @settings.credentials
      @ftp.open_timeout = 15
      @ftp.read_timeout = 30
      @ftp.passive = true
      @ftp.connect(host, @settings.port)
      @ftp.login(username, password)
      @ftp.chdir(@settings.directory)
      unless @ftp.pwd == "/UPLOAD"
        raise Error.new("Directory FTP inattesa.", code: "FTP_DIRECTORY")
      end
      names = @ftp.nlst.map { |name| File.basename(name) }
      missing = Schema::HEADERS.keys - names
      raise Error.new("Batch FTP incompleto.", code: "FTP_MISSING_FILE") if missing.any?
      before = metadata
      sleep(@probe_seconds) if @probe_seconds.positive?
      raise Error.new("Export FTP ancora in scrittura.", code: "FTP_UNSTABLE") unless metadata == before
      FileUtils.mkdir_p(@root)
      directory = @root.join(SecureRandom.uuid)
      FileUtils.mkdir(directory)
      files = download(directory, before)
      raise Error.new("Export FTP modificato durante il trasferimento.", code: "FTP_UNSTABLE") unless metadata == before
      if before.values.any? { |info| info[:modified].nil? }
        # Size alone does not attest stability: compare a second complete read.
        raise Error.new("Contenuti FTP non stabili.", code: "FTP_UNSTABLE") unless second_checksums == files.transform_values { |info| info[:sha256] }
      end
      { directory: directory, files: files, encrypted: false, read_only: true }
    rescue Error
      raise
    rescue StandardError
      raise Error.new("Download FTP non completato; dataset valido conservato.", code: "FTP_TRANSFER_FAILED"), cause: nil
    ensure
      @ftp.close rescue nil
    end

    private

    def metadata
      Schema::HEADERS.to_h do |name, _|
        size = @ftp.size(name)
        raise Error.new("Dimensione export FTP non valida.", code: "FTP_INVALID_SIZE") unless size.is_a?(Integer) && size.positive? && size <= MAX_FILE_BYTES
        modified = begin
          @ftp.mtime(name, false).utc.iso8601
        rescue Net::FTPPermError
          nil
        end
        [ name, { bytes: size, modified: modified } ]
      end
    end

    def download(directory, metadata)
      metadata.to_h do |name, info|
        digest = Digest::SHA256.new
        size = 0
        File.open(directory.join(name), "wb") do |file|
          @ftp.retrbinary("RETR #{name}", 65_536) do |chunk|
            size += chunk.bytesize
            raise Error.new("Dimensione FTP cambiata.", code: "FTP_UNSTABLE") if size > info[:bytes]
            digest.update(chunk); file.write(chunk)
          end
          file.flush; file.fsync
        end
        raise Error.new("File FTP incompleto.", code: "FTP_TRUNCATED") unless size == info[:bytes]
        [ name, info.merge(sha256: digest.hexdigest) ]
      end
    end

    def second_checksums
      Schema::HEADERS.to_h do |name, _|
        digest = Digest::SHA256.new
        count = 0
        @ftp.retrbinary("RETR #{name}", 65_536) do |chunk|
          count += chunk.bytesize
          raise Error.new("Dimensione FTP fuori limite.", code: "FTP_INVALID_SIZE") if count > MAX_FILE_BYTES
          digest.update(chunk)
        end
        [ name, digest.hexdigest ]
      end
    end
  end
end
