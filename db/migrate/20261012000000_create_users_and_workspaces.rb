class CreateUsersAndWorkspaces < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |table|
      table.string :email, null: false, default: ""
      table.string :encrypted_password, null: false, default: ""
      table.datetime :remember_created_at
      table.string :agent_id, null: false, default: "AG-014"
      table.timestamps
    end
    add_index :users, :email, unique: true

    create_table :workspaces do |table|
      table.references :user, null: false, foreign_key: true, index: { unique: true }
      table.jsonb :state, null: false
      table.integer :version, null: false, default: 0
      table.integer :epoch, null: false, default: 1
      table.integer :lock_version, null: false, default: 0
      table.timestamps
    end
    add_check_constraint :workspaces, "version >= 0 AND epoch >= 1", name: "workspace_version_bounds"

    create_table :command_receipts do |table|
      table.references :user, null: false, foreign_key: true
      table.references :workspace, null: false, foreign_key: true
      table.string :operation_id, null: false, limit: 128
      table.string :request_digest, null: false, limit: 64
      table.string :command_type, null: false
      table.integer :epoch, null: false
      table.integer :result_version, null: false
      table.jsonb :response, null: false
      table.timestamps
    end
    add_index :command_receipts, [ :user_id, :operation_id ], unique: true, name: "index_receipts_on_user_operation"
  end
end
