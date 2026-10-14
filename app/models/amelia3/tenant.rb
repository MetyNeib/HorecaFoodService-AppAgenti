class Amelia3::Tenant < ApplicationRecord
  belongs_to :active_batch, class_name: "Amelia3::ImportBatch", optional: true
  belongs_to :active_alert_run, class_name: "Amelia3::AlertRun", optional: true
  belongs_to :feed_snapshot, class_name: "Amelia3::FeedSnapshot", optional: true
  has_many :import_batches, class_name: "Amelia3::ImportBatch", dependent: :restrict_with_exception
  validates :code, presence: true, uniqueness: true
  validate :active_batch_owner

  private

  def active_batch_owner
    errors.add(:active_batch, "appartiene a un altro tenant") if active_batch && active_batch.tenant_id != id
  end
end
