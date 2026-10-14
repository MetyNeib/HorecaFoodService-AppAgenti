class Amelia3::HistoryOrderSummary < ApplicationRecord
  belongs_to :batch, class_name: "Amelia3::ImportBatch"

  def self.prepare(batch)
    return if batch.metrics["historyOrdersVersion"] == 1
    transaction do
      where(batch_id: batch.id).delete_all
      sql = <<~SQL
        INSERT INTO amelia3_history_order_summaries (batch_id, customer_code, order_reference, first_delivery, last_delivery, delivery_dates, line_count)
        SELECT batch_id, customer_code, order_reference, MIN(delivery_date), MAX(delivery_date), ARRAY_AGG(DISTINCT delivery_date ORDER BY delivery_date), COUNT(*)
        FROM amelia3_history_rows WHERE batch_id = #{connection.quote(batch.id)}
        GROUP BY batch_id, customer_code, order_reference
      SQL
      connection.execute(sql)
      batch.update!(metrics: batch.metrics.merge("historyOrdersVersion" => 1))
    end
  end
end
