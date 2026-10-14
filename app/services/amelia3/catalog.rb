module Amelia3
  class Catalog
    def initialize(scope, products, customer = nil)
      @scope, @products, @customer = scope, products.to_a, customer
      codes = @products.map(&:external_code)
      @stocks = Stock.where(batch_id: scope.batch_id, product_code: codes).index_by(&:product_code)
      @prices = Price.where(batch_id: scope.batch_id, product_code: codes, list_code: "000").index_by(&:product_code)
      @conditions = customer ? Condition.where(batch_id: scope.batch_id, customer_code: customer.external_code, product_code: codes).group_by(&:product_code) : {}
      @verifications = UnitVerification.where(tenant: scope.tenant, active: true).to_a
    end

    def quotes
      @products.to_h do |product|
        [ product.external_code, quote(product) ]
      end
    end

    def quote(product, unit: nil)
      Quote.new(product: product, customer: @customer, stock: @stocks[product.external_code], price: @prices[product.external_code],
                conditions: @conditions.fetch(product.external_code, []), unit: unit, verification: UnitVerification.for_product(product, @verifications))
    end

    def orderable_units(product)
      return [] if product.generic_catalog_item?
      @orderable_units ||= {}
      @orderable_units[product.id] ||= product.canonical_units.fetch("orderableUms").select do |unit|
        quote(product, unit: unit).unavailable_reason.nil?
      end
    end

    def orderable_products(limit: nil)
      rows = @products.lazy.select { |product| orderable_units(product).any? }
      (limit ? rows.take(limit) : rows).to_a
    end

    def self.cached_products(scope, include_usual: true)
      candidates = scope.products.where(blocked: false).order(:external_code)
      usable = new(scope, candidates).orderable_products(limit: 180).map(&:external_code)
      usual = scope.user.role == "admin" || !include_usual ? [] : scope.history.group(:product_code).order(Arel.sql("COUNT(*) DESC")).limit(80).pluck(:product_code)
      personal = Condition.where(batch_id: scope.batch_id, customer_code: scope.customers.select(:external_code)).limit(40).pluck(:product_code)
      scope.products.where(external_code: (usable + usual + personal).uniq).order(:external_code)
    end
  end
end
