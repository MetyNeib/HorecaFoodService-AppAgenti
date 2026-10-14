# Local, reviewed evidence only. No external calls or commercial CSV mutations.
root = Rails.root.join("imports/private").realpath
path = Pathname(ENV.fetch("AMELIA3_EVIDENCE_FILE")).realpath
abort "Evidence must be inside imports/private" unless path.to_s.start_with?(root.to_s + File::SEPARATOR)
input = JSON.parse(path.read)
tenant = Amelia3::Tenant.find_by!(code: input.fetch("tenant"))
approved = input.fetch("verifications").map do |attributes|
  permitted = attributes.slice("product_code", "base_unit", "order_unit", "version", "evidence_reference", "approved_by", "approved_at", "contract")
  row = Amelia3::UnitVerification.new(permitted.merge(tenant: tenant))
  row.validate!
  row
end
apply = ENV["AMELIA3_APPLY_EVIDENCE"] == "true"
changed = 0
if apply
  tenant.with_lock do
    approved.each do |row|
      old = Amelia3::UnitVerification.where(tenant: tenant, product_code: row.product_code, base_unit: row.base_unit, order_unit: row.order_unit, active: true).first
      next if old && old.version == row.version && old.contract == row.contract && old.evidence_reference == row.evidence_reference
      old&.update!(active: false)
      row.save!
      changed += 1
    end
    tenant.update!(revision: tenant.revision + 1) if changed.positive?
  end
end
puts JSON.generate(status: "PASS", mode: apply ? "apply" : "dry_run", validated: approved.length, applied: changed)
