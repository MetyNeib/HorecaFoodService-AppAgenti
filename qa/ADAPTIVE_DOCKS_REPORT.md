# HFS — header/footer automatici e liste compatte

11/10/2026 — **COMPLETE_LOCAL**. Implementazione, build, regressione e verifica visuale completate.

## Risultato

Header e footer si presentano aperti all'ingresso in ogni vista e dopo reset; si richiudono dopo 1000 ms. La riapertura manuale, o un'interazione esplicita con i controlli, resta aperta fino allo scroll verticale dell'area centrale o di una lista, in entrambe le direzioni. Da chiusi rimangono soltanto il tasto account in alto a destra e il tasto footer in basso. L'icona account riapre l'intestazione con HFS/Home e i dati agente; non introduce una funzione account. Filtri e ricerche non riavviano la presentazione delle barre.

I dock ridimensionano l'area centrale, senza coprire i controlli. Conservati `inert`, nomi accessibili, `aria-controls`, `aria-expanded`, focus e riapertura da tastiera. Animazione da 220 ms, assente con reduced motion. Timer/listener puliti per navigazione, reset e StrictMode. Il semplice ritorno del focus dopo un reset non annulla la nuova chiusura automatica.

Le schede sono ricomposte tramite container query: titoli da 18px, testo di lettura da 16px, metadati da 14px e controlli alti almeno 44px. Etichette, selettori e pulsanti usano 14–16px secondo lo spazio disponibile. Tutti i dati e comandi rimangono disponibili; quantità/UM/Aggiungi condivisi fra ordine manuale e WhatsApp. I pulsanti del riepilogo sono affiancati anche su tablet verticale. Le liste corte evitano altezza vuota nella modalità scorrevole.

Ogni sottolista protegge lo spazio necessario per almeno due schede complete, misurate sulle coppie reali di righe incluse le righe tabellari. Il minimo viene ricalcolato per wrapping, contenuto, errori e resize. Con meno di due risultati vengono mostrati i soli dati presenti. 2,5–6 è un obiettivo flessibile; nelle finestre grandi possono entrare più righe. Quando questo minimo leggibile non entra nel layout fisso, viene ammesso lo scorrimento centrale concordato. Su finestre estreme più basse della stessa regione occorre muovere l'area centrale per esplorarla: la regione non viene ridotta sotto due schede né vengono rimpiccioliti ulteriormente i controlli.

## File principali

- `src/app/AppHeader.tsx`, `useDockVisibility.ts`, `StatusFooter.tsx`, `App.tsx`: header riutilizzabile, temporizzazione comune, scroll e apertura manuale.
- `src/app/listLayout.ts`, `useWorkspaceLayout.ts`: minimi delle liste e ricalcolo dopo le animazioni dei due dock.
- `src/design-system/adaptive.css`, `src/main.tsx`: densità, container query, barre ridotte e riepilogo.
- `tests/e2e/elastic.spec.ts`, `layout.spec.ts`, `workspace-helpers.ts`: timer a 900/1050 ms, apertura manuale stabile anche durante una ricerca, reset, scroll delle liste, focus, schede complete e touch target.
- `scripts/verify-elastic.mjs`: matrice della build dopo la chiusura automatica, con controllo di almeno due schede complete e assenza di contenuti tagliati.

Il test dell'indipendenza delle liste misura le posizioni dopo l'assestamento automatico dei dock, conservando l'asserzione che lo scroll prodotti non sposti il riepilogo in modalità fissa. Gli helper dei test simulano l'interazione da tastiera per usare i controlli del footer senza interferenze del timer iniziale.

## Esiti

| Comando / verifica | Esito | Evidenza |
|---|---|---|
| `npm.cmd run validate:data` | PASS — 20/20 | [data.log](adaptive/data.log) |
| `npm.cmd test` | PASS — 49/49 | [unit.log](adaptive/unit.log) |
| `npm.cmd run typecheck` | PASS | [typecheck.log](adaptive/typecheck.log) |
| `npm.cmd run build` | PASS | [build.log](adaptive/build.log); nuova `dist` |
| `npm.cmd run check:bundle` | PASS — 6 file | [bundle.log](adaptive/bundle.log) |
| `npm.cmd run test:e2e` | PASS — 90/90; 0 skipped, 0 flaky, 0 unexpected | [e2e.log](adaptive/e2e.log), [JSON](e2e-results.json), [report HTML](playwright-report/index.html) |
| `node scripts/verify-elastic.mjs` | PASS — 437/437 su 19 viewport | [layout.log](adaptive/layout.log), [JSON](elastic/layout-results.json), [galleria](elastic/screenshots/index.html) |
| `node scripts/verify-preview.mjs` | PASS — 4 viewport | [preview.log](adaptive/preview.log), [JSON](preview-verification.json) |
| Ispezione visuale dei quattro formati principali | PASS | [Galleria screenshot](elastic/screenshots/index.html) |
| Pubblicazione pubblica / altri motori browser | NOT_RUN — aggiornamento locale; Chromium | Preview locale verificata |

I formati principali sono 390×844, 768×1024, 1024×768 e 1440×900; E2E include anche 1276×550 e 768×650. La matrice della build comprende 19 dimensioni, comprese finestre basse e spazio equivalente a zoom elevato. Nessun contenuto tagliato, overflow orizzontale, errore runtime o richiesta business esterna rilevato. Screenshot nella [galleria](elastic/screenshots/index.html), con [selezione cliente telefono](elastic/screenshots/phone-customer-picker.png), [prodotti tablet verticale](elastic/screenshots/tablet-portrait-products-cart.png), [orizzontale](elastic/screenshots/tablet-landscape-products-cart.png) e [verifica WhatsApp desktop](elastic/screenshots/desktop-wa-review.png).

Nessuna dipendenza aggiornata; seed e lockfile immutati (SHA256 `2fa3e0a68029226d01a0f1911fd4aedd616aca9768038a24f5c9c3004f01c4b6` e `b397386016b578761eac5a7e969bac0ee27f7ba0aff5aade98e5cb0fa803d7ab`).

## Avvio locale

Nella root `C:\HorecaFoodService-AppAgenti`, comando `npm.cmd run preview`.

La preview esistente sulla porta 4173 serve la nuova build: http://127.0.0.1:4173/. Per aggiornare la scheda browser già aperta, ricaricare la pagina. Nessun secondo processo necessario.
