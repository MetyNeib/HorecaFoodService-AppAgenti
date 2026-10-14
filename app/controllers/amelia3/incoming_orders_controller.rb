class Amelia3::IncomingOrdersController < Amelia3::PagesController
  rescue_from ActionController::InvalidAuthenticityToken do
    render json: { error: "Aggiorna il token della sessione.", code: "CSRF_EXPIRED" }, status: :unprocessable_content
  end

  def index
    @archive = params[:archive] == "1"
    @page = page
    rows = @scope.incoming_orders
    rows = @archive ? rows.where(status: %w[archived confirmed_demo]) : rows.awaiting_confirmation
    @total = rows.count
    @incoming_orders = rows.order(received_at: :desc, id: :desc).offset((@page - 1) * 50).limit(50)
    @customer_names = @scope.customers.where(external_code: @incoming_orders.select(:customer_code)).pluck(:external_code, :name).to_h
    @feed_state = Amelia3::FeedState.find_by(tenant: @scope.tenant)
  end

  def show
    @incoming = @scope.incoming_orders.find(params[:id])
    @customer = @scope.customers.find_by(external_code: @incoming.customer_code)
    @products_by_code = @scope.products.where(external_code: @incoming.draft.fetch("lines").map { |row| row["productCode"] }).index_by(&:external_code)
    @can_edit = demo_accounts.exists? && @customer && !@customer.blocked && @incoming.status != "confirmed_demo"
  end

  def update
    identity = request.headers["X-HFS-User-Id"].presence || params[:owner_user_id]
    unless identity == Amelia3::Snapshot.identity(current_user)
      raise Amelia3::Error.new("Account cambiato: aggiorna la pagina prima di salvare.", code: "ACCOUNT_CHANGED", status: 409)
    end
    incoming = @scope.incoming_orders.find(params[:id])
    source = params[:draft].is_a?(ActionController::Parameters) ? params[:draft] : ActionController::Parameters.new
    attributes = source.permit(:note, :deliveryDate, lines: [ :id, :productCode, :sourceUnit, :quantity, :note, :remove ]).to_h
    attributes["lines"] = attributes["lines"].values if attributes["lines"].is_a?(Hash)
    incoming.change!(scope: @scope, actor: authenticated_admin, operation: params[:operation], expected_version: Integer(params[:version], exception: false), attributes: attributes)
    location = "/amelia3/whatsapp/#{incoming.id}"
    request.format.json? ? render(json: { location: location }) : redirect_to(location, status: :see_other)
  end

  def notifications
    if request.headers["X-HFS-User-Id"].present? && request.headers["X-HFS-User-Id"] != Amelia3::Snapshot.identity(current_user)
      return render json: { error: "Account cambiato." }, status: :conflict
    end
    render json: { notifications: @scope.notifications, serverTime: Time.current.iso8601 }
  end
end
