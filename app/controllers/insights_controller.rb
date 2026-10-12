class InsightsController < ApplicationController
  before_action :load_workspace
  before_action :load_customer, only: %i[show actions]
  def index; end
  def show; end
  def actions; end

  private

  def load_customer
    @customer = require_customer(params[:id])
  end
end
