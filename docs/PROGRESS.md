# Checkpoint di implementazione

## Header/footer automatici e liste compatte 11/10/2026 — COMPLETE_LOCAL

- Nuova regola approvata: header e footer aperti all'ingresso, richiusi dopo un secondo; apertura manuale mantenuta fino allo scroll centrale o delle liste. Header ridotto con icona account che riapre logo, Home e dati agente.
- Schede delle liste ricomposte e ridotte negli spazi senza eliminare dati/controlli; testi principali 16px, titoli scheda 18px, controlli touch 44px. Altezza minima delle sottoliste misurata sulle coppie di righe, almeno due quando i dati sono presenti; se non entra, scorrimento centrale.
- PASS finali: validate:data 20/20, unit 49/49, typecheck, build, check:bundle, E2E 90/90 su sei viewport, layout della build 437/437 su 19 viewport e smoke preview su quattro viewport. Verificati timer a 900/1050ms, apertura manuale, scroll centrale/interno, focus, reset, leggibilità, liste indipendenti e controlli raggiungibili. Screenshot dei quattro formati principali ispezionati; nessun errore runtime/richiesta business esterna/overflow rilevato. Seed e lockfile invariati.
- Nuova dist servita dalla preview esistente: http://127.0.0.1:4173/. [Report corrente](../qa/ADAPTIVE_DOCKS_REPORT.md), [galleria](../qa/elastic/screenshots/index.html). Su finestre estremamente basse la regione protetta di due schede richiede scorrimento centrale per essere esplorata; i controlli non vengono ulteriormente rimpiccioliti. Le sezioni successive documentano regole precedenti, sostituite da questo intervento.

## Footer: chiusura allo scorrimento 11/10/2026 — COMPLETE_LOCAL

- Invertita la regola precedente: footer aperto all'ingresso in ogni vista e dopo reset; scorrimento centrale verso il basso lo richiude. Quando è chiuso rimane accessibile soltanto il tasto di apertura.
- Riapertura manuale, nessuna riapertura allo scorrimento o al cambio di densità. Le liste autonome non modificano il footer quando la schermata centrale non scorre. Animazione, focus e reduced motion conservati.
- Corretto anche l'assestamento automatico dello scroll durante la riapertura a fondo pagina con reduced motion; caso aggiunto alla regressione.
- PASS finali: validate:data 20/20, unit 49/49, typecheck, build, check:bundle, E2E 90/90 su sei viewport, layout della build 437/437 su 19 viewport, smoke preview su quattro viewport e smoke footer su sette. Screenshot rigenerati e ispezionati; nessun errore runtime/richiesta business esterna/overflow rilevato. Seed, lockfile e dipendenze invariati.
- Nuova dist già servita dalla preview su http://127.0.0.1:4173/ (PID 9344). [Report corrente](../qa/FOOTER_BEHAVIOR_REPORT.md), [galleria](../qa/elastic/screenshots/index.html). Le sezioni successive documentano gli interventi precedenti.

## Layout elastico e footer richiudibile 11/10/2026 — COMPLETE_LOCAL / PUBLICATION_BLOCKED

- Nuova richiesta approvata: compattare spazi/titoli/icone senza sacrificare leggibilità; Clienti/Catalogo/Statistiche in tre card distinte quando c'è larghezza; scorrimento centrale se le proporzioni minime non bastano.
- Implementati rilevamento delle dimensioni effettive, modalità normale/compatta/scorrevole e footer con riapertura manuale o durante lo scorrimento centrale, senza sovrapporre controlli.
- PASS finali: validate:data 20/20, unit 49/49, typecheck, build, check:bundle, E2E 84/84 su sei viewport e 437/437 verifiche della build su 19 viewport. 633 screenshot; controllo visivo completato; zero errori runtime/richieste business esterne/download inattesi. Nessuna nuova dipendenza e nessuna modifica al seed/lockfile.
- Preview riavviata e HTTP 200 verificato su http://127.0.0.1:4173/ (PID 9344). Server temporaneo sulla porta 5174 terminato. L'avvio ngrok è stato rifiutato da exec_command con “blocked by policy”; nessun tunnel pubblico attivo o URL dichiarato verificato.
- Checkpoint pubblico: eseguire manualmente `ngrok http http://127.0.0.1:4173`, poi verificare l'URL HTTPS Forwarding. Report e log: [ELASTIC_LAYOUT_REPORT.md](../qa/ELASTIC_LAYOUT_REPORT.md), [galleria](../qa/elastic/screenshots/index.html).

## Presentazione Centro Cash 25/09/2026 — COMPLETE

- Rebrand visibile della demo a “Centro Cash order app”: logo, intestazione, titolo browser, visual catalogo e mittente delle condivisioni simulate. Le etichette dei depositi non mostrano più la sigla HFS; il seed approvato resta invariato.
- Creata la [presentazione PDF di 7 slide](../qa/centro-cash-presentation/Centro-Cash-order-app-presentazione.pdf) dalla scaletta fornita dall'utente, con 14 schermate acquisite dall'app funzionante. Testi e note distinguono i flussi dimostrativi dalle integrazioni reali.
- PASS: 20/20 controlli dati, 49/49 test unitari, typecheck, build, bundle pulito, 44/44 E2E su quattro viewport. PDF verificato: 7 pagine, immagini caricate, slide ispezionate visivamente.

## Ripristino brand HFS 11/10/2026 — COMPLETE

- Ripristinata l'interfaccia della demo locale con il wordmark HFS e le etichette Horeca Food Service. La presentazione Centro Cash resta un PDF statico separato in `qa/centro-cash-presentation/` e non modifica l'app HFS.

## Microcopy WhatsApp 23/09/2026 — COMPLETE

- Sostituito “Indicatore demo” con “Confidenza” nella risoluzione prodotti WhatsApp e nel carrello dell'ordine; il valore resta la percentuale di confidenza dell'associazione prodotto. Il valore assente appare come “—”, senza simbolo %.
- PASS: 49 test unitari, typecheck, build, check:bundle e 4 test E2E mirati (telefono, tablet verticale/orizzontale, desktop). Seed e lockfile invariati.

## Refitting 23/09/2026 — COMPLETE

- Confermato: piena finestra su desktop e tablet anche verticale; pagina scorrevole sui telefoni verticali dal rapporto nominale 19,5:9. Liste, carrello, partite e analisi in pannelli interni, comandi principali fissi.
- Implementati contenitori delle 22 viste, barre azione separate, Home fluida, icone documento con + e fumetto centrato, gerarchie e contrasto maggiori.
- PASS: 44 E2E sui quattro viewport principali, 176 viste sulla build (22 × 8 viewport), 49 unit test, validazione dati, typecheck, build e controllo bundle. Zero test saltati.
- Controllo visivo completato. Corretti anche Home orizzontale, alternative WA dopo selezione e footer delle partite mobile; aggiunti controlli contro contenitori troncati e sovrapposizioni.
- Build aggiornata e verificata su http://127.0.0.1:4173/. Report: [REFIT_REPORT.md](../qa/REFIT_REPORT.md), [176 screenshot](../qa/refit/screenshots/index.html). Seed e lockfile invariati; nessun blocco aperto.
- La certificazione seguente resta il baseline precedente.

## Baseline 22/09/2026

Stato: **COMPLETE — demo locale implementata e collaudata il 22/09/2026**. Nessun deploy pubblico.
Root verificata: C:\HorecaFoodService-AppAgenti. Seed e package-lock invariati.

| Milestone | Stato | Evidenza |
|---|---|---|
| M0 baseline | PASS | 20/20 controlli dati, 42/42 test di dominio; lette specifiche e 22 PNG |
| M1 shell, DS, Home, stato | PASS | Provider, reducer, HashRouter, token, reset e persistenza; Home nei quattro viewport |
| M2 ordine manuale | PASS | Carrello canonico, quantità/UM, prezzi, condizioni, riepilogo, stock aggregato |
| M3 rete e liste | PASS | Coda idempotente, timeout cancellabile, liste, filtri, sola lettura |
| M4 FastOrder | PASS | WA841/842/843, alternative, ricerca, UM esplicita, esclusioni motivate, mapping cliente |
| M5 clienti | PASS | Quattro tab, referenti, partite per rata, condivisioni simulate |
| M6 catalogo | PASS | 120 prodotti, due depositi, filtri, scheda, visual sintetico ingrandibile |
| M7 insight | PASS | Snapshot, storico cliente, azioni e valutazioni persistenti |
| M8 QA | PASS | 49 unit test, 36 E2E, 92 screenshot, build e preview verificati, bundle pulito |

## Registro 22/09/2026
- Nessuna reinstallazione npm: setup e lockfile preesistenti verificati e riusati.
- Implementati moduli features separati, src/domain/model.ts, Store e componenti UI condivisi.
- Primo typecheck ha trovato incompatibilità dei tipi inferiti dal JSON (null, union snapshot); corretti nel modello runtime. Secondo typecheck PASS.
- Chromium installato nella cache progetto dopo EPERM nella cache utente e restrizione rete. Download autorizzato tramite escalation, senza modificare policy o permessi globali.
- Sostituito il test bootstrap con nove scenari prodotto su quattro viewport. Corrette gestione focus/Escape dei dialog, aggiornamento filtri e navigazione rapida con conservazione del contesto.
- La sandbox impediva il termine dei processi Vite: esecuzione locale autorizzata con escalation completata con exit code 0. Nessun test finale saltato.
- Esclusa dal runtime la sola nota di provenienza branding.visualSystem; seed immutato e tutti gli altri campi equivalenti, verificati da test. Dettagli in DECISIONS.md.
- Verifica finale: validate:data 20/20, unit 49/49, validatore Python 86/86, typecheck, build, check:bundle 5 file, E2E 36/36. Nessun FAIL finale.
- Preview della build su http://127.0.0.1:4173/: PASS nei quattro viewport; zero richieste esterne, download reali ed errori rilevati. Screenshot e ispezione visuale completati.

## Consegna e ripartenza

Report: [IMPLEMENTATION_REPORT.md](../qa/IMPLEMENTATION_REPORT.md). Galleria: [screenshots/index.html](../qa/screenshots/index.html).

Avvio sviluppo dalla root: `npm.cmd run dev` → http://127.0.0.1:5173/.
Build pronta in `dist/`; `npm.cmd run preview` → http://127.0.0.1:4173/.
Non restano milestone aperte. Per modifiche successive usare la suite prodotto; non ricreare seed o lockfile.
