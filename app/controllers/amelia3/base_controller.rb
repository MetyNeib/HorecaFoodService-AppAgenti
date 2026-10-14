class Amelia3::BaseController < ApplicationController
  before_action :load_commercial_scope
  layout "amelia3"
  rescue_from ActiveRecord::RecordNotFound do
    if request.format.json?
      render json: { error: "Elemento non disponibile nel portafoglio.", code: "NOT_FOUND" }, status: :not_found
    else
      render plain: "Elemento non disponibile nel portafoglio.", status: :not_found
    end
  end
  rescue_from Amelia3::Error do |error|
    if request.format.json?
      render json: { error: error.message, code: error.code }, status: error.status
    elsif request.get? && error.code == "FORBIDDEN" && current_user.synthetic?
      render "amelia3/account_required", layout: "application", status: :forbidden
    else
      render plain: error.message, status: error.status
    end
  end

  helper_method :demo_accounts

  def authenticated_admin
    @authenticated_admin ||= super_current_user
  end

  def current_user
    @demo_current_user ||= Amelia3::DemoAccess.new(authenticated_admin).selected(session[:amelia3_demo_account])
  end

  def demo_accounts
    Amelia3::DemoAccess.new(authenticated_admin).accounts
  end

  private

  def super_current_user
    # Devise remains signed in as the original Admin.
    warden.user(:user)
  end

  def load_commercial_scope
    @scope = Amelia3::Scope.new(current_user)
  end
end
