class Amelia3::HistoryProfileSet < ApplicationRecord
  belongs_to :tenant
  has_many :memberships, class_name: "Amelia3::HistoryProfileMembership", foreign_key: :profile_set_id, dependent: :delete_all
  has_many :profiles, through: :memberships, source: :profile
end
