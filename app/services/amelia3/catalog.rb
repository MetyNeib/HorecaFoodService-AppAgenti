module Amelia3
  class Catalog
    def initialize(scope, products, customer = nil)
      @scope, @products, @customer = scope, products.to_a, customer
      codes = @products.map(&:external_code)
      @stocks = Stock.where(batch_id: scope.batch_id, product_code: codes).index_by(&:product_code)
      @prices = Price.where(batch_id: scope.batch_id, product_code: codes, list_code: "000").index_by(&:product_code)
      @conditions = customer ? Condition.where(batch_id: scope.batch_id, customer_code: customer.external_code, product_code: codes).group_by(&:product_code) : {}
    end

    def quotes
      @products.to_h do |product|
        [ product.external_code, Quote.new(product: product, customer: @customer, stock: @stocks[product.external_code], price: @prices[product.external_code], conditions: @conditions.fetch(product.external_code, [])) ]
      end
    end

    def self.cached_products(scope)
      usable = scope.products.where(base_unit: "P", order_unit: "P", blocked: false)
                    .where(external_code: Stock.where(batch_id: scope.batch_id).where("pieces > 0").select(:product_code))
                    .order(:external_code).limit(180).pluck(:external_code)
      usual = scope.user.role == "admin" ? [] : scope.history.group(:product_code).order(Arel.sql("COUNT(*) DESC")).limit(80).pluck(:product_code)
      personal = Condition.where(batch_id: scope.batch_id, customer_code: scope.customers.select(:external_code)).limit(40).pluck(:product_code)
      scope.products.where(external_code: (usable + usual + personal).uniq).order(:external_code)
    end
  end
end
