module Amelia3FeedFixture
  def incoming_csv(customer: 'C001', reference: 'QA-1', quantity: '2,5', product: 'P001', unit: 'PZ', columns: 14)
    CSV.generate(col_sep: ';') do |csv|
      csv << [ customer, '14/10/2026', '15/10/2026', 'A', 'Nota sintetica', reference, '14/10/2026', nil, nil, nil, nil, nil, nil, 'N' ]
      csv << [ product, unit, quantity, 'N', 'Nota riga', *Array.new(columns - 5) ]
    end
  end

  def feed_csvs
    {
      '/matia_ftp/catalogo.csv' => CSV.generate(col_sep: ";") { |csv| csv << %w[code name category_1_name synonyms]; csv << [ 'P001', 'Prodotto sintetico P', 'Alimentari', '[]' ] },
      '/matia_ftp/venue_products.csv' => CSV.generate(col_sep: ';') do |csv|
        csv << %w[venue_unique_code product_code last_sale_date last_sale_quantity]
        csv << %w[C001 P001 2999-01-01 0]
        csv << %w[C003 K001 2026-10-01 99]
        csv << %w[C001 UNKNOWN 2026-10-01 99]
      end
    }
  end

  class ReadOnlyFtp
    attr_accessor :open_timeout, :read_timeout, :passive, :files, :unstable
    attr_reader :retrieved
    def initialize(files)
      @files, @retrieved = files, []
    end
    def connect(*) = true
    def login(*) = true
    def close = true
    def chdir(path) = @directory = path
    def pwd = @directory
    def nlst = files.keys.select { |path| File.dirname(path) == @directory }.map { |path| File.basename(path) }
    def size(name) = files.fetch("#{@directory}/#{name}").bytesize
    def mtime(name, *) = Time.utc(2026, 10, 14) + (unstable && @retrieved.include?(name) ? 1 : 0)
    def retrbinary(command, *)
      raise 'Remote mutation forbidden' unless command.start_with?('RETR ')
      name = command.delete_prefix('RETR ')
      @retrieved << name
      yield files.fetch("#{@directory}/#{name}")
    end
  end
end
