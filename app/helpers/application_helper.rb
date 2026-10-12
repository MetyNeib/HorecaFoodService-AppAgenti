require "digest"
require "securerandom"

module ApplicationHelper
  STATUS_LABELS = { "DRAFT" => "Bozza", "PENDING_SEND" => "Da inviare", "SENT" => "Inviato", "WHATSAPP_REVIEW" => "Verifica WhatsApp" }.freeze

  # Stable catalogue keys keep the original approved Italian copy translatable.
  def ui(text, **values)
    I18n.t("hfs.#{Digest::SHA256.hexdigest(text)[0, 16]}", **values, default: text)
  end

  def order_status_labels
    STATUS_LABELS
  end

  def records(name)
    (@data || @state&.fetch("data", nil) || {}).fetch(name, [])
  end

  def record(name, id)
    records(name).find { |entry| entry["id"] == id }
  end

  def demo_defaults
    @data.fetch("demoDefaults")
  end

  def today
    @data.dig("meta", "demoClock").to_s[0, 10]
  end

  def money(cents)
    number_to_currency(cents.to_f / 100, unit: "€", format: "%n %u", separator: ",", delimiter: ".")
  end

  def percentage(value)
    value.nil? ? "—" : "#{number_with_precision(value, precision: 2, strip_insignificant_zeros: true, separator: ',')}%"
  end

  def quantity_text(value)
    number_with_precision(value, precision: 3, strip_insignificant_zeros: true, separator: ".", delimiter: "")
  end

  def display_date(value)
    value.present? ? value.to_s[0, 10].split("-").reverse.join("/") : "—"
  end

  def decimal_input(cents)
    format("%.2f", cents.to_f / 100).tr(".", ",")
  end

  def normalized(value)
    value.to_s.unicode_normalize(:nfd).gsub(/\p{Mn}/, "").downcase.strip
  end

  def matches?(query, *values)
    normalized(values.join(" ")).include?(normalized(query))
  end

  def current_order
    @order ||= record("orders", params[:order_id] || params[:id])
  end

  def current_customer
    @customer ||= record("customers", params[:customer_id] || params[:id])
  end

  def current_product
    @product ||= record("products", params[:product_id] || params[:id])
  end

  def current_line
    current_order&.fetch("lines", [])&.find { |line| line["id"] == params[:line_id] }
  end

  def editable?(order)
    order && %w[DRAFT WHATSAPP_REVIEW].include?(order["status"])
  end

  def unresolved?(request)
    !%w[MATCHED RESOLVED EXCLUDED].include?(request["status"])
  end

  def inbox_for(order)
    records("whatsappInbox").find { |inbox| inbox["orderId"] == order["id"] }
  end

  def request_for(order, line)
    inbox_for(order)&.fetch("requests", [])&.find { |item| item["id"] == line["whatsappRequestId"] }
  end

  def order_location(order)
    return "/fastorder/#{order['id']}" if order["status"] == "WHATSAPP_REVIEW"
    "/orders/#{order['id']}/#{editable?(order) ? 'products' : 'review'}"
  end

  def safe_return(fallback = "/")
    candidate = params[:returnTo] || params[:return_to]
    candidate.to_s.start_with?("/") && !candidate.to_s.start_with?("//", "/\\") && !candidate.to_s.match?(/[\r\n]/) ? candidate : fallback
  end

  def contextual_path(path, **query)
    "#{path}?#{query.to_query}"
  end

  def collection_options(name, label = "name", scope: nil)
    (scope || records(name)).map { |entry| [ entry[label], entry["id"] ] }
  end

  def customer_records(customer, name)
    records(name).select { |entry| entry["customerId"] == customer["id"] }
  end

  def portfolio_customers
    records("customers").select { |customer| demo_defaults["activeCustomerIds"].include?(customer["id"]) && matches?(params[:q], customer["businessName"], customer["code"], customer["taxId"]) }.sort_by { |customer| normalized(customer["businessName"]) }
  end

  def home_counts
    mine = records("orders").select { |order| order["agentId"] == demo_defaults["currentAgentId"] }
    { drafts: mine.count { |order| order["status"] == "DRAFT" }, pending: mine.count { |order| order["status"] == "PENDING_SEND" }, sent: mine.count { |order| order["status"] == "SENT" }, whatsapp: mine.count { |order| order["status"] == "WHATSAPP_REVIEW" } }
  end

  def stock_quantity(product, warehouse)
    stock_record(product, warehouse)&.fetch("availableBaseQuantity", 0) || 0
  end

  def stock_record(product, warehouse)
    records("stocks").find { |stock| stock["productId"] == product["id"] && stock["warehouseId"] == warehouse }
  end

  def stock_presentation(product, warehouse)
    quantity = stock_quantity(product, warehouse)
    threshold = stock_record(product, warehouse)&.fetch("lowStockThreshold", 0) || 0
    return [ "Esaurito", "error", quantity ] if quantity.zero?
    quantity <= threshold ? [ "In esaurimento", "warning", quantity ] : [ "Disponibile", "success", quantity ]
  end

  def filtered_products(order = nil)
    warehouse = order&.fetch("warehouseId") || params[:warehouse] || "DEP-07"
    past = order ? records("orders").select { |item| item["customerId"] == order["customerId"] && item["status"] == "SENT" }.flat_map { |item| item["lines"].map { |line| line["productId"] } } : []
    records("products").select do |product|
      matches?(params[:q], product["name"], product["code"]) &&
        (params[:category].blank? || product["categoryId"] == params[:category]) &&
        (params[:available] != "1" || stock_quantity(product, warehouse).positive?) &&
        (params[:past] != "1" || past.include?(product["id"]))
    end
  end

  def filtered_inbox
    records("whatsappInbox").select do |inbox|
      customer = record("customers", inbox["customerId"])
      contact = record("contacts", inbox["contactId"])
      record("orders", inbox["orderId"])["status"] == "WHATSAPP_REVIEW" &&
        matches?(params[:q], customer["businessName"], customer["code"], inbox["orderId"], contact["firstName"], contact["lastName"], contact["phoneDisplay"]) &&
        (params[:delivery].blank? || inbox["requestedDeliveryDate"] == params[:delivery]) &&
        (params[:only] != "1" || inbox["requests"].any? { |item| unresolved?(item) })
    end
  end

  def filtered_orders(customer = nil)
    wanted = customer ? params[:status] : { "drafts" => "DRAFT", "pending" => "PENDING_SEND", "sent" => "SENT" }.fetch(params[:tab], "DRAFT")
    all = records("orders").select { |order| order["agentId"] == demo_defaults["currentAgentId"] && (!customer || order["customerId"] == customer["id"]) && (wanted.blank? || order["status"] == wanted) }
    from, to = order_date_range
    selected = all.select do |order|
      date = (customer ? order["createdAt"] : order["sentAt"] || order["updatedAt"])[0, 10]
      matches?(params[:q], order["number"], record("customers", order["customerId"])["businessName"]) && (from.blank? || date >= from) && (to.blank? || date <= to)
    end
    [ selected.sort_by { |order| order["sentAt"] || order["updatedAt"] }.reverse, all.length ]
  end

  def order_date_range
    case params[:period]
    when "today" then [ today, today ]
    when "week" then [ (Date.iso8601(today) - 6).iso8601, today ]
    when "month" then [ "#{today[0, 7]}-01", today ]
    when "all" then [ nil, nil ]
    else [ params[:from], params[:to] ]
    end
  end

  def ledger_rows(customer, filter: false)
    customer_records(customer, "receivables").filter_map do |receivable|
      invoice = record("invoices", receivable["invoiceId"])
      paid = records("payments").select { |payment| payment["receivableId"] == receivable["id"] }.sum { |payment| payment["amountCents"] }
      residual = receivable["faceValueCents"] - paid
      row = receivable.merge("invoice" => invoice, "paid" => paid, "residual" => residual, "overdue" => residual.positive? && receivable["dueDate"] < today)
      row unless filter && (!matches?(params[:q], invoice["number"]) || params[:only] == "1" && !row["overdue"])
    end
  end

  def ledger_totals(customer)
    rows = ledger_rows(customer)
    [ rows.sum { |row| row["residual"] }, rows.select { |row| row["overdue"] }.sum { |row| row["residual"] }, rows.sum { |row| row["paid"] } ]
  end

  def customer_conditions(customer)
    customer_records(customer, "customerConditions").select { |condition| product = record("products", condition["productId"]); matches?(params[:q], product["name"], product["code"]) }
  end

  def condition_status(condition)
    return "Futura" if condition["validFrom"].present? && condition["validFrom"] > today
    return "Scaduta" if condition["validTo"].present? && condition["validTo"] < today
    "Attiva"
  end

  def condition_description(condition)
    product = record("products", condition["productId"])
    return "#{money(condition['unitPriceBaseCents'])} / #{product['baseUnit']}" if condition["type"] == "FIXED_PRICE"
    list = record("priceLists", condition["priceListId"])&.fetch("name", "")
    condition["type"] == "DISCOUNT" ? ui("%{discount}% sul listino %{list}", discount: condition["discountBasisPoints"].to_f / 100, list: list) : list
  end

  def insight_customers
    target = params[:tab] == "reviewed" ? "REVIEWED" : "TO_REVIEW"
    insights = records("insights").select { |item| item["status"] == target }
    records("customers").select { |customer| insights.any? { |item| item["customerId"] == customer["id"] } && matches?(params[:q], customer["businessName"], customer["code"]) }.map { |customer| [ customer, insights.select { |item| item["customerId"] == customer["id"] } ] }
  end

  def command_hidden(type, payload = {}, return_to: request.fullpath)
    fields = [ command_envelope, hidden_field_tag("type", type, id: nil), hidden_field_tag("return_to", return_to, id: nil) ]
    payload.each { |key, value| fields << hidden_field_tag("payload[#{key}]", value, id: nil) }
    safe_join(fields)
  end

  def command_envelope
    bootstrap = (@bootstrap || {}).with_indifferent_access
    safe_join([
      hidden_field_tag("owner_user_id", current_user.id, id: nil),
      hidden_field_tag("operationId", SecureRandom.uuid, id: nil),
      hidden_field_tag("baseVersion", bootstrap[:version], id: nil),
      hidden_field_tag("epoch", bootstrap[:epoch], id: nil)
    ])
  end

  def command_form(type, payload = {}, return_to: request.fullpath, **options, &block)
    options[:class] = [ "command_form_js", options[:class] ].compact.join(" ")
    form_tag("/commands", method: :post, **options) { safe_join([ command_hidden(type, payload, return_to: return_to), capture(&block) ]) }
  end

  def search_field(label = "Cerca per nome o codice")
    render "components/search_input", label: label, value: params[:q]
  end

  def list_attributes(label, kind: "list", classes: "")
    { class: "scroll-area scroll_area_js #{classes}", role: "region", "aria-label": ui(label), tabindex: 0, data: { kind: kind } }
  end

  def product_price(product, order)
    Hfs::Calculations.resolve_price(@data, record("customers", order["customerId"]), product, today)["unitPriceBaseCents"]
  end

  def review_errors(order)
    editable?(order) ? Hfs::Domain.new(@state, agent_id: demo_defaults["currentAgentId"]).order_errors(order) : []
  end

  def delivery_weekdays(order)
    customer = record("customers", order["customerId"])
    destination = record("destinations", order["destinationId"])
    route = record("deliveryRoutes", destination&.fetch("deliveryRouteId", nil) || customer["deliveryRouteId"])
    route["weekdaysISO"].map { |day| ui([ nil, "lun", "mar", "mer", "gio", "ven", "sab", "dom" ][day]) }.join(", ")
  end

  def resolver_candidates(request)
    params[:q].present? ? filtered_products : request["alternatives"].filter_map { |alternative| record("products", alternative["productId"]) }
  end

  def icon(name = "box")
    paths = {
      "order" => '<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h5"/><path d="M3 7H1v16h14"/>',
      "new-order" => '<path d="M13 21H6a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6M7 7h6M7 11h5M7 15h2"/><circle cx="17" cy="17" r="5"/><path d="M17 14.5v5M14.5 17h5"/>',
      "chat" => '<path d="M21 11.5a9 9 0 0 1-13.2 8L3 22l1.5-5.1A9 9 0 1 1 21 11.5Z"/><circle cx="7.5" cy="11.5" r=".65"/><circle cx="12" cy="11.5" r=".65"/><circle cx="16.5" cy="11.5" r=".65"/>',
      "users" => '<rect x="3" y="3" width="18" height="19" rx="3"/><circle cx="12" cy="10" r="3"/><path d="M7 19v-2a5 5 0 0 1 10 0v2M7 1v4M17 1v4"/>',
      "chart" => '<path d="M3 21V11h4v10M10 21V3h4v18M17 21V7h4v14"/>',
      "box" => '<path d="m12 2 10 5v11l-10 5L2 18V7zm0 10v11M2 7l10 5 10-5M7 4.5l10 5V15"/>'
    }
    content_tag(:svg, paths.fetch(name, paths["box"]).html_safe, class: "icon", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": true)
  end
end
