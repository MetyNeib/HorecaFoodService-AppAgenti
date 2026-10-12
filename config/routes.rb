Rails.application.routes.draw do
  get "up", to: "rails/health#show", as: :rails_health_check
  devise_for :users, controllers: { sessions: "users/sessions" }
  root "home#index"
  get "snapshot", to: "commands#snapshot"
  post "commands", to: "commands#create"
  get "offline", to: "offline#show"
  get "manifest.webmanifest", to: "offline#manifest", defaults: { format: :json }
  get "orders/new/customer", to: "orders#customer"
  get "orders/:id/products", to: "orders#products"
  get "orders/:id/lines/:line_id/edit", to: "orders#line"
  get "orders/:id/review", to: "orders#review"
  get "orders", to: "orders#index"
  get "fastorder", to: "fastorder#index"
  get "fastorder/:id/resolve/:request_id", to: "fastorder#resolve"
  get "fastorder/:id", to: "fastorder#show"
  get "customers", to: "customers#index"
  get "customers/:id/share", to: "customers#share"
  get "customers/:id", to: "customers#show"
  get "catalog", to: "catalog#index"
  get "catalog/:id", to: "catalog#show"
  get "insights", to: "insights#index"
  get "insights/:id/actions", to: "insights#actions"
  get "insights/:id", to: "insights#show"
end
