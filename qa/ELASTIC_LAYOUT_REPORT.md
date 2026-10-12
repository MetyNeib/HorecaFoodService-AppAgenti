# HFS — layout elastico e footer richiudibile

Questo report documenta il primo intervento sul layout elastico. La regola del footer è stata successivamente invertita e il collaudo aggiornato a 90 E2E e 437 verifiche del layout PASS: vedere il [report corrente](FOOTER_BEHAVIOR_REPORT.md).

11/10/2026 — **COMPLETE_LOCAL** del primo intervento. Codice, build e collaudo completati nella root `C:\HorecaFoodService-AppAgenti`. In quel momento la pubblicazione ngrok era stata bloccata dal controllo automatico di esecuzione; nessun URL pubblico dichiarato attivo.

## Risultato

La pagina prova prima proporzioni normali, poi una densità compatta con spazi, titoli e icone ridotti moderatamente. Quando il contenuto non entra rispettando le dimensioni operative, l'area centrale può scorrere. La scelta viene ricalcolata per resize, modifiche del contenuto, messaggi di errore, caricamento font e visualViewport; non dipende dal solo rapporto dello schermo.

Clienti, Catalogo e Statistiche restano tre card separate. Da 1100px di larghezza, nella modalità compatta, possono stare sulla stessa riga; sui tablet più stretti Statistiche conserva la riga dedicata. I testi principali restano almeno 16px, i titoli compatti almeno 22–24px e i pulsanti principali almeno 44px. I pannelli delle liste hanno uno spazio operativo protetto, anziché restringersi a pochi pixel; i form si espandono nella modalità scorrevole. Prodotti/carrello e richieste WA/bozza conservano l'organizzazione a colonne, impilandosi sui formati stretti.

Il footer rimane ancorato al bordo inferiore. In modalità compatta mostra stato rete e un pulsante da 44px per riaprire i comandi. Si apre con animazione di 220ms, manualmente o avanzando nello scorrimento centrale. La sua altezza ridimensiona il workspace senza coprire CTA o dati. Controlli chiusi `inert`, nome accessibile, `aria-expanded`, gestione del focus e `prefers-reduced-motion` verificati. Il reset ricollega gli observer/listener al nuovo elemento main anche restando sulla stessa route.

## Esiti finali

| Comando / controllo | Esito | Evidenza |
|---|---|---|
| Root e file di progetto presenti | PASS | Root richiesta; AGENTS e documentazione letti; nessun nuovo progetto |
| `npm.cmd run validate:data` | PASS — 20/20 | [data.log](elastic/data.log) |
| `npm.cmd test` | PASS — 49/49 | [unit.log](elastic/unit.log) |
| `npm.cmd run typecheck` | PASS | [typecheck.log](elastic/typecheck.log) |
| `npm.cmd run build` | PASS | [build.log](elastic/build.log); dist aggiornata |
| `npm.cmd run test:e2e` | PASS — 84/84 | [e2e.log](elastic/e2e.log), [JSON](e2e-results.json), [report HTML](playwright-report/index.html); 0 skipped, 0 flaky, 0 unexpected; durata 212,5 s |
| `npm.cmd run check:bundle` | PASS — 6 file | [bundle.log](elastic/bundle.log); nessun riferimento privato noto |
| `node scripts/verify-preview.mjs` | PASS — 4 viewport | [preview-check.log](elastic/preview-check.log), [JSON](preview-verification.json) |
| `node scripts/verify-elastic.mjs` | PASS — 437/437 | [layout.log](elastic/layout.log), [JSON](elastic/layout-results.json) |
| Controllo visivo e screenshot | PASS | [Galleria](elastic/screenshots/index.html); 633 PNG, inclusi fondi delle viste scorrevoli |
| Rete business esterna, errori runtime, download inattesi | PASS — nessuno | Intercettati nei test E2E e nella verifica della build |
| Preview riavviata dopo il collaudo | PASS | HTTP 200 su `http://127.0.0.1:4173/`; verificati titolo HFS e asset della build corrente; smoke della build nei quattro viewport ripetuto dopo il riavvio: [preview-after-restart.log](elastic/preview-after-restart.log) |
| Avvio automatico ngrok | FAIL — azione rifiutata | `exec_command` ha rifiutato Start-Process ngrok con `blocked by policy`; nessun dettaglio ulteriore e nessun processo ngrok attivo |
| Verifica URL pubblico | NOT_RUN | Tunnel non avviato |
| Browser Firefox/WebKit, tablet fisici e utenti reali | NOT_RUN | Collaudo Chromium; leggibilità controllata visualmente e geometricamente, senza sessioni con utenti finali |

Nessun FAIL finale nei test del prodotto. L'avvio ngrok bloccato è distinto dal collaudo locale.

## Copertura

La suite conserva tutti i flussi di prodotto: ordine manuale, prezzi/UM/condizioni, conferma offline e sync idempotente, tre ordini WA, ambiguità, referenti, partite, condivisioni simulate, catalogo, insight, persistenza e reset. Aggiunti resize consecutivi con ritorno alla finestra grande, footer/tastiera/focus, riapertura dopo reset sulla stessa route, selezione WA e validazioni con altezza ridotta.

I sei progetti E2E sono 390×844, 768×1024, 1024×768, 1440×900, 1276×550 e 768×650. La matrice della build copre le 22 viste più la conferma dell'alternativa WA dopo selezione in **19 viewport**: 390×844, 768×1024, 1024×768, 1440×900, 1920×872, 1366×768, 600×960, 412×915, 1276×550, 1276×650, 1024×568, 768×650, 768×500, 600×500, 1440×400, 736×414, 390×500, 1276×738 e 1024×350. Il formato 736×414 simula lo spazio CSS ridotto dall'ingrandimento del browser, senza dichiarare una prova su un dispositivo fisico.

Verificati overflow orizzontale, contenitori troncati, spazio delle regioni scorrevoli, footer, CTA completamente raggiungibili e comportamento dopo apertura del footer. Ispezionati Home, prodotti/carrello, riepilogo e conferma WA su desktop/tablet/telefono e nelle altezze problematiche. Nessun elemento o colonna commerciale rimosso.

Durante il lavoro sono stati corretti un riavvio continuo dell'animazione causato dalle misurazioni del footer e un'estensione residua dello scorrimento del documento dopo il focus nelle liste WA su Chromium. Le misurazioni ora preservano l'animazione e il documento esterno è fisso: lo scorrimento rimane nei contenitori previsti. Sono problemi emersi durante questa modifica, non errori del bootstrap.

## File e dati

Implementazione: [useWorkspaceLayout.ts](../src/app/useWorkspaceLayout.ts), [StatusFooter.tsx](../src/app/StatusFooter.tsx), [elastic.css](../src/design-system/elastic.css), integrazione nella shell/Home e distinzione liste/contenuti nei componenti condivisi. Test: [elastic.spec.ts](../tests/e2e/elastic.spec.ts), [layout.spec.ts](../tests/e2e/layout.spec.ts), helper condiviso e [verify-elastic.mjs](../scripts/verify-elastic.mjs).

Nessuna nuova dipendenza. Seed invariato, SHA-256 `2fa3e0a68029226d01a0f1911fd4aedd616aca9768038a24f5c9c3004f01c4b6`. Package-lock invariato, SHA-256 `b397386016b578761eac5a7e969bac0ee27f7ba0aff5aade98e5cb0fa803d7ab`. La build contiene solo HTML/CSS/JS e l'asset logo Centro Cash storico non utilizzato dall'app HFS; nessun documento di riferimento, font binario o screenshot. La presentazione Centro Cash resta separata in qa.

## Avvio e checkpoint pubblicazione

Preview attiva: **http://127.0.0.1:4173/**. Processo Vite preview PID 9344; server temporaneo di verifica sulla porta 5174 terminato. Nessun processo ngrok attivo alla consegna.

Per riavviare localmente dalla root:

```powershell
npm.cmd run preview
```

Per aprire dal proprio terminale il tunnel pubblico già configurato:

```powershell
ngrok http http://127.0.0.1:4173
```

L'URL pubblico sarà il valore HTTPS di Forwarding mostrato da ngrok. Il PC, la preview e il tunnel devono restare attivi. La preview Vite già ammette i sottodomini ngrok-free.dev. Prossimo controllo dopo l'avvio manuale: aprire Forwarding e verificare Home/ordine e asset della build; non è stato inventato un URL.
