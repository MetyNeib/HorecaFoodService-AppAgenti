# Piano esecutivo per Codex

Ogni milestone termina con codice funzionante, test pertinenti e aggiornamento di PROGRESS.md. Non interrompere il lavoro dopo aver riscritto questo piano. Non accumulare tutte le viste in App.tsx.

| Fase | Consegna concreta | Controllo minimo |
|---|---|---|
| M0 | Inventario, install npm e lockfile reale, baseline test, lettura 22 PNG | seed invariato; tooling funzionante o errore documentato |
| M1 | DS componenti, shell, router, provider, persistenza/reset, Home | Home conta 2/1/24/3, stessi controlli ai 4 viewport |
| M2 | Ordine manuale completo con editor e prezzi/condizioni, catalogo condiviso | nuova bozza → prodotti → prezzo → riepilogo; editor Annulla non salva |
| M3 | Offline/sync + liste/dettaglio ordini | conferma doppia/reconnect non duplica, contatori e storico coerenti |
| M4 | Inbox WA, risoluzione alternativa/manuale/ambigua, stesso riepilogo | casi WA841/842/843; nessuna quantità inventata |
| M5 | Clienti, referenti, partite/anteprima/condivisione, info commerciali | saldo €587,46, condizioni salvate visibili, invio solo simulato |
| M6 | Catalogo completo, scheda/ingrandimento/descrizione, filtri e ritorni | prodotti/stock per deposito; nessun dato tecnico inventato |
| M7 | Insight/analisi/ipotesi/azioni/valutate | cifre da storico, nuovo ordine cliente giusto senza aggiunte |
| M8 | QA trasversale, test E2E, build, controllo bundle e report | tutte le accettazioni; screenshot alle 4 dimensioni; niente link morti |

## Problemi tipici da prevenire
I totali non devono restare copiati da derived, lo stesso prodotto può essere in più righe e superare stock aggregato, i prezzi di ordine storico non devono cambiare con le condizioni attuali, un click su un prodotto non deve tornare alla pagina sbagliata, un timer di sync non deve correre dopo Reset, e WA confermato non deve restare nella inbox.

## Deliverable finale locale
Codice sorgente, package-lock.json reale, dist/, test, qa/IMPLEMENTATION_REPORT.md, screenshots per i flussi principali, README con avvio e reset. Non pubblicare su cloud né creare repository remoto senza richiesta. La build è statica ma va servita via HTTP.

## Fine turno / ripresa
Aggiornare la riga di milestone e registrare file toccati, test eseguiti, errori effettivi e prossimo comando. Se l'ambiente impone interruzione, descrivere esattamente cosa manca; non trasformare NOT_RUN in PASS o segnare COMPLETE per la sola Home.
