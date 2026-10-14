class Amelia3::AlertItem < ApplicationRecord
  belongs_to :run, class_name: "Amelia3::AlertRun"
end
