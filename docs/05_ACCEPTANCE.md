# Criteri di accettazione — app completa

Il test `bootstrap.spec.ts` incluso è una verifica iniziale della schermata tecnica. Va sostituito durante M1/M8 con test del prodotto vero. Passare quel test NON completa lo Step 3.

## Flussi minimi end-to-end
1. **Ordine manuale**: Home → cliente → cerca codice e nome → filtra categoria e Già acquistati → aggiungi collo e pezzi → cambia UM/quantità → editor prezzo libero/sconto/listino → salva condizione → riepilogo con nota e pagamento → conferma offline. Verificare totali, riga condizione e bozza/coda.
2. **Idempotenza rete**: ordine confermato due volte, online → sync, offline → online ripetuto, reload. Un solo ordine inviato, una sola mutazione contatori. Reset durante timeout non deve inviare ordini ripristinati.
3. **WA esaurito**: WA-26-00841, latte ART-0207423 a stock zero, scelta alternativa ART-0207430 o ART-0207433; 2CT convertiti con l'unità del nuovo prodotto. Seconda richiesta spezzatino trovata manualmente 2KG. Riepilogo abilitato dopo le due risoluzioni, carrello stesso oggetto. Salva/Riprendi preserva stato intermedio.
4. **WA ambiguo**: WA-26-00843, “2 cotolette”, confermare prodotto e UM esplicitamente. Tasto riepilogo non attivo solo perché confidence elevata. Escludi richiede motivo, conserva testo originale. Richiesta risolta manualmente memorizza mapping solo per cliente.
5. **Bozze/liste**: nuova bozza appare nelle liste cliente e globali; Riprendi mantiene ID; elimina confermato aggiorna tutto. Inviati ha filtri date funzionanti e dettagli snapshot in lettura.
6. **Clienti e condizioni**: ricerca nome/codice/taxId demo; aggiungi/modifica referente; WhatsApp offline “in attesa sync”. Condizioni attive/scadute/future visualizzate correttamente; salvare override di pagamento non cambia default cliente.
7. **Partite**: CLI-061001 saldo58746/scaduto45000/incassato10000cent. Credito-1254 riduce una sola volta. Fattura a due rate non duplicata. Filtri/Apri/anteprima funzionanti; WhatsApp/email/download esclusivamente simulati e nessuna chiamata esterna.
8. **Catalogo**: 120 articoli, due depositi, stock coerente; filtri combinati; zero stock consultabile, conferma ordine bloccata se indisponibile; nessuna perdita carrello visitando scheda. Immagine ingrandibile, descrizione espandibile, null mostrati senza invenzioni.
9. **Insight**: 8→4 ordini, 2400→1560€, bevande1000→240€, medio300→390€. Apri dati cliente corretto. Segna valutata sposta segnalazioni, non cancella ordini. Nuovo ordine da insight precompila cliente, nessun articolo non scelto.
10. **Persistenza**: refresh conserva bozza/prezzi/risoluzioni/valutazioni; reset ricrea seed esatto e stato OFFLINE. Dati corrotti/storage pieno gestiti con messaggio e senza crash.

## Controlli visuali obbligatori
Viewport: 390x844, 768x1024, 1024x768, 1440x900. Acquisire Home, prodotti+carrello, editor riga, verifica WA, scheda cliente/partite, catalogo e analisi.
Stessi controlli presenti e raggiungibili nei quattro viewport; niente hamburger sostitutivo, CTA nascoste o colonne eliminate. Nessun overflow orizzontale della pagina; ordine dei blocchi del PDF mantenuto. Font/form non microscopici, target touch, labels non tagliate, tab che vanno a capo, footer non copre le CTA.
Ogni controllo interattivo ha stato focus, nome accessibile e feedback; dialog ha focus trap e ritorno focus, Escape, chiusura. Disabilitato con ragione, non semplicemente grigio senza spiegazione. Evidenza visiva non soltanto colore. Prefer-reduced-motion rispettato.

## Sicurezza e bundle
La pagina in esecuzione non deve chiamare endpoint WhatsApp/email/ERP/AI. Intercettare via Playwright richieste esterne e far fallire il test. Durante install npm o browser Playwright il download è previsto: è distinto dalle chiamate business runtime.
Non includere PDF, FIG, XLSX, font binari, cataloghi reali, screenshot reali o SOURCE_AUDIT nel dist. Il check-bundle esamina marker noti, ma verificare anche l'albero dist. Nessun client secret o API key necessario.

## Comandi finali
```
npm.cmd run validate:data
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run check:bundle
```
Facoltativo: `python scripts/validate-seed.py` per ripetere gli 86 controlli completi originali.
Esiti salvati nel report con PASS / FAIL / NOT_RUN. Nessun test saltato deve essere nascosto o chiamato PASS. Non abbassare l'accettazione per adattarla al bootstrap.
