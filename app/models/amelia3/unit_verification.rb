class Amelia3::UnitVerification < ApplicationRecord
  belongs_to :tenant
  validates :version, :evidence_reference, :approved_by, :approved_at, presence: true
  validate :supported_contract

  def applies_to?(product)
    (product_code.blank? || product_code == product.external_code) &&
      (base_unit == "*" || base_unit == product.base_unit) &&
      (order_unit == "*" || order_unit == product.order_unit)
  end

  def self.for_product(product, verifications)
    matches = verifications.select { |row| row.applies_to?(product) }
    specific = matches.select { |row| row.product_code.present? }
    matches = specific if specific.any?
    matches.one? ? matches.first : nil
  end

  private

  def supported_contract
    units = Amelia3::CanonicalUnits::KINDS.keys
    raw_units = Amelia3::CanonicalUnits::MAP.keys + [ "*" ]
    errors.add(:base_unit, "non valida") unless raw_units.include?(base_unit) && raw_units.include?(order_unit)
    valid = contract.is_a?(Hash) && (units + [ "base" ]).include?(contract["priceUnit"]) &&
      contract["stockFields"].is_a?(Hash) && contract["steps"].is_a?(Hash) &&
      contract["stockFields"].key?(contract["primaryStockField"]) &&
      contract["stockFields"].all? { |key, unit| %w[packs pieces weight].include?(key) && units.include?(unit) } &&
      contract["steps"].any? && contract["steps"].all? { |unit, value| units.include?(unit) && (unit == "KG" && value == "any" || value.is_a?(String) && value.match?(/\A\d+(?:\.\d{1,12})?\z/) && BigDecimal(value).positive?) } &&
      (Array(contract["verifiedFactors"]) - %w[piecesPerPack packsPerCase weightPerPack]).empty? &&
      (!contract.key?("personalPriceUnit") || (units + [ "base" ]).include?(contract["personalPriceUnit"]))
    errors.add(:contract, "richiede prezzo, campo stock autorevole e passi attestati") unless valid
    if contract.is_a?(Hash) && Array(contract["verifiedFactors"]).include?("weightPerPack") && contract["fixedWeight"] != true
      errors.add(:contract, "la conversione nominale a peso richiede peso fisso attestato")
    end
  end
end
