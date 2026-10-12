# HFS / Amelia3 — Preflight CSV e mappa tecnica per Codex

*Revisione v3 · 2026-10-12 · Baseline GitHub: `feature/hfs-rails-migration` @ `3b15948d1d7f92c964c89619c93f06df715e438e`.*

**Scopo**: handoff di mapping verificato sui nove CSV allegati. Senza righe commerciali, indirizzi email, numeri di telefono o segreti FTP. Il manifest allegato contiene hash e tracciati; il nominativo dell’agente selezionato è indicato solo in forma breve.

## 1. File campione verificati

| File | Righe | Encoding osservato | Delimitatore |
|---|---:|---|---|
| `ARTICOLI.csv` | 9.847 | `cp1252` | `;` |
| `CLIENTI.csv` | 8.311 | `cp1252` | `;` |
| `FIDO.csv` | 5.064 | `utf-8-sig` | `;` |
| `GIACENZE.csv` | 9.245 | `utf-8-sig` | `;` |
| `INSOLUTO.csv` | 3.017 | `utf-8-sig` | `;` |
| `LISTINI.csv` | 28.940 | `utf-8-sig` | `;` |
| `LISTINI_PERS.csv` | 12.173 | `utf-8-sig` | `;` |
| `STORICO.csv` | 1.036.814 | `utf-8-sig` | `;` |
| `TABGIR.csv` (allegato in chat come `TABGIR(1).csv`) | 19.960 | `utf-8-sig` | `;` |

*Encoding osservato sui campioni: `cp1252` per ARTICOLI e CLIENTI; `utf-8-sig` per gli altri. Il parsing CSV è semicolon-delimited. Tutti i file hanno una colonna finale vuota dovuta a `;` terminale.*

## 2. Relazioni verificate sui file campione

| Colonna sorgente | Riferimento | Esito |
|---|---|---|
| `FIDO.cod_cli` | `CLIENTI.cod_cli` | 5.064/5.064 righe collegate |
| `GIACENZE.cod_art` | `ARTICOLI.cod_art` | 9.245/9.245 |
| `LISTINI.cod_art` | `ARTICOLI.cod_art` | 28.940/28.940 |
| `LISTINI_PERS.cod_cli` | `CLIENTI.cod_cli` | 12.173/12.173 |
| `LISTINI_PERS.cod_art` | `ARTICOLI.cod_art` | 12.173/12.173 |
| `INSOLUTO.cod_conto` | `CLIENTI.cod_conto` | 3.017/3.017 |
| `TABGIR.cod_cli` | `CLIENTI.cod_cli` | 19.960/19.960 |
| `STORICO.cod_cli/cod_art` | `CLIENTI/ARTICOLI` | Zero codici orfani tra 5.029 clienti e 4.350 articoli distinti |
| `CLIENTI.cod_int` | `CLIENTI.cod_cli` | 1.447/1.447 link di anagrafiche collegate |

**Vincolo:** preservare ogni codice come stringa, anche quando sembra numerico, inclusi eventuali zeri iniziali. La presenza di referenze valide non certifica la correttezza economica o di accesso.

## 3. Mappatura candidata sul contratto HFS

| CSV / campi | Destinazione HFS già esistente | Stato / attenzione |
|---|---|---|
| `ARTICOLI`: `cod_art`, `des_art`, gruppi, UM, confezioni, flag | `products`, `categories`, `products.units` | Candidata; significati `K/P/L/C` e divisibilità da confermare |
| `CLIENTI`: codici, ragione sociale, contatti, `cod_agente`, `cod_int`, `cod_giro` | `customers`, `destinations`, `agents`, eventuali `contacts` | Candidata; distinguere intestatario e punto consegna |
| `LISTINI`: `cod_lis`, `cod_art`, `prezzo` | `priceLists`, `priceListItems` | **BLOCCO P0**: 3 listini (`000`,`001`,`PRO`) ma `CLIENTI.cod_lis` è vuoto su 8.311 righe |
| `LISTINI_PERS`: cliente, articolo, validità, `prezzo`, `sconto` | `customerConditions` | **BLOCCO P0**: colonna `prezzo` sempre vuota, `sconto` disponibile in 12.145 righe; base di calcolo da confermare |
| `GIACENZE`: articolo, `esistenza_att_cf/pz/pe` | `stocks` | Candidata; manca deposito: non inventare stock per deposito; conversioni UM da confermare |
| `TABGIR`: cliente, giro, `giorno_sett` | `deliveryRoutes`, `destinations` | Candidata; valori 1..7 e assegnazioni per cliente, significato/precedenza da confermare |
| `FIDO`: `valore_fido`, `residuo_fido` | `customers.creditLimitCents` + eventuale dato credito separato | Parziale: significato residuo e conti da confermare |
| `INSOLUTO`: conto, partita, riferimento, date e `tot_rata` | `receivables` / vista partite aperte | Parziale: non inventare fatture complete o pagamenti assenti |
| `STORICO`: ordine, cliente, articolo, quantità, `data_cons` | Aggregati acquisti/abituali; **non** `orders` massivo nel workspace | Nessun prezzo o fatturato storico disponibile |

I target HFS qui citati sono oggetti del JSON applicativo esistente, **non tabelle SQL già presenti**. Il DB corrente contiene soltanto `users`, `workspaces`, `command_receipts` e relativi campi.

## 4. Anomalie reali osservate

- **CLIENTI.csv**: 586 righe con due separatori vuoti supplementari in coda e 1 riga con `;` non protetto nel testo di ragione sociale. Un parser ingenuo scarta 587 clienti. Con recupero controllato e validazione dei flag si leggono **8.311 codici cliente unici**.
- **Gerarchia agente/capoarea**: 39 agenti distinti; tutti gli 8.311 clienti hanno `cod_agente`. Il campo `cod_care` è un indirizzo email e compare su 586 clienti di **un solo agente**; 7.725 righe non indicano capoarea. Non basta per costruire le aree di tutti gli agenti.
- **Clienti e consegne**: 1.447 righe hanno `cod_int` che rimanda a 1.292 clienti. In 107 collegamenti l'agente del punto e l'agente dell'anagrafica collegata sono differenti. Definire autorizzazioni e titolarità amministrativa prima di creare ruoli.
- **Bloccati**: `ARTICOLI.flag_bloccato=S` su 4.427/9.847; `CLIENTI.flag_bloccato=S` su 2.874/8.311. Confermare la regola di visibilità/ordinabilità.
- **Prezzi**: 28.940 righe LISTINI su tre listini, due prezzi mancanti e tre prezzi non positivi; i prezzi hanno fino a cinque cifre decimali. Non convertire indiscriminatamente a centesimi finché non è chiarita l'unità di prezzo e la regola d'arrotondamento.
- **Condizioni cliente**: 12.173 righe, 12.145 con `sconto`, 28 senza `sconto` né `prezzo`; sconti osservati fra 0 e 27, con decimali. 76 condizioni future al 12/10/2026; nessuna sovrapposizione *attiva* per coppia cliente/articolo rilevata in questo campione. Semantica e base di calcolo ancora da confermare.
- **Giacenze**: 602 articoli senza riga GIACENZE (68 non bloccati), 548 righe con tutte e tre le esistenze vuote, alcuni valori negativi. 2.890 articoli non bloccati hanno almeno una esistenza numericamente positiva. **Non sommare** `cf`, `pz`, `pe`: potrebbero rappresentare la stessa giacenza in unità diverse.
- **Giri**: `CLIENTI.cod_giro` è spesso una lista di codici separati da virgola; `TABGIR` contiene 49 codici e 6.512 clienti. Per i 6.512 clienti presenti in TABGIR esiste almeno un codice in comune con la lista di CLIENTI, ma solo 193 insiemi di codici coincidono esattamente; 1.799 clienti non hanno righe in TABGIR. Stabilire fonte autorevole per i giorni.
- **Fido**: 5.064 righe tutte collegate; 101 residui fido negativi da gestire senza troncamento.
- **Insoluto**: 3.017 righe collegate a 753 conti; 2.411 scadenze passate al 12/10/2026, un duplicato della chiave candidata `(cod_conto,nr_partita,data_scad)`. Importi con artefatti di precisione decimale: usare `BigDecimal` e riconciliare la regola monetaria.
- **Storico**: 1.036.814 righe, 234.128 ordini distinti, periodo 2015–2026; 24.161 righe con `qta_sped=0`, 225 date consegna successive al 12/10/2026. Mancano prezzi, IVA e totali: non ricostruire impropriamente ricavi o margini storici.

## 5. Profilo dell'agente dimostrativo: SOPHIA BUZZICOTTI

**Decisione confermata dall'utente:** account Agente collegato ESCLUSIVAMENTE a `CLIENTI.cod_agente = "34"`. Non utilizzare più il precedente agente codice `7`. Identificare l'agente con il codice stringa, **non** tramite nome o numero telefonico inseriti nel campo descrittivo.

| Indicatore sul campione del 12/10/2026 | Quantità |
|---|---:|
| Clienti del codice `34` | **16** |
| Di cui `flag_bloccato=N` | **12** |
| Di cui `flag_bloccato=S` | **4** |
| Righe FIDO collegate | 10 |
| Righe LISTINI_PERS collegate | 12 (4 codici cliente) |
| Righe TABGIR collegate | 58 (14 codici cliente) |
| Righe INSOLUTO attraverso `cod_conto` | 3 |
| Righe STORICO collegate | **2.237** |
| `rif_ord_interno` distinti nello storico collegato | **606** |
| Articoli distinti nello storico collegato | **447** |

Nota: i 12 clienti non bloccati sono *candidati* ordinabili, non 12 ordini garantiti: serve verificare prezzo base `000`, UM, stock e altri vincoli. Non mostrare dati cliente fuori portafoglio, neppure attraverso `cod_int`, `cod_conto`, analisi, partite, esportazioni, endpoint o cache PWA. L'Admin vede tutti i clienti Amelia3. Preparare il modello Capoarea senza abilitarlo: la gerarchia è incompleta nei CSV.

## 6. Decisioni funzionali e operative approvate

| Tema | Decisione attiva |
|---|---|
| Tenant | Solo **Amelia3**; estendibilità multi-tenant futura senza architettura prematura |
| Account | **Admin** (tutto Amelia3) e **Agente 34** (solo 16 clienti assegnati); entrambi operativi su PostgreSQL condiviso |
| Capoarea | Ruolo previsto, non ancora operativo finché non esiste la relazione agente→capoarea attendibile |
| Prezzo | Base `LISTINI.cod_lis=000`, `LISTINI_PERS.sconto` valido sul cliente/articolo, previa verifica scala, UM, rounding; anomalie non ordinabili |
| Blocchi | Articoli e clienti con `flag_bloccato=S`: visibili, non ordinabili, applicato anche server-side e offline |
| Storico | Import/aggregazione di ~1M righe in PostgreSQL con query/paginazione server; analisi su quantità e frequenze, **no** ricavi o margini ricostruiti |
| Ordini | Scrittura locale Rails / PostgreSQL e visibilità coerente tra account autorizzati; invio a ERP, FTP, WA, email **sempre disabilitato** |
| FTP | FTP semplice NON cifrato porta 21, approvato esplicitamente dal cliente per questa fase; `/UPLOAD` read-only; VPN prevista successivamente |
| Scheduler | **ATTIVO** ogni giorno ore **06:05 Europe/Rome**, dopo bootstrap/test connessione/completezza, mantenendo precedente versione valida se export incompleto |
| Workstation | Docker CLI disponibile secondo utente, Codex deve eseguire smoke test effettivo e proteggere i volumi |
| Dati locali | I nove CSV sono in `imports/private/amelia3/` sotto `.gitignore`; `TABGIR.csv` ha stesso hash di `TABGIR(1).csv` dell'upload |
| Demo | Tablet/telefono LAN con `compose.lan.yml` + Caddy HTTPS con certificato attendibile; no Internet public exposure |

L'autorizzazione all'FTP in chiaro **non rende il trasporto cifrato**: trasferimento password e dati resta esposto. Registrare la scelta senza bloccare l'implementazione FTP richiesta. Non inserire host, username o password nei documenti; leggere soltanto dall'ambiente. Usare la configurazione locale già presente senza mostrarne il contenuto.

## 7. Architettura del dato: soluzione transitoria senza incoerenze

Il codice Rails attuale salva `workspaces.state` come JSONB per ogni utente; `User.agent_id` consente solo `AG-014`, `Hfs::Snapshot.scoped_state` filtra per agente, `Hfs::Domain#clock` usa data demo, `RESET_DEMO` ricrea il seed e gli ordini nuovi sono contrassegnati come sintetici. **Non basta aggiungere due account Devise copiando lo stesso JSONB**. I dati Amelia3 devono avere almeno un livello autorevole condiviso, con indici/chiavi tecniche e invarianti transazionali.

- Conservare byte-identico il seed demo e le suite correnti; mode `synthetic` separato da `amelia3` anche per data, reset, ordini e offline.
- Separare identità del creatore ordine (`created_by_user`) e titolarità commerciale (`assigned_agent_code` dal cliente). L'Admin può creare un ordine che risulta al relativo Agente autorizzato; nessun duplicato nei due account.
- Applicare scope e permessi alle query server, ID diretti, mutazioni, report, snapshot, endpoint AJAX/JSON, cache IndexedDB e cambi account.
- Import in staging validato e pubblicazione atomica con precedente snapshot integro; codici esterni sempre stringhe; un nuovo import non sovrascrive ordini, prezzi storicizzati nell'ordine, bozze o coda offline.
- 8.311 clienti, 9.847 articoli, 28.940 prezzi, 12.173 condizioni e >1M storico **non** devono essere riversati in blocco nella PWA. Indici, query e aggregati server-side: confrontare tempi/payload prima di dichiarare demo pronta.
- Rispettare il contratto HFS: margini articolo non calcolabili senza costi, giacenze `cf/pz/pe` non sommabili, nessun deposito deducibile dall'export. Se UM/prezzo/stock non certificati, riga consultabile ma non confermabile.

## 8. FTP e schedulazione: requisito operativo esplicito

- Sono già presenti nella `.env` locale le credenziali segrete (non visibili qui), `AMELIA3_FTP_IMPORT_DIR=/UPLOAD`, sincronizzazione abilitata, orario `06:05`, timezone `Europe/Rome`, scrittura disabilitata. **Codex deve verificare i NOMI delle variabili orario/timezone** senza esporne i valori né rinominarle ciecamente.
- Il `compose.yml` corrente **non** propaga ancora le variabili Amelia3 ai container. Predisporre il minimo wiring ai servizi che devono effettuare la lettura; niente segreti nel browser o nel codice sorgente. Il job deve restare read-only (nessuna funzione `put`, `delete`, `rename`, `mkdir`), con timeout, passive mode se necessario, error handling, log senza segreti.
- Eseguire primo import locale dei file verificati; poi test FTP remoto REALE in lettura, validazione directory `/UPLOAD` e nomi file, stabilità dimensioni/mtime e/o altra prova di batch completo, checksum. Se fallisce, non dichiarare la sincronizzazione testata; preservare dataset locale valido.
- Scheduler sidekiq **attivo** dopo test tecnici, una esecuzione logica quotidiana alle **06:05 Europe/Rome**, resistente a DST e ad avvii duplicati; blocco per tenant, retry idempotente e ultimo successo/ultimo errore visibili. Se file mancanti/parziali non pubblicare dataset e registrare il fallimento, anche se l'automazione resta abilitata.
- Non usare la directory ordini in uscita e non attivare invii commerciali. VPN/FTPS è un hardening futuro separato, non condizione sospensiva per la FTP in chiaro ora autorizzata.

## 9. Verifiche specifiche per l'agente 34 e la demo

1. `CLIENTI.cod_agente=34` → 16 clienti, 12 non bloccati e 4 bloccati. Nessuna contaminazione con agente 7; controllare anche tutti gli URL diretti e la cache offline.
2. Secondo account autenticato via Devise; separazione portafoglio e coerente visibilità degli ordini su DB condiviso; test Admin che crea ordine per cliente agente 34 e visibilità lato agente.
3. Import idempotente (due passaggi = stessi codici) e rollback atomico se uno dei nove file fallisce, compreso file STORICO incompleto.
4. Prezzo `000` e personalizzazione verificati sulle UM, stock derivato soltanto da quantità dimostrate, blocchi in server/client/offline; test con ordine valido multi-riga e nessuna scrittura verso ERP.
5. Storico Agente 34: 2.237 righe, 606 ordini identificati, 447 articoli distinti; confronto aggregazioni. Senza metriche economiche fittizie.
6. FTP `/UPLOAD` reale in lettura, job automatico 06:05 Europe/Rome attivo/testato, file mancanti/non stabili = FAIL senza perdita dati; `AMELIA3_FTP_WRITE_ENABLED=false` effettivamente enforce.
7. Verificare snapshot/caching e performance su tablet/telefono HTTPS LAN; non dichiarare prova fisica se non effettuata.
8. Registrare `IMPLEMENTATO`, `TESTATO` e `DA_VERIFICARE` con commit SHA, esiti QA e limiti di dati. Nessun dato sensibile nei commit, log, bug report o file distribuiti.
