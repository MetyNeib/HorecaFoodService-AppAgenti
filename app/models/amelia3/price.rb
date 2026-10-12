class Amelia3::Price < ApplicationRecord
  belongs_to :batch, class_name: "Amelia3::ImportBatch"
end
