module Amelia3
  class FtpSettings
    attr_reader :env

    def initialize(env = ENV)
      @env = env
      if env.fetch("AMELIA3_FTP_WRITE_ENABLED", "false").downcase != "false"
        raise Error.new("Scrittura FTP vietata: configurazione rifiutata.", code: "FTP_WRITE_FORBIDDEN")
      end
      unless env.fetch("AMELIA3_FTP_SYNC_CRON", "5 6 * * *").split == %w[5 6 * * *] && env.fetch("AMELIA3_FTP_TIMEZONE", "Europe/Rome") == "Europe/Rome"
        raise Error.new("Scheduler richiesto alle 06:05 Europe/Rome.", code: "INVALID_SCHEDULE")
      end
    end

    def enabled? = env.fetch("AMELIA3_FTP_SYNC_ENABLED", "false").downcase == "true"
    def timezone = "Europe/Rome"
    def cron = "5 6 * * *"
    def port = Integer(env.fetch("AMELIA3_FTP_PORT", "21"))
    def directory = env.fetch("AMELIA3_FTP_IMPORT_DIR", "/UPLOAD")

    def credentials
      fields = %w[AMELIA3_FTP_HOST AMELIA3_FTP_USERNAME AMELIA3_FTP_PASSWORD]
      values = fields.map { |key| env[key] }
      unless values.all?(&:present?) && port == 21 && directory == "/UPLOAD"
        raise Error.new("Configurazione FTP read-only non disponibile.", code: "FTP_NOT_CONFIGURED")
      end
      values
    end
  end
end
