class Amelia3::Route < ApplicationRecord
  belongs_to :batch, class_name: "Amelia3::ImportBatch"
end
