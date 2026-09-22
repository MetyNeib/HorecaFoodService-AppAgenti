# Contesto della call fornita dall'utente

**Natura di questo file:** estrazione strutturata e parafrasi del transcript incollato nella chat, non trascrizione verbatim né nuova fonte. Le 22 schermate originali sono nel PDF e nei PNG accanto. Le decisioni successive dell'utente in docs prevalgono dove restringono il perimetro.

## Ordine manuale
Il relatore mostra la sequenza cliente → prodotti → riepilogo. L'input cliente cerca nome/codice/P.IVA; quello prodotto cerca nome/codice. Il filtro Già acquistati serve il cliente selezionato e si combina con categorie. Catalogo e giacenze dipendono dal centro distributivo.
La riga consente quantità, UM e scheda; nel carrello sono mostrati costo per riga e totale ordine, con margine ordine e margine singolo articolo. L'editor permette prezzo da listino scelto, prezzo libero o sconto, omaggio per casistiche operative e commento di riga.
Il prezzo/sconto/listino particolare può essere salvato per quel cliente/prodotto e per ordini futuri. Validità senza date è indeterminata; con una data finale smette di applicarsi dopo quella data. Le condizioni si ritrovano poi nella scheda commerciale cliente.
Al riepilogo: articoli, nota, destinazione default, prima consegna disponibile, deposito, pagamento. La call corregge il PDF: togliere la scelta dei documenti a cui destinare la nota, tenere la nota sul documento di consegna. Il cambio pagamento viene ritenuto interessante e mantenuto.
La conferma offline salva in attesa invio. Si possono salvare bozze senza concluderle e riprenderle quando arrivano altri prodotti. Gli stati sono bozze/da inviare/inviati.

## FastOrder / WhatsApp
Il cliente manda un messaggio naturale una volta, senza una lunga conversazione di chiarimenti automatica. L'agente riceve l'ordine nell'app. Lista mostra cliente, ricezione, consegna richiesta, quante richieste e quanti problemi.
Esempio: otto richieste e due da risolvere. A destra bozza AI con prodotto scelto, richiesta originale e livello di confidenza; a sinistra le eccezioni. Il caso latte abituale esaurito propone alternative con disponibilità/confidence o ricerca manuale. Il caso spezzatino morbido non riconosciuto richiede ricerca e selezione dell'agente.
Nella call l'associazione scelta diventa contesto per il cliente nelle richieste future. Si discute anche di non proporre più prodotti mai scelti: questa è una spiegazione della logica AI, non una nuova UI da sviluppare. Nel mockup l'apprendimento è simulato, per cliente, senza modello reale.
Una volta risolte le eccezioni si usa lo stesso riepilogo dell'ordine normale, inclusi consegna, nota richiesta dal cliente e approvazione. Le verifiche possono essere salvate/riprese.

## Clienti
Ricerca libera dei clienti e scheda. Anagrafica azienda e referenti; l'agente gestisce anche chi è abilitato a ordinare via WhatsApp nello stesso canale, senza passare a un'altra applicazione. Non tutti i referenti sono ordinanti: esistono amministrativi.
Storico ordini distingue origine WhatsApp e agente. Partite aperte mostra saldo, scaduto, incassato, fatture/scadenze/residui e riapertura documento. Invio dati al cliente via WhatsApp/email/PDF descritto come comodità; nella demo tutti i canali sono simulati per decisione successiva dell'utente.
La call domanda se assegnare anche prospect da visitare/attivare. L'utente ha poi ESCLUSO i prospect dallo Step 3. Non implementarli. La registrazione di incasso nel PDF rimane da confermare ed è esclusa.

## Catalogo
Selezione deposito/centro, disponibili, categorie, ricerca, badge disponibilità/esaurimento, foto ingrandibile, scheda e descrizione. La politica sui prodotti a giacenza zero è discussa come dettaglio futuro: per la demo sono consultabili senza filtro Solo disponibili, ma il contratto allowBackorders=false impedisce conferma non disponibile.
Si ipotizza in call un catalogo futuro per clienti/e-commerce: non fa parte della App Agenti da implementare. Non aggiungere login cliente o checkout e-commerce.

## Statistiche / segnalazioni
Segnalazioni per cliente che ordina meno, ritardo riordino o articolo non più comprato. Esempio due segnalazioni per lo stesso cliente: ordini da otto a quattro, spesa2400→1560, valore medio300→390; calo concentrato bevande, cambio assortimento/amaro assente. Analisi mostra dati, ipotesi da verificare e possibili azioni commerciali.
Il cliente domanda configurazione e priorità considerando anche margine: la risposta dice che le regole sarebbero personalizzabili. L'utente ha poi scelto SOLO gli insight mostrati, senza configuratore. Non creare pannelli regole/priorità, né presentare ipotesi come cause dimostrate.
Azioni finali: apri scheda, prepara un nuovo ordine per quel cliente, segna valutate. Evolutiva esclusa dal primo MVP reale, ma navigabile nella demo concordata.
