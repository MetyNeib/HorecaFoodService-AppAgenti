class Amelia3::HistoryRow < ApplicationRecord
  belongs_to :batch, class_name: "Amelia3::ImportBatch"
end
