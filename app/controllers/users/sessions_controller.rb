module Users
  class SessionsController < Devise::SessionsController
    def destroy
      super
      response.headers["Cache-Control"] = "no-store, private"
    end
  end
end
