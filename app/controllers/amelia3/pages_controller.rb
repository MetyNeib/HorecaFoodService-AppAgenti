class Amelia3::PagesController < Amelia3::BaseController
  helper_method :amelia_bootstrap

  def home
    @counts = { customers: @scope.customers.count, blocked: @scope.customers.where(blocked: true).count,
                drafts: @scope.orders.where(status: "DRAFT").count, confirmed: @scope.orders.where(status: "CONFIRMED_LOCAL").count }
    @metrics = @scope.tenant.active_batch.metrics.fetch(current_user.role == "admin" ? "all" : "agent34", {})
  end

  def customers
    @page = page
    rows = @scope.customers
    @total = rows.count
    query = params[:q].to_s.strip.first(100)
    rows = rows.where("external_code ILIKE :q OR name ILIKE :q OR city ILIKE :q", q: "%#{ApplicationRecord.sanitize_sql_like(query)}%") if query.present?
    @filtered_total = rows.count
    @customers = rows.order(:name, :external_code).offset((@page - 1) * 50).limit(50)
  end

  def customer
    @customer = @scope.customer(params[:id])
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
    rows = @scope.products
    query = params[:q].to_s.strip.first(100)
    rows = rows.where("external_code ILIKE :q OR name ILIKE :q", q: "%#{ApplicationRecord.sanitize_sql_like(query)}%") if query.present?
    if params[:usual] == "1" && @customer
      rows = rows.where(external_code: @scope.history.where(customer_code: @customer.external_code).select(:product_code).distinct)
    end
    @total = rows.count
    @products = rows.order(:name, :external_code).offset((@page - 1) * 50).limit(50)
    @quotes = Amelia3::Catalog.new(@scope, @products, @customer).quotes
    cart_products = @scope.products.where(external_code: Array(@order&.lines).map { |line| line["productId"] })
    @cart_steps = Amelia3::Catalog.new(@scope, cart_products, @customer).quotes.transform_values { |quote| quote.step || 1 }
  end

  def product
    @product = @scope.products.find_by!(external_code: params[:id])
    @quote = Amelia3::Quote.for(@scope, @product)
  end

  def orders
    @page = page
    rows = @scope.orders
    rows = rows.where(status: params[:status]) if %w[DRAFT CONFIRMED_LOCAL].include?(params[:status])
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
    @customer = @scope.customer(params[:customer_id]) if params[:customer_id].present?
    rows = @scope.history
    rows = rows.where(customer_code: @customer.external_code) if @customer
    query = params[:q].to_s.strip.first(100)
    rows = rows.where("product_code ILIKE :q OR order_reference ILIKE :q", q: "%#{ApplicationRecord.sanitize_sql_like(query)}%") if query.present?
    rows = rows.where("delivery_date >= ?", Amelia3::CsvReader.date(params[:from])) if params[:from].present?
    rows = rows.where("delivery_date <= ?", Amelia3::CsvReader.date(params[:to])) if params[:to].present?
    @total = rows.count
    @rows = rows.order(delivery_date: :desc, source_row: :desc).offset((@page - 1) * 50).limit(50)
    @product_names = @scope.products.where(external_code: @rows.map(&:product_code)).pluck(:external_code, :name).to_h
  end

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
  end

  private

  def page
    Integer(params[:page], exception: false).to_i.clamp(1, 100_000)
  end

  def amelia_bootstrap
    @amelia_bootstrap ||= Amelia3::Snapshot.for(current_user,
      customer_codes: [ @customer&.external_code, *@customers.to_a.map(&:external_code) ].compact,
      product_codes: [ @product&.external_code, *@products.to_a.map(&:external_code) ].compact,
      order_id: @order&.id).merge(csrfToken: form_authenticity_token)
  end
end
