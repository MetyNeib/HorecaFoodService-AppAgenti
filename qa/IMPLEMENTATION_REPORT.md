# Report corrente: versione Rails

Il collaudo della migrazione è in [RAILS_IMPLEMENTATION_REPORT.md](RAILS_IMPLEMENTATION_REPORT.md).
Il contenuto seguente riguarda esclusivamente la V1 React conservata su `main` e `v1-react`.

---

# Horeca Food Service — report di implementazione

**Ultimo aggiornamento 11/10/2026 — COMPLETE_LOCAL.** Header e footer aperti all'ingresso, chiusi dopo un secondo; apertura manuale mantenuta fino allo scroll centrale o delle liste. Icona account sempre disponibile, liste compatte con spazio protetto per due schede leggibili e fallback allo scorrimento centrale. PASS: validate:data 20/20, unit 49/49, typecheck, build, check:bundle, E2E 90/90 (0 skipped/flaky), 437 verifiche del layout su 19 viewport, preview e ispezione visuale sui quattro formati principali. Nuova dist servita su http://127.0.0.1:4173/. Report corrente: [ADAPTIVE_DOCKS_REPORT.md](ADAPTIVE_DOCKS_REPORT.md).

**Footer precedente 11/10/2026 — baseline storico.** Chiusura soltanto allo scorrimento centrale, successivamente sostituita dalla regola comune di un secondo. Evidenze storiche: [FOOTER_BEHAVIOR_REPORT.md](FOOTER_BEHAVIOR_REPORT.md).

**Layout elastico iniziale 11/10/2026 — baseline precedente.** Layout e footer consegnati con E2E 84/84 e 437 verifiche del layout PASS. In quel momento la pubblicazione ngrok era stata bloccata dal controllo automatico con “blocked by policy”; nessun URL pubblico verificato. Report storico: [ELASTIC_LAYOUT_REPORT.md](ELASTIC_LAYOUT_REPORT.md).

**Consegna iniziale — demo locale, 22 settembre 2026.** Implementate e collaudate M1–M8 nella root `C:\HorecaFoodService-AppAgenti`. Le sezioni seguenti descrivono il baseline storico; gli esiti correnti sono nel report collegato sopra.

## Esiti finali

**Aggiornamento 23/09/2026:** completato il [refitting delle viste](REFIT_REPORT.md), con 44/44 E2E e 176/176 controlli del layout sulla build. I conteggi e log sotto descrivono la consegna iniziale; i risultati E2E e screenshot sono rigenerati dal collaudo più recente.

| Verifica eseguita | Esito | Evidenza |
|---|---|---|
| Root, AGENTS.md, specifiche e fonti locali | PASS | Directory richiesta e file presenti; letti i 22 PNG e gli estratti locali |
| `npm.cmd run validate:data` | PASS — 20/20 | [data_integrity_current.json](data_integrity_current.json), data-final.log |
| `npm.cmd test` | PASS — 49/49 | [unit-tests-final.tap](unit-tests-final.tap); 42 test originali conservati e 7 aggiunti |
| `python scripts/validate-seed.py` | PASS — 86/86 | [seed_validation_current.json](seed_validation_current.json) |
| `npm.cmd run typecheck` | PASS | typecheck-final.log |
| `npm.cmd run build` | PASS | build-final.log; HTML, CSS e tre chunk JavaScript |
| `npm.cmd run test:e2e` | PASS — 36/36 | [e2e-results.json](e2e-results.json), [report HTML](playwright-report/index.html); 0 skipped, 0 flaky; durata 114,4 s |
| `npm.cmd run check:bundle` | PASS — 5 file | bundle-final.log; albero dist controllato |
| `node scripts/verify-preview.mjs` | PASS — 4 viewport | [preview-verification.json](preview-verification.json); zero richieste esterne, download reali ed errori |
| Screenshot e verifica visuale | PASS | [Galleria di 92 screenshot](screenshots/index.html) |
| Modifiche a seed e package-lock | PASS — nessuna | Diff rispetto al baseline vuoto |
| Deploy pubblico | NOT_RUN | Non richiesto; consegna locale |
| Browser diversi da Chromium | NOT_RUN | Collaudo con Chromium Playwright |

**FAIL finali: nessuno.** I risultati bootstrap preesistenti rimangono distinti dal collaudo del prodotto. Dipendenze e lockfile locale riutilizzati senza aggiornamenti di versione.

## Flussi consegnati e copertura

| Area | Implementazione e verifiche |
|---|---|
| Shell e Home | Brand HFS, Marco Rossi, clock fisso, contatori derivati 2/1/24/3, rete, dialog sync, reset confermato |
| Ordine manuale | Selezione/cambio cliente, ricerca nome/codice, categoria e già acquistati, CT/UM base, righe condivise, editor libero/sconto/listino, omaggi, condizioni e sovrapposizioni, margini e totali, annulla senza mutazione |
| Riepilogo | Nota documento, consegna e destinazione, deposito, pagamento solo per ordine, stock aggregato e validazioni; conferma offline |
| Offline e liste | Bozze/coda/inviati, ricerca e date fisse, riprendi stesso ID, eliminazione confermata, storico immutabile; sync idempotente, reconnect, reload e reset durante timer |
| FastOrder | WA841: alternativa latte 2 CT = 24 PZ e spezzatino 2 KG, otto righe canoniche; WA843: UM esplicita ed esclusione motivata; WA842 già abbinato; salva/riprendi, messaggi sintetici e mapping cliente |
| Clienti | Otto clienti assegnati, ricerca anche taxId DEMO, quattro tab, referenti con annulla/salva e sync; condizioni attive/scadute/future |
| Partite | CLI-061001 saldo 587,46 €, scaduto 450,00 €, incassato 100,00 €; credito contato una volta. CLI-061002 con due rate verificato anche in preview; filtri, dettaglio, anteprima HTML e job locali WA/email/PDF |
| Catalogo | 120 prodotti, due depositi, filtri combinati, stock zero consultabile, scheda contestuale e ritorno con ricerca/carrello conservati; descrizione e visual ingrandibile |
| Insight | Snapshot approvati, 8→4 ordini e 2.400→1.560 €, dettaglio bevande/amaro, storico corretto, nuovo ordine vuoto per cliente selezionato, valutazioni persistenti |
| Persistenza | schemaVersion, reload, reset, JSON/envelope incompatibile, quota/storage disabilitato: avvisi senza crash; dati corrotti conservati fino al reset |

Le verifiche coprono i comportamenti dei dieci flussi di `docs/05_ACCEPTANCE.md` e le regole delle fixture T01–T09 tramite unit test, E2E e controllo della build. Conversioni specifiche e validità inclusive sono verificate anche dagli helper di dominio originali.

## Interfaccia e accessibilità

Nove scenari E2E in ciascuna risoluzione: **390×844, 768×1024, 1024×768, 1440×900**. Acquisite tutte le 22 viste in ogni viewport (88 PNG), più quattro Home dalla build (92 PNG complessivi).

Ispezionati visivamente Home, prodotti/carrello, editor riga, verifica WA, cliente/partite, catalogo e analisi nei quattro viewport. Verificati automaticamente overflow di pagina nelle 22 viste, heading e controlli raggiungibili; collaudati focus iniziale, Escape e ritorno focus dei dialog, skip link, errori e stati disabilitati. Su telefono blocchi e dati tabellari si impilano conservando informazioni e azioni. Footer nel flusso, nessuna sidebar di navigazione aggiunta.

Token e stile dagli estratti locali; Inter se installato, con fallback di sistema. Non è una certificazione di identità pixel-per-pixel con il mockup Figma dell'altra app. Visual prodotto vettoriali sintetici; dati tecnici mancanti indicati come non disponibili.

## Dati, bundle e simulazioni

SHA-256 del seed originale immutato:

`2fa3e0a68029226d01a0f1911fd4aedd616aca9768038a24f5c9c3004f01c4b6`

Il reset ripristina integralmente i dati della demo e lo stato offline. La sola nota di sviluppo `branding.visualSystem` è esclusa dalla proiezione runtime perché contiene il nome della fonte Figma vietato dal controllo bundle. Il JSON originale resta immutato; un test confronta ogni altro campo della proiezione con il seed. Non vengono rigenerati codici, nomi o prezzi.

Il bundle contiene solo index.html, CSS e tre file JavaScript (app, vendor, dati sintetici). Non contiene font binari, PDF, FIG, XLSX, screenshot reali o audit privati. Nessuna API key o backend. I test intercettano richieste remote; la preview registra zero richieste esterne. WhatsApp, email e download PDF restano esplicitamente simulati; non viene scaricato un documento fiscale.

## Correzioni emerse dal collaudo

- Corrette inferenze TypeScript da campi null e snapshot senza modificare il seed.
- Corretti ritorno focus/Escape e filtri immediati. Disattivate le transizioni del router per evitare input applicati alla vista precedente durante navigazioni rapide; verificato il ritorno alla ricerca anche su telefono.
- Risolto il marker di provenienza nel bundle con la proiezione documentata, senza indebolire il validatore.
- Chromium inizialmente assente: installato nella cache progetto con download autorizzato. La sandbox impediva la corretta chiusura dei processi del web server: E2E finale eseguito con escalation autorizzata e terminato con exit code 0. Nessuna modifica a policy globali.

## Avvio e ripetizione

Dalla root già installata:

```powershell
npm.cmd run dev
```

URL di sviluppo verificato dalla suite: **http://127.0.0.1:5173/**.

Per la build già prodotta:

```powershell
npm.cmd run preview
```

URL della build verificato: **http://127.0.0.1:4173/**. Servire dist via HTTP. Per azzerare le modifiche usare **Reset demo → Ripristina seed** nel footer.

Comandi di verifica nella tabella iniziale. Playwright usa la cache locale `.playwright-browsers`; istruzioni per un altro PC nel [README](../README.md). Non restano blocchi tecnici aperti per questa consegna locale.
