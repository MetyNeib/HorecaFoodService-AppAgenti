# Horeca Food Service — App Agenti

Riscrittura in **Rails 8.1, Ruby 4, Ralix, PostgreSQL e Devise**. Mantiene il seed sintetico e i flussi HFS: ordine manuale, FastOrder WhatsApp, bozze/coda/storico, clienti, partite, catalogo e insight. Il backend salva realmente i dati; gli invii commerciali WhatsApp/email/PDF ed ERP restano simulati.

Rails è su `main` dopo la [PR #1](https://github.com/MetyNeib/HorecaFoodService-AppAgenti/pull/1). Il branch `feature/amelia3-ftp-import` aggiunge l'integrazione Amelia3 approvata: dati commerciali condivisi, Admin e agente **34**, storico PostgreSQL, ordini locali e FTP in sola lettura alle **06:05 Europe/Rome**. La V1 React è conservata su `v1-react` e tag `v1.0.0-react` (commit `81e72bc`). Nessun deploy pubblico. Esiti in [qa/AMELIA3_IMPORT_REPORT.md](qa/AMELIA3_IMPORT_REPORT.md).

## Amelia3 sul computer già configurato

Aprire **http://127.0.0.1:3002/amelia3** e accedere come `admin@amelia3.invalid`
oppure `agente34@amelia3.invalid`. Le password casuali sono nel solo file locale
`imports/private/amelia3/local_accounts.json`, escluso da Git. Admin e agente
condividono gli stessi ordini autorizzati; la conferma salva nel database e non
trasmette nulla al gestionale. Il seed HFS rimane accessibile con il suo account
dimostrativo separato.

Il worker deve restare acceso per l'import quotidiano. Se Docker riparte dopo
le 06:05, recupera l'esecuzione della giornata una volta sola. La pagina
**Sincronizzazione dati**, riservata all'Admin, mostra heartbeat, import ed errori.
Per installazione con dati privati, diagnostica e limiti delle UM seguire
[docs/AMELIA3_LOCAL.md](docs/AMELIA3_LOCAL.md).

## Installazione locale su un altro computer

Occorrono Git e Docker Desktop avviato con container Linux. Su Windows serve WSL2; su Mac scegliere Docker Desktop per il proprio processore. L'account GitHub deve avere accesso al repository privato. Non occorrono Ruby o PostgreSQL installati globalmente, né una chiave OpenAI.

```powershell
git clone --branch feature/amelia3-ftp-import https://github.com/MetyNeib/HorecaFoodService-AppAgenti.git
cd HorecaFoodService-AppAgenti
docker compose up --build -d
```

Aprire **http://127.0.0.1:3002/**. Il primo avvio scarica le immagini, installa le gemme e prepara database e account dimostrativo:

- Email: `agente@hfs.invalid`
- Password locale dimostrativa: `HfsDemoLocale2026!`

Sono credenziali pubbliche del solo seed sintetico. Per personalizzarle prima del primo avvio copiare `.env.example` in `.env`; un database già inizializzato conserva gli account e i dati. La porta web è configurabile con `HFS_PORT`. Ogni installazione Docker su un altro PC crea un database indipendente: per condividere gli stessi ordini, i dispositivi devono collegarsi allo stesso backend locale.

```powershell
docker compose logs --tail=60 web
docker compose stop
docker compose up -d
```

`stop` conserva PostgreSQL e gli ordini. Il reset nell'app ripristina soltanto il workspace demo dell'utente connesso; non elimina account o dati di altri utenti. Non usare `docker compose down -v` per un normale arresto: elimina i volumi dati.

## Installazione come app e offline

Aprire l'app online e accedere per preparare catalogo, clienti e copia locale. È possibile installarla dalla funzione del browser. Android e iPhone/iPad richiedono HTTPS riconosciuto quando accedono al PC tramite rete locale: seguire [docs/LOCAL_PWA.md](docs/LOCAL_PWA.md). Docker sul telefono non serve.

L'offline essenziale conserva clienti/catalogo già scaricati, creazione e modifica degli ordini e una coda in IndexedDB. Al ritorno della connessione, con app aperta, le modifiche vengono inviate a Rails una sola volta. I conflitti sono espliciti e il lavoro locale viene conservato. FastOrder, condivisioni e analisi richiedono il collegamento al backend. La simulazione «Passa online/offline» del footer riguarda il gestionale dimostrativo; lo stato della connessione a Rails è separato.

Ogni utente ha dati e coda separati. Logout con modifiche da sincronizzare richiede di gestirle prima; cancellare i dati del browser può eliminare lavoro solo locale. L'app non promette sincronizzazione in background a browser chiuso su ogni OS.

## Sviluppo e controlli

L'app viene eseguita interamente da Docker. Node 22.12+ sul computer serve soltanto per tooling, test browser e rigenerazione delle librerie JS vendorizzate.

```powershell
npm.cmd ci
npm.cmd run vendor:javascript
npm.cmd run validate:data
npm.cmd test
npm.cmd run test:domain-parity
npm.cmd run test:amelia3-domain
npm.cmd run check:rules
docker compose exec web bundle exec rspec
docker compose exec web bundle exec rubocop
docker compose exec web bundle exec brakeman --no-pager
```

Per Playwright su Windows:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.playwright-browsers'
npx.cmd playwright install chromium webkit
npm.cmd run test:e2e
npm.cmd run test:amelia3-prepare
npm.cmd run test:amelia3
```

La CI verifica regole CSS/JS/ERB, seed, dominio, migrazioni da database vuoto, RSpec, RuboCop, Brakeman, i flussi UI nei quattro viewport e l'offline Chromium/WebKit. Gli esiti storici React nei report QA non certificano la nuova versione Rails. I report Rails distinguono PASS, FAIL e NOT_RUN. Le schermate sono consultabili nella [galleria Rails](qa/rails-ui/screenshots/index.html).

## Struttura e dati

- `app/controllers`, `app/views`, `app/helpers`: pagine ERB e comandi autenticati.
- `app/services/hfs`: regole di dominio, calcoli in centesimi, snapshot e idempotenza.
- `app/models`, `db`: utenti, workspace PostgreSQL, ricevute dei comandi e migrazioni.
- `app/javascript`: controller Ralix, IndexedDB e proiezione offline.
- `app/assets/stylesheets`, `vendor/javascript`: CSS e librerie servite localmente.
- `src/data/hfs_demo_data.json`: seed approvato immutato.
- `tests/reference-v1`: helper puri originali conservati solo per i test di confronto; nessun runtime React.
- `docs`, `references`, `fixtures`, `qa`: specifiche e verifiche, escluse dagli asset pubblici.

Il clock del solo seed dimostrativo resta il 22 settembre 2026 alle 09:30, agente
Marco Rossi, otto clienti assegnati. Amelia3 usa il calendario reale Europe/Rome,
tabelle commerciali condivise per tenant e revisioni per ordine; i dati privati
non vengono distribuiti con il codice. Il workspace JSONB per utente riguarda
soltanto la demo sintetica. Decisioni in [docs/RAILS_MIGRATION.md](docs/RAILS_MIGRATION.md).

