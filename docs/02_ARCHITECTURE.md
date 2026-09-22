# Architettura applicativa

## Scelte
Vite + React + TypeScript, React Router, CSS custom con token verificati, Context/useReducer. Nessun backend, Redux, UI framework pesante, servizio cloud, service worker o dipendenza da un account Figma. Il server Vite serve solo il frontend locale; non è un backend commerciale.
HashRouter è la scelta di portabilità: una build statica servita via HTTP mantiene route e refresh anche senza rewrite server. Non promettere funzionamento di dist/index.html con doppio click/file://.

## Struttura target
```
src/
  app/             router, AppShell, AppProvider, reducer, selectors, persistence
  design-system/   token, Button, SearchInput, Select, Checkbox, Chip, Tabs, Card,
                   QuantityInput, Stepper, Dialog, Snackbar, DataList
  domain/          core.ts + helpers/validators/reducers di business testabili
  data/            hfs_demo_data.json (immutabile)
  features/
    home/          HomePage
    order-editor/  CustomerPicker, ProductPicker, Cart, LineEditor, OrderReview
    fastorder/     Inbox, Review, RequestResolver
    orders/        OrdersList, ConfirmedOrderDetail
    customers/     CustomerList, CustomerDetail, OpenItems, SharePreview
    catalog/       CatalogPage, ProductDetail
    insights/      InsightsList, AnalysisPage
```
Riepilogo, editor articolo, prodotto, ricerca e righe ordine devono essere riusati tra manuale e WA. Un returnTo serializzabile nella route/query tiene origine, richiesta selezionata e filtri; non salvare funzioni React in localStorage.

## Stato
Una envelope con `schemaVersion`, `datasetId`, `data` (copia runtime del seed), `ui` minimo e `network` simulata. Mantieni UNA collezione orders. Il carrello corrente è identificato da orderId, non duplicato in currentOrder + drafts + sentOrders.
`whatsappInbox.orderId` punta a quell'ordine. `derived` è una cache di consultazione nel file originale: ignorarla/ricalcolarla dopo mutazioni. Tutte le schermate usano selector della stessa fonte.
Conservare form locale per Annulla; salvataggio con un'azione atomica. Azioni attese: CREATE_DRAFT, UPDATE_LINE, SAVE_CUSTOMER_CONDITION, SAVE_REVIEW, RESOLVE_REQUEST, EXCLUDE_REQUEST, CONFIRM_ORDER, SYNC_COMPLETE, UPSERT_CONTACT, SHARE_SIMULATED, MARK_INSIGHTS_REVIEWED, RESET_DEMO.

## Persistenza
Chiave `hfs-agent-demo-v1`; JSON con schemaVersion. All'avvio importare seed solo se manca stato valido. Non usare `Date.now()` per le date di business. Un envelope incompatibile va segnalato e ripristinato mediante reset esplicito; non fare un loop di crash.
Reset con conferma: ripristina deep clone seed, OFFLINE, contatori iniziali, learnedMappings e shareJobs vuoti; annulla timeout di sync e dialog/form pendenti. Non mettere immagini/font in localStorage.
Gestire quota/storage disabilitato: continuare in memoria con avviso, senza presentare persistenza come riuscita.

## Sync
Rete demo OFFLINE → SYNCING → ONLINE. Una transizione online programma un timeout breve di sola simulazione. Cancellare/riportare in attesa il timer tornando offline. Jobs identificati da entityId/operation/idempotencyKey. Usare i nomi reali del seed: `entityType`, `entityId`, `operation`, `status`, `attempts` (non un campo inventato `type`).
Gli helper attuali gestiscono SEND_ORDER dopo validazione; implementare nel reducer il resto del flusso, compresi contatti e shareJobs. L'effetto React può essere eseguito due volte in sviluppo: non affidargli l'unicità del job.

## Calcoli
Isolare conversioni, prezzi, sconti, margini e saldo dalle viste. Riutilizzare `core.ts`, aggiungendo i controlli mancanti. L'ordine storico conserva il prezzo/costo snapshot: non applicare listini attuali retroattivamente. Per stock aggregare tutte le righe dello stesso prodotto nel deposito, non validarle isolatamente.
Non convertire gli input prezzo con `parseFloat('1,25')`: una funzione locale valida virgola e centesimi. Quantità massima 3 decimali e step per UM. I calibri del testo WA non sono quantità.

## Adaptive
Riferimento 1024x768 e 768x1024, verifica anche 390x844 e 1440x900. Max-width e CSS grid/flex. Desktop/tablet affiancano i due blocchi del PDF, mobile li impila nello stesso ordine DOM. Niente display:none di informazioni o sostituzione menu con hamburger. Tab e azioni vanno a capo mantenendo i controlli. Liste/tabelle possono diventare righe impilate ma tutti i valori rimangono etichettati. Una disclosure disponibile a tutti i dispositivi è ammessa per contenuti secondari, non come scorciatoia per nascondere il carrello su mobile.

## Asset e deployment
Solo `src/` e asset sintetici ammessi in `public/`. Nessun import glob su references. Nessun font remoto obbligatorio. Documenti e FIG restano fuori bundle. `check:bundle` è una barriera preliminare, non una prova completa di privacy: E2E deve intercettare chiamate esterne. Dist servita via HTTP, non un hosting pubblico automaticamente.
