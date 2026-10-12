# HFS Rails — collaudo in corso

Data: 12 ottobre 2026. Branch `feature/hfs-rails-migration`.
Stato: **IN_PROGRESS**, nessun deploy. I report V1 restano evidenze storiche.

## PASS

- V1 completa conservata nel commit `81e72bc`, tre branch e tag su GitHub privato.
- Rails 8.1.4/Ruby 4.0.5, PostgreSQL 16, Redis 7, Devise e Sidekiq avviati in Docker.
- 94 RSpec: calcoli, dominio, autorizzazioni, transazioni, idempotenza, CSRF,
  isolamento account, versioni/epoch, conferma HTML atomica e scope server.
- 49 test originali conservati in `tests/reference-v1`; 12 test Ruby/JavaScript
  confrontano stato completo per 20 passaggi e 10 comandi invalidi.
- 20 controlli seed: SHA256 e dataset immutati.
- 7 test del checker; 72 file frontend senza pattern vietati rilevati.
- RuboCop: 50 file, zero segnalazioni. Brakeman: zero warning.
- Migrazione realmente eseguita su database vuoto isolato; schema identico.
- Build Docker, nuova installazione npm dal lockfile, npm audit zero vulnerabilità.
- HTTPS locale con CA esplicita: HTTP 200 e TLS verificato; trust del PC invariato.
- Tre flussi completi desktop: manuale, tre casi WhatsApp, clienti/condivisioni/insight.
- Prima suite PWA Chromium: offline reale, conflitto/reset, sessione scaduta,
  risposta persa dopo commit, quota atomica e logout/pulizia: 6/6 PASS.

## IN_PROGRESS / FAIL da risolvere

- Matrice finale UI: 20 test su quattro viewport, 88 schermate e relativi screenshot.
- Matrice PWA finale: 26 test Chromium/WebKit. La regressione upstream Playwright
  1.63 è stata isolata e risolta passando a 1.64: riproduzione indipendente 4/4 PASS.
  Dettagli in [WEBKIT_OFFLINE_AUDIT](rails/WEBKIT_OFFLINE_AUDIT.md).
- Recupero archivio IndexedDB corrotto, memoria negata, due tab, token CSRF,
  risposta persa e aggiornamento shell: sette test mirati Chromium PASS; ripetizione
  nella suite finale su entrambi i motori in corso.
- Asset Rails compilati in modalità production in container senza rete: PASS,
  39 file pubblici senza riferimenti privati noti. Nessun server production avviato.
- CI GitHub checkpoint: Ruby/migrazioni, regole, stile e sicurezza PASS; browser
  da ripetere sul commit aggiornato e sul commit finale di consegna.

## NOT_RUN

- Installazione su dispositivi Android/iPhone/iPad fisici e trust della CA su tali
  dispositivi; la prova browser non li sostituisce.
- Installazione Docker su un secondo PC/Mac fisico.
- Import di dati reali cliente, previsto dopo il refactor.
- Deploy server, invii business e integrazioni reali: fuori dallo scope autorizzato.

Avvio e credenziali locali: [README](../README.md). Decisioni e limiti:
[RAILS_MIGRATION](../docs/RAILS_MIGRATION.md). Prova su dispositivi:
[LOCAL_PWA](../docs/LOCAL_PWA.md). Evidenze correnti in `qa/rails-ui` e `qa/rails`;
durante il collaudo i file JSON vengono aggiornati anche con gli esiti falliti.
