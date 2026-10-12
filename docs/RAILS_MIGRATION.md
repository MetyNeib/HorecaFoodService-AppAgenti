# Migrazione HFS Rails — decisioni del 12 ottobre 2026

## Obiettivo autorizzato

Riscrittura completa della V1 in Rails + Ralix, PostgreSQL e Devise. Identità HFS,
22 viste, flussi e risultati economici invariati. Questa versione costituisce la
base della futura app reale. Non viene pubblicata su server: solo esecuzioni locali.
GitHub conserva il codice in un repository privato per installazione su altri PC.

V1 aggiornata conservata nel commit `81e72bc`, branch `v1-react`, tag
`v1.0.0-react`. Rails promossa su `main` tramite PR #1 e merge `81587c7`, dopo
CI verde sullo SHA esatto `9cbb124`. La fase successiva approvata Amelia3 usa
`feature/amelia3-ftp-import`; specifiche in `docs/amelia3/`.

## Scelte confermate

- Rails + Ralix; ERB, importmap e Propshaft, CSS custom. Nessun React, Turbo o Stimulus nel nuovo runtime.
- Backend autorevole; login individuale Devise, dati e reset isolati per utente.
- PWA installabile, compatibilità Android e Apple. Offline essenziale: clienti e
  catalogo scaricati, creazione e modifica ordini, coda locale e sincronizzazione.
- Seed `HFS-AGENT-DEMO-20260922-V1` immutato; nessuna importazione dello stato localStorage V1.
- Docker Desktop locale. Nessun deploy, ERP o invio WhatsApp/email/PDF reale.
- Collaudo autonomo per milestone, incluso confronto visivo e test Chromium/WebKit.

## Dopo il refactor: importazione dati reali

È richiesto un successivo import dei dati reali di un cliente. Questa fase NON li
importa né li inventa. Occorrono sorgenti autorizzate, mapping dei codici stabili,
validazione in staging, rapporto scarti e riconciliazione prima dell'attivazione.
Dati reali, credenziali e backup non entrano mai nel repository GitHub. Il reset
demo resta separato dai dati reali; nessun import può convertire implicitamente un
dataset reale in demo. Il clock fisso riguarda soltanto il dataset dimostrativo.

## Offline e consistenza

IndexedDB conserva una copia per utente e una coda transazionale. Il server applica
comandi granulari con ricevuta idempotente, revisione ottimistica ed epoch di reset.
Il client non può sostituire lo stato server con un JSON arbitrario. Un conflitto
conserva il lavoro locale e richiede scelta esplicita; un reset invalida comandi
vecchi. Il server ricalcola prezzi, conversioni e disponibilità aggregate.

Il salvataggio Rails reale è distinto dalle trasmissioni commerciali simulate.
Il ritorno della connessione non implica ricezione da un ERP. La sincronizzazione
è verificata ad app aperta/riaperta; non viene promessa ad app chiusa su ogni OS.
La prima preparazione dei dati richiede accesso online. Logout e cambio account
devono proteggere gli ordini non sincronizzati e impedire dati fra utenti diversi.

La prima versione usa un workspace JSONB per agente, aggiornato atomicamente.
Questo limita le scritture concorrenti dello stesso workspace: conflitti espliciti,
nessuna sovrascrittura silenziosa. Prima di carichi multiagente reali occorrerà
misurare e, dove necessario, normalizzare ordini e revisioni per entità. Le regole
di dominio e il protocollo di comandi sono separati dal formato di persistenza.

## Verifiche e dispositivi

Chromium/WebKit automatici non equivalgono a installazione fisica Android/iPhone.
Le prove su dispositivi non disponibili saranno dichiarate NOT_RUN. L'accesso
PWA da telefono sulla LAN richiede HTTPS con certificato riconosciuto; il semplice
http://IP-del-PC non abilita il service worker. Nessuna apertura Internet implicita.

## Milestone

| Blocco | Stato |
|---|---|
| Snapshot V1 e branch dedicato | PASS locale e GitHub privato, 3 branch + tag verificati |
| Docker e dipendenze Rails | PASS avvio web/PostgreSQL/Redis/Sidekiq locale; lockfile reale |
| Dominio Ruby, Devise, persistenza e comandi | PASS 94 RSpec e 12 test di parità offline |
| Tutte le viste ERB e Ralix equivalenti | PASS 24 casi UI, 22 viste su quattro viewport e 88 screenshot |
| PWA offline, outbox e conflitti | PASS 28 casi Chromium/WebKit, logout concorrente e recupero dati inclusi |
| Test, sicurezza, visuale e documentazione installazione | PASS locale; Brakeman 0 warning, migrazione vuota e build PASS |

Collaudo locale concluso: [rapporto Rails](../qa/RAILS_IMPLEMENTATION_REPORT.md).
La prova di installazione sui dispositivi fisici resta NOT_RUN; non è sostituita
dai test dei motori browser.
