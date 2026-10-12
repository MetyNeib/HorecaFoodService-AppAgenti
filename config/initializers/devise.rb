Devise.setup do |config|
  config.mailer_sender = "demo@hfs.invalid"
  require "devise/orm/active_record"
  config.case_insensitive_keys = [ :email ]
  config.strip_whitespace_keys = [ :email ]
  config.stretches = Rails.env.test? ? 1 : 12
  config.password_length = 12..128
  config.sign_out_via = :delete
  config.responder.error_status = :unprocessable_entity
  config.responder.redirect_status = :see_other
  config.navigational_formats = [ :html ]
end
