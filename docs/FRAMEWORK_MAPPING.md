# Applicazione del framework allegato

Fonte: `regole_progetti_delmar.zip`, letto come materiale tecnico di riferimento.
Le istruzioni operative e le funzioni specifiche dell'altro progetto non sono
autorizzazioni per HFS. Le scelte esplicite dell'utente prevalgono.

| Indicazione del framework | Applicazione HFS |
|---|---|
| Rails/Ruby, PostgreSQL, Devise | Ruby 4.0.5, Rails 8.1.4, PostgreSQL 16, login individuale |
| Ralix e importmap | Controller per area, helper Ralix, asset npm vendorizzati localmente |
| ERB e componenti riusabili | Partial per quantità, liste, carrello, dialog e schede |
| Nessun markup costruito in JS | Template ERB pubblici e vuoti clonati anche offline |
| CSS separato e proprietà per riga | CSS V1 portato preservando le regole, adattatori form separati |
| Test e controlli | RSpec, Playwright, RuboCop omakase, Brakeman, checker CSS/JS/ERB |
| Database e migrazioni riproducibili | Migrazione da zero verificata, schema generato e lockfile reali |
| Docker, Redis, Sidekiq | Servizi locali, porte host 3002/5433/6380; worker pronto |
| Localizzazione | Interfaccia italiana, Rails i18n e locale Devise |
| Commit e pubblicazione | Push privato autorizzato dall'utente; nessun deploy server |

Non vengono importati sidebar, AI Marina, FTP, prodotti ittici, prezzi speciali o
integrazioni del progetto Del Mar. HFS conserva navigazione, layout e contratto
dei dati propri. La registrazione Docker/GitHub riguarda l'ambiente, non l'app.

Il checker dello ZIP è copiato in `scripts/check_project_rules.cjs` con i suoi
test. È corretto un falso positivo: la variabile Ruby `online =` dentro ERB non è
un attributo HTML `onclick`; un test mantiene vietati gli attributi inline anche
quando contengono espressioni ERB. Nessuna esclusione di moduli applicativi.

Il file watcher in sviluppo usa `FileUpdateChecker`: durante le prove reali sul
bind mount Windows, le viste modificate restavano obsolete con il watcher a
eventi nonostante il polling dichiarato. La scelta privilegia il ricaricamento
affidabile; può aumentare il tempo delle richieste in sviluppo e non riguarda
la modalità production.

Le dipendenze sono nel lockfile effettivamente risolto. Devise gestisce sessioni
e password; pg/Redis/Sidekiq lo stack richiesto; Propshaft/importmap gli asset;
RSpec/RuboCop/Brakeman i controlli. Nessun framework UI pesante o CDN a runtime.
L'architettura offline, il workspace JSONB e il futuro import cliente sono
documentati in [RAILS_MIGRATION.md](RAILS_MIGRATION.md).
