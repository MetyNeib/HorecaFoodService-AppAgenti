class AddAmelia3CommercialData < ActiveRecord::Migration[8.1]
  def change
    create_table :amelia3_tenants do |t|
      t.string :code, null: false
      t.string :name, null: false
      t.uuid :active_batch_id
      t.integer :revision, null: false, default: 0
      t.timestamps
    end
    add_index :amelia3_tenants, :code, unique: true
    create_table :amelia3_import_batches, id: :uuid do |t|
      t.references :tenant, null: false, foreign_key: { to_table: :amelia3_tenants }
      t.string :fingerprint, null: false, limit: 64
      t.string :status, null: false, default: "staging"
      t.string :source, null: false
      t.jsonb :files, null: false, default: {}
      t.jsonb :counts, null: false, default: {}
      t.jsonb :anomalies, null: false, default: {}
      t.string :error_code
      t.datetime :published_at
      t.timestamps
    end
    add_index :amelia3_import_batches, [ :tenant_id, :fingerprint ], unique: true
    add_foreign_key :amelia3_tenants, :amelia3_import_batches, column: :active_batch_id
    add_reference :users, :commercial_tenant, foreign_key: { to_table: :amelia3_tenants }
    add_column :users, :dataset_mode, :string, null: false, default: "synthetic"
    add_column :users, :role, :string, null: false, default: "agent"
    add_column :users, :display_name, :string

    create_table :amelia3_customers do |t|
      t.uuid :batch_id, null: false
      t.string :external_code, null: false
      t.string :account_code, null: false
      t.string :agent_code, null: false
      t.string :parent_code
      t.string :name, null: false
      t.string :city
      t.string :address
      t.string :tax_id
      t.string :fiscal_code
      t.string :email
      t.string :telephone
      t.boolean :blocked, null: false
      t.boolean :bill_to, null: false
      t.boolean :delivery_point, null: false
      t.jsonb :source_fields, null: false, default: {}
    end
    imported_indexes :amelia3_customers, :external_code
    add_index :amelia3_customers, [ :batch_id, :agent_code ]
    add_index :amelia3_customers, [ :batch_id, :account_code ], unique: true

    create_table :amelia3_products do |t|
      t.uuid :batch_id, null: false
      t.string :external_code, null: false
      t.string :name, null: false
      t.string :base_unit, null: false
      t.string :order_unit
      t.decimal :pieces_per_pack, precision: 24, scale: 10
      t.decimal :weight_per_pack, precision: 24, scale: 10
      t.decimal :packs_per_case, precision: 24, scale: 10
      t.boolean :blocked, null: false
      t.boolean :pack_indivisible, null: false
      t.boolean :case_indivisible, null: false
      t.string :category_code
      t.jsonb :source_fields, null: false, default: {}
    end
    imported_indexes :amelia3_products, :external_code

    create_table :amelia3_stocks do |t|
      t.uuid :batch_id, null: false
      t.string :product_code, null: false
      t.decimal :packs, precision: 32, scale: 16
      t.decimal :pieces, precision: 32, scale: 16
      t.decimal :weight, precision: 32, scale: 16
    end
    imported_indexes :amelia3_stocks, :product_code
    create_table :amelia3_prices do |t|
      t.uuid :batch_id, null: false
      t.string :list_code, null: false
      t.string :product_code, null: false
      t.decimal :amount, precision: 24, scale: 10
      t.boolean :valid_price, null: false
    end
    imported_indexes :amelia3_prices, [ :list_code, :product_code ]
    create_table :amelia3_conditions do |t|
      t.uuid :batch_id, null: false
      t.integer :source_row, null: false
      t.string :customer_code, null: false
      t.string :product_code, null: false
      t.date :valid_from, null: false
      t.date :valid_to, null: false
      t.decimal :price, precision: 24, scale: 10
      t.decimal :discount, precision: 10, scale: 4
      t.decimal :commission, precision: 10, scale: 4
    end
    imported_indexes :amelia3_conditions, :source_row
    add_index :amelia3_conditions, [ :batch_id, :customer_code, :product_code ], name: :index_amelia_conditions_lookup
    create_table :amelia3_credits do |t|
      t.uuid :batch_id, null: false
      t.string :customer_code, null: false
      t.decimal :limit, precision: 32, scale: 16, null: false
      t.decimal :remaining, precision: 32, scale: 16, null: false
    end
    imported_indexes :amelia3_credits, :customer_code
    create_table :amelia3_open_items do |t|
      t.uuid :batch_id, null: false
      t.integer :source_row, null: false
      t.string :account_code, null: false
      t.string :item_reference, null: false
      t.string :document_reference
      t.date :reference_date, null: false
      t.date :due_date, null: false
      t.decimal :amount, precision: 32, scale: 16, null: false
    end
    imported_indexes :amelia3_open_items, :source_row
    add_index :amelia3_open_items, [ :batch_id, :account_code, :due_date ], name: :index_amelia_open_items_lookup
    create_table :amelia3_routes do |t|
      t.uuid :batch_id, null: false
      t.integer :source_row, null: false
      t.string :customer_code, null: false
      t.string :route_code, null: false
      t.string :description
      t.integer :weekday, null: false
    end
    imported_indexes :amelia3_routes, :source_row
    add_index :amelia3_routes, [ :batch_id, :customer_code ]
    create_table :amelia3_history_rows do |t|
      t.uuid :batch_id, null: false
      t.integer :source_row, null: false
      t.string :order_reference, null: false
      t.string :customer_code, null: false
      t.string :product_code, null: false
      t.decimal :packs, precision: 36, scale: 18, null: false
      t.decimal :pieces, precision: 36, scale: 18, null: false
      t.decimal :weight, precision: 36, scale: 18, null: false
      t.decimal :shipped, precision: 36, scale: 18, null: false
      t.date :delivery_date, null: false
    end
    imported_indexes :amelia3_history_rows, :source_row
    add_index :amelia3_history_rows, [ :batch_id, :customer_code, :delivery_date ], name: :index_amelia_history_customer_date
    add_index :amelia3_history_rows, [ :batch_id, :customer_code, :product_code ], name: :index_amelia_history_customer_product
    add_index :amelia3_history_rows, [ :batch_id, :order_reference ], name: :index_amelia_history_order

    create_table :amelia3_orders, id: :uuid do |t|
      t.references :tenant, null: false, foreign_key: { to_table: :amelia3_tenants }
      t.references :created_by_user, null: false, foreign_key: { to_table: :users }
      t.string :customer_code, null: false
      t.string :assigned_agent_code, null: false
      t.string :status, null: false, default: "DRAFT"
      t.integer :version, null: false, default: 0
      t.jsonb :lines, null: false, default: []
      t.jsonb :customer_snapshot, null: false, default: {}
      t.string :destination_code
      t.date :delivery_date
      t.string :payment_note
      t.text :note
      t.bigint :net_cents, null: false, default: 0
      t.datetime :confirmed_at
      t.timestamps
    end
    add_index :amelia3_orders, [ :tenant_id, :customer_code, :created_at ], name: :index_amelia_orders_scope
    add_check_constraint :amelia3_orders, "version >= 0 AND status IN ('DRAFT','CONFIRMED_LOCAL')", name: :amelia_order_bounds
    create_table :amelia3_receipts do |t|
      t.references :user, null: false, foreign_key: true
      t.references :tenant, null: false, foreign_key: { to_table: :amelia3_tenants }
      t.string :operation_id, null: false, limit: 128
      t.string :request_digest, null: false, limit: 64
      t.uuid :order_id, null: false
      t.boolean :deleted, null: false, default: false
      t.timestamps
    end
    add_index :amelia3_receipts, [ :user_id, :operation_id ], unique: true
    create_table :amelia3_sync_occurrences do |t|
      t.references :tenant, null: false, foreign_key: { to_table: :amelia3_tenants }
      t.date :local_date, null: false
      t.datetime :scheduled_at, null: false
      t.string :job_id
      t.string :status, null: false, default: "pending"
      t.integer :attempts, null: false, default: 0
      t.string :error_code
      t.uuid :batch_id
      t.datetime :completed_at
      t.timestamps
    end
    add_index :amelia3_sync_occurrences, [ :tenant_id, :local_date ], unique: true, name: :index_amelia_sync_daily
  end

  private

  def imported_indexes(table, key)
    add_foreign_key table, :amelia3_import_batches, column: :batch_id
    add_index table, [ :batch_id, *Array(key) ], unique: true
  end
end
