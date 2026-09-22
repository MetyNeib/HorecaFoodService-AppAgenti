# HFS — Contratto dati e regole per l'implementazione

## Fonte e separazione delle responsabilità
`hfs_demo_data.json` è l'unica fonte canonica del seed. CSV e XLSX sono proiezioni di consultazione, non copie da modificare indipendentemente.
`derived` è una cache leggibile: a ogni mutazione, ricalcolare contatori, totali, saldo e storico dagli oggetti canonici.
Non unire i tre cataloghi reali in produzione, non importare audit_private nella build, non usare dati reali per un invio.
L'app non ha bisogno di un backend: il seed JSON è importabile nel progetto React/TypeScript previsto nello Step 2.

## Identificativi e unità
Codici articolo a 7 cifre memorizzati come stringhe: conservare gli zeri iniziali.
Formato demo: 2 cifre di famiglia + blocco 07 + progressivo con intervalli; i valori sono nuovi e non coincidono con i codici estratti.
Le chiavi tecniche sono ART-{codice}; clienti CLI-{sei cifre}; agenti, giri, depositi e listini hanno namespace separati.
PZ indica l'unità commerciale: per un guanto venduto in scatola da 100, 1 PZ è una scatola, non un singolo guanto.
CT e COLLI sono la stessa unità nel modello. CT si può visualizzare come “Colli”.
Base PZ/KG/L; CONF presente soltanto quando definita nelle unità del prodotto.
`baseQuantity = quantity × factorToBase`; `caseQuantityBase = innerQuantityBase × innerUnitsPerCase`.
Le quantità hanno al massimo tre decimali; la UI deve rispettare gli step della singola unità.
I fattori dei prodotti a peso variabile sono stime quando `estimated=true`: mostrare “peso indicativo”.
Una quantità esplicita in KG non è stimata. Non scambiare calibro 26/30 o U/10 con numero di pezzi.

## Prezzi e arrotondamenti
Tutti gli importi sono centesimi interi di euro. Quantità non sono importi.
Prezzo e costo sono riferiti alla UM base; niente moltiplicazioni doppie per collo.
Imponibile riga = arrotondamento half-up a centesimi di (quantità base × prezzo unitario base).
Costo riga = arrotondamento half-up a centesimi di (quantità base × costo unitario base).
Margine € = ricavo meno costo; margine % = margine / ricavo × 100.
Margine ordine % è sul ricavo totale, non media delle percentuali di riga.
Per omaggio: ricavo zero, costo mantenuto, margine negativo; percentuale nulla, visualizzata “—”, non divisione per zero.
Importi tutti dimostrativi IVA esclusa. I documenti contabili non sono documenti fiscali e non implementano una fiscalità reale.

## Priorità del prezzo e condizioni
Per nuova riga, applicare prima la condizione valida cliente-prodotto, poi il listino cliente, poi lo standard.
Una modifica esplicita nella riga può sostituire il prezzo: listino scelto, prezzo libero o sconto sul listino di riferimento.
La modalità sconto non significa “aggiungi un ulteriore sconto al prezzo già scontato”.
Le date di validità sono inclusive; null significa nessun limite in quella direzione.
Le condizioni scadute o future rimangono consultabili ma non sono applicate alla data demo.
Salvare la condizione è una scelta esplicita della UI: non trasformare ogni override in una condizione permanente.
Una modifica condizione non riscrive lo storico ordini: le righe degli ordini sono snapshot.
Il seed include una condizione scaduta, una futura e condizioni a tempo indeterminato per testare gli stati.

## Stato ordine e WhatsApp
Una sola collezione `orders`: DRAFT, WHATSAPP_REVIEW, PENDING_SEND, SENT.
Le tre schede I miei ordini sono filtri; la Home deriva dallo stesso stato e dal portafoglio agente.
`whatsappInbox.orderId` punta al medesimo ordine, non a una copia distinta del carrello.
Ogni richiesta ha un ID e conserva il testo originale sintetico.
Solo MATCHED o una risoluzione esplicita dell'agente genera una riga ordinabile.
Per OUT_OF_STOCK: scegliere alternativa o prodotto manuale disponibile nello stesso deposito.
Per NO_MATCH: cercare e confermare manualmente prodotto, quantità e UM.
Per AMBIGUOUS: non usare la confidence come autorizzazione automatica; confermare la scelta e l'UM mancante.
L'esclusione è esplicita e con motivazione; non cancellare la richiesta originale.
“Vai al riepilogo” si abilita solo quando tutte le richieste sono risolte o escluse.
Con la scelta manuale, memorizzare la mappatura cliente + frase normalizzata + prodotto; non creare un'associazione globale.
`learnedMappings` vuoto all'avvio evita di risolvere in anticipo le eccezioni della demo.
Gli esempi aggiuntivi di foto/cliente sconosciuto sono fixture di prova, non nuove sezioni da aggiungere all'app.

## Offline, sincronizzazione e sicurezza
Orologio demo fisso: 2026-09-22 09:30 Europe/Rome; ultimo sync 08:30; stato iniziale OFFLINE.
Gli ordini confermati offline diventano PENDING_SEND e si aggiungono una sola volta alla syncQueue.
Tornando online, simulare attesa e passaggio a SENT. Ogni job ha una idempotencyKey.
Bloccare doppi click o doppi invii; una riconnessione non deve duplicare un ordine.
Le giacenze sono snapshot dimostrativi. Non etichettarle “live reali” e non scaricarle retroattivamente per gli ordini storici.
Cambio deposito: rivalutare stock, disponibilità e coerenza delle righe.
Gli articoli a stock zero si possono consultare; `allowBackorders=false` non consente conferma di una riga non disponibile.
Contatti offline: cambio flag WhatsApp simulato da applicare al sync, senza comunicazioni reali.
Condivisioni WhatsApp/email/scarica PDF sono solo simulazioni: nessun mailto, wa.me, fetch o endpoint remoto.
Nomi/P.IVA/telefoni demo non devono essere validati o usati come contatti reali.

## Documenti e credito
Fattura/nota di credito in `invoices`; scadenze distinte in `receivables`; incassi in `payments`.
Una fattura a due rate non va conteggiata due volte per il suo totale.
Residuo rata = importo rata meno incassi collegati.
Saldo aperto = somma residui con segno; nota credito riduce il saldo una volta.
Scaduto = soli residui positivi con scadenza precedente alla data demo.
I valori credito sono una convenzione sintetica, non un calcolo derivato dai clienti reali né una funzione UI aggiuntiva.
Non introdurre “Registra incasso”: nella progettazione non è stato confermato.

## Insight
Tre segnalazioni: due per Osteria del Faro, una per Trattoria dei Tigli; nessun configuratore regole.
Snapshot storico: 28/07–24/08 rispetto a 25/08–21/09/2026.
4 contro 8 ordini, €1.560 contro €2.400, beverage €240 contro €1.000, valore medio €390 contro €300.
Amaro: 6 ordini precedenti su 8, zero su 4 attuali; lager: 6/8 e 3/4.
Il latte abituale è presente nello storico e risulta esaurito solo nello snapshot stock della demo.
Le ipotesi sono ipotesi, non cause accertate. Non rigenerare valori con una vera API AI.
Creare nuovo ordine da un insight precompila il cliente senza aggiungere articoli non scelti.
Segna valutata aggiorna gli insight collegati e i contatori, non cancella lo storico.

## Persistenza e reset
Chiave localStorage `hfs-agent-demo-v1`; includere schemaVersion.
All'inizio caricare seed soltanto se manca uno stato valido.
Ogni reset ripristina esattamente il seed, riporta OFFLINE e svuota learnedMappings/shareJobs.
Gli asset reali e le fonti private non entrano in localStorage.
Eseguire `python validate_demo.py` prima di utilizzare un seed modificato.
