# Specifica funzionale completa — 22 viste

Questa specifica concretizza PDF e call con le decisioni successive dell’utente. Non è un nuovo perimetro. Route riportate senza `#`: usare HashRouter per una build statica senza regole server. Le viste 21/22 possono essere due sezioni contigue, con ancore e ritorni coerenti. Le altre route contestuali possono condividere componenti.

## Regole comuni
Nessun contorno tratteggiato viola e nessun footer di navigazione slide. Mantieni header agente/brand e footer stato rete, con controllo demo discreto sempre accessibile. Mostra focus, errori, stati vuoti, nessun risultato e validazioni inline. Le operazioni di modifica sono realmente stateful. Non sostituire funzioni centrali con toast “Funzione demo”: soltanto le trasmissioni esterne devono essere simulate; ricerca, calcoli, salvataggi, filtri e navigazione devono funzionare.

## 01 — Home
**Route:** `/`

**Struttura da mantenere:** Header brand/agente; due card principali Nuovo ordine e Ordini WhatsApp; sotto Bozze/Da inviare/Inviati; Clienti/Catalogo; Statistiche e segnalazioni; footer rete/sync.

**Comportamento:** Tutti i contatori derivano da ordini/insight dell’agente; accessi diretti. Stato sincronizzazione apre un dialog informativo e il controllo demo online/offline resta sempre accessibile.

**Riferimento visivo:** `references/functional/pages/page-01.png`.

## 02 — Selezione cliente
**Route:** `/orders/new/customer`

**Struttura da mantenere:** Home/indietro, stepper Cliente → Prodotti → Riepilogo, ricerca unica per nome/codice/P.IVA, elenco e Seleziona.

**Comportamento:** Filtri locali con normalizzazione accenti e zeri conservati. Selezione crea UNA bozza runtime e carica condizioni, listino, deposito, destinazione e pagamento. Cambio cliente di una bozza non vuota richiede conferma prima di svuotare/reimpostare.

**Riferimento visivo:** `references/functional/pages/page-02.png`.

## 03 — Prodotti e carrello
**Route:** `/orders/:orderId/products`

**Struttura da mantenere:** Cliente selezionato; colonna sinistra ricerca/categoria/Già acquistati/product card; colonna destra carrello con righe, quantità, UM, modifica/rimuovi, totale e margine, riepilogo/salva bozza.

**Comportamento:** Ricerca e categoria combinabili; storico Già acquistati solo SENT del cliente. Stock per deposito. Aggiunte ripetute dello stesso articolo/UM/prezzo si sommano senza doppia conversione. Lista lunga scorre nella pagina; carrello può restare sticky solo quando non copre contenuti. Nessun carrello nascosto su mobile.

**Riferimento visivo:** `references/functional/pages/page-03.png`.

## 04 — Modifica articolo
**Route:** `/orders/:orderId/lines/:lineId/edit`

**Struttura da mantenere:** Pagina a due colonne: quantità/UM e prezzo a sinistra, margine e condizione futura a destra. Footer prezzo riga/imponibile/margine; Annulla/Salva.

**Comportamento:** Listino / Prezzo libero / Sconto %, omaggio, commento. Ricalcolo immediato. Prezzo libero editato con virgola italiana. Salvataggio condizione esplicito cliente-prodotto e validità inclusiva; Annulla non modifica nulla. Modifica da WhatsApp ritorna alla verifica, non al flusso agente sbagliato.

**Riferimento visivo:** `references/functional/pages/page-04.png`.

## 05 — Riepilogo ordine
**Route:** `/orders/:orderId/review`

**Struttura da mantenere:** Stepper; a sinistra articoli e nota; a destra destinazione, data, ora opzionale, deposito, riferimento cliente, referente, pagamento; footer totale/margine/salva/conferma.

**Comportamento:** Un componente per agente e WA. Nota soltanto per documento consegna: niente checkbox fattura/ordine. Data prima consegna utile sul giro; pagamento locale override e ripristino default. Cambio deposito rivaluta stock e righe; conferma bloccata se mancanti/non disponibili. Offline → coda, online → breve simulazione e SENT; protegge doppio click.

**Riferimento visivo:** `references/functional/pages/page-05.png`.

## 06 — WhatsApp da verificare
**Route:** `/fastorder`

**Struttura da mantenere:** Elenco con ricerca cliente/numero/mittente, filtro consegna e Solo con richieste da risolvere; righe con timestamp, consegna, numero richieste, problemi, Verifica/Riprendi.

**Comportamento:** Tre ordini iniziali. La verifica salvata resta nell’inbox con stato Riprendi, non genera una bozza agente duplicata. Dopo conferma sparisce dall’inbox e compare nel relativo stato ordine.

**Riferimento visivo:** `references/functional/pages/page-06.png`.

## 07 — Verifica WhatsApp
**Route:** `/fastorder/:orderId`

**Struttura da mantenere:** Header cliente/numero/mittente/consegna; a sinistra richieste da definire; a destra bozza con messaggio cliente per riga e confidence; salva verifica, contatore problemi e riepilogo.

**Comportamento:** Controlli quantità/UM/modifica condivisi con ordine manuale. Richieste abbinate leggibili anche quando molte. Accesso discreto al testo sintetico completo senza creare una nuova area chat. Riepilogo abilitato solo con tutte richieste risolte o escluse esplicitamente.

**Riferimento visivo:** `references/functional/pages/page-07.png`.

## 08 — Risoluzione prodotto WA
**Route:** `/fastorder/:orderId/resolve/:requestId`

**Struttura da mantenere:** Mantiene eccezioni sinistra; destra sostituisce bozza con richiesta originale, abituale esaurito, alternative disponibili/confidence/Scegli/Scheda, Cerca altro prodotto, Escludi richiesta, Torna bozza.

**Comportamento:** Alternative dello stesso deposito; conversioni del prodotto scelto, non di quello esaurito. Ricerca manuale richiede prodotto/quantità/UM. “2 cotolette” non presume KG o PZ. Esclusione con motivo e richiesta conservata. Apprendimento solo simulato cliente+frase; messaggio “Associazione salvata nella demo”.

**Riferimento visivo:** `references/functional/pages/page-08.png`.

## 09 — Bozze
**Route:** `/orders?tab=drafts`

**Struttura da mantenere:** Titolo I miei ordini; tab Bozze/Da inviare/Inviati e ricerca; data, prodotti, importo, Riprendi, Elimina.

**Comportamento:** Riprende stesso ID/carrello/condizioni; eliminazione con conferma e aggiorna contatori. Nessuna ricreazione dal seed a ogni navigazione.

**Riferimento visivo:** `references/functional/pages/page-09.png`.

## 10 — Da inviare
**Route:** `/orders?tab=pending`

**Struttura da mantenere:** Stesse tab; ordini confermati e attesa rete; Apri ordine; informazione invio automatico.

**Comportamento:** Dettaglio confermato in sola lettura, non nuovo ordine editabile. Coda unica idempotente, nessun ordine trasmesso due volte dopo reconnect. Online/offline ripetuto non duplica.

**Riferimento visivo:** `references/functional/pages/page-10.png`.

## 11 — Inviati
**Route:** `/orders?tab=sent`

**Struttura da mantenere:** Tab comuni; filtri Oggi/7 giorni/Mese/Personalizzato/Tutti, Dal/Al, Applica/Azzera, conteggio risultati, righe ordinamento recente.

**Comportamento:** Date confrontate con clock demo. I campi personalizzati restano nello stesso set di elementi su tutti i dispositivi. Apri mostra dettaglio snapshot, non ricalcola prezzi storici con condizioni nuove.

**Riferimento visivo:** `references/functional/pages/page-11.png`.

## 12 — Elenco clienti
**Route:** `/customers`

**Struttura da mantenere:** Ricerca nome/codice/P.IVA, conteggio e righe in ordine alfabetico con Apri scheda.

**Comportamento:** Mostra gli otto clienti del portafoglio; nessun Prospect o Attiva cliente. Scheda navigabile dal catalogo degli insight senza perdere contesto.

**Riferimento visivo:** `references/functional/pages/page-12.png`.

## 13 — Anagrafica e referenti
**Route:** `/customers/:customerId?tab=details`

**Struttura da mantenere:** Quattro tab; dati aziendali a sinistra, referenti a destra; Aggiungi/Modifica con nome/cognome/ruolo/telefono e checkbox WhatsApp, Annulla/Salva.

**Comportamento:** Dati societari in lettura; form referenti nello stesso blocco del PDF. Validazione campi ma non forzare reali numeri di telefono su placeholder non instradabili. Flag offline mostra attivazione dopo sincronizzazione; solo simulazione. No link tel/mail attivi.

**Riferimento visivo:** `references/functional/pages/page-13.png`.

## 14 — Ordini cliente
**Route:** `/customers/:customerId?tab=orders`

**Struttura da mantenere:** Quattro tab; ricerca numero, stato, intervallo date, Applica/Azzera e ordini con canale WhatsApp/Agente.

**Comportamento:** Gli stessi oggetti orders di Home e liste. Bozze riprendibili, inviati e coda in lettura. Data e canale non hardcoded sulle righe.

**Riferimento visivo:** `references/functional/pages/page-14.png`.

## 15 — Partite aperte
**Route:** `/customers/:customerId?tab=open-items`

**Struttura da mantenere:** Quattro tab; saldo aperto/scaduto/incassato; ricerca documento, Solo scadute, tabella documento/scadenza/importo/incassato/residuo/stato/Apri; Invio PDF.

**Comportamento:** Raggruppare o etichettare rate senza duplicare importo documento. Nota credito con segno negativo. Apri mostra dettaglio/anteprima sintetica in dialog. Registra incasso escluso: non aggiungerlo funzionante.

**Riferimento visivo:** `references/functional/pages/page-15.png`.

## 16 — Invio PDF simulato
**Route:** `/customers/:customerId/share`

**Struttura da mantenere:** Stesso contesto cliente/tab; tutte partite o solo scadute, anteprima, canali WhatsApp/email/scarica, mittente/destinatario, Annulla/Invia.

**Comportamento:** Anteprima composizione HTML interna. Tutti i tre canali simulati, compreso Scarica PDF. Toast chiarisce simulazione, offline accoda shareJob locale. Nessun browser download o apertura app esterna. Destinatari sempre sintetici.

**Riferimento visivo:** `references/functional/pages/page-16.png`.

## 17 — Info commerciali
**Route:** `/customers/:customerId?tab=commercial`

**Struttura da mantenere:** Quattro tab; pagamento/listino default e tabella condizioni dedicate con ricerca prodotto/codice, condizione e validità.

**Comportamento:** Visualizza anche condizioni scadute/future con badge; mostra quelle create nell’editor di riga; non altera ordini già inviati né il default pagamento per override singolo ordine.

**Riferimento visivo:** `references/functional/pages/page-17.png`.

## 18 — Catalogo
**Route:** `/catalog`

**Struttura da mantenere:** Ricerca, selezione deposito, Solo disponibili; categorie sinistra e prodotti destra; stock e badge disponibile/in esaurimento/esaurito; scheda.

**Comportamento:** Filtri combinati su 120 prodotti. Giacenza zero consultabile finché Solo disponibili spento. Magazzino ordine resta coerente quando catalogo consultato dall’ordine. Cambio deposito standalone non modifica silenziosamente una bozza aperta.

**Riferimento visivo:** `references/functional/pages/page-18.png`.

## 19 — Scheda prodotto
**Route:** `/catalog/:productId`

**Struttura da mantenere:** Indietro contestuale; nome/codice/categoria/deposito; visual prodotto e ingrandisci; stock; confezionamento; dati disponibili; descrizione/Leggi tutto.

**Comportamento:** Ingrandimento dialog e espansione testo reali. Non inventare allergeni/nutrizionali quando null: “Non disponibile nella demo”. ReturnTo conserva origine e filtri; da WA torna alla richiesta selezionata. Asset sintetici, mai screenshot fonte.

**Riferimento visivo:** `references/functional/pages/page-19.png`.

## 20 — Segnalazioni
**Route:** `/insights`

**Struttura da mantenere:** Titolo Evolutiva, ricerca cliente, Da valutare/Valutate; cliente, numero segnalazioni e riassunto; Apri analisi.

**Comportamento:** Tre segnalazioni su due clienti, aggregate da ID. Nessun configuratore o priorità aggiunta. Evolutiva etichettata ma navigabile nella demo.

**Riferimento visivo:** `references/functional/pages/page-20.png`.

## 21 — Analisi acquisti
**Route:** `/insights/:customerId`

**Struttura da mantenere:** Header cliente/periodi, Mostra dati; quadro cliente; due card calo categorie e variazione assortimento; prosegue alle ipotesi.

**Comportamento:** Può condividere pagina scrollabile con 22 mantenendo ordine e sezioni. Mostra dati apre storico DEL CLIENTE indicato con filtri coerenti, non cliente fisso del PDF. Valori derivati dallo snapshot approvato, non generati da API.

**Riferimento visivo:** `references/functional/pages/page-21.png`.

## 22 — Ipotesi e azioni
**Route:** `/insights/:customerId/actions`

**Struttura da mantenere:** Ipotesi da verificare, azioni consigliate, Apri scheda cliente/Nuovo ordine/Segna come valutate.

**Comportamento:** Nuovo ordine precompila solo cliente, senza prodotti non selezionati. Valutata archivia gli insight collegati e aggiorna contatori; ipotesi presentate come ipotesi, non cause accertate.

**Riferimento visivo:** `references/functional/pages/page-22.png`.

## Comportamenti trasversali ulteriori

**Annulla / Indietro / modifica non salvata.** Le modifiche nel form articolo e referente restano locali al form fino a Salva. Uscita da ordine non vuoto chiede se conservare bozza o continuare modifica, senza perdere il carrello. Riprendi non cambia ID. Il tasto browser Indietro deve avere un esito coerente con l'origine.

**Ordine confermato.** Disabilitare conferma durante invio simulato, segnare stato prima di navigare, non duplicare lavoro in React StrictMode. Un ordine in coda o inviato si apre in lettura; non convertire retroattivamente la coda in bozza.

**Condizioni e deposito.** Al cambio deposito ricalcolare disponibilità, non cambiare prezzi/storico senza regola. Se una riga diventa non disponibile bloccare conferma e indicare la riga. Mostrare margini negativi con avviso; non aggiungere un blocco di credito non approvato.

**Tempo.** Usare sempre meta.demoClock. Filtri relativi, scadenze e validità non cambiano con la data reale del PC. La simulazione del sync usa la stessa data demo, non date future arbitrarie.

**Immagini e fiducia.** Le percentuali sono indicatori del seed, non probabilità certificate da un modello. Prezzi/stock sono demo. Non dichiarare “AI addestrata” o “giacenza realmente aggiornata”.
