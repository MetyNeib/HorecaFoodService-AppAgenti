# Amelia3 — implementazione e collaudo del 12 ottobre 2026

Stato: CHECKPOINT_DATI_REALI_TESTATI; lavoro fermato su richiesta dell'utente.
Branch `feature/amelia3-ftp-import`. Nessun deploy pubblico e nessuna scrittura FTP.
Il rapporto contiene aggregati e metadati; CSV, password, nominativi clienti,
righe commerciali e screenshot reali rimangono fuori Git.

## Milestone

| Milestone | Stato | Evidenza |
|---|---|---|
| M0 Rails → main | TESTATO | [PR #1](https://github.com/MetyNeib/HorecaFoodService-AppAgenti/pull/1), head `9cbb124433a66cb090069c4e546e4c20301273e5`, CI `38256349200` success, merge non forzato `81587c768343cb16b450b072b1b121cbbb1e28ca`; V1/tag preservati |
| M1 ambiente e bootstrap | TESTATO | Docker Compose 5.5.1, engine 29.8.2; nove hash/byte/header uguali al manifest, senza nuova ricognizione dello storico |
| Import streaming e pubblicazione | TESTATO | Dry-run 51,595s; publish staging 2,734s; ripetizione idempotente 1,209s; successiva correzione mapping 57,102s, revisione 2; rollback/quarantena verificati |
| M2 account e ordini condivisi | TESTATO | Login Admin e agente 34 reali; ultimo ordine di collaudo a due prodotti, destinazione attestata, creatore Admin/agente commerciale 34, un record per UUID, conferma soltanto locale |
| M2 PWA e autorizzazioni | TESTATO | 45/45 casi browser Amelia3, RSpec e prove sui CSV reali Chromium/WebKit; scoping URL/API/cache, blocchi, prezzi, idempotenza, conflitti, scadenza/rinnovo e moduli senza IndexedDB |
| M3 storico e analisi | TESTATO | 1.036.814 righe in PostgreSQL; agente34 2.237 righe/606 riferimenti ordine/447 articoli; query paginate e controlli reali di ricerca/memoria/layout |
| M4 FTP live | TESTATO | Primo job automatico di recupero completato 12/10 18:10:43 Europe/Rome, un tentativo; download/verifica effettiva successiva 18:43:56, 37,969s, nove hash invariati |
| M4 scheduler | TESTATO | Worker attivo, heartbeat e prossimo avvio 13/10 06:05 Europe/Rome; unicità, DST, lock, retry/backoff e fallimento terminale verificati |
| M5 HTTPS LAN | TESTATO sul PC | Caddy su `192.168.1.12:3443`; cinque endpoint HTTPS con CA esplicita, verifica TLS positiva, nessuna modifica al trust Windows |
| M5 dispositivi fisici | DA_VERIFICARE / NOT_RUN | Installazione e fiducia CA su Android/iPhone/iPad; accesso da un secondo dispositivo/PC non fisicamente disponibile |

## Riconciliazione delle sorgenti

| File | Righe attive |
|---|---:|
| ARTICOLI | 9.847 |
| CLIENTI | 8.311 |
| FIDO | 5.064 |
| GIACENZE | 9.245 |
| INSOLUTO | 3.017 |
| LISTINI | 28.940 |
| LISTINI_PERS | 12.173 |
| STORICO | 1.036.814 |
| TABGIR | 19.960 |

Agente **34 — Sophia Buzzicotti**, identificato esclusivamente dal codice:
16 clienti, 12 non bloccati e 4 bloccati. Fra i 12 non bloccati, 11 sono punti
di consegna; l'ordinabilità richiede comunque prezzo, UM, divisibilità e stock
validi. Nessun account dell'agente 7. Capoarea negato.

586 righe CLIENTI con posizioni vuote aggiuntive e un separatore non quotato
nel nome sono riparati mantenendo le ancore e gli spazi interni. Dodici date
riferimento INSOLUTO assenti restano NULL. Quantità e importi decimali sono
conservati, senza trasformare lo storico in nuovi ordini o le partite in
fatture/incassi. I batch precedenti rimangono versioni separate; il puntatore
attivo seleziona una sola fotografia, senza duplicati funzionali.

Mapping versione 1, fingerprint attivo
`9eca9f4b050d59a05a0dfc3f1f9e26749d52b1e6989b3605b65c571d590e188f`.
Picco RSS dell'import completo 107.188 KiB (circa 105 MiB), senza caricare
un milione di righe in un array Ruby/browser. Dopo il controllo sulla precisione
percentuale sono state validate soltanto le 12.173 condizioni interessate;
lo storico non è stato riprofilato.

## Comportamento commerciale verificato

Listino `000`, sconto attivo valido inclusivamente, BigDecimal/BigInt e un solo
arrotondamento HALF_UP per riga. Sorgenti oltre la precisione memorizzabile non
vengono arrotondate implicitamente da PostgreSQL. Condizioni sovrapposte o ambigue
bloccano la riga. Il prezzo visualizzato deve corrispondere a quello proposto;
una variazione non genera un addebito silenzioso. I prezzi già salvati restano
immutati dopo import successivi e modifiche di quantità.

Solo **P/P** con stock `pz` intero e positivo è attualmente attestato per gli
ordini. Confezioni/colli indivisibili richiedono multipli documentati. Altre UM
restano consultabili con blocco motivato: nessuna conversione K/P/L/C supposta,
somma cf/pz/pe, deposito, costo o margine inventato. Le giacenze rappresentano
l'export e non una prenotazione nel gestionale.

Destinazioni con `flag_punto_cons=S`, non bloccate, autorizzate per l'anagrafica.
`cod_int` non amplia il portafoglio. Admin e agente vedono lo stesso ordine,
con creatore distinto dall'agente commerciale. `CONFIRMED_LOCAL` indica soltanto
salvataggio nel database: nessun job di trasmissione ERP/FTP/WhatsApp/email.
`RESET_DEMO` è negato agli account Amelia3 e il seed resta separato.

Sono conservati due ordini locali di collaudo. La prima prova precedeva il
controllo del flag punto consegna; quell'ordine già confermato non è stato
riscritto o cancellato. L'ultimo smoke verifica due prodotti, destinazione
ammessa e visibilità condivisa. Nessuno dei due è stato trasmesso.

## Memoria, risposte e controlli visuali reali

23 letture HTML reali fra Admin e agente: tutte HTTP 200. Ricerca catalogo
circa 0,74s agente e 0,52s Admin; ultime risposte osservate 0,40–1,99s,
senza valore di SLA. Ultima verifica reale 12/10 alle 20:43 Europe/Rome.
Snapshot misurati circa
87 KB agente e 101 KB Admin; cache agente 16 clienti/266 prodotti, Admin
100 clienti/214 prodotti. Limiti 100 clienti/500 prodotti/20 ordini recenti
più ordine aperto esplicitamente. Lo storico resta sul server, 50 righe/pagina.

L'API Chrome espone heap approssimativo 10–17,1 MB, non una misura RSS
dell'intero browser. 32 controlli reali di catalogo, clienti, storico e ordine
nelle larghezze 390/768/1024/1440: nessun overflow orizzontale, errori JS o
richieste HTTP business esterne. Screenshot sotto `qa/amelia3/private/`, esclusi
da Git e dall'immagine; immagini sintetiche dei test browser separate.

Quattro riaperture reali dal `start_url=/` del manifest, Admin/agente su
Chromium/WebKit, passano online e offline: redirect a `/amelia3`, cache isolata,
coda vuota e nessun overflow. Non equivalgono a installazione fisica.

## FTP e scheduler

FTP porta 21 in chiaro è esplicitamente autorizzato: password e dati transitano
senza TLS; VPN futura raccomandata. Credenziali solo nel worker, nessuna nei
processi web/browser/Git/report. `WRITE_ENABLED=false` viene imposto; il
connettore non contiene upload/delete/rename/mkdir o accessi `/DOWNLOAD`.

Nove file obbligatori, SIZE/MDTM prima/dopo e SHA-256; se MDTM manca,
seconda lettura completa per confronto. Pubblicazione atomica solo dopo parsing
e relazioni valide. Mancanza file, modifica durante lettura, timeout, interruzione,
troncamento, concorrenza e retry conservano l'ultimo dataset valido. Metadati
di trasferimento e durata vengono registrati nelle nuove occorrenze.

Una sola occorrenza logica per tenant/giorno, lock PostgreSQL, cinque retry e
backoff. Il controllo Sidekiq ogni 20s recupera la giornata corrente in caso
di avvio tardivo. La prova automatica osservata è il recupero delle 18:10,
non un'esecuzione alle 06:05. Il prossimo avvio è schedulato, ancora futuro.
Docker/worker e PC devono restare accesi; nessun deploy o servizio cloud.

## Verifiche e CI

- PASS: 134 RSpec, 49 test puri originali, 12 parità Ruby/JS, 8 calcoli/proiezioni
  Amelia3, 20 controlli seed, 7 test checker e 95 file frontend senza violazioni.
- PASS: RuboCop 101 file, Brakeman 0 warning, Zeitwerk.
- PASS: migrazioni da database vuoto isolato e schema identico; immagine Docker
  ricostruita da lockfile, precompile production senza rete e bundle 37 file
  senza dati/fonti private; .env/CSV/screenshot commerciali esclusi dall'immagine.
- PASS: seed byte-identico SHA-256
  `2fa3e0a68029226d01a0f1911fd4aedd616aca9768038a24f5c9c3004f01c4b6`.
- PASS finale: 45/45 casi browser Amelia3 in CI su cinque progetti Chromium/WebKit,
  28/28 PWA originali. Le prove commerciali reali sono separate dalle fixture CI.
- CI finale sul codice: `c180cdf6b99f8411896a00ecc56a0f1ddfa37cb8`,
  [run 38289890582](https://github.com/MetyNeib/HorecaFoodService-AppAgenti/actions/runs/38289890582).
  Ruby/regole/stile/sicurezza PASS; job browser FAILURE per UI demo 23/24.
  Il solo FAIL riguarda il dialogo di cancellazione della bozza sintetica.
  La CI complessiva resta FAILURE e non certifica una chiusura globale verde.
- L'utente ha chiesto di ignorare i fix demo, eliminarla nel prossimo turno e
  fermarsi dopo il collaudo dei dati reali. Nessuna ulteriore correzione demo
  mantenuta; ripetizione locale aggiuntiva interrotta su richiesta. Una precedente
  matrice locale aveva quattro attese premature prima del fix test `c180cdf`;
  gli esiti finali 45/45 provengono dai log CI dello SHA sopra indicato.
  Il checkpoint successivo modifica soltanto documentazione/evidenze.

Le prime CI hanno trovato Salva bozza reso come link nella copia offline e
attese premature nel nuovo test dell'editor. Il controllo è stato uniformato
al pulsante HTML, tre ripetizioni PASS; il test mantiene le asserzioni e
attende navigazione e transazione IndexedDB. Otto ripetizioni dei casi
editor/accesso scaduto passano; nessun controllo è stato eliminato.

## Punto di ripresa per il prossimo turno

Eliminare i dati demo come annunciato dall'utente e adeguare avvio, viste/API
e relativi controlli CI all'app reale. Conservare database e account Amelia3,
CSV e credenziali locali, ordini condivisi, scheduler e PWA; mantenere le fixture
isolate necessarie ai test commerciali. Il branch non è stato unito a main.
Nessuna eliminazione demo è stata anticipata in questo turno.

Il Wi-Fi è cambiato durante il collaudo conclusivo: il precedente IP
`10.113.223.219` non era più assegnato e ha prodotto un timeout. Aggiornato
soltanto `HFS_LAN_HOST` nella copia privata `.env` a `192.168.1.12`, ricreati
web/HTTPS, preservati volumi, account, ordini e configurazione FTP. La verifica
TLS sui cinque endpoint del nuovo indirizzo è PASS.

## NOT_RUN e uso locale

Installazione Android/iPhone/iPad, trust CA su hardware, accesso da altro PC
fisico e osservazione del prossimo orario reale 06:05: NOT_RUN. Sul dispositivo
importare solo `tmp/hfs-local-root.crt`, rendere attendibile la CA e aprire
`https://192.168.1.12:3443`. Nessuna modifica a firewall, router, execution
policy o trust globale. Ignorare un errore TLS non certifica l'attendibilità.

Password in `imports/private/amelia3/local_accounts.json`, solo sul computer.
Procedure: [README](../README.md), [AMELIA3_LOCAL](../docs/AMELIA3_LOCAL.md),
[LOCAL_PWA](../docs/LOCAL_PWA.md).

Evidenze: [Git](amelia3/git-promotion.json), [import](amelia3/local-import.json),
[FTP live](amelia3/live-ftp.json), [scheduler](amelia3/scheduler-status.json),
[ordine condiviso](amelia3/order-smoke.json), [browser reali](amelia3/real-browser-results.json),
[riapertura PWA](amelia3/real-cold-start.json), [LAN](amelia3/lan-results.json),
[CI](amelia3/ci-results.json), [conteggi browser CI](amelia3/ci-browser-results.json).
