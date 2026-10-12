class FastorderController < ApplicationController
  before_action :load_workspace
  before_action :load_order, only: %i[show resolve]
  def index; end
  def show; end

  def resolve
    inbox = @data.fetch("whatsappInbox").find { |item| item["orderId"] == @order["id"] }
    raise ActiveRecord::RecordNotFound unless inbox&.fetch("requests", [])&.any? { |item| item["id"] == params[:request_id] }
  end

  private

  def load_order
    @order = require_order(params[:id])
  end
end
