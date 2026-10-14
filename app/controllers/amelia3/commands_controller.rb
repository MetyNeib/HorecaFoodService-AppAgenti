class Amelia3::CommandsController < Amelia3::BaseController
  before_action :verify_commercial_owner!, only: :create
  rescue_from ActionController::InvalidAuthenticityToken do
    render json: { error: "Aggiorna il token della sessione.", code: "CSRF_EXPIRED" }, status: :unprocessable_content
  end

  def snapshot
    render json: Amelia3::Snapshot.for(current_user, customer_codes: Array(params[:customers]).take(50), product_codes: Array(params[:products]).take(50), order_id: params[:order_id], include_usual: params[:context] != "alerts").merge(csrfToken: form_authenticity_token)
  end

  def create
    command = params.permit(:operationId, :baseVersion, :epoch, :type, payload: {}).to_h
    unless request.format.json?
      %w[baseVersion epoch].each { |key| command[key] = Integer(command[key], exception: false) }
      payload = command["payload"]
      payload["expectedVersion"] = Integer(payload["expectedVersion"], exception: false) if payload.is_a?(Hash) && payload.key?("expectedVersion")
    end
    result = Amelia3::Commands.call(user: current_user, command: command)
    if !request.format.json? && params[:next_command] == "CONFIRM_ORDER" && command["type"] == "SAVE_REVIEW"
      order = result.fetch(:state).fetch("data").fetch("orders").find { |row| row["id"] == command.dig("payload", "orderId") }
      confirmation = { "operationId" => "#{command['operationId']}-confirm", "baseVersion" => result.fetch(:version), "epoch" => 1, "type" => "CONFIRM_ORDER",
                       "payload" => { "orderId" => order.fetch("id"), "expectedVersion" => order.fetch("version"), "batchId" => @scope.batch_id } }
      result = Amelia3::Commands.call(user: current_user, command: confirmation)
    end
    if request.format.json?
      render json: result.merge(csrfToken: form_authenticity_token)
    else
      context_id = command.dig("payload", "id") || command.dig("payload", "orderId") || ""
      candidate = params[:return_to].to_s.gsub(":id", ERB::Util.url_encode(context_id))
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
