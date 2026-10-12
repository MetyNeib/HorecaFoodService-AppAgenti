class User < ApplicationRecord
  devise :database_authenticatable, :rememberable, :validatable

  has_one :workspace, dependent: :destroy
  has_many :command_receipts, dependent: :destroy

  validates :agent_id, inclusion: { in: [ "AG-014" ] }

  # The first delivery deliberately has no public registration or mail integrations.
  # Accounts are provisioned by the local seed task; personal workspaces stay isolated.
end
