class Amelia3::ImportBatch < ApplicationRecord
  belongs_to :tenant
  validates :fingerprint, presence: true
end
