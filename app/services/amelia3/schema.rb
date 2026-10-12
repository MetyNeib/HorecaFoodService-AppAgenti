module Amelia3
  class Schema
    HEADERS = {
      "ARTICOLI.csv" => %w[cod_art des_art tipo_um pezzi_conf peso_netto_conf flag_bloccato cls_linea cls_sett cls_fam cls_sott conf_collo tipo_um_ordcli tipo_um_ordforn flag_conf_non_div flag_colli_non_div cod_linea_comm cod_sett_comm cod_fam_comm cod_sott_comm],
      "CLIENTI.csv" => %w[cod_cli cod_conto rag_soc part_iva cod_fisc localita indirizzo flag_intest flag_punto_cons cod_int cod_stato e_mail telefono cod_giro flag_bloccato cod_lis cod_agente des_age telefono_age email_age cod_care des_care],
      "FIDO.csv" => %w[cod_cli valore_fido residuo_fido],
      "GIACENZE.csv" => %w[cod_art esistenza_att_cf esistenza_att_pz esistenza_att_pe],
      "INSOLUTO.csv" => %w[cod_conto nr_partita nr_rif data_rif data_scad tot_rata],
      "LISTINI.csv" => %w[cod_lis cod_art prezzo],
      "LISTINI_PERS.csv" => %w[cod_cli cod_art da_data a_data prezzo sconto perc_provv],
      "STORICO.csv" => %w[rif_ord_interno cod_cli cod_art qta_ord_cf qta_ord_pz qta_ord_pe qta_sped data_cons],
      "TABGIR.csv" => %w[cod_giro des_giro cod_cli giorno_sett]
    }.freeze
    ENCODINGS = {
      "ARTICOLI.csv" => "Windows-1252",
      "CLIENTI.csv" => "Windows-1252",
      "FIDO.csv" => "bom|UTF-8",
      "GIACENZE.csv" => "bom|UTF-8",
      "INSOLUTO.csv" => "bom|UTF-8",
      "LISTINI.csv" => "bom|UTF-8",
      "LISTINI_PERS.csv" => "bom|UTF-8",
      "STORICO.csv" => "bom|UTF-8",
      "TABGIR.csv" => "bom|UTF-8"
    }.freeze
  end
end
