class Amelia3::HistoryProfileMembership < ApplicationRecord
  belongs_to :profile_set, class_name: "Amelia3::HistoryProfileSet"
  belongs_to :profile, class_name: "Amelia3::HistoryProfile"
end
