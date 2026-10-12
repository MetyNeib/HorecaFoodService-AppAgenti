# Amelia3 — integrazione del 12 ottobre 2026

Stato: IN_PROGRESS. Branch `feature/amelia3-ftp-import`. Nessun deploy pubblico.
I file commerciali e le credenziali non fanno parte di questo rapporto.

| Milestone | Stato | Prova |
|---|---|---|
| M0 promozione Rails | TESTATO | PR #1, head 9cbb124433a66cb090069c4e546e4c20301273e5, CI PR 38256349200 success, merge 81587c768343cb16b450b072b1b121cbbb1e28ca |
| M1 ambiente e fonti | TESTATO | Compose 5.5.1, engine 29.8.2; nove hash/dimensioni/header coincidono con il manifest; nessuna nuova ricognizione delle righe |
| Import locale e rollback | TESTATO | Dry-run completo ~51.6s, nove conteggi uguali al manifest; publish staging ~2.7s, secondo import ~1.2s senza duplicati; 5 RSpec sintetici PASS |
| Account/ordini condivisi e PWA | DA_VERIFICARE | Solo agente codice 34; nessun invio ERP |
| Storico e analisi | IMPLEMENTATO / riconciliazione TESTATA | PostgreSQL: 1.036.814 righe; agente34: 2.237 righe/606 ordini/447 articoli, portafoglio 16=12+4; UI da verificare |
| FTP e scheduler | DA_VERIFICARE | Accesso FTP metadata read-only riuscito, nove file presenti; download/job non ancora certificati |
| LAN e QA finale | DA_VERIFICARE | Prova fisica tablet/telefono NOT_RUN |

FTP porta 21 in chiaro esplicitamente autorizzato: password e dati transitano
senza cifratura. VPN futura raccomandata. Il connettore deve consentire soltanto
letture e mantenere l'ultimo dataset valido in caso di batch incompleto.

Evidenza locale aggregata: [local-import.json](amelia3/local-import.json).
Anomalie gestite: 586 righe CLIENTI con posizioni vuote aggiuntive, un separatore
non quotato nel campo descrittivo; INSOLUTO presenta 12 date riferimento assenti,
conservate come NULL senza inventarle. Nessuna riga commerciale pubblicata.
