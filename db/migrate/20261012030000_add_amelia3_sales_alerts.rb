class AddAmelia3SalesAlerts < ActiveRecord::Migration[8.1]
  def change
    create_table :amelia3_history_profile_sets do |t|
      t.references :tenant, null: false, foreign_key: { to_table: :amelia3_tenants }
      t.string :history_sha, null: false
      t.string :profile_version, null: false
      t.string :status, null: false, default: "building"
      t.jsonb :metrics, null: false, default: {}
      t.timestamps
    end
    add_index :amelia3_history_profile_sets, [ :tenant_id, :history_sha, :profile_version ], unique: true, name: "amelia_profile_source_unique"
    create_table :amelia3_history_profiles do |t|
      t.references :tenant, null: false, foreign_key: { to_table: :amelia3_tenants }
      t.string :customer_code, null: false
      t.string :digest, null: false
      t.integer :row_count, null: false
      t.jsonb :product_dates, null: false, default: {}
      t.timestamps
    end
    add_index :amelia3_history_profiles, [ :tenant_id, :customer_code, :digest ], unique: true, name: "amelia_profile_content_unique"
    create_table :amelia3_history_profile_memberships do |t|
      t.references :profile_set, null: false, foreign_key: { to_table: :amelia3_history_profile_sets }
      t.references :profile, null: false, foreign_key: { to_table: :amelia3_history_profiles }
      t.string :customer_code, null: false
    end
    add_index :amelia3_history_profile_memberships, [ :profile_set_id, :customer_code ], unique: true, name: "amelia_profile_member_unique"
    add_reference :amelia3_import_batches, :history_profile_set, foreign_key: { to_table: :amelia3_history_profile_sets }
    create_table :amelia3_alert_evaluations do |t|
      t.references :tenant, null: false, foreign_key: { to_table: :amelia3_tenants }
      t.string :evaluation_key, null: false
      t.jsonb :outcomes, null: false, default: []
      t.timestamps
    end
    add_index :amelia3_alert_evaluations, [ :tenant_id, :evaluation_key ], unique: true, name: "amelia_alert_evaluation_unique"
    create_table :amelia3_alert_runs do |t|
      t.references :tenant, null: false, foreign_key: { to_table: :amelia3_tenants }
      t.references :batch, type: :uuid, null: false, foreign_key: { to_table: :amelia3_import_batches }
      t.references :profile_set, foreign_key: { to_table: :amelia3_history_profile_sets }
      t.date :as_of, null: false
      t.string :rules_version, null: false
      t.string :source, null: false
      t.string :status, null: false, default: "building"
      t.string :error_code
      t.string :result_digest
      t.jsonb :metrics, null: false, default: {}
      t.datetime :completed_at
      t.timestamps
    end
    add_index :amelia3_alert_runs, [ :tenant_id, :as_of, :batch_id, :rules_version ], unique: true, name: "amelia_alert_logical_run"
    create_table :amelia3_alert_items do |t|
      t.references :run, null: false, foreign_key: { to_table: :amelia3_alert_runs }
      t.string :customer_code, null: false
      t.string :product_code, null: false, default: ""
      t.string :rule_type, null: false
      t.string :status, null: false, default: "active"
      t.integer :severity_numerator, null: false
      t.integer :severity_denominator, null: false
      t.integer :days_late, null: false
      t.jsonb :evidence, null: false, default: {}
    end
    add_index :amelia3_alert_items, [ :run_id, :rule_type, :customer_code, :product_code ], unique: true, name: "amelia_alert_identity"
    add_index :amelia3_alert_items, [ :run_id, :status, :rule_type ], name: "amelia_alert_display"
    add_reference :amelia3_tenants, :active_alert_run, foreign_key: { to_table: :amelia3_alert_runs }
    create_table :amelia3_alert_occurrences do |t|
      t.references :tenant, null: false, foreign_key: { to_table: :amelia3_tenants }
      t.references :batch, type: :uuid, null: false, foreign_key: { to_table: :amelia3_import_batches }
      t.date :local_date, null: false
      t.string :status, null: false, default: "pending"
      t.string :job_id
      t.integer :attempts, null: false, default: 0
      t.datetime :next_attempt_at
      t.string :error_code
      t.timestamps
    end
    add_index :amelia3_alert_occurrences, [ :tenant_id, :local_date, :batch_id ], unique: true, name: "amelia_alert_daily_batch"
    add_index :amelia3_history_rows, [ :batch_id, :customer_code, :source_row ], name: "amelia_history_profile_scan"
  end
end
