module Amelia3
  class HistoryOrders
    PER_PAGE = 20
    attr_reader :total, :rows

    def initialize(scope, params)
      raise Error.new("Indice ordini storici in preparazione.", code: "HISTORY_NOT_PREPARED", status: 503) unless scope.tenant.active_batch.metrics["historyOrdersVersion"] == 1
      source = HistoryOrderSummary.where(batch_id: scope.batch_id, customer_code: scope.customers.select(:external_code))
      source = source.where(customer_code: scope.customer(params[:customer_id]).external_code) if params[:customer_id].present?
      query = params[:q].to_s.strip.first(100)
      source = source.where("order_reference ILIKE ?", "%#{ApplicationRecord.sanitize_sql_like(query)}%") if query.present?
      from = params[:from].present? ? CsvReader.date(params[:from]) : Date.new(1, 1, 1)
      to = params[:to].present? ? CsvReader.date(params[:to]) : Date.new(9999, 12, 31)
      if params[:from].present? || params[:to].present?
        source = source.where("last_delivery >= ? AND first_delivery <= ? AND EXISTS (SELECT 1 FROM unnest(delivery_dates) AS date WHERE date BETWEEN ? AND ?)", from, to, from, to)
      end
      @total = source.count
      page = Integer(params[:page], exception: false).to_i.clamp(1, 100_000)
      @rows = source.order(last_delivery: :desc, customer_code: :asc, order_reference: :asc).offset((page - 1) * PER_PAGE).limit(PER_PAGE).to_a
    end
  end
end
