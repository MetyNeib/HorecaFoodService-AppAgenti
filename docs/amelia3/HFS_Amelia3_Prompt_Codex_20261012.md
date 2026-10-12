# Codex — Esecuzione autonoma integrazione Amelia3 v3 (13/10/2026)

**Obiettivo:** trasformare la base Rails HFS in una demo reale per il distributore Amelia3, con Admin e Agente codice **34 — Sophia Buzzicotti** realmente operativi, DB commerciale condiviso, ordini persistenti **mai trasmessi** a ERP/FTP/WhatsApp/email, storico e insight su fatti misurabili e sincronizzazione remota FTP **attiva** ogni giorno alle **06:05 Europe/Rome**.

## Fonti, limiti e materiale pronto

Repo privato `MetyNeib/HorecaFoodService-AppAgenti`. Fotografia GitHub verificata 12/10/2026: Rails `feature/hfs-rails-migration` SHA `3b15948d1d7f92c964c89619c93f06df715e438e`, `main` SHA `81e72bcabd9bbe6933cde8d52b5f0460f4a97a4f`, Rails ahead 6/behind 0, nessuna PR aperta, ultima CI applicativa PASS sul commit `fbbaeec6d47e0cafcfc4011e6587f93ef673c3a0`. **Verifica di nuovo SHA/working tree/PR/CI prima di operare.**

Allegati handoff già elaborati: `HFS_Amelia3_Piano_Operativo_20261012.md`, `HFS_Amelia3_Mappa_Codex_20261012.md`, `HFS_Amelia3_Manifest_Codex_20261012.json`. Consultali e non ripetere un preflight di un milione di righe se hash e schema coincidono. Leggi poi `AGENTS.md`, README, `docs/RAILS_MIGRATION.md`, `docs/PROGRESS.md`, `docs/LOCAL_PWA.md` e codice interessato. Stack Rails 8.1/Ruby 4, PostgreSQL, Devise, Ralix, Sidekiq, PWA: **non ricostruirlo**. Il seed HFS sintetico deve rimanere byte-identico e funzionante. Regole dello ZIP Del Mar solo con adattamenti pertinenti, mai logiche applicative importate automaticamente.

I CSV veri sono stati copiati sul PC in `imports/private/amelia3/` e sono ignorati da Git. I nove file hanno i nomi del manifest, incluso `TABGIR.csv` (equivalente byte per byte al `TABGIR(1).csv` allegato in chat). Verifica SHA-256 dei file locali prima di usare i conteggi; export FTP più recenti avranno hash legittimamente diversi. Non inserire file reali, password, nominativi clienti o righe dati in Git/report. Nel pacchetto non sono presenti credenziali o numeri di telefono.

## M0 — PROMUOVI TU RAILS SU MAIN, POI CREA IL BRANCH

**Autorizzazione esplicita dell’utente per Codex**: esegui autonomamente la promozione Rails da `feature/hfs-rails-migration` a `main` tramite PR, verifica CI/assenza conflitti e completa il merge non forzato. Dopo il merge aggiorna `main` locale e crea `feature/amelia3-ftp-import`; committa e, se necessari alla PR/CI, esegui push privati relativi alla task. Non cambiare o cancellare `v1-react`, tag `v1.0.0-react`, altri branch o dati. Non fare `--force`/force-push, merge con CI rossa, bypass protezioni, deploy o apertura Internet. Se lo stato remoto è mutato, rivaluta prima di agire. In presenza di blocchi di permessi obbligatori, richiedi solo l'intervento umano necessario e documenta il checkpoint, non fermarti per domande evitabili. Aggiorna successivamente `AGENTS.md`/README per il branch operativo reale.

## M1 — Preflight ambiente locale e import file campione

L’utente dichiara Docker CLI ora accessibile dalla cartella progetto `C:\HorecaFoodService-AppAgenti`; verifica con comandi effettivi `docker compose version`, `docker info`, `docker compose config --quiet` prima dei test Rails. Non cancellare volumi. `.env` locale già presente e ignorato da Git, con FTP import `/UPLOAD`, sync abilitata, orario `06:05 Europe/Rome`, scrittura disabilitata e credenziali. Non stamparlo, non rivelare password né spostare segreti in codice. Verifica i nomi delle chiavi di configurazione dello scheduler senza presumere gli esatti nomi dalle risposte in chat. Il `compose.yml` attuale non inoltra le variabili FTP: applica minimo wiring sicuro per worker/job.

Implementa parsing CSV robusto con staging/dry-run, rollback su errore, checksum, upsert idempotente e compatibilità encoding/anomalie descritti nella mappa. Non caricare STORICO o tutti i clienti in un unico workspace JSONB/browser. Non creare contenuti demo reali in migration/seed. Conserva il seed sintetico. Crea un dataset autorevole Amelia3 con relazioni/codici esterni stringa. Ripeti due volte l’import locale e riconcilia gli esiti senza duplicati.

## M2 — Due account e ordine locale coerente

Crea **Admin Amelia3** (accesso a tutti i clienti del tenant) e **Agente codice `34`** (soltanto i propri clienti). Dal CSV `CLIENTI.csv`, `cod_agente=34` identifica Sophia Buzzicotti: **16 clienti, di cui 12 `flag_bloccato=N` e 4 `flag_bloccato=S`**. **Non utilizzare l’agente precedente codice 7**, non identificare per nome/telefono e non mettere telefono in sorgenti o report. Capoarea è un ruolo futuro da predisporre con deny-by-default: la gerarchia CSV non è attendibile per attivarlo ora.

L’attuale `User` valida solo AG-014, `Hfs::Snapshot` scopa per user/agente, `Hfs::Domain` usa orologio demo e flag `synthetic`, `Hfs::Commands` persiste per workspace JSONB. Non creare copie mutable per Admin e Agente: implementa minima persistenza autorevole condivisa (incl. ordini) e autorizzazioni server-side rigorose su letture, URL diretti, mutazioni, API, snapshot e cache IndexedDB. Distingui creatore ordine dall’agente commerciale di riferimento; un ordine dell’Admin per cliente dell’Agente 34 deve risultare visibile a entrambi in base ai permessi, senza duplicazione. `RESET_DEMO` non deve toccare Amelia3.

Listino **`000`** e sconti `LISTINI_PERS` validi; prezzi, UM e disponibilità rigorosamente attestati. Non inventare conversioni per K/P/L/C o sommare a caso stock cf/pz/pe. Bloccati visibili ma NON ordinabili anche da API/offline. Senza costo di acquisto non inventare margini. Gli ordini confermati sono **salvati nel DB ma mai inviati all'ERP**; niente falsa etichetta “SENT al gestionale”. Mantieni idempotenza, snapshot prezzi e protezione da import successivi.

## M3 — Storico e insight reali

STORICO ~1.036.814 righe: import streaming/chunk, indici/aggregati e query filtrate/paginate server-side; analisi quantità, frequenza, articoli abituali e ultima consegna. Per Agente 34 il campione contiene **2.237 righe, 606 ordini storici distinti, 447 articoli distinti**: usarli come controlli. Nessun prezzo/totale nello STORICO: non calcolare fatturato o margine storico. FIDO/INSOLUTO non autorizzano creazione di fatture o pagamenti inesistenti. Misura risposta, ricerca e consumo memoria PWA; non distribuire un dump massivo.

## M4 — FTP LIVE E SYNC AUTOMATICA ATTIVA DAL PRIMO RILASCIO

**Il cliente ha esplicitamente autorizzato il transito NON cifrato su FTP porta 21.** Non richiedere nuovamente approvazione TLS: puoi collegarti al server remoto immediatamente in lettura usando le credenziali già presenti in `.env`. Documenta che i dati e le password viaggiano in chiaro e che una futura VPN è raccomandata, ma non è un blocco per l'attuale task. Nessuna scrittura FTP, upload, delete, rename, mkdir, ordini, test di scrittura, modifiche a `/DOWNLOAD`, o abilitazione invii esterni.

Leggi realmente la directory `/UPLOAD`, verifica nomi e stabilità dei nove file giornalieri, timestamp/dimensioni/checksum, formato e batch completo; gestisci non disponibilità, FTP interrotto, file in scrittura, file mancanti, timeout e accessi concorrenti. Importa in staging e pubblica **tutte** le entità valide in modo atomico; se il batch fallisce mantieni l'ultimo dataset valido. Aggiungi job Sidekiq schedulato **attivo** alle **06:05 Europe/Rome** ogni giorno, gestione cambio ora DST, unicità per tenant e retry/backoff idempotenti. Usa le chiavi `.env` di sync già abilitate e configura realmente il worker (nuove gemme solo motivate, con lockfile e test). Un test locale dei CSV NON equivale a un test FTP live: registra le evidenze separatamente.

## M5 — LAN, verifiche finali e consegna

L'utente userà tablet/telefono collegato alla stessa rete del PC Windows. **Riusa** `compose.lan.yml`, Caddy e `docs/LOCAL_PWA.md`: HTTPS sulla LAN con CA locale attendibile. Non aprire Internet, port-forward o deploy cloud. Se non hai accesso fisico al dispositivo, indica test `NOT_RUN` con istruzioni concise e verificabili.

Test minimi: migrazioni compatibili; import locale ×2 idempotente e rollback; download FTP live read-only; primo job automatico/registrazione scheduler 06:05 Europe/Rome, inclusi DST/lock; blocchi commerciale e prezzi corretti; due login e isolamento agente 34, URL/API e PWA; ordine dell'Admin per cliente del 34 visibile correttamente all'agente; persist/reload senza ERP; storico/analisi reali; seed originale invariato; test RSpec/Playwright, sicurezza Brakeman/RuboCop, CI riferita allo SHA giusto. Stato per fase: **IMPLEMENTATO**, **TESTATO**, **DA_VERIFICARE** con prove. Aggiorna `docs/RAILS_MIGRATION.md`, `docs/PROGRESS.md`, `qa/AMELIA3_IMPORT_REPORT.md` privi di record identificativi reali.

Preserva il codice esistente, evita refactor estranei, non abbassare i test e non simulare risultati. Esegui il massimo lavoro autonomo autorizzato e fermati solo in caso di vero blocco esterno, indicando il passaggio esatto ancora necessario.
