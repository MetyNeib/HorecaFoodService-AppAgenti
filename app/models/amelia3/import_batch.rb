class Amelia3::ImportBatch < ApplicationRecord
  belongs_to :tenant
  belongs_to :history_profile_set, class_name: "Amelia3::HistoryProfileSet", optional: true
  validates :fingerprint, presence: true
end
