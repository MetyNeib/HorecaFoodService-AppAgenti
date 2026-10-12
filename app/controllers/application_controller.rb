class ApplicationController < ActionController::Base
  prepend_before_action :authenticate_user!
  before_action :private_response
  before_action :separate_datasets

  private

  def private_response
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
  end

  def load_workspace
    @bootstrap = Hfs::Snapshot.for(current_user).merge(csrfToken: form_authenticity_token)
    @state = @bootstrap.fetch(:state)
    @data = @state.fetch("data")
  end

  def require_record(collection, id)
    record = @data.fetch(collection).find { |item| item["id"] == id }
    raise ActiveRecord::RecordNotFound unless record
    record
  end

  def require_customer(id)
    customer = require_record("customers", id)
    unless @data.fetch("demoDefaults").fetch("activeCustomerIds").include?(customer["id"])
      raise ActiveRecord::RecordNotFound
    end
    customer
  end

  def require_order(id)
    order = require_record("orders", id)
    require_customer(order.fetch("customerId"))
    raise ActiveRecord::RecordNotFound unless order["agentId"] == current_user.agent_id
    order
  end

  def after_sign_in_path_for(resource)
    resource.amelia3? ? "/amelia3" : root_path
  end

  def separate_datasets
    return unless current_user&.amelia3?
    return if devise_controller? || controller_path.start_with?("amelia3/")
    if request.format.json?
      render json: { error: "Il dataset demo è separato da Amelia3." }, status: :forbidden
    else
      redirect_to "/amelia3"
    end
  end
end
