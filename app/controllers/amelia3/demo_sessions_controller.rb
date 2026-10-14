class Amelia3::DemoSessionsController < Amelia3::BaseController
  def create
    unless request.headers["X-HFS-User-Id"] == Amelia3::Snapshot.identity(current_user)
      return render json: { error: "Account cambiato: aggiorna la pagina prima di continuare." }, status: :conflict
    end
    selected = demo_accounts.find(params[:account_id])
    scope = Amelia3::Scope.new(selected)
    path = authorized_path(scope)
    session[:amelia3_demo_account] = selected.id
    render json: { location: path }
  end

  private

  def authorized_path(scope)
    uri = URI.parse(params[:return_to].to_s)
    return "/amelia3" if uri.host || uri.scheme || uri.path.match?(/[\\\r\n]/)
    route = Rails.application.routes.recognize_path(uri.path, method: :get)
    return "/amelia3" unless %w[amelia3/pages amelia3/incoming_orders].include?(route[:controller])
    scope.incoming_orders.find(route[:id]) if route[:controller] == "amelia3/incoming_orders" && route[:action] == "show"
    query = Rack::Utils.parse_nested_query(uri.query.to_s)
    scope.customer(route[:id]) if route[:action] == "customer"
    scope.order(route[:id]) if route[:action] == "order"
    scope.customer(query["customer_id"]) if query["customer_id"].present?
    scope.order(query["order_id"]) if query["order_id"].present?
    scope.admin! if %w[sync].include?(route[:action])
    [ uri.path, uri.query ].compact.join("?")
  rescue ActiveRecord::RecordNotFound, Amelia3::Error, ActionController::RoutingError, URI::InvalidURIError, ArgumentError
    "/amelia3"
  end
end
