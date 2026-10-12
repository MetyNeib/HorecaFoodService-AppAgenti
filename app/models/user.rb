class User < ApplicationRecord
  devise :database_authenticatable, :rememberable, :validatable

  has_one :workspace, dependent: :destroy
  has_many :command_receipts, dependent: :destroy
  belongs_to :commercial_tenant, class_name: "Amelia3::Tenant", optional: true

  validates :dataset_mode, inclusion: { in: %w[synthetic amelia3] }
  validates :role, inclusion: { in: %w[agent admin capoarea] }
  validates :agent_id, inclusion: { in: [ "AG-014" ] }, if: :synthetic?
  validate :commercial_identity

  def synthetic? = dataset_mode == "synthetic"
  def amelia3? = dataset_mode == "amelia3"

  private

  def commercial_identity
    return unless amelia3?
    errors.add(:commercial_tenant, "è obbligatorio") unless commercial_tenant
    errors.add(:agent_id, "deve essere il codice 34") if role == "agent" && agent_id != "34"
  end

  # The first delivery deliberately has no public registration or mail integrations.
  # Accounts are provisioned by the local seed task; personal workspaces stay isolated.
end
