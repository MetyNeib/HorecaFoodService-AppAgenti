class CommandsController < ApplicationController
  before_action :verify_workspace_owner!, only: :create
  rescue_from ActionController::InvalidAuthenticityToken, with: :expired_csrf_token
  BOOLEAN_FIELDS = %w[isGift whatsappEnabled overdue online confirmClear replaceOverlaps].freeze
  INTEGER_FIELDS = %w[unitPriceBaseCents discountBasisPoints].freeze

  def snapshot
    render json: Hfs::Snapshot.for(current_user).merge(csrfToken: form_authenticity_token)
  end

  def create
    result = Hfs::Commands.call(user: current_user, command: command_params)
    respond_to do |format|
      format.json { render json: result.merge(csrfToken: form_authenticity_token) }
      format.html { redirect_to success_return_path(result), notice: I18n.t("commands.saved", default: "Modifiche salvate."), status: :see_other }
    end
  rescue Hfs::Conflict => error
    respond_to do |format|
      format.json { render json: { error: error.message, snapshot: error.snapshot, csrfToken: form_authenticity_token }, status: :conflict }
      format.html { render plain: error.message, status: :conflict }
    end
  rescue Hfs::ValidationError => error
    respond_to do |format|
      format.json { render json: { error: error.message, details: error.details }, status: error.status }
      format.html { redirect_to local_return_path, alert: error.message, status: :see_other }
    end
  end

  private

  def expired_csrf_token
    respond_to do |format|
      format.json { render json: { error: "La sessione è stata aggiornata. Recupera un nuovo token prima di riprovare.", code: "CSRF_EXPIRED" }, status: :unprocessable_content }
      format.html { render plain: "La sessione è stata aggiornata. Riapri la pagina prima di salvare.", status: :unprocessable_content }
    end
  end

  # A cookie can change in another tab while an old offline outbox remains open.
  # Require the owner captured with that outbox/form before applying any intent.
  def verify_workspace_owner!
    owner = request.format.json? ? request.headers["X-HFS-User-Id"] : params[:owner_user_id]
    return if owner.to_s == current_user.id.to_s

    respond_to do |format|
      format.json { render json: { error: "La sessione appartiene a un altro account. Accedi con l'account delle modifiche locali.", code: "ACCOUNT_CHANGED" }, status: :unauthorized }
      format.html { render plain: "L'account è cambiato. Riapri la pagina prima di salvare.", status: :unauthorized }
    end
  end

  def command_params
    fields = params.permit(:operationId, :baseVersion, :epoch, :type, payload: {}).to_h
    return fields if request.format.json?

    # HTML carries the version rendered to the user, so stale forms cannot silently overwrite.
    fields["baseVersion"] = Integer(fields["baseVersion"], exception: false)
    fields["epoch"] = Integer(fields["epoch"], exception: false)
    fields["payload"] = normalize_form(fields.fetch("payload", {}))
    fields
  end

  def normalize_form(value)
    value.to_h.transform_values do |child|
      child.is_a?(Hash) ? normalize_form(child) : child
    end.tap do |payload|
      BOOLEAN_FIELDS.each { |key| payload[key] = payload[key] == "true" || payload[key] == "1" if payload.key?(key) }
      INTEGER_FIELDS.each { |key| payload[key] = Integer(payload[key], exception: false) if payload.key?(key) }
      payload["quantity"] = Float(payload["quantity"].to_s.tr(",", "."), exception: false) if payload.key?("quantity")
    end
  end

  def local_return_path
    value = params[:return_to].to_s
    value.start_with?("/") && !value.start_with?("//", "/\\") && !value.match?(/[\r\n]/) ? value : root_path
  end

  def success_return_path(result)
    return local_return_path unless params[:type] == "CONFIRM_ORDER"

    order_id = params.dig(:payload, :orderId)
    order = result.fetch(:state).fetch("data").fetch("orders").find { |item| item["id"] == order_id }
    order && order["status"] == "SENT" ? "/orders?tab=sent" : "/orders?tab=pending"
  end
end
