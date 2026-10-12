module Hfs
  class Conflict < ValidationError
    attr_reader :snapshot

    def initialize(message, snapshot:)
      super(message)
      @snapshot = snapshot
    end

    def status = 409
    def payload = snapshot.merge(error: message)
  end
end
