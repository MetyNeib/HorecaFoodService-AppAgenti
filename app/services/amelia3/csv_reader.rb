require "csv"
require "bigdecimal"

module Amelia3
  class CsvReader
    attr_reader :anomalies, :count

    def initialize(path)
      @path = Pathname(path)
      @name = @path.basename.to_s
      @fields = Schema::HEADERS.fetch(@name)
      @anomalies = Hash.new(0)
      @count = 0
    end

    def each
      File.open(@path, "r:#{Schema::ENCODINGS.fetch(@name)}:UTF-8") do |file|
        # The export contains literal quotes in unquoted descriptions. Column and
        # flag validation still reject structural corruption after parsing.
        csv = CSV.new(file, col_sep: ";", liberal_parsing: true)
        header = csv.shift
        raise Error.new("Tracciato CSV non riconosciuto: #{@name}.", code: "INVALID_HEADER") unless header == [ *@fields, nil ] || header == [ *@fields, "" ]
        csv.each do |row|
          @count += 1
          raise Error.new("Riga CSV incompleta: #{@name}, riga #{@count}.", code: "INVALID_ROW") if row.nil?
          row = row.map { |cell| cell.to_s }
          row.pop if row.last == "" && row.length > @fields.length
          repair_customer(row) if @name == "CLIENTI.csv"
          unless row.length == @fields.length
            raise Error.new("Numero di colonne non valido: #{@name}, riga #{@count}.", code: "INVALID_ROW")
          end
          yield @fields.zip(row.map(&:strip)).to_h, @count
        end
      end
      raise Error.new("CSV privo di dati: #{@name}.", code: "EMPTY_FILE") if @count.zero?
    rescue CSV::MalformedCSVError, EncodingError, ArgumentError
      raise Error.new("Formato o encoding CSV non valido: #{@name}.", code: "INVALID_CSV"), cause: nil
    end

    def self.decimal(value, optional: false, tolerate_invalid: false)
      return nil if optional && value.to_s.empty?
      text = value.to_s.tr(",", ".")
      unless text.match?(/\A[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\z/) && text.length <= 64
        return nil if tolerate_invalid
        raise Error.new("Valore numerico non valido.", code: "INVALID_DECIMAL")
      end
      number = BigDecimal(text)
      raise Error.new("Valore numerico fuori scala.", code: "INVALID_DECIMAL") unless number.finite? && number.abs < BigDecimal("1000000000000")
      number
    end

    def self.date(value)
      format = case value
      when /\A\d{4}-\d{2}-\d{2}\z/ then "%Y-%m-%d"
      when /\A\d{1,2}\/\d{1,2}\/\d{4}\z/ then "%d/%m/%Y"
      when /\A\d{1,2}-\d{1,2}-\d{4}\z/ then "%d-%m-%Y"
      when /\A\d{1,2}\.\d{1,2}\.\d{4}\z/ then "%d.%m.%Y"
      when /\A\d{8}\z/ then "%Y%m%d"
      else raise Error.new("Data CSV non valida.", code: "INVALID_DATE")
      end
      Date.strptime(value, format)
    rescue Date::Error
      raise Error.new("Data CSV non valida.", code: "INVALID_DATE")
    end

    def self.flag(value)
      raise Error.new("Flag CSV non valido.", code: "INVALID_FLAG") unless %w[S N].include?(value)
      value == "S"
    end

    private

    def repair_customer(row)
      repaired = false
      # Repair the name first: otherwise a shifted empty email could be mistaken
      # for an extra capoarea position and a valid customer would be discarded.
      if !customer_prefix?(row) && row.length > @fields.length
        candidate = row.dup
        candidate[2] = candidate[2] + ";" + candidate.delete_at(3)
        if customer_prefix?(candidate)
          row.replace(candidate)
          @anomalies["customer_unquoted_semicolon"] += 1
        end
      end
      while customer_prefix?(row) && row.length > @fields.length && row.last == ""
        row.pop
        repaired = true
      end
      while customer_prefix?(row) && row.length > @fields.length && row[20] == ""
        row.delete_at(20)
        repaired = true
      end
      @anomalies["customer_extra_empty_columns"] += 1 if repaired
      raise Error.new("Ancore CLIENTI non valide, riga #{@count}.", code: "INVALID_CUSTOMER") unless customer_anchors?(row)
    end

    def customer_anchors?(row)
      row.length == @fields.length && customer_prefix?(row)
    end

    def customer_prefix?(row)
      [ 7, 8, 14 ].all? { |index| %w[S N].include?(row[index].to_s.strip) } &&
        row[0].present? && row[1].present? && row[16].present?
    end
  end
end
