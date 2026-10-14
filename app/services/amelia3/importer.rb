require "digest"
require "securerandom"
require "pg"

module Amelia3
  class Importer
    MAPPING_VERSION = 1
    TABLES = {
      "ARTICOLI.csv" => Product, "CLIENTI.csv" => Customer, "FIDO.csv" => Credit,
      "GIACENZE.csv" => Stock, "INSOLUTO.csv" => OpenItem, "LISTINI.csv" => Price,
      "LISTINI_PERS.csv" => Condition, "STORICO.csv" => HistoryRow, "TABGIR.csv" => Route
    }.freeze

    def self.call(tenant:, directory:, source: "local", dry_run: false)
      new(tenant, directory, source, dry_run).call
    end

    def initialize(tenant, directory, source, dry_run)
      @tenant = tenant
      @directory = Pathname(directory).realpath
      @source = source
      @dry_run = dry_run
    end

    def call
      files = checksums
      fingerprint = Digest::SHA256.hexdigest("mapping:#{MAPPING_VERSION}\n" + files.sort.map { |name, info| "#{name}:#{info.fetch(:sha256)}" }.join("\n"))
      result = nil
      with_import_lock do
        existing = @tenant.import_batches.find_by(fingerprint: fingerprint, status: "published")
        if existing
          raise Error.new("Batch già superato: nessun ripristino implicito.", code: "SUPERSEDED_BATCH") unless @tenant.reload.active_batch_id == existing.id
          result = existing
          next
        end
        validated = @tenant.import_batches.find_by(fingerprint: fingerprint, status: "validated")
        if validated
          @batch = validated
          validate_relations!
          raise Error.new("Staging modificato.", code: "INVALID_STAGING") unless TABLES.all? { |name, model| model.where(batch_id: @batch.id).count == @batch.counts[name] }
          @batch.update!(metrics: History.batch_metrics(@batch))
          publish! unless @dry_run
          result = @batch
          next
        end
        previous = @tenant.import_batches.find_by(fingerprint: fingerprint)
        if previous
          HistoryOrderSummary.where(batch_id: previous.id).delete_all
          TABLES.values.each { |model| model.where(batch_id: previous.id).delete_all }
          previous.destroy!
        end
        @batch = @tenant.import_batches.create!(id: SecureRandom.uuid, fingerprint: fingerprint, source: @source, files: files)
        counts = {}
        anomalies = {}
        TABLES.each do |name, model|
          reader = CsvReader.new(@directory.join(name))
          copy(model, name, reader)
          counts[name] = reader.count
          anomalies[name] = reader.anomalies
        end
        validate_relations!
        raise Error.new("File modificati durante l'importazione.", code: "UNSTABLE_FILES") unless files == checksums
        @batch.update!(counts: counts, anomalies: anomalies, metrics: History.batch_metrics(@batch))
        if @dry_run
          @batch.update!(status: "validated")
        else
          publish!
        end
        result = @batch
      rescue Error => error
        @batch&.update!(status: "failed", error_code: error.code)
        raise
      rescue StandardError
        @batch&.update!(status: "failed", error_code: "IMPORT_FAILURE")
        raise Error.new("Importazione non pubblicata; ultimo dataset conservato.", code: "IMPORT_FAILURE"), cause: nil
      end
      result
    end

    private

    def publish!
      HistoryOrderSummary.prepare(@batch)
      HistoryProfiles.prepare(@batch)
      Tenant.transaction do
        @tenant.lock!
        @batch.update!(status: "published", published_at: Time.current)
        @tenant.update!(active_batch: @batch, revision: @tenant.revision + 1)
      end
    end

    def checksums
      Schema::HEADERS.to_h do |name, _|
        path = @directory.join(name)
        raise Error.new("Batch incompleto: #{name}.", code: "MISSING_FILE") unless path.file? && path.realpath.dirname == @directory
        [ name, { sha256: Digest::SHA256.file(path).hexdigest, bytes: path.size } ]
      end
    end

    def with_import_lock
      ApplicationRecord.connection_pool.with_connection do |connection|
        key = 730_000_000 + @tenant.id
        raise Error.new("Importazione già in corso.", code: "IMPORT_BUSY", status: 409) unless connection.select_value("SELECT pg_try_advisory_lock(#{key})")
        begin
          yield
        ensure
          connection.execute("SELECT pg_advisory_unlock(#{key})")
        end
      end
    end

    def copy(model, name, reader)
      records = Enumerator.new do |stream|
        reader.each { |row, index| stream << { batch_id: @batch.id }.merge(ImportMapper.call(name, row, index)) }
      end
      first = records.next
      columns = first.keys
      connection = ApplicationRecord.connection
      pg = connection.raw_connection
      sql = "COPY #{model.quoted_table_name} (#{columns.map { |column| connection.quote_column_name(column) }.join(',')}) FROM STDIN"
      ApplicationRecord.transaction(requires_new: true) do
        pg.copy_data(sql, PG::TextEncoder::CopyRow.new) do
          pg.put_copy_data(columns.map { |column| copy_value(first[column]) })
          loop do
            row = records.next
            pg.put_copy_data(columns.map { |column| copy_value(row[column]) })
          end
        end
      end
    end

    def copy_value(value)
      case value
      when BigDecimal then value.to_s("F")
      when Date then value.iso8601
      when Hash then JSON.generate(value)
      else value
      end
    end

    def validate_relations!
      batch = @batch.id
      customers = Customer.where(batch_id: batch)
      products = Product.where(batch_id: batch)
      { Credit => :customer_code, Condition => :customer_code, Route => :customer_code, HistoryRow => :customer_code }.each do |model, key|
        raise Error.new("Riferimento cliente non valido.", code: "ORPHAN_CUSTOMER") if model.where(batch_id: batch).where.not(key => customers.select(:external_code)).exists?
      end
      [ Stock, Price, Condition, HistoryRow ].each do |model|
        raise Error.new("Riferimento articolo non valido.", code: "ORPHAN_PRODUCT") if model.where(batch_id: batch).where.not(product_code: products.select(:external_code)).exists?
      end
      if OpenItem.where(batch_id: batch).where.not(account_code: customers.select(:account_code)).exists? ||
        customers.where.not(parent_code: nil).where.not(parent_code: customers.select(:external_code)).exists?
        raise Error.new("Riferimento anagrafica non valido.", code: "ORPHAN_ACCOUNT")
      end
      raise Error.new("Validità condizione non coerente.", code: "INVALID_CONDITION") if Condition.where(batch_id: batch).where("valid_to < valid_from").exists?
    end
  end
end
