class Amelia3::AlertReview < ApplicationRecord
  belongs_to :alert_item

  def self.visible(rows)
    rows.where.not(rule_type: "USUAL_PRODUCT_MISSING").or(rows.where(rule_type: "USUAL_PRODUCT_MISSING", id: where(status: "kept").select(:alert_item_id)))
  end
end
