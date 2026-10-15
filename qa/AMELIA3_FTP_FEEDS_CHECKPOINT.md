# Ripresa completata — 15 ottobre 2026, ore 10:25 Europe/Rome

Questo aggiornamento sostituisce lo stato di sospensione riportato più sotto.
App disponibile su http://127.0.0.1:3002/amelia3; archivio WhatsApp aperto nel
browser. `feed_worker`, web, db e redis attivi. Il vecchio `worker` rimane
fermo. Il container temporaneo di QA è stato rimosso senza rimuovere volumi,
database o fixture sintetiche.

Branch effettivo: `feature/amelia3-ftp-inbox-habitual-products`.
Checkpoint di partenza: `d2ef68c`. Questo commit successivo, richiesto
dall’utente, salva correzione finale, test, documentazione e supporto applicativo
per l’accesso demo tramite ngrok. Nessun push/merge/deploy. La revisione UX e
dei flussi è rinviata al prossimo turno.

## Funzioni disponibili

- Lettura `/DOWNLOAD/BACKUP` ogni tre minuti con controllo integrità, archivio
  iniziale, deduplicazione, originali conservati e ripresa dopo errori.
- Ordini ricevuti consultabili e modificabili in una copia demo: presa in
  carico, quantità/note/consegna, aggiunta/rimozione prodotti e conferma locale.
  L’archivio iniziale non genera notifiche; i nuovi arrivi restano conteggiati
  fino alla conferma esplicita. Il timer di 30 minuti non invia nulla.
- Prodotti abituali di default per il cliente e tab Intero catalogo. Il feed
  dinamico arricchisce la ricerca; prezzi, UM e ordinabilità rimangono quelli
  attestati dal percorso commerciale. Copia offline dei prodotti scaricati.
- Ricerca locale prima, fallback GPT-6 Luna solo senza risultati locali; audit
  delle sostituzioni fondato sulle consegne positive nello storico giornaliero.
  Ordini WhatsApp o tablet non vengono considerati consegne avvenute.
- Import giornaliero alle 06:05 e alert alle 06:30 Europe/Rome gestiti dal solo
  nuovo worker, con recupero dell’esecuzione rimasta sospesa durante la pausa.

## PASS finali

- HTTP `/up` 200; login e cinque viste commerciali in sola lettura: Home,
  archivio/dettaglio WhatsApp, clienti, catalogo e alert; zero errori JavaScript.
- 198 test Rails PASS, inclusa regressione per nuovo run pubblicato durante
  la revisione AI. 18 JavaScript/service worker PASS. RuboCop senza infrazioni,
  Brakeman zero errori/avvisi, checker 106 file senza violazioni, bundle 63 file.
- Browser sintetico: cambio Admin/Agente conserva la pagina autorizzata;
  presa in carico, salvataggio, conferma e originale immutabile; contatore
  rimosso soltanto alla conferma. Timer scaduto mantiene ordine da confermare;
  modifiche non salvate bloccano conferma e assenza connessione blocca scritture.
- Prodotti abituali e intero catalogo verificati online e dopo cold reload
  offline; nessun overflow a 390/768/1440 px. Screenshot soltanto sintetici.
- Import giornaliero 15/10 riuscito, nuovo calcolo schedulato pubblicato, feed
  prodotti allineato al batch corrente. Polling automatici ripetuti senza
  errori di file o duplicazioni: 69 ordini iniziali, tutti in archivio.
- Catalogo sorgente 9.849 righe, venue 406.276 righe; 54.512 coppie abituali
  ammesse dopo riconciliazione con lo storico aggiornato e la finestra sei mesi.
  La differenza rispetto alle 59.214 del checkpoint deriva dal nuovo batch.
- Confronto completo/incrementale identico su 1.038.513 righe dello storico.
- Revisione di 2.124 alert prodotto completata: 1.489 soppressi per sostituzioni,
  600 conservati, 35 oltre il limite di cinque per cliente; **zero pending**.
- Audit di tutte le 1.489 soppressioni: acquisto del sostitutivo presente nello
  storico positivo, successivo all’originale, entro la finestra della regola,
  nessuna violazione delle varianti protette. Nessun errore nell’audit.
- Contatori e pagina coerenti: Admin 820 alert complessivi; Agente 34 zero.
  I 220 ulteriori alert Admin sono 171 clienti fermi e 49 frequenze in calo.
- GPT-6 Luna realmente utilizzato, chiave verificata, output JSON validato;
  limite applicativo 300 richieste/giorno rispettato. Nessun dato cliente,
  prezzo o storico inviato al modello. Chiave e dati privati fuori Git.

## FAIL aperti

Nessuno. Una prima verifica browser controllava la scheda prima che finisse
la navigazione: attesa corretta, prova ripetuta PASS. Nessun criterio rimosso.

## NOT_RUN / limiti della verifica

- Nessun nuovo ordine commerciale è arrivato sul FTP durante il collaudo:
  ricezione successiva all’archivio, deduplicazione e recupero file incompleti
  verificati con sorgenti sintetiche. Il polling FTP reale è verificato.
- Nessun invio a gestionale/FTP: escluso dallo scopo della demo.
- Non eseguita una nuova CI GitHub né un collaudo su hardware mobile fisico.
  Il browser locale verifica dimensioni telefono/tablet/desktop.
- Le equivalenze semantiche sono inferenze registrate nell’audit; la verifica
  automatica delle evidenze non equivale a una classificazione commerciale
  umana indipendente di tutte le coppie.

## Gestione locale

Per sospendere polling, import giornaliero e AI: `docker compose stop -t 35
feed_worker`. Per riattivarli: `docker compose up -d --no-deps feed_worker`.
Il polling continua mentre il Mac è acceso e Docker è in esecuzione; recupera
alla ripresa. Non avviare anche il vecchio `worker`.

Configurazione privata `.env.openai.local`: `OPENAI_MODEL=gpt-6-luna` e chiave
locale, mai in chat/Git. Responses API, effort low, output strutturato,
`store: false`, cache e limite di 300 chiamate/giorno. Dopo cambi di env usare
`docker compose up -d --no-deps web feed_worker` per ricreare i servizi.

Prove locali private: `tmp/feeds-complete-rspec.log`, `tmp/feeds-resume-*.log`,
`tmp/feeds-final-browser.log`, `tmp/feeds-expired-browser.log`,
`tmp/feeds-offline-browser.log`, `tmp/feeds-final-audit.json`.
Il container QA citato nella sezione storica sottostante non esiste più;
ricrearlo solo se necessario e solo con gli account sintetici.

---

# Checkpoint locale — 15 ottobre 2026

## Stato alla sospensione

Pausa esplicita richiesta dall’utente per chiudere il Mac. Non riavviare il
lavoro finché non chiede di riprendere. Branch:
`feature/amelia3-ftp-inbox-habitual-products`; base UX `3453e15`.
Checkpoint Git locale richiesto; nessun push, merge, deploy o invio reale.

- Implementati import FTP read-only, catalogo supplementare e prodotti abituali,
  inbox WhatsApp con archivio iniziale e polling ogni tre minuti, revisione
  sostituzioni locali/AI e interfaccia online/offline pertinente.
- GPT-6 Luna configurato sia come default nel codice sia nel file privato
  `.env.openai.local`. Chiamata reale con due confronti sintetici PASS.
- Tre migrazioni additive già applicate a sviluppo/test; database e volumi
  preesistenti conservati. Nessun reset del seed o del tenant commerciale.
- Il worker `feed_worker` è stato fermato ordinatamente su richiesta; il vecchio
  `worker` resta fermo. Anche il server QA temporaneo è fermo. Web/db/redis
  rimangono disponibili; la sospensione del Mac non richiede cancellazioni.
- Import iniziale: 69 ordini archiviati, nessuno da confermare; 9.849 righe di
  catalogo e 406.276 venue, con 59.214 coppie abituali ammesse. Import ripetuto
  automaticamente senza duplicazioni né errori di file. Nessuna scrittura FTP.
- La revisione completa degli alert con Luna è stata interrotta per questa
  pausa: risultati/cache già registrati restano disponibili; non dichiararla
  completata. L’audit distingue confermati, soppressi e ancora in verifica.

## PASS

- Suite Rails completa: 196 esempi, zero fallimenti.
- Dopo le ultime correzioni: 15 test mirati PASS, incluso nuovo controllo di
  download cambiato durante il trasferimento e recupero senza perdita archivio.
- JavaScript/service worker: 18 PASS; checker progetto: 107 file, zero violazioni.
- RuboCop: 169 file senza infrazioni prima dell’ultimo test FTP aggiunto.
- Brakeman: zero avvisi nell’ultima verifica; ripetere sul codice finale API.
- API reale: chiave valida, `gpt-6-luna`, due risultati JSON strutturati corretti.
- Browser su tenant sintetico: presa in carico, modifica quantità, conferma
  locale, notifica rimossa solo alla conferma, originale preservato.
- Prodotti abituali come default, tab intero catalogo, drawer e assenza overflow
  a 390, 768 e 1440 px; zero errori JavaScript durante queste verifiche.
- Asset finali compilati e web riavviato dopo le modifiche frontend.
- `.env.openai.local`, dati privati e file di lavoro esclusi da Git.

## FAIL aperti

Nessun test fallito aperto noto. La revisione AI e il collaudo finale sono
incompleti per sospensione richiesta, non certificati come PASS.

## NOT_RUN / da completare alla ripresa

1. Riattivare il worker dedicato e completare la revisione alert; verificare
   conteggi e motivi di eventuali stati pending (quota, API, catalogo incompleto).
2. Eseguire il controllo finale browser in sola lettura sui dati reali e il
   cambio Admin/Agente sulla scheda ordine sintetica. Script locale predisposto
   `tmp/feeds-final-browser.js`, non ancora eseguito.
3. Controllare screenshot esclusivamente sintetici e chiudere il server QA
   temporaneo. Nessuno screenshot commerciale deve essere salvato in Git.
4. Verifiche finali appropriate: Rails aggiornato, sicurezza, regole, bundle.
5. Documentare il report conclusivo, senza confondere il checkpoint con il
   completamento. Nuovo arrivo FTP reale e prossima esecuzione delle 06:05/06:30
   non ancora osservati; arrivo/duplicazione/recupero coperti da test sintetici.

## Ripresa operativa

Aprire Docker Desktop e attendere `docker info`, poi dalla root:

```bash
docker compose up -d db redis web
docker compose up -d --no-deps feed_worker
docker compose exec -T web bundle exec rails runner tmp/feeds-status.rb
```

Non usare `docker compose up -d` senza servizi: avvierebbe anche il vecchio
worker. Il nuovo worker gestisce inbox ogni tre minuti, import commerciale
06:05 e alert 06:30 Europe/Rome. Per una nuova pausa:

```bash
docker compose stop -t 35 feed_worker
```

La chiave resta nel file privato `.env.openai.local` (permessi 0600); non
stamparlo. Dopo variazioni di quel file, ricreare i servizi con `docker compose
up -d --no-deps web feed_worker`, non basta il semplice restart. Modello
`gpt-6-luna`, Responses API, effort low, output JSON vincolato, `store: false`;
limite applicativo 300 richieste/giorno e batch fino a 12 confronti.
Documentazione verificata: https://developers.openai.com/api/docs/models/gpt-6-luna.

URL app: http://127.0.0.1:3002/amelia3. Archivio iniziale:
http://127.0.0.1:3002/amelia3/whatsapp?archive=1.

Log privati disponibili in `tmp/feeds-*.log`; script di stato e diagnosi in
`tmp/feeds-*.rb`. Il container sintetico fermo `hfs-amelia3-feeds-qa` esponeva
127.0.0.1:3003; riavviarlo solo per il collaudo necessario. Sessione Playwright
`amelia3-mac`. Prima di riutilizzare script browser verificare identità, contesto
e fixture esistenti: l’ordine QA del collaudo precedente è già confermato.
Nessun test di scrittura deve usare il tenant commerciale.
