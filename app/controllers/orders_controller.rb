class OrdersController < ApplicationController
  before_action :load_workspace
  before_action :load_order, only: %i[products line review]

  def index; end

  def customer
    render "orders/customer"
  end

  def products; end

  def line
    raise ActiveRecord::RecordNotFound unless @order.fetch("lines").any? { |line| line["id"] == params[:line_id] }
  end

  def review; end

  private

  def load_order
    @order = require_order(params[:id])
  end
end
