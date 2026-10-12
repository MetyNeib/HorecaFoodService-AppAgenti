module Hfs
  class Snapshot
    def self.workspace_for(user)
      raise Forbidden, "Il reset e il workspace demo non accedono ad Amelia3." unless user.synthetic?
      Workspace.find_by(user_id: user.id) || Workspace.create!(user: user, state: Seed.initial_state, version: 0, epoch: 1)
    rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid => error
      Workspace.find_by(user_id: user.id) || raise(error)
    end

    def self.for(user)
      serialize(user, workspace_for(user))
    end

    def self.serialize(user, workspace)
      { state: scoped_state(user, workspace.state), version: workspace.version, epoch: workspace.epoch,
        user: { id: user.id, email: user.email, agentId: user.agent_id } }
    end

    # Access is enforced before data leaves Rails, including lookup and financial
    # records. The complete immutable demo seed remains on the server for reset.
    def self.scoped_state(user, state)
      result = JSON.parse(JSON.generate(state))
      data = result.fetch("data")
      ids = data.fetch("customers").select do |customer|
        customer["agentId"] == user.agent_id && data.fetch("demoDefaults").fetch("activeCustomerIds").include?(customer["id"])
      end.map { |customer| customer.fetch("id") }
      data["customers"].select! { |customer| ids.include?(customer["id"]) }
      %w[contacts destinations customerConditions orders whatsappInbox invoices receivables insights analyses learnedMappings shareJobs].each do |collection|
        data.fetch(collection).select! { |entry| ids.include?(entry["customerId"]) }
      end
      data["orders"].select! { |order| order["agentId"] == user.agent_id }
      orders = data["orders"].map { |order| order["id"] }
      data["whatsappInbox"].select! { |inbox| orders.include?(inbox["orderId"]) }
      receivables = data["receivables"].map { |entry| entry["id"] }
      data["payments"].select! { |payment| receivables.include?(payment["receivableId"]) }
      entities = { "ORDER" => orders, "CONTACT" => data["contacts"].map { |entry| entry["id"] }, "SHARE" => data["shareJobs"].map { |entry| entry["id"] } }
      data["syncQueue"].select! { |job| entities.fetch(job["entityType"], []).include?(job["entityId"]) }
      data["agents"].select! { |agent| agent["id"] == user.agent_id }
      data["demoDefaults"]["currentAgentId"] = user.agent_id
      data["demoDefaults"]["activeCustomerIds"] = ids
      # Derived values are recalculated by selectors; fixtures are not app data.
      data["derived"] = {}
      data["scenarioBank"] = []
      result
    end
  end
end
