class Amelia3::Receipt < ApplicationRecord
  belongs_to :tenant
  belongs_to :user
end
