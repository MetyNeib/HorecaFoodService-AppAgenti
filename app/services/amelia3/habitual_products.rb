module Amelia3
  class HabitualProducts
    def self.codes(scope, customer_code, date: Time.zone.today)
      scope.customer(customer_code)
      snapshot = scope.tenant.feed_snapshot
      return [] unless snapshot && snapshot.batch_id == scope.batch_id
      snapshot.habitual_products.where(customer_code: customer_code, last_purchased_on: date.prev_month(6)..date).pluck(:product_code)
    end
  end
end
