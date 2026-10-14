class Amelia3::Product < ApplicationRecord
  belongs_to :batch, class_name: "Amelia3::ImportBatch"

  def canonical_units
    Amelia3::CanonicalUnits.for(self)
  end

  def generic_catalog_item?
    normalized = name.to_s.upcase.gsub(/[^A-Z0-9]+/, " ").strip
    normalized.match?(/\A(?:(?:DS|OM)\s+)?(?:ARTICOL[OI]|ART|PRODOTT[OI]|MERCE|MERCI)\s+(?:VARI[OAIE]?|GENERIC[OAIE]|GENERICHE|DIVERS[OAIE])\b/)
  end
end
