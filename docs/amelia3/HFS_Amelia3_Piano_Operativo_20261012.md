# Amelia3 — Piano esecutivo v3 e promozione Rails su main

**Versione handoff**: `HFS-AMELIA3-HANDOFF-20261012-v3`. **Target demo**: 13 ottobre 2026. Repository `MetyNeib/HorecaFoodService-AppAgenti`.

## Verifica GitHub reale (12 ottobre 2026)

- `main` @ `81e72bcabd9bbe6933cde8d52b5f0460f4a97a4f` (React, mantenuta su `v1-react` / tag `v1.0.0-react`).
- `feature/hfs-rails-migration` @ `3b15948d1d7f92c964c89619c93f06df715e438e` (Rails), `ahead=6, behind=0` rispetto a `main`.
- Nessuna PR aperta; `feature/amelia3-ftp-import` non risulta ancora presente su GitHub.
- CI Rails: run `38229579621` PASS al commit applicativo `fbbaeec6d47e0cafcfc4011e6587f93ef673c3a0`; i commit successivi includono documentazione/QA. **Non attribuire una CI vecchia a SHA futuri.**

## Decisioni bloccate dal committente

- Singolo tenant Amelia3, account Admin + Agente con codice `34` Sophia Buzzicotti (16 clienti; 12 non bloccati, 4 bloccati). Capoarea predisposto, non ancora attivo.
- Listino `000` + sconti personalizzati ove validi; bloccati visibili e non ordinabili; fatturati e margini storici non inferibili.
- Salvare ordini in PostgreSQL senza invii ERP, FTP ordini, WA o email.
- FTP **in chiaro** porta 21 **autorizzato dal cliente**, prima sincronizzazione reale da `/UPLOAD`, accesso **solo lettura**, VPN in futuro.
- `.env` locale già configurato con path `/UPLOAD`, sync attiva, `06:05 Europe/Rome` e scrittura disabilitata. Verificare presenza dei nomi delle chiavi senza stamparne segreti e senza sovrascrivere `.env`.
- Docker CLI ora disponibile secondo utente; verificare `docker compose version`, `docker info` e avvio container senza cancellare volumi.
- CSV locali copiati in `imports/private/amelia3/`: `ARTICOLI.csv`, `CLIENTI.csv`, `FIDO.csv`, `GIACENZE.csv`, `INSOLUTO.csv`, `LISTINI.csv`, `LISTINI_PERS.csv`, `STORICO.csv`, `TABGIR.csv`. File ignorati tramite `.gitignore`.
- Tablet/smartphone in LAN; riutilizzare `compose.lan.yml` + Caddy HTTPS su porta 3443 con CA attendibile, evitando server pubblico.

## M0 — Git autonoma prima dell'importazione

**Autorizzazione esplicita del committente a Codex**: completare il passaggio Rails a `main` con tutte le operazioni necessarie: esaminare repository, salvaguardare modifiche locali, creare la PR `feature/hfs-rails-migration` → `main`, verificare checks CI e assenza conflitti, effettuare merge NON forzato, aggiornare `main` locale e creare `feature/amelia3-ftp-import`. È autorizzato anche il push dei branch/commit tecnici connessi a questa iniziativa **solo nel repository privato**, dopo controlli di sicurezza del diff. Nessun deploy o apertura Internet dell'app.

Procedura idempotente: se il merge è già avvenuto, saltarlo; se la PR esiste, riutilizzarla; se `main` è cambiato, riesaminare confronto e conflitti prima di procedere. Non riscrivere la storia, non fare force-push e non aggirare branch protection. Se GitHub richiede autorizzazioni umane, review obbligatoria o l'autenticazione fallisce, registrare l'ostacolo e chiedere soltanto il passo strettamente necessario. Non eliminare `v1-react` o il tag V1.

Evidenze da produrre: SHA prima/dopo, URL PR, ID merge/commit, stato CI riferito esattamente agli SHA, nuovo branch. Aggiornare i riferimenti in `AGENTS.md`, `README.md`, docs che descrivono ancora Rails come branch di migrazione.

## M1 — Preflight ambiente e sorgenti

Dal PC Windows lavorare in `C:\HorecaFoodService-AppAgenti`. Non installare o reinizializzare Docker se è già funzionante. Testare `docker compose version`, `docker info`, `docker compose config --quiet`; eseguire il progetto preservando PostgreSQL, senza `docker compose down -v`.

Verificare lo SHA-256 di tutti i CSV locali contro il manifest. `TABGIR.csv` nel progetto corrisponde allo stesso file che in chat è `TABGIR(1).csv`. L'FTP remoto può avere file più recenti: distinguere gli hash dei due snapshot senza chiamare corrotto un aggiornamento legittimo.

Configurazione `.env` già presente e ignorata da Git. Non visualizzare chiavi segrete: usare soltanto nomi e verifiche booleane dove possibile. Il file è usato da Compose per interpolazione ma **non** trasferisce automaticamente ogni variabile ai container. Modificare `compose.yml` solo per renderle disponibili al job/worker che ne ha bisogno; escludere password e dati dal client e dai log.

## M2 — Staging e import locale deterministico

Implementare parsing incrementale secondo mappa/manifest: `ARTICOLI.csv` e `CLIENTI.csv` CP1252, altri UTF-8 BOM, delimitatore `;`, ultima colonna vuota, 586 righe CLIENTI con separatori extra e una ragione sociale con `;` non quotato. Validazione selettiva dei recuperi, report degli scarti, dry-run, checksum, checkpoint e publish atomico senza cancellare il dataset valido.

Mappare identificativi stringa, client/intestatari, agenti, articoli, listino `000`, sconti, stock, giri, fido, insoluti e storico. Non inventare UM/prezzo/costo/giacenza: gli articoli non validati restano consultabili ma non ordinabili. Non mettere file commerciali né valori sensibili nel seed, migrazioni o commit.

## M3 — Admin e Agente 34 con dati autorevoli condivisi

Nell'app Rails esistente attivare due account distinti tramite Devise, con dataset commerciale unico Amelia3. L'Admin vede tutti i clienti Amelia3; l'Agente `34` ne vede **16**, con **12** non bloccati e **4** bloccati. La chiave tecnica dei permessi è `cod_agente=34` e non il campo descrittivo o il telefono. Role `capoarea` predisposto ma deny-by-default/non operativo.

L'attuale `workspaces.state` JSONB per utente NON va duplicato in due copie mutabili indipendenti. Usare minima persistenza PostgreSQL condivisa per ordini/canale commerciale; ordini dell'Admin per clienti assegnati devono essere visibili all'agente titolare senza duplicati. Conservare idempotenza, prezzi snapshot, outbox offline, controllo URL/API e `RESET_DEMO` segregato. Evitare snapshot monolitici con 8k clienti e >1M storico.

## M4 — Storico, insight e riconciliazione

Import STORICO ~1.036.814 righe con streaming/bulk/chunking, indici e aggregati ricercabili (cliente/prodotto/periodo). Report frequenze, quantità, articoli abituali, ultime consegne e metriche supportate dai dati. **Non ricostruire ricavi, margini o costi che non esistono nei tracciati**. Validare aggregati dell'Agente 34: **2.237** righe, **606** ordini storici distinti, **447** articoli distinti.

FIDO e INSOLUTO solo con significato provato, senza creare fatture o pagamenti inesistenti. Prestazioni reali misurate, risposte paginabili e UI Ralix esistente preservata.

## M5 — FTP live read-only + schedulazione quotidiana attiva

Il cliente **autorizza esplicitamente FTP semplice senza TLS sulla porta 21** per questa fase. Codex può eseguire da subito accesso e test FTP live in lettura: non bloccare la task chiedendo di nuovo consenso TLS. La futura VPN è un task separato. Non descrivere il canale come sicuro o cifrato.

La sorgente è `/UPLOAD`, da verificare direttamente, e i nove file attesi devono essere individuati. Non effettuare mai scritture FTP, neppure file temporanei, delete, rename, mkdir, upload o ordini verso `/DOWNLOAD`. Mettere timeouts, retry limitati, modalità passiva se necessaria, log sanitizzati e protezione contro file incompleti/still writing. Confrontare dimensione/mtime/filename o marker di completamento, se disponibile, prima di attivare il batch. Reimport idempotente, stop se file incoerenti, ultimo dataset valido sempre conservato.

**Scheduler richiesto attivo**: una esecuzione logica al giorno alle **06:05 nel fuso `Europe/Rome`**, gestione DST, singleton per tenant e lock contro job concorrenti. Le chiavi locali sono già abilitate; rileva i nomi esatti delle variabili di ora/timezone senza esporre password. Aggancia il worker e verifica l'effettiva registrazione schedulazione; non lasciare il job spento come nel vecchio piano. Se alle 06:05 il batch export non è completo, registrare esito di non pubblicazione e implementare retry limitato senza esporre dati incompleti. Testare un'esecuzione live di sola lettura e riferire cosa è stato realmente scaricato, senza includere righe nei log.

## M6 — Demo LAN e QA finale

Riutilizzare l'HTTPS locale già presente (`compose.lan.yml`, Caddy, `docs/LOCAL_PWA.md`). Verificare `HFS_LAN_HOST` e HTTPS su porta `3443`, installazione e trust CA sul tablet/smartphone con test reali se il dispositivo è accessibile a Codex; altrimenti indicare NOT_RUN e guida manuale. Vietati port forwarding, tunnel pubblico o deploy cloud non autorizzato.

QA: RSpec + Playwright (incl. PWA), controllo regole, RuboCop, Brakeman, migrazioni vuote, import locale ripetuto, FTP failure/incomplete files, scheduler 06:05 con timezone/DST, accessi Admin/Agente scoping su pagine/API/cache offline, ordini veri non trasmessi, storico/analisi, regressione sintetica, performance tablet. Validare CI contro commit attuale. Segnalare `IMPLEMENTATO`, `TESTATO` e `DA_VERIFICARE` e non dichiarare COMPLETE finché i test essenziali non sono PASS.

## Go/no-go per demo

**GO:** la versione Rails promossa correttamente; Docker/DB accessibili; due account funzionanti, portafoglio 34 isolato; almeno un articolo/cliente con UM/prezzo/stock affidabili per ordine confermato e persistente; storico analizzato senza numeri economici inventati; HTTPS LAN raggiungibile; connettore remoto FTP read-only collaudato e scheduler 06:05 effettivamente attivo. Se l'FTP fallisce conservare lo snapshot locale importato, ma dichiarare l'automazione **DA VERIFICARE**, non PASS.

**STOP / stato parziale:** mapping UM o giacenza non giustificabile, CI rossa, ordini non condivisi, password leak, mancata verifica CA sul dispositivo, integrazione FTP che modifica dati remoti. L'assenza delle prove su hardware fisico può essere NOT_RUN con istruzioni operative; non inventare l'esito.
