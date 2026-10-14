# Amelia3 v5 — esercizio locale e limiti verificati

La base V5 deriva da `223a2312172a6a2d83cb19012abf908adef2357b` ed è identificata
dal tag `amelia3-demo-baseline-20261014`. L'utente ha autorizzato il salvataggio
del codice revisionato sul repository pubblico e il nuovo branch
`feature/amelia3-demo-polish`. Main resta invariato. Per il ripristino completo
su Mac e il lavoro successivo vedere [MAC_HANDOFF](MAC_HANDOFF.md).

Collaudo locale concluso: 163 RSpec, 15 test dominio/service worker e 70
verifiche browser sui dati reali PASS. I 60 scenari Amelia3 hanno esiti PASS
tra matrice iniziale e ripetizioni mirate; vedere il report per la traccia dei
FAIL corretti. Dopo `assets:precompile` riavviare il servizio `web`: il processo
Rails può conservare il vecchio manifest in memoria.

## Interfaccia e dati

Aprire `http://127.0.0.1:3002/amelia3`. Il drawer con logo originale contiene Home,
Nuovo ordine, I miei ordini, Ordini WhatsApp, Clienti, Catalogo, Alert di vendita.
La schermata WhatsApp è un placeholder esplicito. Il dettaglio connessione mostra
raggiungibilità Rails, coda, recupero locale e import; il dettaglio FTP è riservato
all'Admin. Non esistono reset o interruttori di rete simulata in Amelia3.

I miei ordini separa Bozze, Confermati localmente e Storico. Lo storico raggruppa
per cliente e riferimento, con 20 ordini per pagina, filtri e dettaglio originale.
Le liste usano riepiloghi derivati, senza aggregare un milione di righe a ogni
richiesta; le quantità e le righe ripetute restano nel dettaglio in sola lettura.
Gli ordini confermati non sono stati trasmessi a ERP, FTP, email o WhatsApp.

La PWA conserva gli ordini locali e i dati preparati nell'archivio del relativo
utente/tenant/ruolo/portafoglio. Storico e alert richiedono il server. Le quote
offline usano gli stessi rapporti razionali del backend; aggiornamenti dei dati
o delle attestazioni preservano le operazioni pendenti e richiedono riconciliazione
quando cambia il contratto. Non è promesso il sync con browser completamente chiuso.

## Unità e attestazioni

La mappa certificata è P=PZ, C=CONF, K=KG, L=COLL. La prima scelta deriva da
`tipo_um_ordcli`; la UM base si aggiunge solo se differente ed entrambi i flag di
indivisibilità sono falsi. Il catalogo seleziona solo prodotti e UM quotabili,
escludendo anche segnaposto generici come ARTICOLO VARIO. Una sola UM appare
come testo, più UM verificate come selettore. Gli originali sono conservati.

La [risposta tecnica dell'utente](amelia3/V5_UNIT_EVIDENCE.md) attesta il prezzo 000
per `tipo_um`, i campi CF/PZ/PE separati e le relazioni di conteggio. I KG hanno
`step="any"`: fino a 12 decimali nel protocollo, nessun multiplo commerciale
globale. Il peso nominale non abilita conversioni economiche di merce a peso
variabile. La verifica esatta usa il prezzo originale e arrotonda HALF_UP solo
il totale di riga. CF/PZ/PE non vengono mai sommati; canali convertibili discordanti
bloccano la proposta. Fonte, versione, UM, rapporti e prezzo esatto sono salvati
nell'ordine. Una modifica delle evidenze non riscrive gli ordini confermati.

Gli export non forniscono `cod_lis` per i 16 clienti dell'agente 34 in questo batch.
Un futuro cliente con listino diverso da 000 richiederà la relativa regola:
non verrà servito automaticamente con 000. Anche l'UM dei prezzi fissi personali
richiede prova separata; gli sconti percentuali validi sul listino verificato sono
già supportati. Le attestazioni non vengono ricavate da semplici uguaglianze numeriche.

Per applicare un JSON privato di attestazioni revisionate:

```powershell
docker compose exec -e AMELIA3_EVIDENCE_FILE=/app/imports/private/amelia3/verification-v5/user-source-evidence.json web bin/rails runner scripts/apply-amelia3-unit-evidence.rb
docker compose exec -e AMELIA3_EVIDENCE_FILE=/app/imports/private/amelia3/verification-v5/user-source-evidence.json -e AMELIA3_APPLY_EVIDENCE=true web bin/rails runner scripts/apply-amelia3-unit-evidence.rb
```

Il primo comando è dry-run; il secondo pubblica le attestazioni validate nel
tenant nominato nel JSON, conservando le precedenti versioni e incrementando la
revisione. Per file corretti ripetuti l'applicazione è idempotente. Il JSON corrente
resta privato. Il modello documenta campi richiesti e vincoli; nessuna prova di
peso fisso è inclusa nell'attestazione generale corrente.

## Alert e scheduler

Regole `HFS-AMELIA3-SALES-ALERTS-REACTIVATION-90D-v2`, calendario Europe/Rome.
Oltre 90 giorni dall'ultima consegna positiva, anche oltre i 12 mesi, il cliente
è «Da riattivare» ed escluso dai tre alert ordinari. La sezione dedicata include
anche clienti bloccati, sempre non ordinabili. Badge in lista/scheda e offline;
assenza di storico non equivale a inattività provata. Per gli alert ordinari si considerano
solo spedizioni positive in `[D.prev_year, D)`, clienti non bloccati e date
distinte. Clienti fermi: almeno quattro date e 45 giorni di osservazione, soglia
`max(21, ceil(2,5 × mediana intervalli))`. Sopprimono gli altri due tipi.
Prodotti mancanti: almeno cinque date in due mesi, altro acquisto cliente
successivo, ultimo entro 180 giorni, soglia `max(30, ceil(2,5 × mediana))`, massimo
cinque per cliente e nessun articolo bloccato. Frequenza in calo: almeno nove
giornate in `[D-240,D-60)`, almeno una recente, frequenza recente non superiore
alla metà dell'attesa e diminuzione assoluta almeno due giornate.

Il riepilogo conserva date compatte e firme del multinsieme degli eventi per
cliente, indipendenti da ordine del CSV e numero riga. Duplicati, correzioni ed
eliminazioni cambiano la firma. SQL raggruppa correttamente anche file futuri
non contigui per cliente. Lo SHA invariato di STORICO riusa i profili; ogni nuova
data rivaluta a costo ridotto le finestre senza rileggere lo storico completo.
Anagrafiche, blocchi e assegnazioni correnti regolano calcolo e visibilità.

Lo stesso scheduler Sidekiq dell'FTP aggiunge le **06:30 Europe/Rome** dopo il
successo FTP delle **06:05** del giorno sul batch attivo; un export invariato è
valido. Attesa/retry ogni 15 minuti, al massimo otto tentativi, recupero del lease
di job interrotti dopo 30 minuti. Un lock condiviso con l'import evita calcoli su
staging parziale. Il logical run è unico per tenant/data/batch/versione regole;
un nuovo batch nello stesso giorno può produrre un nuovo risultato. Se l'import
fallisce si conserva l'ultimo calcolo, mostrando dati non aggiornati.

La lista interroga solo alert pubblicati: dieci per pagina con mix 4/4/2 e
redistribuzione deterministica, filtri prima della paginazione, `run_id` stabile.
Le risoluzioni sono automatiche; nessun comando di silenziamento o gestione manuale.
I link WhatsApp del popup contatti sono individuali, senza testo precompilato né
invio automatico; l'esistenza del numero su WhatsApp non è certificata.

```powershell
docker compose exec web bin/rails db:migrate
docker compose exec web bin/rails runner scripts/prepare-amelia3-history.rb
docker compose exec web bin/rails runner scripts/benchmark-amelia3-alerts.rb
docker compose restart worker
docker compose exec worker bin/rails runner scripts/amelia3-status.rb
```

I runner di preparazione/benchmark sono limitati al development locale. Il primo
calcolo locale è esplicitamente autorizzato senza pretendere un nuovo FTP live.
Il benchmark confronta alert attivi, risolti, evidenze, severità e ordinamento;
stampa solo aggregati. Per modifiche alle regole o alla normalizzazione occorre
incrementare le relative costanti di versione, senza riusare firme incompatibili.

## Collaudo e riservatezza

Vedere [rapporto v5](../qa/AMELIA3_V5_REPORT.md) per esiti finali e distinzione tra
IMPLEMENTATO, TESTATO e DA VERIFICARE. I report pubblicabili contengono aggregati
e schermate del solo tenant sintetico. I campioni, la parità con quotazioni reali
e le schermate dei clienti reali stanno sotto `imports/private/amelia3/verification-v5/`.
CSV, backup, credenziali, IndexedDB, cache commerciali e screenshot reali non
appartengono a Git, Docker build context o asset pubblici.

Android/iOS fisici richiedono la procedura HTTPS/CA di [LOCAL_PWA](LOCAL_PWA.md):
le prove Chromium/WebKit non certificano installazione e comportamento su hardware.
Nessun tunnel, apertura router, deploy pubblico o scrittura FTP fa parte di questa v5.
