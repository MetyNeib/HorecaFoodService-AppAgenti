require "csv"

module Amelia3
  class IncomingOrderParser
    UNIT_MAP = { "CT" => "COLL", "COLLO" => "COLL", "CF" => "CONF", "PZ" => "PZ", "KG" => "KG", "LT" => "LT" }.freeze

    def self.call(bytes)
      raise Error.new("Ordine vuoto o troppo grande.", code: "INBOX_INVALID_FILE") unless bytes.bytesize.between?(1, 2_000_000)
      text = bytes.dup.force_encoding("UTF-8")
      text = bytes.dup.force_encoding("Windows-1252").encode("UTF-8") unless text.valid_encoding?
      rows = CSV.parse(text.delete_prefix("\uFEFF"), col_sep: ";")
      header = rows.shift
      unless header&.length == 14 && header[0].present? && header[5].present? && rows.length.between?(1, 1000)
        raise Error.new("Struttura ordine non riconosciuta.", code: "INBOX_INVALID_HEADER")
      end
      lines = rows.map.with_index do |row, index|
        unless [ 11, 14 ].include?(row.length) && row[0].present? && row[1].present?
          raise Error.new("Riga ordine incompleta.", code: "INBOX_INVALID_LINE")
        end
        quantity = CsvReader.decimal(row[2])
        raise Error.new("Quantità ricevuta non positiva.", code: "INBOX_INVALID_QUANTITY") unless quantity.positive?
        { "id" => (index + 1).to_s, "productCode" => row[0].strip, "sourceUnit" => row[1].strip.upcase,
          "unit" => UNIT_MAP[row[1].strip.upcase], "quantity" => quantity.to_s("F"), "note" => row[4].to_s, "raw" => row }
      end
      { "customerCode" => header[0].strip, "externalReference" => header[5].strip,
        "orderDate" => CsvReader.date(header[1]).iso8601, "deliveryDate" => CsvReader.date(header[2]).iso8601,
        "note" => header[4].to_s, "lines" => lines, "header" => header }
    rescue CSV::MalformedCSVError, EncodingError
      raise Error.new("CSV ordine non leggibile.", code: "INBOX_INVALID_FILE"), cause: nil
    end
  end
end
