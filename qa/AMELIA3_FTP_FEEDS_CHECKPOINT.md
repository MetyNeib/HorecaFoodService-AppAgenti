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
