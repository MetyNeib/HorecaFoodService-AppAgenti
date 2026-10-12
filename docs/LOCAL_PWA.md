# PWA locale su Android e Apple

Il computer esegue Rails/PostgreSQL in Docker; i dispositivi usano il browser o
l'app installata. Il backend resta locale, senza pubblicazione Internet.
Il PC deve essere acceso e sulla stessa rete per accesso iniziale e sincronizzazione.
Dopo la preparazione online, il nucleo offline funziona anche senza PC raggiungibile.

Per Amelia3 il PC corrente risponde su **https://192.168.1.12:3443**.
TLS e cinque endpoint sono stati verificati con CA esplicita, senza modificare
il trust di Windows. La CA pubblica da trasferire è `tmp/hfs-local-root.crt`.
L'IP può cambiare con la rete Wi-Fi: aggiornare `HFS_LAN_HOST` nella copia
privata `.env` e riavviare il compose LAN se necessario. Account Admin/agente34,
password nel file privato `imports/private/amelia3/local_accounts.json`.
Installazione fisica NOT_RUN, distinta dalle prove browser e TLS.

## Sul computer

`http://127.0.0.1:3002` è un'origine locale utilizzabile dai browser per il service
worker. Su un telefono `127.0.0.1` indica invece il telefono stesso: serve l'indirizzo
LAN del computer e HTTPS con certificato riconosciuto.

Il file facoltativo `compose.lan.yml` aggiunge Caddy con una CA locale. Non modifica
il trust del sistema, il firewall o il router e non apre tunnel. La configurazione
standard rimane limitata a loopback. Per attivare la LAN, individuare l'IP privato
del PC nella rete Wi-Fi e aggiungere a `.env`, ad esempio:

```dotenv
HFS_LAN_HOST=192.168.1.20
```

Sostituire l'indirizzo d'esempio con quello effettivo, poi:

```powershell
docker compose -f compose.yml -f compose.lan.yml up -d
docker compose -f compose.yml -f compose.lan.yml cp https:/data/caddy/pki/authorities/local/root.crt ./tmp/hfs-local-root.crt
```

L'app risponde su `https://192.168.1.20:3443`. Consentire eventualmente nel firewall
l'accesso alla sola rete privata per questa porta. Nessun port forwarding sul router.
Trasferire ai propri dispositivi **solo `root.crt`**: la chiave privata della CA resta
nel volume Docker. Non commettere certificati o chiavi nel repository.

Ogni dispositivo deve riconoscere la CA prima dell'uso; ignorare un errore TLS non
equivale a rendere attendibile l'origine. La procedura è descritta nella
[documentazione Caddy su HTTPS locale](https://caddyserver.com/docs/automatic-https#local-https).
Installare la CA soltanto sui dispositivi usati per questa prova, e rimuoverla quando
la prova termina. Questo file prepara il percorso di installazione, non certifica
un test su hardware fisico.

## iPhone e iPad

Installare il certificato come profilo, poi attivare l'attendibilità SSL in
Impostazioni → Generali → Info → Impostazioni attendibilità certificati, secondo
la [guida Apple](https://support.apple.com/en-us/102390).
Aprire l'URL HTTPS in Safari, accedere e attendere la preparazione dei dati.
Dal menu Condividi scegliere Aggiungi alla schermata Home e, quando presente,
Apri come app web. Riferimento: [installazione web app in Safari](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).

## Android

Installare il certificato CA nelle impostazioni di sicurezza del dispositivo
(il nome del menu varia secondo produttore/versione). Aprire l'URL HTTPS in Chrome,
accedere e preparare i dati, poi scegliere Installa app o Aggiungi a schermata Home.
La disponibilità e l'etichetta del comando dipendono dal browser; vedere
[installazione PWA](https://web.dev/learn/pwa/installation).

## Prova di accettazione sul dispositivo

1. Aprire l'app installata online, verificare clienti, catalogo e una bozza.
2. Attivare modalità aereo; riaprire l'app, creare un ordine e modificarne le righe.
3. Chiudere e riaprire l'app: quantità, note e coda devono essere conservate.
4. Riattivare la rete con il PC acceso; attendere la sincronizzazione e controllare
   dal PC che l'ordine esista una sola volta con gli stessi totali.
5. Verificare logout, successivo accesso e isolamento con un secondo utente.

Le installazioni possono avere storage separati. La prima apertura di ciascuna
installazione richiede rete. Il sistema operativo può rimuovere dati del browser:
sincronizzare regolarmente e verificare la coda prima di cancellare l'app.

Per fermare il solo accesso LAN:

```powershell
docker compose -f compose.yml -f compose.lan.yml stop https
```

Installazione fisica Android/iOS e fiducia del certificato: **NOT_RUN** finché
eseguite sui dispositivi. I test Chromium/WebKit automatici vengono registrati
separatamente nel report Rails.
