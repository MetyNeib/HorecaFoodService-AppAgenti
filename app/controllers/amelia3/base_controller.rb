class Amelia3::BaseController < ApplicationController
  before_action :load_commercial_scope
  layout "amelia3"
  rescue_from Amelia3::Error do |error|
    if request.format.json?
      render json: { error: error.message, code: error.code }, status: error.status
    else
      render plain: error.message, status: error.status
    end
  end

  private

  def load_commercial_scope
    @scope = Amelia3::Scope.new(current_user)
  end
end
