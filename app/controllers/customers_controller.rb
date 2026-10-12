class CustomersController < ApplicationController
  before_action :load_workspace
  before_action :load_customer, only: %i[show share]
  def index; end
  def show; end
  def share; end

  private

  def load_customer
    @customer = require_customer(params[:id])
  end
end
