module Amelia3
  class Scope
    attr_reader :user, :tenant, :batch_id

    def initialize(user)
      @user = user
      unless user.amelia3? && %w[admin agent].include?(user.role) && (user.role == "admin" || user.agent_id == "34")
        raise Error.new("Accesso commerciale non abilitato.", code: "FORBIDDEN", status: 403)
      end
      @tenant = Tenant.find_by(id: user.commercial_tenant_id) || raise(Error.new("Tenant non configurato.", code: "FORBIDDEN", status: 403))
      @batch_id = tenant.active_batch_id || raise(Error.new("Dataset non ancora disponibile.", code: "NO_DATASET", status: 503))
      raise Error.new("Dataset di un altro tenant.", code: "FORBIDDEN", status: 403) unless tenant.active_batch.tenant_id == tenant.id
    end

    def customers
      rows = Customer.where(batch_id: batch_id)
      user.role == "admin" ? rows : rows.where(agent_code: user.agent_id)
    end

    def customer(code)
      customers.find_by!(external_code: code)
    end

    def customer_activity
      @customer_activity ||= CustomerActivity.new(self)
    end

    def products
      Product.where(batch_id: batch_id)
    end

    def reactivation_items
      AlertItem.where(run_id: tenant.active_alert_run_id, status: "active", rule_type: SalesAlertRules::REACTIVATION,
                      customer_code: customers.where(blocked: false).select(:external_code))
    end

    def sales_alert_count
      AlertItem.where(run_id: tenant.active_alert_run_id, status: "active", rule_type: SalesAlertRules::TYPES,
                      customer_code: customers.where(blocked: false).select(:external_code))
               .where.not(rule_type: "USUAL_PRODUCT_MISSING", product_code: products.where(blocked: true).select(:external_code)).count
    end

    def destinations(customer)
      customers.where(delivery_point: true).where("external_code = ? OR parent_code = ?", customer.external_code, customer.external_code)
    end

    def orders
      Order.where(tenant_id: tenant.id, customer_code: customers.select(:external_code))
    end

    def order(id)
      orders.find(id)
    end

    def history
      HistoryRow.where(batch_id: batch_id, customer_code: customers.select(:external_code))
    end

    def credits
      Credit.where(batch_id: batch_id, customer_code: customers.select(:external_code))
    end

    def open_items
      OpenItem.where(batch_id: batch_id, account_code: customers.select(:account_code))
    end

    def routes
      Route.where(batch_id: batch_id, customer_code: customers.select(:external_code))
    end

    def admin!
      raise Error.new("Funzione riservata all'Admin.", code: "FORBIDDEN", status: 403) unless user.role == "admin"
    end
  end
end
