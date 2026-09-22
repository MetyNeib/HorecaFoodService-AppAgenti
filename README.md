# Horeca Food Service · App Agenti

**Consegna: kit di implementazione locale Step 3, v1.0.0.**
Questo progetto contiene una base React/TypeScript, non ancora l'applicazione completa a 22 viste. Il prompt Codex e tutte le fonti necessarie all'implementazione sono inclusi.

## Avvio
Da questa cartella, con Node LTS (raccomandato 24.x; minimo del kit 22.12):
```powershell
npm.cmd install
npm.cmd run validate:data
npm.cmd test
npm.cmd run dev
```
Il browser a `http://127.0.0.1:5173` mostra il bootstrap con verifica catalogo. In Codex aprire la cartella radice del progetto e inviare `docs/CODEX_START_PROMPT.md`.

## Cosa è già disponibile
Seed approvato, token/colori verificati nei FIG, inventario componenti, PDF originale, 22 immagini, 204 collegamenti estratti, specifica route/stati/controlli, funzioni pure prezzi/UM/margini/partite/coda con test, configurazione Playwright e script di verifica.
Il file `qa/BOOTSTRAP_VALIDATION.json` distingue le verifiche effettivamente eseguite dalle verifiche da eseguire localmente.

## Ordine di lettura
`AGENTS.md` → `docs/00_START_HERE.md` → specifiche → fonti. Il PDF conserva la struttura; la call precisa il comportamento; Figma fornisce lo stile. Il mockup Figma è un'altra applicazione, mai il target funzionale.

## Organizzazione
- `src/`: codice applicativo, helper e seed sintetico importabile.
- `docs/`: specifiche, avvio Codex, checkpoint e accettazione.
- `references/functional/`: PDF, immagini e navigazione, solo per lo sviluppo.
- `references/design/`: FIG e token/inventari estratti, solo per lo sviluppo.
- `references/data/`: contratto approvato e copie leggibili del seed.
- `fixtures/`: casi di accettazione e messaggi sintetici inclusi nel seed.
- `tests/`: unit test presenti; E2E bootstrap da estendere/sostituire.
- `qa/`: esiti verifiche, screenshot e report.
- `scripts/`: controlli integrità/dati/bundle.

Non includere `references/` nella build o in un deploy. Non copiare raw cataloghi, FIDO, INSOLUTO o screenshot WhatsApp reali nel progetto. Sono stati deliberatamente esclusi.

## Dipendenze / riproducibilità
Non sono inclusi `node_modules`, font binari o un lockfile fittizio. Nel container di preparazione il registry npm non era raggiungibile: la prima `npm install` locale deve risolvere le versioni compatibili e generare `package-lock.json`. Registrare i risultati nel report e usare poi `npm ci`.
La guida esterna `GUIDA_SETUP.md` riguarda la copia iniziale da Download alla cartella Windows; non va rieseguito l'installer su un progetto già modificato.
