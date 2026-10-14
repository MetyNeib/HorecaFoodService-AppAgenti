class AddAmelia3AlertReviews < ActiveRecord::Migration[8.1]
  def change
    create_table :amelia3_alert_reviews do |t|
      t.references :alert_item, null: false, foreign_key: { to_table: :amelia3_alert_items }, index: { unique: true }
      t.string :status, null: false
      t.jsonb :evidence, null: false, default: {}
      t.timestamps
    end
  end
end
