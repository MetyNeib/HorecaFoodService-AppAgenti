class Amelia3::AlertRun < ApplicationRecord
  belongs_to :tenant
  belongs_to :batch, class_name: "Amelia3::ImportBatch"
  belongs_to :profile_set, class_name: "Amelia3::HistoryProfileSet", optional: true
  has_many :items, class_name: "Amelia3::AlertItem", foreign_key: :run_id, dependent: :delete_all
end
