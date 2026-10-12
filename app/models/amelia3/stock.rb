class Amelia3::Stock < ApplicationRecord
  belongs_to :batch, class_name: "Amelia3::ImportBatch"
end
