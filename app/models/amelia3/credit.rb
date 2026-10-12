class Amelia3::Credit < ApplicationRecord
  belongs_to :batch, class_name: "Amelia3::ImportBatch"
end
