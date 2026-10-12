class AddAmelia3TransferEvidence < ActiveRecord::Migration[8.1]
  def change
    add_column :amelia3_sync_occurrences, :source_files, :jsonb, null: false, default: {}
    add_column :amelia3_sync_occurrences, :duration_ms, :bigint
  end
end
