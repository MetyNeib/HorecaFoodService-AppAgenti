class AddOriginatingAdminToAmelia3Receipts < ActiveRecord::Migration[8.1]
  def change
    add_reference :amelia3_receipts, :originating_admin, foreign_key: { to_table: :users }
  end
end
