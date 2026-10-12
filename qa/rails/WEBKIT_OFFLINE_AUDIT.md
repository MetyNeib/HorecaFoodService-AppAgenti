# Playwright WebKit offline: audit dell'ambiente di collaudo

Data: 12 ottobre 2026. L'errore `WebKit encountered an internal error` ottenuto
con Playwright 1.63.0 durante una navigazione controllata dal service worker,
dopo `context.setOffline(true)`, è riproducibile senza codice HFS.

## Evidenza indipendente

Lo script `tests/rails-pwa/repro-webkit-offline.mjs` crea una nuova origine HTTP locale e
un service worker minimo che restituisce HTML letterale. Non legge né modifica
Rails, i dati HFS o gli account di collaudo. Prima della prova verifica che la
pagina sia controllata dal worker e che una navigazione online riceva il suo
HTML. Ogni caso usa un contesto browser e un server distinti.

| Playwright 1.63.0, Windows | Emulazione offline | Server locale arrestato |
| --- | --- | --- |
| Chromium 153.0.8010.12 | PASS | PASS |
| WebKit 26.6, build 2359 | FAIL: internal error prima del caricamento | PASS |

Comando eseguito con i browser locali già installati:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'C:\HorecaFoodService-AppAgenti\.playwright-browsers'
node tests/rails-pwa/repro-webkit-offline.mjs
```

Il risultato grezzo è in `webkit-offline-repro-1.63.0.json`. Questo confronto
isola il difetto dell'emulazione: WebKit riesce a navigare sullo stesso worker
quando il server è realmente irraggiungibile.

## Fonti ufficiali e correzione

- [Issue Playwright #42775](https://github.com/microsoft/playwright/issues/42775)
  riproduce lo stesso problema con la stessa versione, anche nel container
  Linux ufficiale e su macOS: spostare Playwright 1.63.0 in Docker non lo risolve.
- [Correzione #42894](https://github.com/microsoft/playwright/pull/42894),
  incorporata il 5 ottobre 2026, corregge la navigazione WebKit offline gestita
  dal service worker.
- [Release stabile 1.64.0](https://github.com/microsoft/playwright/releases/tag/v1.64.0),
  pubblicata il 7 ottobre 2026: aggiornare pacchetto e browser insieme, quindi
  rieseguire la riproduzione e l'intera suite PWA. Nessun test va saltato.

## Risposta persa dopo commit

Il test che intercetta `/commands` con `page.route` ha un problema distinto:
la richiesta può essere gestita dal service worker e quindi non attraversare
la route della pagina. La [documentazione ufficiale sui service worker](https://playwright.dev/docs/service-workers)
distingue richieste della pagina e richieste del worker; le API Playwright
specifiche per worker e relativo routing sono disponibili su Chromium.
Questo limite non equivale all'assenza di service worker nativi in WebKit.

Per mantenere il caso di prova su entrambi i motori, il test può avvolgere il
trasporto del client, attendere la risposta HTTP reale dopo il commit server,
poi generare una singola perdita della risposta prima che il client la usi.
Il replay deve riutilizzare lo stesso operationId, svuotare la coda e verificare
che ordine e revisione server non siano duplicati. Il backend resta reale.

I fallimenti sul cambio account, osservati anche su Chromium, richiedono invece
un'indagine applicativa separata: non sono attribuibili a questo bug WebKit.

## Validazione successiva

Lo stesso script, senza modifiche, è stato eseguito con Playwright 1.64.0 e
i browser abbinati. Risultati grezzi in `webkit-offline-repro-1.64.0.json`:

| Playwright 1.64.0, Windows | Emulazione offline | Server locale arrestato |
| --- | --- | --- |
| Chromium 156.0.8078.4 | PASS | PASS |
| WebKit 27.2, build 2370 | PASS | PASS |

La correzione dell'ambiente è confermata: 4 casi su 4 PASS. Il risultato della
suite applicativa HFS resta indipendente e viene riportato in `pwa-results.json`.
Il test WebKit automatizzato non certifica un'installazione su un dispositivo
Apple fisico: quella verifica resta distinta.
