module Hfs
  class ValidationError < StandardError
    attr_reader :details

    def initialize(message, details: [])
      super(message)
      @details = details
    end

    def status = 422
  end
end
