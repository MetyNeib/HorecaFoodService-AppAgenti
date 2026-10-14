module Amelia3
  class ContactNumbers
    def self.call(raw)
      raw.to_s.split(/[;,\/|\n]+/).flat_map do |part|
        next [] if part.match?(/\+{2,}/)
        part.scan(/\+?\d[\d\s().-]*\d|\+?\d/).flat_map do |segment|
          cleaned = segment.strip
          # Labels can separate numbers; a formatted single number is retained intact.
          # Split a spaced dash only when both sides independently validate as complete phones.
          tokens = cleaned.split(/\s*-\s*/)
          tokens = cleaned.split(/\s+/) unless tokens.length > 1 && tokens.all? { |token| normalize(token) }
          candidates = tokens.length > 1 && tokens.all? { |token| normalize(token) } ? tokens : [ cleaned ]
          candidates.filter_map { |value| normalize(value) }
        end
      end.uniq
    end

    def self.normalize(raw)
      return unless raw.match?(/\A[+\d().\s-]+\z/)
      digits = raw.gsub(/[().\s-]/, "")
      if digits.start_with?("+", "00")
        number = digits.sub(/\A(?:\+|00)/, "")
        return number if number.match?(/\A[1-9]\d{7,14}\z/)
      elsif digits.match?(/\A(?:0[1-9]\d{4,9}|3\d{9})\z/)
        return "39#{digits}"
      elsif digits.match?(/\A39(?:0[1-9]\d{4,9}|3\d{9})\z/)
        return digits
      end
      nil
    end
    private_class_method :normalize
  end
end
