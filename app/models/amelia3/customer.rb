class Amelia3::Customer < ApplicationRecord
  belongs_to :batch, class_name: "Amelia3::ImportBatch"
end
