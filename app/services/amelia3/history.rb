module Amelia3
  class History
    def self.summary(rows)
      { rows: rows.count, orders: rows.distinct.count(:order_reference), products: rows.distinct.count(:product_code),
        last_delivery: rows.where("delivery_date <= ? AND shipped > 0", Time.zone.today).maximum(:delivery_date)&.iso8601 }
    end

    def self.batch_metrics(batch)
      customers = Customer.where(batch_id: batch.id)
      selected = customers.where(agent_code: "34")
      { "all" => summary(HistoryRow.where(batch_id: batch.id)),
        "agent34" => summary(HistoryRow.where(batch_id: batch.id, customer_code: selected.select(:external_code))).merge(
          customers: selected.count, unblocked: selected.where(blocked: false).count, blocked: selected.where(blocked: true).count) }
    end

    def self.usual(rows, limit: 50)
      rows.group(:product_code).select("product_code, COUNT(*) AS row_count, COUNT(DISTINCT order_reference) AS order_count, SUM(packs) AS total_packs, SUM(pieces) AS total_pieces, SUM(weight) AS total_weight, MAX(delivery_date) AS last_reference_date")
          .order(Arel.sql("COUNT(DISTINCT order_reference) DESC, product_code ASC")).limit(limit)
    end
  end
end
