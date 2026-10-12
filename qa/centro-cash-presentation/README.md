# Centro Cash order app — presentazione

- PDF finale: [Centro-Cash-order-app-presentazione.pdf](Centro-Cash-order-app-presentazione.pdf), 7 pagine 16:9.
- Sorgente impaginato: [presentazione.html](presentazione.html).
- Schermate: `screens/`, 14 acquisizioni reali della build locale a 1280 × 720 pixel (densità 2×).
- Anteprime delle slide: `slide-previews/`.
- Marchio: `logo-official.png`, wordmark ufficiale da https://centrocash.net/wp-content/uploads/2020/11/cropped-centrocash_logo.png, coerente con l'immagine fornita dall'utente; il sottotitolo è testo HTML.

Per rigenerare dalla root, avviare `npm.cmd run build`, quindi `npm.cmd run preview` sulla porta 4173 e `node scripts/build-centro-cash-presentation.mjs` in un altro terminale. Il generatore controlla che le sette slide e tutte le immagini siano caricate e non escano dai margini, poi stampa il PDF.

Verifica 25/09/2026: `validate:data` 20/20, unit 49/49, typecheck PASS, build PASS, `check:bundle` PASS (6 file), Playwright E2E 44/44 PASS. PDF `%PDF-1.4`, 7 oggetti pagina, 3.238.235 byte. Ispezione visiva delle sette anteprime completata.

Le schermate mostrano dati sintetici del seed storico. La geografia e i codici dimostrativi non rappresentano l'anagrafica reale Centro Cash. I flussi WhatsApp, email e PDF dell'app sono simulati; la presentazione non dichiara integrazioni operative.
