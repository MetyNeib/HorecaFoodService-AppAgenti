# Amelia3 — uso e installazione locale

Il codice è sul branch `feature/amelia3-ftp-import` del repository privato.
CSV, `.env`, database, password e screenshot commerciali non vengono caricati
su GitHub e non sono inclusi nell'immagine Docker.

## Prima installazione con dati privati

Clonare il branch e seguire il README per Docker. Copiare i nove export
autorizzati in `imports/private/amelia3/` con i nomi del manifest; nessun CSV
reale viene creato da seed o migrazioni. Preparare `.env` dalla propria copia
privata o da `.env.example` senza sovrascrivere una configurazione esistente.

```powershell
docker compose up --build -d
docker compose exec web bundle exec rails runner scripts/import-amelia3.rb --dry-run
docker compose exec web bundle exec rails runner scripts/import-amelia3.rb
docker compose exec web bundle exec rails runner scripts/provision-amelia3.rb
```

Il dry-run conserva uno staging verificato. Il secondo comando pubblica il
batch completo con un solo cambio atomico; un import ripetuto degli stessi
file riusa il batch. Export mancanti, corrotti, instabili o con riferimenti
invalidi non sostituiscono il dataset pubblicato. Un batch già superato non
può ripristinare implicitamente prezzi precedenti.

Il provisioning crea `admin@amelia3.invalid` e `agente34@amelia3.invalid` con
password casuali nel file locale `imports/private/amelia3/local_accounts.json`.
Ripeterlo conserva le password degli account esistenti. Il nome visualizzato
dell'agente viene dalla specifica approvata, l'identità dal codice `34`.
Capoarea non ha accesso. Non esiste registrazione pubblica.

## Prezzi, consegna e ordini

Listino base `000`, sconto percentuale attivo per cliente/articolo, estremi
di validità inclusivi sul calendario Europe/Rome. Il prezzo sorgente ordinabile
mantiene fino a sei decimali e lo sconto quattro; il netto effettivo conserva
tutta la precisione del calcolo. L'import rifiuta valori che PostgreSQL
arrotonderebbe durante la memorizzazione del prezzo o della percentuale.
Condizioni sovrapposte, precisione
non rappresentabile e combinazioni ambigue prezzo+sconto bloccano la riga.
Il totale viene arrotondato HALF_UP una volta per riga, ai centesimi.

Sono ordinabili soltanto le UM base/ordine entrambe `P`, usando la giacenza
`pz` intera e positiva. Confezioni e colli indivisibili impongono multipli
attestati da `pezzi_conf` e `conf_collo`. Le combinazioni K/P/L/C non verificate
restano consultabili e non confermabili. Non si sommano `cf`, `pz`, `pe`,
non si deduce un deposito e non si inventano costi o margini.

Clienti e articoli bloccati non sono ordinabili neppure via API o offline.
La destinazione deve avere `flag_punto_cons=S`, appartenere alla stessa
anagrafica autorizzata e non essere bloccata. Un collegamento `cod_int`
non concede accesso al cliente di un altro agente. Le indicazioni di pagamento
e la nota di consegna sono locali: il CSV non fornisce modalità pagamento.

Ordini e ricevute idempotenti stanno in tabelle PostgreSQL condivise. Il
creatore dell'ordine è distinto dall'agente commerciale. Admin e agente 34
vedono lo stesso UUID per i clienti autorizzati. `CONFIRMED_LOCAL` significa
salvato nel database, senza invio a ERP/FTP/email/WhatsApp. Gli import non
riscrivono prezzi salvati o ordini. Le giacenze sono una fotografia dell'export,
non una prenotazione nel gestionale.

## Offline e storico

Preparare online l'app con l'account corretto. IndexedDB usa un archivio per
utente/tenant/ruolo/portafoglio e una coda transazionale. La cache contiene
al massimo 100 clienti, 500 prodotti e 20 ordini recenti, oltre all'ordine
aperto esplicitamente. L'agente prepara tutti i propri clienti; l'Admin usa
ricerca e paginazione sul server. I prodotti preparati comprendono un campione
ordinabile, abituali, condizioni e il contesto della pagina aperta.

La copia autorizzata scade dopo 24 ore e richiede verifica online dell'account;
il rinnovo conserva prezzi e modifiche pendenti e permette la sincronizzazione.
Scadenza,
cambio account o import con prezzi nuovi conservano il lavoro pendente e
impediscono sovrascritture silenziose. Un conflitto può essere esportato e
archiviato prima di scegliere la versione del server. Logout con coda pendente
è bloccato. Con memoria browser negata i moduli HTML continuano online e non
promettono un salvataggio offline.

Storico, credito, partite e analisi vengono consultati online sul server:
50 righe per pagina, filtri e indici PostgreSQL. STORICO non viene copiato
integralmente nel browser né trasformato in nuovi ordini modificabili.
Quantità `cf/pz/pe` e `qta_sped` restano separate; frequenza e articoli abituali
descrivono le righe presenti, incluse quelle future esplicitamente segnalate.
L'ultima consegna esclude date future e quantità spedite nulle. Non si
ricostruiscono ricavi/margini; INSOLUTO non crea fatture o incassi.

## FTP e scheduler

Il worker riceve le credenziali dalla sola `.env` locale. La porta web non
riceve host/username/password FTP. Variabili operative:

```dotenv
AMELIA3_FTP_PORT=21
AMELIA3_FTP_IMPORT_DIR=/UPLOAD
AMELIA3_FTP_WRITE_ENABLED=false
AMELIA3_FTP_SYNC_ENABLED=true
AMELIA3_FTP_SYNC_CRON="5 6 * * *"
AMELIA3_FTP_TIMEZONE=Europe/Rome
```

Host, username e password si impostano soltanto nella copia privata.
FTP senza TLS è stato autorizzato: dati e password viaggiano in chiaro;
una VPN futura è raccomandata. Il connettore non contiene operazioni di
upload/delete/rename/mkdir e rifiuta l'abilitazione della scrittura.

Sidekiq controlla ogni 20 secondi l'occorrenza delle **06:05 Europe/Rome**,
con cambio ora DST e unicità per tenant/giorno. Se il PC è spento, recupera
la sola giornata corrente quando riparte. Un lock PostgreSQL impedisce import
concorrenti. Errori causano cinque retry con backoff; dopo l'esaurimento lo
stato è fallito e il dataset valido resta disponibile. Il giorno successivo
mantiene la propria esecuzione. L'heartbeat scade dopo 90 secondi se il worker
si ferma; non equivale a una promessa di funzionamento a PC spento.

Nove nomi obbligatori, SIZE/MDTM stabili prima/dopo il trasferimento, SHA-256
e validazione relazionale del batch intero. Se MDTM non è disponibile, il
contenuto viene letto due volte e confrontato. Le copie locali del download
restano private sotto `imports/private/amelia3/ftp/`; monitorare lo spazio
e conservarle/eliminarle secondo la propria politica di backup. Nessuna
cancellazione remota o eliminazione automatica dei dati dell'utente.

```powershell
docker compose exec worker bundle exec rails runner scripts/amelia3-status.rb
docker compose logs --tail=60 worker
```

Lo script restituisce soltanto stato e aggregati. La pagina Admin mostra
ultima pubblicazione, heartbeat e successi/errori. La verifica manuale
`scripts/verify-amelia3-ftp.rb` esegue un download reale in sola lettura e
un import idempotente, salvando solo metadati nel rapporto QA.

## LAN Android e Apple

Seguire [LOCAL_PWA.md](LOCAL_PWA.md): Caddy, HTTPS e CA locale sul dispositivo,
stessa rete Wi-Fi del PC. Non aprire router, tunnel o hosting pubblico.
Il PC deve essere acceso per accesso iniziale, sincronizzazione degli ordini e FTP.
Le prove su motori Chromium/WebKit e quelle su dispositivi fisici sono separate
nel [rapporto Amelia3](../qa/AMELIA3_IMPORT_REPORT.md).

## Test riproducibili

`npm.cmd run test:amelia3-prepare` azzera soltanto gli ordini del tenant
esplicitamente sintetico `amelia3-browser-qa`, poi prepara due account QA.
Non eseguirlo con l'intento di inizializzare il tenant reale. RSpec usa un
database test separato; la CI usa CSV piccoli generati con nomi sintetici,
senza credenziali o connessioni FTP reali.

```powershell
docker compose exec web bundle exec rspec
npm.cmd run test:amelia3-domain
npm.cmd run test:amelia3-prepare
npm.cmd run test:amelia3
```
