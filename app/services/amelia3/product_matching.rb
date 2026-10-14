module Amelia3
  class ProductMatching
    VERSION = "habitual-substitutes-v2".freeze
    Result = Struct.new(:codes, :status, :method, keyword_init: true)
    IGNORED = %w[fresco fresca freschi fresche surgelato surgelata surgelati surgelate congelato congelata secco secca secchi secche intero intera interi intere tagliato tagliata tagliati tagliate fette cubetti confezione cartone collo pezzi prodotto prodotti confezioni busta scatola italia italiano italiana origine provenienza extra gr kg ml lt cf ct pz conf da di del della con per il lo la le gli in al].freeze
    PROTECTED = {
      lactose: /senza\s+lattosio|\bs\s+lattosio|delattosat|lactose\s*free/,
      sugar: /\bzero\b|senza\s+zuccher|sugar\s*free|\blight\b|\bdiet\b|pepsi\s+max/,
      gluten: /senza\s+glutine|gluten\s*free/,
      alcohol: /analcolic|alcohol\s*free/,
      caffeine: /decaffeinat|senza\s+caffeina/
    }.freeze

    def self.normalize(text)
      I18n.transliterate(text.to_s).downcase.gsub(/[^a-z0-9]+/, " ").strip
    end

    def self.compatible?(first, second)
      a, b = normalize(first), normalize(second)
      PROTECTED.values.all? { |pattern| a.match?(pattern) == b.match?(pattern) }
    end

    def self.tokens(text)
      normalize(text).split.reject { |token| token.length < 3 || token.match?(/\d/) || IGNORED.include?(token) }
    end

    def self.fuzzy?(a, b)
      return true if a == b || (a.length >= 4 && b.length >= 4 && (a.start_with?(b) || b.start_with?(a)))
      return false if a.length < 5 || b.length < 5
      x = "  #{a} ".chars.each_cons(3).map(&:join).to_set
      y = "  #{b} ".chars.each_cons(3).map(&:join).to_set
      (x & y).length * 2.0 / (x.length + y.length) >= 0.60
    end

    def self.local(query, candidates, mode: "search")
      normalized = normalize(query)
      parts = tokens(query)
      candidates.select do |candidate|
        next false if mode == "substitution" && !compatible?(query, candidate.fetch("name"))
        text = normalize([ candidate["name"], candidate["synonyms"] ].join(" "))
        next true if candidate["code"].to_s.casecmp?(query.strip) || text.include?(normalized)
        words = tokens(text)
        mode == "substitution" ? parts.any? { |part| words.any? { |word| fuzzy?(part, word) } } : parts.any? && parts.all? { |part| words.any? { |word| fuzzy?(part, word) } }
      end
    end

    def self.key_for(ai, mode, query, candidates)
      Digest::SHA256.hexdigest(JSON.generate([ VERSION, ai.model, ai.configured?, mode, query, candidates.sort_by { |row| row.fetch("code") } ]))
    end

    def self.call(tenant:, query:, candidates:, mode: "search", ai: OpenaiProductSearch.new, defer: false)
      return Result.new(codes: [], status: "complete", method: "empty") if candidates.empty? || query.blank?
      found = local(query, candidates, mode: mode)
      return Result.new(codes: found.map { |row| row.fetch("code") }, status: "complete", method: "local") if found.any?
      candidates = candidates.select { |row| compatible?(query, row.fetch("name")) } if mode == "substitution"
      return Result.new(codes: [], status: "complete", method: "protected") if candidates.empty?
      key = key_for(ai, mode, query, candidates)
      cached = ProductMatch.find_by(tenant: tenant, match_key: key)
      if cached && (cached.status == "complete" || cached.retry_at && cached.retry_at > Time.current)
        return Result.new(codes: cached.result.fetch("codes", []), status: cached.status, method: cached.result.fetch("method", "ai"))
      end
      return Result.new(codes: [], status: "pending", method: "queued") if defer
      result = ai.call(query: query, candidates: candidates, mode: mode)
      row = cached || ProductMatch.new(tenant: tenant, match_key: key)
      row.update!(status: result.status, result: { "codes" => result.codes, "method" => result.method }, retry_at: result.status == "pending" ? 15.minutes.from_now : nil)
      result
    rescue ActiveRecord::RecordNotUnique
      Result.new(codes: [], status: "pending", method: "concurrent")
    end

    def self.resolve_batch(tenant:, tasks:, ai: OpenaiProductSearch.new)
      pending = tasks.filter_map do |task|
        candidates = task.fetch(:candidates).select { |row| compatible?(task.fetch(:query), row.fetch("name")) }
        key = key_for(ai, "substitution", task.fetch(:query), candidates)
        cached = ProductMatch.find_by(tenant: tenant, match_key: key)
        next if cached&.status == "complete"
        next if cached&.retry_at && cached.retry_at > Time.current && cached.result["method"].to_s.start_with?("ai_http_")
        task.merge(candidates: candidates, key: key)
      end.uniq { |task| task.fetch(:key) }
      pending.sort_by { |task| task.fetch(:candidates).length }.each_slice(12) do |group|
        results = if group.length > 1 && group.all? { |task| task.fetch(:candidates).length <= 60 }
          ai.batch_substitutions(group)
        else
          group.map { |task| ai.call(query: task.fetch(:query), candidates: task.fetch(:candidates), mode: "substitution") }
        end
        group.zip(results).each do |task, result|
          row = ProductMatch.find_or_initialize_by(tenant: tenant, match_key: task.fetch(:key))
          row.update!(status: result.status, result: { "codes" => result.codes, "method" => result.method }, retry_at: result.status == "pending" ? 15.minutes.from_now : nil)
        end
      end
    end
  end
end
