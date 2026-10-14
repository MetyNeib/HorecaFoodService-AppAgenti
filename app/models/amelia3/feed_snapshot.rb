class Amelia3::FeedSnapshot < ApplicationRecord
  belongs_to :tenant
  belongs_to :batch, class_name: "Amelia3::ImportBatch"
  has_many :products, class_name: "Amelia3::FeedProduct", dependent: :restrict_with_exception
  has_many :habitual_products, dependent: :restrict_with_exception
end
