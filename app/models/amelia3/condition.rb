class Amelia3::Condition < ApplicationRecord
  belongs_to :batch, class_name: "Amelia3::ImportBatch"
end
