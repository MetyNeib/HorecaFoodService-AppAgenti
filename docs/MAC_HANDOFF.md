> Aggiornamento 15/10/2026: il trasferimento è completato. Lo sviluppo corrente
> è su `feature/amelia3-ftp-inbox-habitual-products`. Per riprendere dopo la pausa
> usare [il checkpoint e rapporto FTP](../qa/AMELIA3_FTP_FEEDS_CHECKPOINT.md): il nuovo
> `feed_worker` sostituisce operativamente il precedente `worker`, che va lasciato
> fermo. Le istruzioni storiche seguenti descrivono la prima installazione.

# Trasferimento della base Amelia3 sul Mac

Destinazione dichiarata: MacBook Pro M1 Pro ARM64, macOS 26.3.1 (a), Docker
Desktop 4.65.0 / CLI 29.2.1. Il motore Docker deve essere avviato sul Mac.
Il branch di lavoro successivo è `feature/amelia3-demo-polish`;
`main` resta invariato fino alla futura PR di promozione della demo.

## Codice e dati sono due trasferimenti distinti

GitHub contiene codice, migrazioni, test e documentazione. Il pacchetto privato
in `backups/mac-transfer-20261014/` contiene l'intero database di sviluppo,
gli account e ordini attuali, attestazioni UM, storico, `.env`, import privati
e file di storage. Conserva anche i tenant sintetici di collaudo già presenti.
Non include le operazioni pendenti di IndexedDB nei browser Windows: prima
di cambiare dispositivo, collegare l'app al server e verificare coda vuota.
Il backup è una fotografia al momento dell'esportazione; le modifiche
successive sul PC non raggiungono automaticamente il Mac.

Il pacchetto include credenziali e dati commerciali. Trasferirlo direttamente
con AirDrop o supporto cifrato; conservarlo fuori Git e non allegarlo a issue
o PR. La configurazione FTP non viene stampata né aggiunta al repository.
Le sessioni del browser non vengono trasferite: accedere di nuovo sul Mac
con gli account riportati nel file privato `local_accounts.json`.

## Sul Mac: prima installazione

Dal Terminale, avviare Docker e attenderne la disponibilità:

```bash
open -a Docker
docker info
git clone --branch feature/amelia3-demo-polish https://github.com/MetyNeib/HorecaFoodService-AppAgenti.git
cd HorecaFoodService-AppAgenti
git status --short --branch
```

Per un repository privato usare l'autenticazione GitHub del proprio account
(HTTPS con credenziali gestite oppure SSH configurato); non inserire token nei file.
Estrarre l'archivio privato ricevuto in una cartella locale, poi:

```bash
tar -xzf ~/Downloads/amelia3-mac-transfer-20261014.tar.gz -C ~/Downloads
bash scripts/restore-mac.sh "$HOME/Downloads/mac-transfer-20261014"
```

Lo script verifica SHA-256, crea solo un database nuovo, ripristina senza
cancellare un database esistente, costruisce l'immagine nativa per il Mac e
confronta conteggi e SHA-256 di tutte le righe prima di avviare Rails.
Non eseguire `docker compose up` prima del ripristino: creerebbe un database
inizializzato che lo script rifiuta correttamente di sovrascrivere.
Se una configurazione o un database esistono già, fermarsi e usare un clone/
progetto Docker distinto; non risolvere cancellando indiscriminatamente i volumi.

Aprire http://127.0.0.1:3002/amelia3. Il database ripristinato conserva le
password correnti: non serve eseguire di nuovo import o provisioning.
Non copiare `node_modules`, `.playwright-browsers`, `public/assets` o i volumi
Docker Windows. Le dipendenze vengono ricostruite per Linux ARM64 nei container.

## Aggiornamenti FTP disponibili, fotografia demo da scegliere più avanti

Il ripristino conserva `.env` con le impostazioni FTP approvate, ma avvia solo
il web. Per attivare import delle 06:05 e alert delle 06:30 Europe/Rome:

```bash
docker compose up -d worker
```

Il primo avvio può recuperare l'import del giorno se non ancora completato.
Il server FTP viene solo letto; gli ordini locali non vengono inviati all'ERP.
Per sospendere gli aggiornamenti sul Mac:

```bash
docker compose stop worker
```

Questa sospensione tecnica non implementa ancora una selezione di campione
congelato nell'interfaccia. Quel lavoro appartiene al nuovo branch, con
snapshot identificato, data di riferimento e selezione manuale documentata.
Per mantenere una sospensione anche dopo un generico `docker compose up -d`,
impostare `AMELIA3_FTP_SYNC_ENABLED=false` nel solo `.env` locale e ricreare
il worker con `docker compose up -d --force-recreate worker`.

## Controlli e sviluppo

Per eseguire l'app bastano Docker e Git. Per tooling/test browser sul Mac
usare Node 22.12+ e i comandi senza il suffisso Windows `.cmd`:

```bash
npm ci
npm run check:rules
npm run test:amelia3-domain
docker compose exec web bundle exec rspec
PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright-browsers" npx playwright install chromium webkit
npm run test:amelia3-prepare
npm run test:amelia3
```

La preparazione browser modifica solo i tenant sintetici. Dopo modifiche JS/CSS,
se esiste un manifest di asset precompilati, eseguire `docker compose exec web
bin/rails assets:precompile` e poi `docker compose restart web`.
Prima di alternare computer: salvare con commit e push; sull'altro computer
eseguire `git pull --ff-only`. I database dei due computer restano indipendenti.

## Obiettivi approvati per il branch demo

1. Flusso completo di ordinazione, con UM e importi comprensibili e verificabili.
2. Ricezione di un ordine WhatsApp da trasformare nella bozza condivisa.
   Amelia3 oggi presenta un placeholder: una ricezione reale tramite provider
   non è implementata né autorizzata implicitamente da questo trasferimento.
   Preparare un flusso dimostrativo esplicito da messaggio scelto; definire in
   quella milestone se l'ingresso sarà manuale/incolla o tramite integrazione.
3. Dare risalto agli alert CRM basati sui dati aggiornati alla presentazione,
   includendo alert preparati manualmente ma sostenuti da evidenze reali.
4. Revisionare manualmente i falsi positivi: prodotti cessati sostituiti con
   comparabili, clienti apparentemente fermi dopo cambio ragione sociale.
   Nessun riconoscimento automatico richiesto. Annotare collegamenti espliciti
   tra codici, fonte, motivazione, intervallo e autore della revisione, mantenendo
   gli originali. Non sopprimere indiscriminatamente alert o accorpare clienti.
5. Consentire di scegliere un campione congelato dopo l'aggiornamento dati,
   distinguendo sempre dato sorgente, revisione manuale e proposta demo.

La data della presentazione e il campione saranno scelti sul Mac. Lavorare
per milestone; prima definire criteri e casi reali, poi rifinire interfaccia
e flussi, infine collaudare la sequenza della presentazione e aprire la PR.


## Accesso esterno ngrok — attivo e verificato 15/10/2026

Accesso pubblico HTTPS autorizzato esplicitamente dall’utente:
https://overscented-kandra-craggy.ngrok-free.dev/amelia3.
Il tunnel inoltra esclusivamente alla web app locale `http://127.0.0.1:3002`.
Login Admin conservato, con selettore Admin/Agente 34 dopo autenticazione.
La prima visita può mostrare la schermata ngrok: scegliere «Visit Site».

Il primo tentativo aveva restituito `ERR_NGROK_334` perché il dominio era già
occupato altrove. L’utente ha fermato quel tunnel e confermato di riprovare;
il successivo avvio è riuscito. Nessun pooling con altre applicazioni.

Configurazione locale esclusa da Git: `HFS_PUBLIC_DEMO=true`, chiave di
sessione casuale privata e solo il dominio esatto aggiunto agli host locali.
Pagine diagnostiche disattivate; cookie HttpOnly e Secure sulle richieste
HTTPS. Il login locale HTTP continua a funzionare. Le vecchie sessioni create
con la chiave di sviluppo richiedono un nuovo login; password invariate.
Backup configurazione precedente: `tmp/compose.override.before-ngrok.yml`,
privato e con permessi 0600. Nessun token o password nei file versionati.

PASS: `/up` e service worker HTTPS 200; senza login Amelia3 rinvia a sign-in;
404 senza dettagli tecnici; host non autorizzato 403. Login Admin reale via
browser pubblico, due account disponibili, catalogo/alert/archivio tutti 200,
cookie Secure/HttpOnly, zero errori JavaScript. Nove request spec di accesso e
inbox PASS; RuboCop mirato PASS. Nessuna scrittura commerciale nel collaudo.

Avvio: `ngrok http http://127.0.0.1:3002 --inspect=false`. Il processo corrente
è in background; PID e URL in `tmp/ngrok-amelia3.pid` e
`tmp/ngrok-amelia3-url.txt`, log privato in `tmp/ngrok-amelia3.log`. Per fermarlo,
terminare quel processo dopo aver verificato che il PID corrisponda ancora a
ngrok. Il collegamento richiede Mac acceso, Docker e ngrok in esecuzione.

Documentazione CLI: https://ngrok.com/docs/gateway/agent/cli.
