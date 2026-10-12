class Amelia3::OpenItem < ApplicationRecord
  belongs_to :batch, class_name: "Amelia3::ImportBatch"
end
