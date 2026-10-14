class Amelia3::FeedState < ApplicationRecord
  belongs_to :tenant

  def fresh?
    last_success_at && last_success_at > 6.minutes.ago && error_code.nil?
  end
end
