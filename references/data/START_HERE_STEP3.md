# START HERE — Step 3 App Agenti Horeca Food Service
STATUS=DATA_READY
DATASET_ID=HFS-AGENT-DEMO-20260922-V1
SCHEMA_VERSION=1.0.0
FREEZE_DATE=2026-09-22
VALIDATION=PASS_86_OF_86
IMPLEMENTATION_STATUS=NOT_STARTED_IN_THIS_DELIVERY

## Decisioni utente già fissate
Brand: Horeca Food Service. Logo semplice autorizzato, da realizzare nello Step 3.
Geografia: Marche ed Emilia-Romagna. Depositi fittizi a Jesi e Rimini.
Nomi generici italiani per agenti e referenti; nessun cliente/contatto reale.
Catalogo general foodservice misto, con nomi commerciali e codici inventati da pattern dei file allegati.
Tablet first, adaptive a desktop e smartphone mantenendo gli stessi elementi. Consentito ricomporre/impilare, non rimuovere funzionalità in base al device.
Conservare posizione e organizzazione del PDF; cambiare soprattutto lo stile.
Prototipo con stato condiviso e persistenza locale; online/offline simulato.
Niente prospect. Solo insight già mostrati, niente configuratore alert.
Invio WhatsApp/email/PDF esclusivamente simulato.
Il Figma di esempio rappresenta un'altra app: non copiarne struttura, funzioni o navigazione.

## Ordine di lettura
1. Questo documento e DATA_CONTRACT.md.
2. hfs_demo_data.json (seed canonico) e validation_report.json.
3. step3_acceptance_scenarios.json.
4. PDF e transcript della call, per flussi e posizione dei componenti.
5. Design system nei file GastroSupply-shared.fig e GastroSupply-shared (1).fig; controllare i token effettivi degli allegati.
I CSV/XLSX sono viste leggibili del seed, non nuove fonti canoniche.

## Modello funzionale già progettato
Home; nuovo ordine cliente → prodotti/carrello → modifica articolo → riepilogo.
FastOrder: inbox → eccezioni + bozza → scelta prodotto/ricerca → stesso riepilogo.
I miei ordini: bozze, da inviare, inviati.
Clienti: anagrafica/referenti, ordini, partite aperte, invio simulato, condizioni commerciali.
Catalogo con giacenze per deposito e scheda prodotto con ritorno contestuale.
Insight: inbox → analisi → ipotesi/azioni → cliente/nuovo ordine/valutata.
Nota dell'ordine destinata al documento di consegna, senza tre checkbox per documenti differenti.
Pagamento modificabile nell'ordine, senza alterare il default cliente.
Non aggiungere una sidebar presa dall'app Figma di esempio.
Logo semplice e asset prodotti sono ancora da produrre: gli asset WhatsApp reali non sono asset UI.

## Base dati consegnata
{
  "products": 120,
  "categories": 10,
  "agents": 4,
  "warehouses": 2,
  "deliveryRoutes": 4,
  "customers": 12,
  "contacts": 24,
  "destinations": 13,
  "priceLists": 4,
  "priceListItems": 480,
  "stocks": 240,
  "customerConditions": 6,
  "orders": 30,
  "whatsappInbox": 3,
  "scenarioBank": 14,
  "invoices": 18,
  "receivables": 19,
  "payments": 5,
  "insights": 3,
  "analyses": 2
}

Sono 12 clienti totali, dei quali 8 nel portafoglio iniziale di Marco Rossi.
Gli altri agenti e clienti sono dati di supporto, non impongono una nuova funzione di cambio agente.
Stato iniziale Home: 2 bozze, 1 da inviare, 24 inviati, 3 verifiche WhatsApp.
WA-26-00841: 8 richieste, 2 da risolvere (latte esaurito, spezzatino manuale).
WA-26-00842: 5 richieste, tutte abbinate.
WA-26-00843: 6 richieste, 1 ambigua; unità “2 cotolette” da confermare.
14 fixture messaggi: 13 ispirate alle immagini reali, più la combinazione latte/spezzatino della call.
Il seed non contiene immagini delle fonti reali. Le fixture fotografiche sono trascrizioni sintetiche; richiedono nuovi asset solo se utilizzate come foto in UI.

## Dataset narrativo principale
Osteria del Faro SRL, Pesaro, cliente CLI-061001:
il suo latte abituale è a stock zero nel deposito di Jesi; due alternative disponibili.
Lo stesso cliente ha lo storico necessario per filtro già acquistati e insight verificabili.
Saldo aperto €587,46, scaduto €450,00, incassato €100,00, nota credito -€12,54.
Trattoria dei Tigli SRL, Fano: ultimo ordine 10/09/2026, 12 giorni prima; precedenti intervalli 7 giorni.
Brand/clienti/codici/contatti/prezzi/stock/importi sono sintetici.

## Riferimenti originali, da non includere nella build
Centro-Cash-App-Agenti-Mockup-grafico-interattivo.pdf e transcript fornito nella chat: requisiti funzionali.
GastroSupply-shared.fig / GastroSupply-shared (1).fig: stile e uso del design system.
Anagra_art (2) (1).xls; Catalogo_itarca_1.xlsx; ARTICOLI.csv: pattern catalogo.
FIDO.csv; INSOLUTO.csv; TABGIR.csv: pattern amministrativi/logistici.
Analisi ordini WA commentata.xlsx: 13 fogli/immagini e commenti.
Le estrazioni complete e le mappe reali sono nell'archivio HFS_Source_Audit_PRIVATE_v1.zip separato.
Non importare audit_private nei sorgenti, nel bundle o nei dati di presentazione.

## Direzione tecnica prevista, non ancora implementata
Vite + React + TypeScript, CSS token del design system, stato condiviso con Context/useReducer, localStorage e routing contestuale.
Nessun backend o AI reale. Nessun deploy cloud necessario per il primo prototipo.
Step 3 deve produrre progetto completo, build se supportata, ZIP e istruzioni locali; non dichiarare un hosting pubblico o preview funzionante senza verificarli.

## Verifica
`python validate_demo.py` verifica il seed, non la UI.
86 controlli PASS, 0 FAIL al congelamento. Hash dei file in MANIFEST.json.
Usare lo stesso orologio demo e lo stesso snapshot per rendere ripetibili date, filtri e insight.
Gli originali sono rimasti invariati.
