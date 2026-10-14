# Explicit local allowlist; never infer demo privileges from the selected role.
class Amelia3::DemoAccess
  def initialize(admin)
    @admin = admin
  end

  def accounts
    return User.none unless ENV["AMELIA3_DEMO_SWITCH"] == "1" && @admin&.amelia3? && @admin.role == "admin" && @admin.id.to_s == ENV["AMELIA3_DEMO_ADMIN_ID"]
    User.where(dataset_mode: "amelia3", commercial_tenant_id: @admin.commercial_tenant_id)
        .where(id: @admin.id, role: "admin")
        .or(User.where(dataset_mode: "amelia3", commercial_tenant_id: @admin.commercial_tenant_id, id: ENV["AMELIA3_DEMO_AGENT_ID"], role: "agent", agent_id: "34"))
  end

  def selected(id)
    id.present? && accounts.exists? ? accounts.find(id) : @admin
  end
end
