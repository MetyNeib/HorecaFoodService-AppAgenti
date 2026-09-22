# Mappa pratica del seed

Fonte unica: `src/data/hfs_demo_data.json`. Gli Excel/CSV in references sono copie consultive. Il seed originale è immutabile; le interazioni lavorano su una deep copy e su localStorage. `validate:data` include SHA-256 approvato: un cambiamento al seed non deve essere “risolto” aggiornando l'hash senza autorizzazione.

## Entità e relazioni
| Campo root | Uso |
|---|---|
| meta / demoDefaults / branding | Clock, versione, agente e portafoglio, default rete e limiti demo |
| products / categories | Catalogo; code è stringa a sette cifre; baseUnit e units esplicite |
| warehouses / stocks | Giacenza availableBaseQuantity per productId/warehouseId |
| customers / contacts / destinations | Anagrafica, referenti e destinazioni, collegati per customerId |
| deliveryRoutes | Giorni ISO1=lunedì…7=domenica e deposito/giro; prima data utile successiva alla data demo |
| priceLists / priceListItems / customerConditions | Prezzi in centesimi per UM base e override con validità |
| orders | Tutti gli ordini in quattro stati; lines e totals sono snapshot |
| whatsappInbox | Richieste, testo, confidence, alternative; orderId punta a orders |
| scenarioBank | 14 esempi extra sintetici per collaudo, non nuove viste |
| invoices / receivables / payments | Documento distinto da rata; pagamenti agganciati a receivableId |
| insights / analyses | Segnalazioni e confronti coerenti con lo storico |
| learnedMappings / syncQueue / shareJobs | Mutazioni locali e trasmissioni simulate |
| derived | Cache descrittiva iniziale; ricalcolare nel runtime |

## Nomi precisi da non cambiare per supposizione
- Stock: `availableBaseQuantity`.
- Prezzo listino: `unitPriceBaseCents`; sconto: `discountBasisPoints` (500=5%).
- Codice collo dati: `CT`; la UI può mostrare Colli. Non convertire CT due volte.
- Scadenza: `receivables[].faceValueCents` e `instalmentNumber`.
- Coda: `entityType`, `entityId`, `operation`, `status`, `idempotencyKey`, `attempts`.
- Inbox ID può essere `WA-WA-26-00841`, mentre orderId/numero è `WA-26-00841`: usare orderId per aprire ordine, non dedurlo rimuovendo prefissi.
- Dati anagrafici demo non devono superare un validatore P.IVA reale: sono deliberatamente non reali/non instradabili.

## Dati narrativi
CLI-061001 Osteria del Faro (Pesaro), Marco Rossi AG-014, deposito Jesi DEP-07. Birra Lager Adriatica ART-0107417, latte abituale ART-0207423, alternative ART-0207430/0207433. I prodotti hanno demoKey utili al test, ma nella UI usare nomi/codici e chiavi stabili, non stringhe originali del PDF.
I tre WA sono 841(2 problemi),842(tutto abbinato),843(cotolette ambigue). `learnedMappings=[]` all'inizio, altrimenti salterebbe la demo di disambiguazione.

## Perimetro dei dati
I 120 articoli, 12 clienti e quattro agenti sono dati sintetici di supporto. La UI parte da otto clienti dell'agente e non aggiunge per questo switch agente, CRM prospect o area fido. Gli stock e i crediti non sono analisi di clienti reali. Nutrizione/allergeni mancanti restano mancanti.
