class Amelia3::AlertOccurrence < ApplicationRecord
  belongs_to :tenant
  belongs_to :batch, class_name: "Amelia3::ImportBatch"
end
