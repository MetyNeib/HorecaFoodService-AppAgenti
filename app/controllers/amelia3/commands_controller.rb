class Amelia3::CommandsController < Amelia3::BaseController
  before_action :verify_commercial_owner!, only: :create
  rescue_from ActionController::InvalidAuthenticityToken do
    render json: { error: "Aggiorna il token della sessione.", code: "CSRF_EXPIRED" }, status: :unprocessable_content
  end

  def snapshot
    render json: Amelia3::Snapshot.for(current_user, customer_codes: Array(params[:customers]).take(50), product_codes: Array(params[:products]).take(50), order_id: params[:order_id]).merge(csrfToken: form_authenticity_token)
  end

  def create
    command = params.permit(:operationId, :baseVersion, :epoch, :type, payload: {}).to_h
    unless request.format.json?
      %w[baseVersion epoch].each { |key| command[key] = Integer(command[key], exception: false) }
      command["payload"]["expectedVersion"] = Integer(command.dig("payload", "expectedVersion"), exception: false) if command["payload"].key?("expectedVersion")
    end
    result = Amelia3::Commands.call(user: current_user, command: command)
    if request.format.json?
      render json: result.merge(csrfToken: form_authenticity_token)
    else
      candidate = params[:return_to].to_s
      path = candidate.start_with?("/amelia3") && !candidate.match?(/[\r\n\\]/) ? candidate : "/amelia3/orders"
      redirect_to path, status: :see_other, notice: "Ordine salvato nel database locale."
    end
  rescue Amelia3::Error => error
    if request.format.json?
      render json: { error: error.message, code: error.code, snapshot: Amelia3::Snapshot.for(current_user) }, status: error.status
    else
      render plain: error.message, status: error.status
    end
  end

  private

  def verify_commercial_owner!
    owner = request.format.json? ? request.headers["X-HFS-User-Id"] : params[:owner_user_id]
    render json: { error: "Account o permessi cambiati: copia locale conservata.", code: "ACCOUNT_CHANGED" }, status: :unauthorized unless owner == Amelia3::Snapshot.identity(current_user)
  end
end
