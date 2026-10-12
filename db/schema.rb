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

ActiveRecord::Schema[8.1].define(version: 2026_10_12_000000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

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

  add_foreign_key "command_receipts", "users"
  add_foreign_key "command_receipts", "workspaces"
  add_foreign_key "workspaces", "users"
end
