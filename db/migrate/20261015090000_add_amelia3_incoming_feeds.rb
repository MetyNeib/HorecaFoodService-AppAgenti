class AddAmelia3IncomingFeeds < ActiveRecord::Migration[8.1]
  def change
    create_table :amelia3_feed_snapshots do |t|
      t.references :tenant, null: false, foreign_key: { to_table: :amelia3_tenants }
      t.references :batch, type: :uuid, null: false, foreign_key: { to_table: :amelia3_import_batches }
      t.string :digest, null: false
      t.jsonb :files, null: false, default: {}
      t.jsonb :counts, null: false, default: {}
      t.datetime :published_at
      t.timestamps
    end
    add_index :amelia3_feed_snapshots, [ :tenant_id, :batch_id, :digest ], unique: true
    add_reference :amelia3_tenants, :feed_snapshot, foreign_key: { to_table: :amelia3_feed_snapshots }
    create_table :amelia3_feed_products do |t|
      t.references :feed_snapshot, null: false, foreign_key: { to_table: :amelia3_feed_snapshots }
      t.string :product_code, null: false
      t.string :name, null: false
      t.jsonb :search_data, null: false, default: {}
    end
    add_index :amelia3_feed_products, [ :feed_snapshot_id, :product_code ], unique: true
    create_table :amelia3_habitual_products do |t|
      t.references :feed_snapshot, null: false, foreign_key: { to_table: :amelia3_feed_snapshots }
      t.string :customer_code, null: false
      t.string :product_code, null: false
      t.date :last_purchased_on, null: false
    end
    add_index :amelia3_habitual_products, [ :feed_snapshot_id, :customer_code, :product_code ], unique: true, name: 'index_amelia3_habits_identity'
    create_table :amelia3_feed_states do |t|
      t.references :tenant, null: false, foreign_key: { to_table: :amelia3_tenants }, index: { unique: true }
      t.jsonb :initial_files, null: false, default: []
      t.datetime :initialized_at
      t.datetime :last_attempt_at
      t.datetime :last_success_at
      t.datetime :next_poll_at
      t.string :error_code
      t.jsonb :file_errors, null: false, default: {}
      t.jsonb :remote_files, null: false, default: {}
      t.timestamps
    end
    create_table :amelia3_incoming_orders do |t|
      t.references :tenant, null: false, foreign_key: { to_table: :amelia3_tenants }
      t.string :customer_code, null: false
      t.string :external_reference, null: false
      t.string :source_sha, null: false
      t.string :source_name, null: false
      t.jsonb :original, null: false, default: {}
      t.jsonb :draft, null: false, default: {}
      t.jsonb :audit, null: false, default: []
      t.string :status, null: false, default: 'pending'
      t.datetime :received_at, null: false
      t.datetime :confirmation_due_at, null: false
      t.references :claimed_by, foreign_key: { to_table: :users }
      t.datetime :confirmed_at
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end
    add_index :amelia3_incoming_orders, [ :tenant_id, :source_sha ], unique: true
    add_index :amelia3_incoming_orders, [ :tenant_id, :customer_code, :status ], name: 'index_amelia3_incoming_portfolio'
    add_index :amelia3_incoming_orders, [ :tenant_id, :external_reference ]
    create_table :amelia3_product_matches do |t|
      t.references :tenant, null: false, foreign_key: { to_table: :amelia3_tenants }
      t.string :cache_key, null: false
      t.string :status, null: false
      t.jsonb :result, null: false, default: {}
      t.datetime :retry_at
      t.timestamps
    end
    add_index :amelia3_product_matches, [ :tenant_id, :cache_key ], unique: true
  end
end
