module Amelia3
  class Error < StandardError
    attr_reader :code, :status

    def initialize(message, code: "INVALID_DATA", status: 422)
      @code = code
      @status = status
      super(message)
    end
  end
end
