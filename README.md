# Horeca Food Service — App Agenti

Riscrittura in **Rails 8.1, Ruby 4, Ralix, PostgreSQL e Devise**. Mantiene il seed sintetico e i flussi HFS: ordine manuale, FastOrder WhatsApp, bozze/coda/storico, clienti, partite, catalogo e insight. Il backend salva realmente i dati; gli invii commerciali WhatsApp/email/PDF ed ERP restano simulati.

Branch corrente: `feature/hfs-rails-migration`. La V1 React completa è conservata su `main`, `v1-react` e tag `v1.0.0-react` (commit `81e72bc`). Nessun deploy pubblico. Lo stato del collaudo Rails è in [docs/PROGRESS.md](docs/PROGRESS.md).

## Installazione locale su un altro computer

Occorrono Git e Docker Desktop avviato con container Linux. Su Windows serve WSL2; su Mac scegliere Docker Desktop per il proprio processore. L'account GitHub deve avere accesso al repository privato. Non occorrono Ruby o PostgreSQL installati globalmente, né una chiave OpenAI.

```powershell
git clone --branch feature/hfs-rails-migration https://github.com/MetyNeib/HorecaFoodService-AppAgenti.git
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
```

La CI verifica regole CSS/JS/ERB, seed, dominio, migrazioni da database vuoto, RSpec, RuboCop e Brakeman. Gli esiti storici React nei report QA non certificano la nuova versione Rails. I report Rails distinguono PASS, FAIL e NOT_RUN.

## Struttura e dati

- `app/controllers`, `app/views`, `app/helpers`: pagine ERB e comandi autenticati.
- `app/services/hfs`: regole di dominio, calcoli in centesimi, snapshot e idempotenza.
- `app/models`, `db`: utenti, workspace PostgreSQL, ricevute dei comandi e migrazioni.
- `app/javascript`: controller Ralix, IndexedDB e proiezione offline.
- `app/assets/stylesheets`, `vendor/javascript`: CSS e librerie servite localmente.
- `src/data/hfs_demo_data.json`: seed approvato immutato.
- `docs`, `references`, `fixtures`, `qa`: specifiche e verifiche, escluse dagli asset pubblici.

Il clock dimostrativo resta il 22 settembre 2026 alle 09:30, agente Marco Rossi, otto clienti assegnati. I dati reali di un cliente saranno importati in una fase successiva documentata in [docs/RAILS_MIGRATION.md](docs/RAILS_MIGRATION.md); non vanno inseriti nel repository. Questa base usa un workspace JSONB atomico per utente: le scelte e i limiti di concorrenza sono descritti nello stesso documento.

