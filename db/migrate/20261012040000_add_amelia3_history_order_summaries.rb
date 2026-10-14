class AddAmelia3HistoryOrderSummaries < ActiveRecord::Migration[8.1]
  def change
    create_table :amelia3_history_order_summaries do |t|
      t.references :batch, type: :uuid, null: false, foreign_key: { to_table: :amelia3_import_batches }
      t.string :customer_code, null: false
      t.string :order_reference, null: false
      t.date :first_delivery, null: false
      t.date :last_delivery, null: false
      t.date :delivery_dates, array: true, null: false
      t.integer :line_count, null: false
    end
    add_index :amelia3_history_order_summaries, [ :batch_id, :customer_code, :order_reference ], unique: true, name: "amelia_history_order_identity"
    add_index :amelia3_history_order_summaries, [ :batch_id, :last_delivery, :customer_code, :order_reference ], name: "amelia_history_order_page"
  end
end
