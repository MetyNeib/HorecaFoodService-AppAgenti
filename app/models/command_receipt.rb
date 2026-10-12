class CommandReceipt < ApplicationRecord
  belongs_to :user
  belongs_to :workspace

  validates :operation_id, presence: true, uniqueness: { scope: :user_id }, length: { maximum: 128 }
  validates :request_digest, presence: true
  validates :response, presence: true
end
