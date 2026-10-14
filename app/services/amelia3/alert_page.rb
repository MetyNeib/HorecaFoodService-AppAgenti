module Amelia3
  # Allocate 4/4/2 first, redistributing unused slots deterministically; only then fetch ten rows.
  class AlertPage
    attr_reader :run, :items, :total, :page
    MIX = [ 4, 4, 2 ].freeze

    def initialize(scope, params)
      @run = params[:run_id].present? ? AlertRun.find_by!(id: params[:run_id], tenant_id: scope.tenant.id, status: "published") : scope.tenant.active_alert_run
      @page = Integer(params[:page], exception: false).to_i.clamp(1, 100_000)
      @items, @total = [], 0
      return unless @run
      reactivation = params[:type] == SalesAlertRules::REACTIVATION
      customers = reactivation ? scope.customers : scope.customers.where(blocked: false)
      customers = customers.where(agent_code: params[:agent]) if params[:agent].present?
      if params[:customer_id].present?
        scope.customer(params[:customer_id])
        customers = customers.where(external_code: params[:customer_id])
      end
      rows = @run.items.where(status: "active", customer_code: customers.select(:external_code))
      if reactivation
        rows = rows.where(rule_type: SalesAlertRules::REACTIVATION)
        @total = rows.count
        @page = @page.clamp(1, [ (@total / 10.0).ceil, 1 ].max)
        @items = rows.order(days_late: :desc, customer_code: :asc).offset((@page - 1) * 10).limit(10).to_a
        return
      end
      rows = rows.where(rule_type: params[:type]) if SalesAlertRules::TYPES.include?(params[:type])
      # Current product blocks also apply while displaying a previously published run.
      blocked_products = scope.products.where(blocked: true).select(:external_code)
      rows = rows.where.not(rule_type: "USUAL_PRODUCT_MISSING", product_code: blocked_products)
      pools = SalesAlertRules::TYPES.map { |type| rows.where(rule_type: type) }
      remaining = pools.map(&:count)
      @total = remaining.sum
      @page = @page.clamp(1, [ (@total / 10.0).ceil, 1 ].max)
      offsets = [ 0, 0, 0 ]
      @page.times do |index|
        allocation = MIX.each_with_index.map { |quota, pool| [ quota, remaining[pool] ].min }
        while allocation.sum < 10
          pool = remaining.each_index.find { |position| remaining[position] > allocation[position] }
          break unless pool
          allocation[pool] += 1
        end
        if index == @page - 1
          ranking = Arel.sql("severity_numerator::numeric / severity_denominator DESC, days_late DESC, customer_code ASC, product_code ASC")
          @items = pools.each_with_index.flat_map { |pool, position| pool.order(ranking).offset(offsets[position]).limit(allocation[position]).to_a }
        end
        remaining.each_index { |position| remaining[position] -= allocation[position]; offsets[position] += allocation[position] }
      end
    end
  end
end
