module Amelia3
  class CustomerActivity
    def initialize(scope, date: Time.zone.today)
      @scope, @date = scope, date
    end

    def active_codes
      last_dates.select { |_, date| date >= @date - 90 }.keys
    end

    def for(customer)
      last = last_dates[customer.external_code]
      { "activity" => customer.blocked ? "blocked" : last && last >= @date - 90 ? "active" : "dormant",
        "lastPurchaseDate" => last&.iso8601 }
    end

    private

    def last_dates
      @last_dates ||= begin
        set = @scope.tenant.active_batch.history_profile_set
        if set
          connection = ApplicationRecord.connection
          sql = <<~SQL
            SELECT memberships.customer_code, MAX(purchase.value) AS last_purchase
            FROM amelia3_history_profile_memberships memberships
            JOIN amelia3_history_profiles profiles ON profiles.id = memberships.profile_id
            CROSS JOIN LATERAL jsonb_each(profiles.product_dates) product
            CROSS JOIN LATERAL jsonb_array_elements_text(product.value) purchase
            WHERE memberships.profile_set_id = #{connection.quote(set.id)}
              AND memberships.customer_code IN (#{@scope.customers.select(:external_code).to_sql})
              AND purchase.value <= #{connection.quote(@date.iso8601)}
            GROUP BY memberships.customer_code
          SQL
          connection.select_rows(sql).to_h.transform_values { |date| Date.iso8601(date) }
        else
          @scope.history.where("shipped > 0 AND delivery_date <= ?", @date).group(:customer_code).maximum(:delivery_date)
        end
      end
    end
  end
end
