module Amelia3
  class CanonicalUnits
    VERSION = "AMELIA3-CANONICAL-UM-v1".freeze
    MAP = { "C" => "CONF", "K" => "KG", "L" => "COLL", "P" => "PZ" }.freeze
    KINDS = { "CONF" => "multiple_el", "KG" => "weight_volume", "COLL" => "multiple_el", "PZ" => "single_el" }.freeze

    def self.for(product)
      base = MAP[product.base_unit]
      preferred = MAP[product.order_unit]
      valid = base && preferred && [ true, false ].include?(product.pack_indivisible) && [ true, false ].include?(product.case_indivisible)
      units = valid ? [ preferred ] : []
      units << base if valid && !product.pack_indivisible && !product.case_indivisible && base != preferred
      { "version" => VERSION, "preferredUm" => preferred, "pricingCandidateUm" => base,
        "orderableUms" => units, "unitKind" => KINDS[preferred], "source" => "ARTICOLI",
        "reason" => valid ? nil : "Codice UM o flag non riconosciuto: verifica anagrafica necessaria" }
    end
  end
end
