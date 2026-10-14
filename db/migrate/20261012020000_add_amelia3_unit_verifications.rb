class AddAmelia3UnitVerifications < ActiveRecord::Migration[8.1]
  def change
    create_table :amelia3_unit_verifications do |t|
      t.references :tenant, null: false, foreign_key: { to_table: :amelia3_tenants }
      t.string :product_code, null: false, default: ""
      t.string :base_unit, null: false, default: ""
      t.string :order_unit, null: false, default: ""
      t.string :version, null: false
      t.string :evidence_reference, null: false
      t.string :approved_by, null: false
      t.datetime :approved_at, null: false
      t.boolean :active, null: false, default: true
      t.jsonb :contract, null: false, default: {}
      t.timestamps
      t.index [ :tenant_id, :product_code, :base_unit, :order_unit ], unique: true, where: "active", name: "index_amelia_unit_verifications_active"
    end
  end
end
