module Hfs
  class Forbidden < ValidationError
    def status = 403
  end
end
