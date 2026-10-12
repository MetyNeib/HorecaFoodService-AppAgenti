# HFS — footer inizialmente aperto e chiusura allo scorrimento

**Report storico:** la successiva decisione dell'utente introduce la chiusura dopo un secondo per header e footer, apertura manuale fino allo scroll anche delle liste e schede più compatte. Stato e collaudo correnti in [ADAPTIVE_DOCKS_REPORT.md](ADAPTIVE_DOCKS_REPORT.md).

11/10/2026 — **COMPLETE_LOCAL**: implementazione, build, regressione e verifica visuale completate.

## Comportamento

Il footer parte aperto all'ingresso in ogni vista, anche compatta, e dopo reset. Al primo avanzamento dello scorrimento centrale si richiude con animazione di 220 ms. Da chiuso rimane accessibile soltanto il tasto di apertura, da 44 px: lo stato rete e gli altri comandi sono dentro il pannello. Risalire o ridimensionare la finestra non lo riapre; la riapertura è manuale. Scorrere una lista interna quando la pagina centrale è già contenuta nella finestra non lo richiude.

I controlli nascosti sono `inert`; nome accessibile, `aria-controls`, `aria-expanded`, focus e riapertura con Enter conservati. Con `prefers-reduced-motion` non ci sono animazioni. Il dock ridimensiona l'area centrale e non copre le CTA. La regola precedente di apertura allo scroll è sostituita.

## Modifiche

- `src/app/StatusFooter.tsx`: stato iniziale aperto, reset per vista, chiusura all'avanzamento dello scroll centrale; rimossa la dipendenza dalla densità compatta e lo stato rete esterno al pannello.
- `src/app/App.tsx`: rimossa la prop `compact` del footer; il rilevamento del layout elastico rimane attivo.
- `src/design-system/elastic.css`: eliminato lo stile del badge esterno; disabilitato l'ancoraggio automatico dello scroll centrale durante il ridimensionamento del dock.
- `tests/e2e/elastic.spec.ts`: aggiornate le aspettative, verificati apertura iniziale, chiusura, un solo pulsante da chiuso, tastiera, reset sulla stessa route, riapertura a fondo pagina senza animazione e liste autonome.

Un controllo aggiuntivo ha inizialmente rilevato una riapertura instabile a fondo pagina con reduced motion: il browser spostava automaticamente lo scroll durante l'espansione del footer. `overflow-anchor: none` elimina questo spostamento. Il caso è stato aggiunto alla regressione; lo smoke sulla build verifica la riapertura a fondo pagina sia con animazione sia senza, su telefono e finestre basse.

## Verifiche eseguite

| Comando / controllo | Esito | Evidenza |
|---|---|---|
| `npm.cmd run validate:data` | PASS — 20/20 | [footer-data.log](elastic/footer-data.log) |
| `npm.cmd test` | PASS — 49/49 | [footer-unit.log](elastic/footer-unit.log) |
| `npm.cmd run typecheck` | PASS | [footer-typecheck.log](elastic/footer-typecheck.log) |
| `npm.cmd run build` | PASS | [footer-build.log](elastic/footer-build.log); `dist` aggiornata |
| `npm.cmd run check:bundle` | PASS — 6 file | [footer-bundle.log](elastic/footer-bundle.log) |
| `npm.cmd run test:e2e` | PASS — 90/90 su 6 viewport | [footer-e2e.log](elastic/footer-e2e.log), [JSON](e2e-results.json), [report HTML](playwright-report/index.html); 0 skipped, 0 flaky, 0 unexpected |
| `node scripts/verify-elastic.mjs` | PASS — 437/437 su 19 viewport | [footer-layout-check.log](elastic/footer-layout-check.log), [JSON](elastic/layout-results.json), [galleria](elastic/screenshots/index.html) |
| `node scripts/verify-preview.mjs` | PASS — 4 viewport | [footer-preview-check.log](elastic/footer-preview-check.log), [JSON](preview-verification.json) |
| Smoke footer sulla build | PASS — 7 viewport | [footer-bottom-smoke.log](elastic/footer-bottom-smoke.log), [JSON](elastic/footer-preview-bottom.json) |
| Controllo visivo footer | PASS | [desktop chiuso](elastic/desktop-footer-closed-after-scroll.png), [desktop riaperto](elastic/desktop-footer-manually-open.png), [telefono chiuso](elastic/footer-preview-390x844-closed.png), [telefono riaperto a fondo pagina](elastic/footer-preview-390x844-reopened-bottom.png) |

Lo smoke specifico della build copre 390×844, 768×500, 1276×550, 1440×400, 768×1024, 1024×768 e 1440×900. Nei primi quattro formati l'area centrale scorre e vengono verificate chiusura e riapertura a fondo pagina; negli altri tre la Home entra nella finestra e il footer rimane aperto. I controlli funzionali della preview coprono 390×844, 768×1024, 1024×768 e 1440×900 senza richieste esterne, download inattesi o errori runtime.

La matrice della build copre 22 viste e lo stato WA con alternativa selezionata su 19 viewport: 437 verifiche PASS, screenshot rigenerati e nessun errore runtime, overflow orizzontale, CTA irraggiungibile, richiesta business esterna o download inatteso rilevato. Controllo visivo eseguito sui quattro formati principali e sul footer aperto/chiuso a desktop e telefono. La suite E2E finale è terminata in 261,1 secondi; tutti i controlli richiesti sono stati eseguiti.

Nessuna dipendenza aggiornata. Seed e lockfile immutati: SHA256 `2fa3e0a68029226d01a0f1911fd4aedd616aca9768038a24f5c9c3004f01c4b6` e `b397386016b578761eac5a7e969bac0ee27f7ba0aff5aade98e5cb0fa803d7ab`.

## Avvio locale

Nella root `C:\HorecaFoodService-AppAgenti`:

```powershell
npm.cmd run preview
```

URL verificato: http://127.0.0.1:4173/. Preview già attiva (PID 9344), che serve la nuova `dist`; non occorre avviare un secondo processo. Per vedere la modifica nella scheda browser già aperta, ricaricare la pagina.
