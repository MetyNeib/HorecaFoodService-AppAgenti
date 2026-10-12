class Workspace < ApplicationRecord
  belongs_to :user
  has_many :command_receipts, dependent: :destroy

  validates :user_id, uniqueness: true
  validates :state, presence: true
  validates :version, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :epoch, numericality: { only_integer: true, greater_than_or_equal_to: 1 }
end
