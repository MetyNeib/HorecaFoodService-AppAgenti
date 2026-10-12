class Amelia3::Tenant < ApplicationRecord
  belongs_to :active_batch, class_name: "Amelia3::ImportBatch", optional: true
  has_many :import_batches, class_name: "Amelia3::ImportBatch", dependent: :restrict_with_exception
  validates :code, presence: true, uniqueness: true
end
