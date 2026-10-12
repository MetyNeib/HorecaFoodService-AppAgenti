class Amelia3::Product < ApplicationRecord
  belongs_to :batch, class_name: "Amelia3::ImportBatch"
end
