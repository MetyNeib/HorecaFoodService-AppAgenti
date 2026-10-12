# Horeca Food Service — App Agenti

Demo locale React + TypeScript + Vite. Comprende ordine manuale, FastOrder WhatsApp, bozze/coda/storico, schede clienti, partite, catalogo e insight. Tutti i dati sono sintetici; nessuna trasmissione business è reale.

## Avvio dalla root già installata

```powershell
cd C:\HorecaFoodService-AppAgenti
npm.cmd run dev
```

Apri **http://127.0.0.1:5173/**. Non occorre reinstallare il progetto né fornire API key.

Per usare la build statica già prodotta:

```powershell
npm.cmd run preview
```

Apri **http://127.0.0.1:4173/**. Servire `dist/` via HTTP; non aprire `dist/index.html` con doppio click.

## Demo

Refitting del 23/09: desktop e tablet (anche verticale) occupano tutta la finestra. Liste, carrello e contenuti estesi scorrono nei propri pannelli; totali e azioni restano visibili. I telefoni verticali dal rapporto nominale 19,5:9 usano lo scorrimento normale della pagina. Dettagli e screenshot in `qa/REFIT_REPORT.md`.

L'agente è Marco Rossi (014), con otto clienti. Clock fisso: 22 settembre 2026, ore 09:30. Si parte offline, con 2 bozze, 1 ordine da inviare, 24 inviati e 3 verifiche WhatsApp.

- **Nuovo ordine**: scegli cliente e prodotti, modifica quantità, UM, prezzi e condizioni; controlla il riepilogo e conferma.
- **WhatsApp**: risolvi le richieste mancanti o ambigue, oppure escludile con motivazione. Il carrello e il riepilogo sono gli stessi del flusso manuale.
- **Passa online**: simula il completamento dei job locali. Ordini confermati e inviati si aprono in lettura.
- **Reset demo**: dal footer, conferma **Ripristina seed** per annullare tutte le modifiche, ripristinare il dataset e tornare offline.

La persistenza usa `hfs-agent-demo-v1` in localStorage con schemaVersion. In caso di storage non disponibile si continua in memoria con avviso. Un dato corrotto non viene sovrascritto senza reset esplicito.

WhatsApp, email e PDF sono simulazioni, compreso il download PDF. Le anteprime HTML non sono documenti fiscali. I visual dei prodotti sono vettoriali sintetici; i dati tecnici mancanti rimangono indicati come non disponibili.

## Verifica

```powershell
npm.cmd run validate:data
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run check:bundle
```

Playwright usa Chromium nella cache `.playwright-browsers` del progetto. Se si trasferisce la repository su un altro PC:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.playwright-browsers'
npx.cmd playwright install chromium
```

Il lockfile originale è conservato. Per una reinstallazione necessaria delle dipendenze usare `npm.cmd ci`, senza aggiornare le versioni.

Risultati: `qa/IMPLEMENTATION_REPORT.md`, `qa/e2e-results.json`, `qa/playwright-report/index.html` e `qa/screenshots/`. Il report bootstrap preesistente rimane distinto dalle verifiche del prodotto.

## Struttura

- `src/app`: shell, router, provider, persistenza e filtri URL.
- `src/domain`: helper puri, modello runtime e reducer.
- `src/design-system`: token verificati, CSS e controlli condivisi.
- `src/features`: moduli separati per i flussi applicativi.
- `src/data/hfs_demo_data.json`: seed approvato e immutato.
- `references`, `docs`, `fixtures`: fonti di sviluppo, escluse dalla build.

La consegna è locale. Non è stato eseguito un deploy pubblico.
