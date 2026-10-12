class CatalogController < ApplicationController
  before_action :load_workspace
  def index; end

  def show
    @product = require_record("products", params[:id])
  end
end
