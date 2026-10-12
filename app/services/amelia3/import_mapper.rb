module Amelia3
  class ImportMapper
    def self.call(name, row, index)
      new(row, index).call(name)
    end

    def initialize(row, index)
      @row = row
      @index = index
    end

    def call(name)
      case name
      when "ARTICOLI.csv" then product
      when "CLIENTI.csv" then customer
      when "GIACENZE.csv" then { product_code: required("cod_art"), packs: decimal("esistenza_att_cf", true), pieces: decimal("esistenza_att_pz", true), weight: decimal("esistenza_att_pe", true) }
      when "LISTINI.csv"
        amount = CsvReader.decimal(@row["prezzo"], optional: true, tolerate_invalid: true)
        { list_code: required("cod_lis"), product_code: required("cod_art"), amount: amount, valid_price: amount.present? && amount.positive? }
      when "LISTINI_PERS.csv"
        { source_row: @index, customer_code: required("cod_cli"), product_code: required("cod_art"), valid_from: date("da_data"), valid_to: date("a_data"),
          price: decimal("prezzo", true), discount: decimal("sconto", true), commission: decimal("perc_provv", true) }
      when "FIDO.csv" then { customer_code: required("cod_cli"), limit: decimal("valore_fido"), remaining: decimal("residuo_fido") }
      when "INSOLUTO.csv"
        { source_row: @index, account_code: required("cod_conto"), item_reference: required("nr_partita"), document_reference: @row["nr_rif"], reference_date: @row["data_rif"].present? ? date("data_rif") : nil, due_date: date("data_scad"), amount: decimal("tot_rata") }
      when "TABGIR.csv"
        day = Integer(@row["giorno_sett"], exception: false)
        raise Error.new("Giorno giro non valido.", code: "INVALID_ROUTE") unless (1..7).cover?(day)
        { source_row: @index, customer_code: required("cod_cli"), route_code: required("cod_giro"), description: @row["des_giro"], weekday: day }
      when "STORICO.csv"
        { source_row: @index, order_reference: required("rif_ord_interno"), customer_code: required("cod_cli"), product_code: required("cod_art"),
          packs: decimal("qta_ord_cf"), pieces: decimal("qta_ord_pz"), weight: decimal("qta_ord_pe"), shipped: decimal("qta_sped"), delivery_date: date("data_cons") }
      end
    end

    private

    def product
      { external_code: required("cod_art"), name: required("des_art"), base_unit: required("tipo_um"), order_unit: @row["tipo_um_ordcli"],
        pieces_per_pack: decimal("pezzi_conf", true), weight_per_pack: decimal("peso_netto_conf", true), packs_per_case: decimal("conf_collo", true),
        blocked: flag("flag_bloccato"), pack_indivisible: flag("flag_conf_non_div"), case_indivisible: flag("flag_colli_non_div"), category_code: @row["cls_fam"],
        source_fields: @row.slice("tipo_um_ordforn", "cls_linea", "cls_sett", "cls_fam", "cls_sott", "cod_linea_comm", "cod_sett_comm", "cod_fam_comm", "cod_sott_comm") }
    end

    def customer
      { external_code: required("cod_cli"), account_code: required("cod_conto"), agent_code: required("cod_agente"), parent_code: @row["cod_int"].presence,
        name: required("rag_soc"), city: @row["localita"], address: @row["indirizzo"], tax_id: @row["part_iva"], fiscal_code: @row["cod_fisc"], email: @row["e_mail"], telephone: @row["telefono"],
        blocked: flag("flag_bloccato"), bill_to: flag("flag_intest"), delivery_point: flag("flag_punto_cons"), source_fields: @row.slice("cod_giro", "cod_lis", "cod_stato") }
    end

    def required(field)
      @row.fetch(field).presence || raise(Error.new("Campo obbligatorio vuoto.", code: "MISSING_VALUE"))
    end

    def decimal(field, optional = false)
      CsvReader.decimal(@row.fetch(field), optional: optional)
    end

    def date(field)
      CsvReader.date(@row.fetch(field))
    end

    def flag(field)
      CsvReader.flag(@row.fetch(field))
    end
  end
end
