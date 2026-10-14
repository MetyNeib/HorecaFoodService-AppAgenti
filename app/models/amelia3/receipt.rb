class Amelia3::Receipt < ApplicationRecord
  belongs_to :tenant
  belongs_to :originating_admin, class_name: "User", optional: true
  belongs_to :user
end
