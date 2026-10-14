# Evidenze UM e prezzi — integrazione v5

## Fonte e limiti

Il 12 ottobre 2026 l'utente ha fornito una ricostruzione tecnica del sistema
WhatsApp `gastro_supply_api`, con riferimenti a `product_syncronizer_v2.rb`
(righe 90 e 160), `price_list_syncronizer.rb:41`, `browse_catalogue/unit_prices.rb:21`,
`availability_syncronizer.rb:9`, `availability_checker.rb:114`, `product.rb:470`
e `draft_v2_quantity_resolver.rb:193,469`. Questi sorgenti si trovano su un altro
computer: non sono stati ispezionati direttamente in questo repository.

La conferma riportata dall'utente viene registrata come evidenza operativa:

- `LISTINI 000.prezzo` è riferito a `ARTICOLI.tipo_um`, indipendentemente dalla UM ordinabile.
- CF, PZ e PE sono rappresentazioni separate della disponibilità rispettivamente
  in CONF, PZ e KG. Non vengono sommate né sostituite con la quantità aggregata
  del vecchio sistema, che l'utente segnala incoerente.
- `pezzi_conf` e `conf_collo` collegano CONF/PZ e COLL/CONF. Si ammettono solo
  coefficienti positivi interi e si confrontano i canali stock convertibili:
  una discordanza impedisce la quotazione. Un canale assente non viene inventato.
  Solo quando manca il canale principale si può usare un altro canale attestato,
  positivo e convertibile; zero e valori negativi non attivano questo ripiego.
- KG ammette decimali senza un passo commerciale globale. `step="any"` conserva
  fino a 12 cifre decimali, limite tecnico esplicito del protocollo esatto;
  il pulsante + aggiunge 1 KG, senza imporre multipli di 1 all'immissione manuale.

## Non attestato

Il peso anagrafico è nominale. Non prova il peso effettivo né che un prodotto sia
a peso fisso: nessuna conversione economica tra conteggio e peso viene attivata
da questa evidenza generale. È necessaria un'attestazione specifica di peso fisso
per abilitare quel collegamento. L'app non acquisisce ancora il peso di consegna.

La risposta menziona listini specifici dei punti vendita: un cliente con `cod_lis`
diverso da `000` resta consultabile, ma non viene quotato automaticamente con 000.
Non si estende la prova del prezzo 000 ai prezzi fissi di `LISTINI_PERS`; gli sconti
percentuali sul prezzo base restano applicabili, i prezzi fissi richiedono una prova
della relativa UM. Nessun listino alternativo o criterio di fallback viene inventato.

Le attestazioni sono versionate in `amelia3_unit_verifications`, separate dagli
export. Il comando `scripts/apply-amelia3-unit-evidence.rb` valida un JSON privato,
opera in dry-run per default e modifica solo il tenant nominato quando richiesto
esplicitamente. Ogni riga d'ordine conserva versione, fonte, fattori, UM e prezzo
razionale; una nuova attestazione non cambia gli ordini confermati precedenti.
