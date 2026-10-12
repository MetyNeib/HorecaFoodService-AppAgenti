class AddAmelia3BatchMetrics < ActiveRecord::Migration[8.1]
  def change
    add_column :amelia3_import_batches, :metrics, :jsonb, null: false, default: {}
  end
end
