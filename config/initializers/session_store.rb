Rails.application.config.session_store :cookie_store,
  key: "_hfs_agents_session",
  same_site: :lax,
  httponly: true,
  secure: Rails.env.production?
