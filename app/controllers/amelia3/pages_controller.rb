class Amelia3::PagesController < Amelia3::BaseController
  helper_method :amelia_bootstrap

  def order_center
  end

  def home
    @counts = { customers: @scope.customers.count, blocked: @scope.customers.where(blocked: true).count,
                drafts: @scope.orders.where(status: "DRAFT").count, confirmed: @scope.orders.where(status: "CONFIRMED_LOCAL").count }
    @metrics = @scope.tenant.active_batch.metrics.fetch(current_user.role == "admin" ? "all" : "agent34", {})
  end

  def customers
    @page = page
    rows = @scope.customers
    @total = rows.count
    @picker = params[:pick] == "1"
    @category = %w[active dormant blocked].include?(params[:category]) ? params[:category] : "active"
    if @picker
      rows = rows.where(blocked: false)
    elsif @category == "blocked"
      rows = rows.where(blocked: true)
    else
      rows = rows.where(blocked: false)
      active = @scope.customer_activity.active_codes
      rows = @category == "active" ? rows.where(external_code: active) : rows.where.not(external_code: active)
    end
    query = params[:q].to_s.strip.first(100)
    rows = rows.where("external_code ILIKE :q OR name ILIKE :q OR city ILIKE :q", q: "%#{ApplicationRecord.sanitize_sql_like(query)}%") if query.present?
    @filtered_total = rows.count
    @customers = rows.order(:name, :external_code).offset((@page - 1) * 50).limit(50)
    @reactivation_codes = @scope.reactivation_items.where(customer_code: @customers.select(:external_code)).pluck(:customer_code).to_set
    @customer_activity = @customers.to_h { |customer| [ customer.external_code, @scope.customer_activity.for(customer) ] }
  end

  def customer
    @customer = @scope.customer(params[:id])
    @reactivation = @scope.reactivation_items.find_by(customer_code: @customer.external_code)
    @tab = %w[details orders open_items commercial].include?(params[:tab]) ? params[:tab] : "details"
    @orders = @scope.orders.where(customer_code: @customer.external_code).order(created_at: :desc).limit(50)
    @open_items = @scope.open_items.where(account_code: @customer.account_code).order(:due_date).limit(100)
    @credit = @scope.credits.find_by(customer_code: @customer.external_code)
    @routes = @scope.routes.where(customer_code: @customer.external_code).order(:weekday, :route_code)
    @destinations = @scope.destinations(@customer).order(:name)
  end

  def catalog
    @page = page
    @order = @scope.order(params[:order_id]) if params[:order_id].present?
    @customer = @scope.customer(@order.customer_code) if @order
    rows = @scope.products.where(blocked: false)
    habitual = @customer ? Amelia3::HabitualProducts.codes(@scope, @customer.external_code) : []
    @habitual_tab = @customer && params[:range] != "all" && habitual.any?
    @habitual_fallback = @customer && habitual.empty?
    rows = rows.where(external_code: habitual) if @habitual_tab
    query = params[:q].to_s.strip.first(100)
    @search = Amelia3::CatalogSearch.new(@scope, rows)
    rows = @search.call(query)
    @catalog = Amelia3::Catalog.new(@scope, rows.where(blocked: false).order(:name, :external_code), @customer)
    available = @catalog.orderable_products
    @total = available.length
    @products = available.slice((@page - 1) * 50, 50) || []
    cart_products = @scope.products.where(external_code: Array(@order&.lines).map { |line| line["productId"] })
    cart_catalog = Amelia3::Catalog.new(@scope, cart_products, @customer)
    indexed_products = cart_products.index_by(&:external_code)
    @cart_quotes = Array(@order&.lines).to_h { |line| [ line.fetch("id"), cart_catalog.quote(indexed_products.fetch(line.fetch("productId")), unit: line.fetch("unit")) ] }
    @cart_units = indexed_products.transform_values { |product| cart_catalog.orderable_units(product) }
  end

  def product
    @product = @scope.products.find_by!(external_code: params[:id])
    catalog = Amelia3::Catalog.new(@scope, [ @product ])
    @quote = catalog.quote(@product, unit: catalog.orderable_units(@product).first)
  end

  def orders
    @page = page
    @tab = %w[DRAFT CONFIRMED_LOCAL HISTORY].include?(params[:status]) ? params[:status] : "DRAFT"
    if @tab == "HISTORY"
      load_history
      return
    end
    rows = @scope.orders
    rows = rows.where(status: @tab)
    @total = rows.count
    @orders = rows.order(updated_at: :desc).offset((@page - 1) * 50).limit(50)
  end

  def order
    @order = @scope.order(params[:id])
    @customer = @scope.customer(@order.customer_code)
    @destinations = @scope.destinations(@customer).order(:name)
  end

  def history
    @page = page
    load_history
  end

  def history_detail
    @customer = @scope.customer(params[:customer_id])
    @reference = params[:reference].to_s
    @rows = @scope.history.where(customer_code: @customer.external_code, order_reference: @reference).order(:delivery_date, :source_row).to_a
    raise ActiveRecord::RecordNotFound if @rows.empty?
    @history_products = @scope.products.where(external_code: @rows.map(&:product_code)).index_by(&:external_code)
    @product_names = @history_products.transform_values(&:name)
  end

  def alerts
    @reactivation_view = params[:type] == Amelia3::SalesAlertRules::REACTIVATION
    result = Amelia3::AlertPage.new(@scope, params)
    @alert_run, @alerts, @total, @page = result.run, result.items, result.total, result.page
    potential = Amelia3::AlertItem.where(run_id: @alert_run&.id, status: "active", rule_type: "USUAL_PRODUCT_MISSING", customer_code: @scope.customers.where(blocked: false).select(:external_code))
    @pending_reviews = potential.where.not(id: Amelia3::AlertReview.where.not(status: "pending").select(:alert_item_id)).count
    @alert_customers = @scope.customers.where(external_code: @alerts.map(&:customer_code)).index_by(&:external_code)
    @alert_products = @scope.products.where(external_code: @alerts.map(&:product_code)).pluck(:external_code, :name).to_h
    @contact_numbers = @alert_customers.transform_values { |customer| Amelia3::ContactNumbers.call(customer.telephone) }
    @stale = !@alert_run || @alert_run.as_of != Time.find_zone!("Europe/Rome").today || @alert_run.batch_id != @scope.batch_id
    @stale ||= @alert_run&.rules_version != Amelia3::SalesAlertRules::VERSION
    import = Amelia3::SyncOccurrence.find_by(tenant_id: @scope.tenant.id, local_date: Time.find_zone!("Europe/Rome").today)
    @stale ||= import && (import.status != "success" || import.batch_id != @scope.batch_id)
    @stale ||= @alert_run&.source == "scheduled" && !import
    @agent_codes = current_user.role == "admin" ? @scope.customers.distinct.order(:agent_code).pluck(:agent_code) : [ current_user.agent_id ]
  end

  def load_history
    @customer = @scope.customer(params[:customer_id]) if params[:customer_id].present?
    result = Amelia3::HistoryOrders.new(@scope, params)
    @total = result.total
    @history_orders = result.rows
    @customer_names = @scope.customers.where(external_code: @history_orders.map(&:customer_code)).pluck(:external_code, :name).to_h
  end
  private :load_history

  def insights
    @customer = @scope.customer(params[:customer_id]) if params[:customer_id].present?
    rows = @scope.history
    rows = rows.where(customer_code: @customer.external_code) if @customer
    @summary = @customer ? Amelia3::History.summary(rows).stringify_keys : @scope.tenant.active_batch.metrics.fetch(current_user.role == "admin" ? "all" : "agent34", {})
    @summary = @summary.merge("last_delivery" => rows.where("delivery_date <= ? AND shipped > 0", Time.zone.today).maximum(:delivery_date)&.iso8601)
    @usual = Amelia3::History.usual(rows)
    @product_names = @scope.products.where(external_code: @usual.map(&:product_code)).pluck(:external_code, :name).to_h
  end

  def sync
    @scope.admin!
    @batch = @scope.tenant.active_batch
    @runs = Amelia3::SyncOccurrence.where(tenant_id: @scope.tenant.id).order(local_date: :desc).limit(14)
    @scheduler = Amelia3::Scheduler.status
    @feed_state = Amelia3::FeedState.find_by(tenant: @scope.tenant)
    @feed_snapshot = @scope.tenant.feed_snapshot
    @ai_configured = Amelia3::OpenaiProductSearch.new.configured?
    @reviews = Amelia3::AlertReview.where(alert_item_id: Amelia3::AlertItem.where(run_id: @scope.tenant.active_alert_run_id).select(:id)).group(:status).count
    @alert_run = @scope.tenant.active_alert_run
    @alert_occurrences = Amelia3::AlertOccurrence.where(tenant_id: @scope.tenant.id).order(local_date: :desc, id: :desc).limit(7)
  end

  private

  def page
    Integer(params[:page], exception: false).to_i.clamp(1, 100_000)
  end

  def amelia_bootstrap
    @amelia_bootstrap ||= Amelia3::Snapshot.for(current_user,
      customer_codes: [ @customer&.external_code, *@customers.to_a.map(&:external_code), *@alert_customers.to_h.keys ].compact,
      product_codes: [ @product&.external_code, *@products.to_a.map(&:external_code) ].compact,
      order_id: @order&.id, include_usual: action_name != "alerts").merge(csrfToken: form_authenticity_token)
  end
end
