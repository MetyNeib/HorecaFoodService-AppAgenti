# HFS Rails — rapporto di collaudo

Data: 12 ottobre 2026. Branch `feature/hfs-rails-migration`.
Stato: **COMPLETE_LOCAL**. Nessun deploy. I report React sono evidenze storiche.
La CI del codice finale viene verificata separatamente prima della consegna GitHub.

## Versioni conservate

La V1 aggiornata è conservata nel commit `81e72bc`, sui branch `main` e `v1-react`
e nel tag `v1.0.0-react` del repository privato
[HorecaFoodService-AppAgenti](https://github.com/MetyNeib/HorecaFoodService-AppAgenti).
La migrazione ha un branch dedicato; non sostituisce la V1 su `main`.

Rails 8.1.4/Ruby 4.0.5, PostgreSQL 16, Redis 7, Devise e Sidekiq sono eseguiti
localmente in Docker. Le 22 viste usano ERB, Ralix e asset locali con importmap.
Il vecchio runtime React/Vite è rimosso; gli helper V1 restano soltanto nei test.
Il seed sintetico e i risultati economici restano invariati. Il backend conserva
realmente le modifiche; le trasmissioni commerciali restano simulate.

## PASS

| Verifica | Risultato ed evidenza |
|---|---|
| Dominio e backend Rails | **94/94 RSpec**, nessun pending: [risultati](rails/rspec-results.json) |
| Dominio V1 di riferimento | **49/49** test originali conservati |
| Parità Ruby/JavaScript offline | **12/12**, stato completo confrontato per 20 passaggi e 10 rifiuti |
| Integrità del seed | **20/20**, SHA256 `2fa3e0a68029226d01a0f1911fd4aedd616aca9768038a24f5c9c3004f01c4b6` |
| Flussi UI | **24/24 casi distinti**, quattro viewport: [riepilogo](rails-ui/summary.json) |
| Offline e sincronizzazione | **28/28 casi distinti**, Chromium e WebKit: [riepilogo](rails/pwa-validation-summary.json) |
| Geometria e controllo visuale | **22 viste × 4 viewport**, 88 screenshot: [galleria](rails-ui/screenshots/index.html) |
| Fedeltà CSS | Cinque stylesheet equivalenti alla V1 nel CSSOM: [confronto](rails-ui/css-parity.json) |
| Regole del framework | **7/7** test del checker, **72 file**, zero violazioni |
| Stile e sicurezza | RuboCop **50 file**, zero segnalazioni; Brakeman **0 warning**: [risultato](rails/security-summary.json) |
| Database da zero | Migrazioni realmente eseguite su database vuoto isolato; schema generato identico |
| Installazione e build | Lockfile reali, nuova installazione npm, npm audit 0 vulnerabilità, immagine Docker ricompilata |
| Riavvio finale | Web/worker ricreati, login riuscito, 8 clienti e 120 prodotti, zero errori browser: [prova](rails/restart-smoke.json) |
| Asset pubblici | Precompilazione production in container senza rete, **39 file** senza riferimenti privati noti |
| HTTPS locale | HTTP 200 e TLS verificato con CA esplicita: [prova](rails/https-check.json); trust globale invariato |

Il collaudo UI copre ordine manuale, quantità e conversioni, prezzi/condizioni,
pagamento e nota, conferma e invio simulato idempotente, tutti e tre i casi WA,
contatti e partite, condivisioni simulate, insight, cambio cliente con annulla e
conferma, svuotamento carrello, rimozione righe ed eliminazione bozze con reload.
Sono verificati controlli, dialog, focus, barre automatiche, persistenza e assenza
di overflow su 390×844, 768×1024, 1024×768 e 1440×900.

Il collaudo PWA include riapertura a freddo senza rete, clienti/catalogo e ordini,
coda idempotente, conflitti/reset, sessione scaduta, risposta persa dopo commit,
quota esaurita, archivio corrotto con esportazione e recupero esplicito, fallback
HTML con IndexedDB negato, cambio account, due schede, token CSRF, aggiornamento
della shell, logout concorrente e risposta snapshot tardiva. La cache pubblica
non conserva pagine autenticate o risposte business. Le richieste applicative
osservate nei test restano locali.

## Esiti iniziali e correzioni

**Nessun FAIL aperto nelle verifiche locali finali; nessun caso previsto saltato.**
I JSON originali con esiti falliti sono conservati. I riepiloghi sopra deduplicano
per file, titolo e progetto e indicano l'ultima esecuzione di ciascun caso;
le ripetizioni non vengono contate come nuovi test.

- La regressione offline di Playwright 1.63 è stata isolata in una riproduzione
  indipendente e risolta con Playwright 1.64: **4/4 PASS**. Vedere
  [WEBKIT_OFFLINE_AUDIT](rails/WEBKIT_OFFLINE_AUDIT.md).
- Le attese UI sono passate da 5 a 15 secondi dopo che le tracce mostravano
  risposte corrette sotto carico concorrente. Le asserzioni sono rimaste identiche.
  Il nuovo test cambio cliente attende la pagina e confronta numericamente `2`
  e `2.0`, rappresentazioni equivalenti della quantità attesa.
- I test offline attendono la transazione IndexedDB e la navigazione HTML prima
  di leggere lo stato; il caso con venti screenshot dispone di 120 secondi.
  Importi, stato, nota, pagamento e verifiche geometriche attese non sono cambiati.
- Il logout concorrente ora blocca atomicamente nuovi salvataggi e invalida le
  vecchie istanze locali prima della pulizia; il test prova anche una risposta
  snapshot in ritardo. Questa è una correzione applicativa, distinta dalle attese.

## CI GitHub

La CI ripete regole, dominio, migrazione da database vuoto, stile, sicurezza,
**24 casi UI** e **28 casi PWA** su Ubuntu. Gli esiti appartengono al commit
verificato e sono consultabili nelle
[GitHub Actions del repository](https://github.com/MetyNeib/HorecaFoodService-AppAgenti/actions).
Stato del run finale: **IN_PROGRESS**; aggiornare questa riga dopo il risultato.

## NOT_RUN e ambito successivo

- Installazione fisica su Android/iPhone/iPad e trust della CA su tali dispositivi.
  L'emulazione Chromium/WebKit non sostituisce la prova su hardware.
- Installazione Docker su un secondo PC/Mac fisico.
- Import dei dati reali di un cliente: fase successiva già registrata, con mapping,
  validazione e riconciliazione; nessun dato reale inserito in questo repository.
- Deploy server e integrazioni/invii business reali: fuori dallo scope autorizzato.

L'offline essenziale richiede una prima preparazione online. FastOrder,
condivisioni e analisi richiedono il backend; la sincronizzazione avviene ad app
aperta o riaperta. Il workspace PostgreSQL JSONB serializza le scritture per
utente; le limitazioni di concorrenza sono documentate, senza promessa di una
validazione di carico multiagente reale.

Avvio e credenziali: [README](../README.md). Decisioni e futuro import:
[RAILS_MIGRATION](../docs/RAILS_MIGRATION.md). Framework:
[FRAMEWORK_MAPPING](../docs/FRAMEWORK_MAPPING.md). Android e Apple locali:
[LOCAL_PWA](../docs/LOCAL_PWA.md).
