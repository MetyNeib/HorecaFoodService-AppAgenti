require "csv"

module Amelia3
  class FeedImporter
    SEARCH_FIELDS = %w[category_1_name category_2_name synonyms brand_name format_name origin_name product_type_name].freeze

    def self.call(tenant:, catalog_path:, venue_path:, files:, date: Time.zone.today)
      new(tenant, catalog_path, venue_path, files, date).call
    end

    def initialize(tenant, catalog_path, venue_path, files, date)
      @tenant, @catalog, @venue, @files, @date = tenant, catalog_path, venue_path, files, date
    end

    def call
      batch = @tenant.reload.active_batch
      digest = Digest::SHA256.hexdigest(JSON.generate(@files.sort.to_h))
      snapshot = FeedSnapshot.find_by(tenant: @tenant, batch: batch, digest: digest)
      return snapshot if snapshot&.published_at
      profiles, = HistoryProfiles.prepare(batch)
      purchases = profiles.profiles.to_h do |profile|
        dates = profile.product_dates.transform_values { |values| values.select { |value| value >= @date.prev_month(6).iso8601 && value <= @date.iso8601 }.max }.compact
        [ profile.customer_code, dates ]
      end
      customers = Customer.where(batch_id: batch.id, blocked: false).pluck(:external_code).to_set
      products = Product.where(batch_id: batch.id, blocked: false).pluck(:external_code).to_set
      counts = Hash.new(0)
      FeedSnapshot.transaction do
        snapshot = FeedSnapshot.create!(tenant: @tenant, batch: batch, digest: digest, files: @files)
        buffer = []
        each_csv(@catalog, %w[code name]) do |row|
          counts["catalogRows"] += 1
          next unless products.include?(row["code"])
          buffer << { feed_snapshot_id: snapshot.id, product_code: row["code"], name: row["name"], search_data: row.to_h.slice(*SEARCH_FIELDS) }
          flush(FeedProduct, buffer) if buffer.length >= 2000
        end
        flush(FeedProduct, buffer)
        each_csv(@venue, %w[venue_unique_code product_code last_sale_date last_sale_quantity], separator: ";") do |row|
          counts["venueRows"] += 1
          customer, product = row.values_at("venue_unique_code", "product_code")
          last = purchases.dig(customer, product)
          # Positive purchases and their dates come from STORICO, never from incoming orders.
          unless customers.include?(customer) && products.include?(product) && last
            counts["excludedPairs"] += 1
            next
          end
          buffer << { feed_snapshot_id: snapshot.id, customer_code: customer, product_code: product, last_purchased_on: last }
          counts["habitualPairs"] += 1
          flush(HabitualProduct, buffer) if buffer.length >= 2000
        end
        flush(HabitualProduct, buffer)
        raise Error.new("Feed vuoto: mantenuta la versione precedente.", code: "FEED_EMPTY") if counts["catalogRows"].zero? || counts["venueRows"].zero?
        @tenant.lock!
        raise Error.new("Dataset cambiato durante l’importazione.", code: "BATCH_CHANGED") unless @tenant.active_batch_id == batch.id
        snapshot.update!(counts: counts, published_at: Time.current)
        @tenant.update!(feed_snapshot: snapshot)
      end
      snapshot
    rescue CSV::MalformedCSVError, EncodingError, ActiveRecord::RecordNotUnique
      raise Error.new("Feed non valido o duplicato: mantenuta la versione precedente.", code: "FEED_INVALID"), cause: nil
    end

    private

    def each_csv(path, required, separator: ";")
      CSV.open(path, "r:bom|utf-8", headers: true, col_sep: separator, liberal_parsing: true) do |csv|
        first = csv.shift
        raise Error.new("Intestazioni feed mancanti.", code: "FEED_HEADER") unless first && (required - csv.headers).empty?
        ([ first ].each + csv.each).each do |row|
          raise Error.new("Numero di colonne feed non valido.", code: "FEED_COLUMNS") unless row.fields.length == csv.headers.length
          yield row
        end
      end
    end

    def flush(model, buffer)
      model.insert_all!(buffer) if buffer.any?
      buffer.clear
    end
  end
end
