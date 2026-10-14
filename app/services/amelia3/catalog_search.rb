module Amelia3
  class CatalogSearch
    attr_reader :status, :method

    def initialize(scope, rows)
      @scope, @rows = scope, rows
    end

    def call(query)
      return @rows if query.blank?
      extras = @scope.tenant.feed_snapshot&.products&.where(product_code: @rows.select(:external_code))&.index_by(&:product_code) || {}
      candidates = @rows.pluck(:external_code, :name).map do |code, name|
        { "code" => code, "name" => name, "synonyms" => [ extras[code]&.name, extras[code]&.search_data&.fetch("synonyms", nil) ].compact.join(" "), "category" => extras[code]&.search_data&.fetch("category_1_name", nil) }
      end
      result = ProductMatching.call(tenant: @scope.tenant, query: query, candidates: candidates)
      @status, @method = result.status, result.method
      @rows.where(external_code: result.codes)
    end
  end
end
