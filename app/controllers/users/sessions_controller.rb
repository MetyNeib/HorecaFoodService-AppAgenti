module Users
  class SessionsController < Devise::SessionsController
    def destroy
      owner = request.headers["X-HFS-User-Id"]
      expected = current_user&.amelia3? ? Amelia3::Snapshot.identity(current_user) : current_user&.id.to_s
      if owner.present? && owner != expected
        render json: { error: "La sessione appartiene a un altro account.", code: "ACCOUNT_CHANGED" }, status: :unauthorized
        return
      end
      super
      response.headers["Cache-Control"] = "no-store, private"
    end
  end
end
