module Users
  class SessionsController < Devise::SessionsController
    def create
      session.delete(:amelia3_demo_account)
      super
    end

    def destroy
      owner = request.headers["X-HFS-User-Id"]
      selected = Amelia3::DemoAccess.new(current_user).selected(session[:amelia3_demo_account])
      expected = current_user&.amelia3? ? Amelia3::Snapshot.identity(selected) : current_user&.id.to_s
      if owner.present? && owner != expected
        render json: { error: "La sessione appartiene a un altro account.", code: "ACCOUNT_CHANGED" }, status: :unauthorized
        return
      end
      session.delete(:amelia3_demo_account)
      super
      response.headers["Cache-Control"] = "no-store, private"
    end
  end
end
