require "csv"
require "tmpdir"

module Amelia3Fixture
  def csv_fixture
    directory = Dir.mktmpdir("hfs-amelia3-fixture-")
    data = {
      "ARTICOLI.csv" => [ { "cod_art" => "P001", "des_art" => "Prodotto sintetico P", "tipo_um" => "P", "tipo_um_ordcli" => "P", "tipo_um_ordforn" => "P", "pezzi_conf" => "10", "peso_netto_conf" => "1", "conf_collo" => "2", "flag_bloccato" => "N", "flag_conf_non_div" => "N", "flag_colli_non_div" => "N" },
                          { "cod_art" => "K001", "des_art" => "Prodotto sintetico senza conversione", "tipo_um" => "K", "tipo_um_ordcli" => "L", "tipo_um_ordforn" => "K", "pezzi_conf" => "1", "peso_netto_conf" => "1", "conf_collo" => "1", "flag_bloccato" => "N", "flag_conf_non_div" => "N", "flag_colli_non_div" => "N" } ],
      "CLIENTI.csv" => [ { "cod_cli" => "C001", "cod_conto" => "A001", "rag_soc" => "Cliente sintetico uno", "flag_intest" => "S", "flag_punto_cons" => "S", "flag_bloccato" => "N", "cod_agente" => "34" },
                         { "cod_cli" => "C002", "cod_conto" => "A002", "rag_soc" => "Cliente sintetico bloccato", "flag_intest" => "S", "flag_punto_cons" => "S", "flag_bloccato" => "S", "cod_agente" => "34" },
                         { "cod_cli" => "C003", "cod_conto" => "A003", "rag_soc" => "Cliente sintetico esterno", "flag_intest" => "S", "flag_punto_cons" => "S", "flag_bloccato" => "N", "cod_agente" => "99" } ],
      "FIDO.csv" => [ { "cod_cli" => "C001", "valore_fido" => "1000", "residuo_fido" => "-5" } ],
      "GIACENZE.csv" => [ { "cod_art" => "P001", "esistenza_att_cf" => "10", "esistenza_att_pz" => "100", "esistenza_att_pe" => "10" },
                          { "cod_art" => "K001", "esistenza_att_cf" => "10", "esistenza_att_pz" => "10", "esistenza_att_pe" => "10" } ],
      "INSOLUTO.csv" => [ { "cod_conto" => "A001", "nr_partita" => "R001", "nr_rif" => "DOC-SYNTHETIC", "data_rif" => "", "data_scad" => "01/10/2026", "tot_rata" => "12.340000000000002" } ],
      "LISTINI.csv" => [ { "cod_lis" => "000", "cod_art" => "P001", "prezzo" => "1.23456" }, { "cod_lis" => "000", "cod_art" => "K001", "prezzo" => "5" } ],
      "LISTINI_PERS.csv" => [ { "cod_cli" => "C001", "cod_art" => "P001", "da_data" => "01/01/2020", "a_data" => "31/12/2099", "prezzo" => "", "sconto" => "3.5", "perc_provv" => "0" } ],
      "STORICO.csv" => [ { "rif_ord_interno" => "SYNTHETIC-ORDER-1", "cod_cli" => "C001", "cod_art" => "P001", "qta_ord_cf" => "1", "qta_ord_pz" => "10", "qta_ord_pe" => "1", "qta_sped" => "10", "data_cons" => "01/10/2026" },
                         { "rif_ord_interno" => "SYNTHETIC-ORDER-2", "cod_cli" => "C003", "cod_art" => "K001", "qta_ord_cf" => "1", "qta_ord_pz" => "1", "qta_ord_pe" => "1", "qta_sped" => "0", "data_cons" => "02/10/2026" } ],
      "TABGIR.csv" => [ { "cod_giro" => "SYNTHETIC-ROUTE", "des_giro" => "Giro sintetico", "cod_cli" => "C001", "giorno_sett" => "2" } ]
    }
    Amelia3::Schema::HEADERS.each do |name, fields|
      text = CSV.generate(col_sep: ";") do |csv|
        csv << [ *fields, nil ]
        data.fetch(name).each { |row| csv << [ *fields.map { |field| row[field] || "" }, nil ] }
      end
      encoding = Amelia3::Schema::ENCODINGS[name] == "Windows-1252" ? "Windows-1252" : "UTF-8"
      File.binwrite(File.join(directory, name), (encoding == "UTF-8" ? "\uFEFF" : "") + text.encode(encoding))
    end
    directory
  end

  def commercial_fixture
    tenant = Amelia3::Tenant.create!(code: "amelia3-qa-#{SecureRandom.hex(4)}", name: "Amelia3 QA sintetica")
    directory = csv_fixture
    batch = Amelia3::Importer.call(tenant: tenant, directory: directory)
    agent = User.create!(email: "agent-#{SecureRandom.hex(4)}@example.invalid", password: "TestHfsLocale2026!", dataset_mode: "amelia3", role: "agent", agent_id: "34", commercial_tenant: tenant, display_name: "Agente sintetico 34")
    admin = User.create!(email: "admin-#{SecureRandom.hex(4)}@example.invalid", password: "TestHfsLocale2026!", dataset_mode: "amelia3", role: "admin", agent_id: "AMELIA3-ADMIN", commercial_tenant: tenant, display_name: "Admin sintetico")
    { tenant: tenant, batch: batch, agent: agent, admin: admin, directory: directory }
  end
end
