class Amelia3::Order < ApplicationRecord
  belongs_to :tenant
  belongs_to :created_by_user, class_name: "User"
end
