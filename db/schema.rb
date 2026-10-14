# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_10_12_040000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "amelia3_alert_evaluations", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.string "evaluation_key", null: false
    t.jsonb "outcomes", default: [], null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["tenant_id", "evaluation_key"], name: "amelia_alert_evaluation_unique", unique: true
    t.index ["tenant_id"], name: "index_amelia3_alert_evaluations_on_tenant_id"
  end

  create_table "amelia3_alert_items", force: :cascade do |t|
    t.bigint "run_id", null: false
    t.string "customer_code", null: false
    t.string "product_code", default: "", null: false
    t.string "rule_type", null: false
    t.string "status", default: "active", null: false
    t.integer "severity_numerator", null: false
    t.integer "severity_denominator", null: false
    t.integer "days_late", null: false
    t.jsonb "evidence", default: {}, null: false
    t.index ["run_id", "rule_type", "customer_code", "product_code"], name: "amelia_alert_identity", unique: true
    t.index ["run_id", "status", "rule_type"], name: "amelia_alert_display"
    t.index ["run_id"], name: "index_amelia3_alert_items_on_run_id"
  end

  create_table "amelia3_alert_occurrences", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.uuid "batch_id", null: false
    t.date "local_date", null: false
    t.string "status", default: "pending", null: false
    t.string "job_id"
    t.integer "attempts", default: 0, null: false
    t.datetime "next_attempt_at"
    t.string "error_code"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["batch_id"], name: "index_amelia3_alert_occurrences_on_batch_id"
    t.index ["tenant_id", "local_date", "batch_id"], name: "amelia_alert_daily_batch", unique: true
    t.index ["tenant_id"], name: "index_amelia3_alert_occurrences_on_tenant_id"
  end

  create_table "amelia3_alert_runs", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.uuid "batch_id", null: false
    t.bigint "profile_set_id"
    t.date "as_of", null: false
    t.string "rules_version", null: false
    t.string "source", null: false
    t.string "status", default: "building", null: false
    t.string "error_code"
    t.string "result_digest"
    t.jsonb "metrics", default: {}, null: false
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["batch_id"], name: "index_amelia3_alert_runs_on_batch_id"
    t.index ["profile_set_id"], name: "index_amelia3_alert_runs_on_profile_set_id"
    t.index ["tenant_id", "as_of", "batch_id", "rules_version"], name: "amelia_alert_logical_run", unique: true
    t.index ["tenant_id"], name: "index_amelia3_alert_runs_on_tenant_id"
  end

  create_table "amelia3_conditions", force: :cascade do |t|
    t.uuid "batch_id", null: false
    t.integer "source_row", null: false
    t.string "customer_code", null: false
    t.string "product_code", null: false
    t.date "valid_from", null: false
    t.date "valid_to", null: false
    t.decimal "price", precision: 24, scale: 10
    t.decimal "discount", precision: 10, scale: 4
    t.decimal "commission", precision: 10, scale: 4
    t.index ["batch_id", "customer_code", "product_code"], name: "index_amelia_conditions_lookup"
    t.index ["batch_id", "source_row"], name: "index_amelia3_conditions_on_batch_id_and_source_row", unique: true
  end

  create_table "amelia3_credits", force: :cascade do |t|
    t.uuid "batch_id", null: false
    t.string "customer_code", null: false
    t.decimal "limit", precision: 32, scale: 16, null: false
    t.decimal "remaining", precision: 32, scale: 16, null: false
    t.index ["batch_id", "customer_code"], name: "index_amelia3_credits_on_batch_id_and_customer_code", unique: true
  end

  create_table "amelia3_customers", force: :cascade do |t|
    t.uuid "batch_id", null: false
    t.string "external_code", null: false
    t.string "account_code", null: false
    t.string "agent_code", null: false
    t.string "parent_code"
    t.string "name", null: false
    t.string "city"
    t.string "address"
    t.string "tax_id"
    t.string "fiscal_code"
    t.string "email"
    t.string "telephone"
    t.boolean "blocked", null: false
    t.boolean "bill_to", null: false
    t.boolean "delivery_point", null: false
    t.jsonb "source_fields", default: {}, null: false
    t.index ["batch_id", "account_code"], name: "index_amelia3_customers_on_batch_id_and_account_code", unique: true
    t.index ["batch_id", "agent_code"], name: "index_amelia3_customers_on_batch_id_and_agent_code"
    t.index ["batch_id", "external_code"], name: "index_amelia3_customers_on_batch_id_and_external_code", unique: true
  end

  create_table "amelia3_history_order_summaries", force: :cascade do |t|
    t.uuid "batch_id", null: false
    t.string "customer_code", null: false
    t.string "order_reference", null: false
    t.date "first_delivery", null: false
    t.date "last_delivery", null: false
    t.date "delivery_dates", null: false, array: true
    t.integer "line_count", null: false
    t.index ["batch_id", "customer_code", "order_reference"], name: "amelia_history_order_identity", unique: true
    t.index ["batch_id", "last_delivery", "customer_code", "order_reference"], name: "amelia_history_order_page"
    t.index ["batch_id"], name: "index_amelia3_history_order_summaries_on_batch_id"
  end

  create_table "amelia3_history_profile_memberships", force: :cascade do |t|
    t.bigint "profile_set_id", null: false
    t.bigint "profile_id", null: false
    t.string "customer_code", null: false
    t.index ["profile_id"], name: "index_amelia3_history_profile_memberships_on_profile_id"
    t.index ["profile_set_id", "customer_code"], name: "amelia_profile_member_unique", unique: true
    t.index ["profile_set_id"], name: "index_amelia3_history_profile_memberships_on_profile_set_id"
  end

  create_table "amelia3_history_profile_sets", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.string "history_sha", null: false
    t.string "profile_version", null: false
    t.string "status", default: "building", null: false
    t.jsonb "metrics", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["tenant_id", "history_sha", "profile_version"], name: "amelia_profile_source_unique", unique: true
    t.index ["tenant_id"], name: "index_amelia3_history_profile_sets_on_tenant_id"
  end

  create_table "amelia3_history_profiles", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.string "customer_code", null: false
    t.string "digest", null: false
    t.integer "row_count", null: false
    t.jsonb "product_dates", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["tenant_id", "customer_code", "digest"], name: "amelia_profile_content_unique", unique: true
    t.index ["tenant_id"], name: "index_amelia3_history_profiles_on_tenant_id"
  end

  create_table "amelia3_history_rows", force: :cascade do |t|
    t.uuid "batch_id", null: false
    t.integer "source_row", null: false
    t.string "order_reference", null: false
    t.string "customer_code", null: false
    t.string "product_code", null: false
    t.decimal "packs", precision: 36, scale: 18, null: false
    t.decimal "pieces", precision: 36, scale: 18, null: false
    t.decimal "weight", precision: 36, scale: 18, null: false
    t.decimal "shipped", precision: 36, scale: 18, null: false
    t.date "delivery_date", null: false
    t.index ["batch_id", "customer_code", "delivery_date"], name: "index_amelia_history_customer_date"
    t.index ["batch_id", "customer_code", "product_code"], name: "index_amelia_history_customer_product"
    t.index ["batch_id", "customer_code", "source_row"], name: "amelia_history_profile_scan"
    t.index ["batch_id", "order_reference"], name: "index_amelia_history_order"
    t.index ["batch_id", "source_row"], name: "index_amelia3_history_rows_on_batch_id_and_source_row", unique: true
  end

  create_table "amelia3_import_batches", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.string "fingerprint", limit: 64, null: false
    t.string "status", default: "staging", null: false
    t.string "source", null: false
    t.jsonb "files", default: {}, null: false
    t.jsonb "counts", default: {}, null: false
    t.jsonb "anomalies", default: {}, null: false
    t.string "error_code"
    t.datetime "published_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "metrics", default: {}, null: false
    t.bigint "history_profile_set_id"
    t.index ["history_profile_set_id"], name: "index_amelia3_import_batches_on_history_profile_set_id"
    t.index ["tenant_id", "fingerprint"], name: "index_amelia3_import_batches_on_tenant_id_and_fingerprint", unique: true
    t.index ["tenant_id"], name: "index_amelia3_import_batches_on_tenant_id"
  end

  create_table "amelia3_open_items", force: :cascade do |t|
    t.uuid "batch_id", null: false
    t.integer "source_row", null: false
    t.string "account_code", null: false
    t.string "item_reference", null: false
    t.string "document_reference"
    t.date "reference_date"
    t.date "due_date", null: false
    t.decimal "amount", precision: 32, scale: 16, null: false
    t.index ["batch_id", "account_code", "due_date"], name: "index_amelia_open_items_lookup"
    t.index ["batch_id", "source_row"], name: "index_amelia3_open_items_on_batch_id_and_source_row", unique: true
  end

  create_table "amelia3_orders", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.bigint "created_by_user_id", null: false
    t.string "customer_code", null: false
    t.string "assigned_agent_code", null: false
    t.string "status", default: "DRAFT", null: false
    t.integer "version", default: 0, null: false
    t.jsonb "lines", default: [], null: false
    t.jsonb "customer_snapshot", default: {}, null: false
    t.string "destination_code"
    t.date "delivery_date"
    t.string "payment_note"
    t.text "note"
    t.bigint "net_cents", default: 0, null: false
    t.datetime "confirmed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_user_id"], name: "index_amelia3_orders_on_created_by_user_id"
    t.index ["tenant_id", "customer_code", "created_at"], name: "index_amelia_orders_scope"
    t.index ["tenant_id"], name: "index_amelia3_orders_on_tenant_id"
    t.check_constraint "version >= 0 AND (status::text = ANY (ARRAY['DRAFT'::character varying, 'CONFIRMED_LOCAL'::character varying]::text[]))", name: "amelia_order_bounds"
  end

  create_table "amelia3_prices", force: :cascade do |t|
    t.uuid "batch_id", null: false
    t.string "list_code", null: false
    t.string "product_code", null: false
    t.decimal "amount", precision: 24, scale: 10
    t.boolean "valid_price", null: false
    t.index ["batch_id", "list_code", "product_code"], name: "idx_on_batch_id_list_code_product_code_59342fd1e3", unique: true
  end

  create_table "amelia3_products", force: :cascade do |t|
    t.uuid "batch_id", null: false
    t.string "external_code", null: false
    t.string "name", null: false
    t.string "base_unit", null: false
    t.string "order_unit"
    t.decimal "pieces_per_pack", precision: 24, scale: 10
    t.decimal "weight_per_pack", precision: 24, scale: 10
    t.decimal "packs_per_case", precision: 24, scale: 10
    t.boolean "blocked", null: false
    t.boolean "pack_indivisible", null: false
    t.boolean "case_indivisible", null: false
    t.string "category_code"
    t.jsonb "source_fields", default: {}, null: false
    t.index ["batch_id", "external_code"], name: "index_amelia3_products_on_batch_id_and_external_code", unique: true
  end

  create_table "amelia3_receipts", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "tenant_id", null: false
    t.string "operation_id", limit: 128, null: false
    t.string "request_digest", limit: 64, null: false
    t.uuid "order_id", null: false
    t.boolean "deleted", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["tenant_id"], name: "index_amelia3_receipts_on_tenant_id"
    t.index ["user_id", "operation_id"], name: "index_amelia3_receipts_on_user_id_and_operation_id", unique: true
    t.index ["user_id"], name: "index_amelia3_receipts_on_user_id"
  end

  create_table "amelia3_routes", force: :cascade do |t|
    t.uuid "batch_id", null: false
    t.integer "source_row", null: false
    t.string "customer_code", null: false
    t.string "route_code", null: false
    t.string "description"
    t.integer "weekday", null: false
    t.index ["batch_id", "customer_code"], name: "index_amelia3_routes_on_batch_id_and_customer_code"
    t.index ["batch_id", "source_row"], name: "index_amelia3_routes_on_batch_id_and_source_row", unique: true
  end

  create_table "amelia3_stocks", force: :cascade do |t|
    t.uuid "batch_id", null: false
    t.string "product_code", null: false
    t.decimal "packs", precision: 32, scale: 16
    t.decimal "pieces", precision: 32, scale: 16
    t.decimal "weight", precision: 32, scale: 16
    t.index ["batch_id", "product_code"], name: "index_amelia3_stocks_on_batch_id_and_product_code", unique: true
  end

  create_table "amelia3_sync_occurrences", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.date "local_date", null: false
    t.datetime "scheduled_at", null: false
    t.string "job_id"
    t.string "status", default: "pending", null: false
    t.integer "attempts", default: 0, null: false
    t.string "error_code"
    t.uuid "batch_id"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "source_files", default: {}, null: false
    t.bigint "duration_ms"
    t.index ["tenant_id", "local_date"], name: "index_amelia_sync_daily", unique: true
    t.index ["tenant_id"], name: "index_amelia3_sync_occurrences_on_tenant_id"
  end

  create_table "amelia3_tenants", force: :cascade do |t|
    t.string "code", null: false
    t.string "name", null: false
    t.uuid "active_batch_id"
    t.integer "revision", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "active_alert_run_id"
    t.index ["active_alert_run_id"], name: "index_amelia3_tenants_on_active_alert_run_id"
    t.index ["code"], name: "index_amelia3_tenants_on_code", unique: true
  end

  create_table "amelia3_unit_verifications", force: :cascade do |t|
    t.bigint "tenant_id", null: false
    t.string "product_code", default: "", null: false
    t.string "base_unit", default: "", null: false
    t.string "order_unit", default: "", null: false
    t.string "version", null: false
    t.string "evidence_reference", null: false
    t.string "approved_by", null: false
    t.datetime "approved_at", null: false
    t.boolean "active", default: true, null: false
    t.jsonb "contract", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["tenant_id", "product_code", "base_unit", "order_unit"], name: "index_amelia_unit_verifications_active", unique: true, where: "active"
    t.index ["tenant_id"], name: "index_amelia3_unit_verifications_on_tenant_id"
  end

  create_table "command_receipts", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "workspace_id", null: false
    t.string "operation_id", limit: 128, null: false
    t.string "request_digest", limit: 64, null: false
    t.string "command_type", null: false
    t.integer "epoch", null: false
    t.integer "result_version", null: false
    t.jsonb "response", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "operation_id"], name: "index_receipts_on_user_operation", unique: true
    t.index ["user_id"], name: "index_command_receipts_on_user_id"
    t.index ["workspace_id"], name: "index_command_receipts_on_workspace_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.datetime "remember_created_at"
    t.string "agent_id", default: "AG-014", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "commercial_tenant_id"
    t.string "dataset_mode", default: "synthetic", null: false
    t.string "role", default: "agent", null: false
    t.string "display_name"
    t.index ["commercial_tenant_id"], name: "index_users_on_commercial_tenant_id"
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  create_table "workspaces", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.jsonb "state", null: false
    t.integer "version", default: 0, null: false
    t.integer "epoch", default: 1, null: false
    t.integer "lock_version", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_workspaces_on_user_id", unique: true
    t.check_constraint "version >= 0 AND epoch >= 1", name: "workspace_version_bounds"
  end

  add_foreign_key "amelia3_alert_evaluations", "amelia3_tenants", column: "tenant_id"
  add_foreign_key "amelia3_alert_items", "amelia3_alert_runs", column: "run_id"
  add_foreign_key "amelia3_alert_occurrences", "amelia3_import_batches", column: "batch_id"
  add_foreign_key "amelia3_alert_occurrences", "amelia3_tenants", column: "tenant_id"
  add_foreign_key "amelia3_alert_runs", "amelia3_history_profile_sets", column: "profile_set_id"
  add_foreign_key "amelia3_alert_runs", "amelia3_import_batches", column: "batch_id"
  add_foreign_key "amelia3_alert_runs", "amelia3_tenants", column: "tenant_id"
  add_foreign_key "amelia3_conditions", "amelia3_import_batches", column: "batch_id"
  add_foreign_key "amelia3_credits", "amelia3_import_batches", column: "batch_id"
  add_foreign_key "amelia3_customers", "amelia3_import_batches", column: "batch_id"
  add_foreign_key "amelia3_history_order_summaries", "amelia3_import_batches", column: "batch_id"
  add_foreign_key "amelia3_history_profile_memberships", "amelia3_history_profile_sets", column: "profile_set_id"
  add_foreign_key "amelia3_history_profile_memberships", "amelia3_history_profiles", column: "profile_id"
  add_foreign_key "amelia3_history_profile_sets", "amelia3_tenants", column: "tenant_id"
  add_foreign_key "amelia3_history_profiles", "amelia3_tenants", column: "tenant_id"
  add_foreign_key "amelia3_history_rows", "amelia3_import_batches", column: "batch_id"
  add_foreign_key "amelia3_import_batches", "amelia3_history_profile_sets", column: "history_profile_set_id"
  add_foreign_key "amelia3_import_batches", "amelia3_tenants", column: "tenant_id"
  add_foreign_key "amelia3_open_items", "amelia3_import_batches", column: "batch_id"
  add_foreign_key "amelia3_orders", "amelia3_tenants", column: "tenant_id"
  add_foreign_key "amelia3_orders", "users", column: "created_by_user_id"
  add_foreign_key "amelia3_prices", "amelia3_import_batches", column: "batch_id"
  add_foreign_key "amelia3_products", "amelia3_import_batches", column: "batch_id"
  add_foreign_key "amelia3_receipts", "amelia3_tenants", column: "tenant_id"
  add_foreign_key "amelia3_receipts", "users"
  add_foreign_key "amelia3_routes", "amelia3_import_batches", column: "batch_id"
  add_foreign_key "amelia3_stocks", "amelia3_import_batches", column: "batch_id"
  add_foreign_key "amelia3_sync_occurrences", "amelia3_tenants", column: "tenant_id"
  add_foreign_key "amelia3_tenants", "amelia3_alert_runs", column: "active_alert_run_id"
  add_foreign_key "amelia3_tenants", "amelia3_import_batches", column: "active_batch_id"
  add_foreign_key "amelia3_unit_verifications", "amelia3_tenants", column: "tenant_id"
  add_foreign_key "command_receipts", "users"
  add_foreign_key "command_receipts", "workspaces"
  add_foreign_key "users", "amelia3_tenants", column: "commercial_tenant_id"
  add_foreign_key "workspaces", "users"
end
