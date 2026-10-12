# Step 3 — entrare nel progetto

## Versione corrente: migrazione Rails + Ralix

Dal 12/10/2026 il branch `feature/hfs-rails-migration` implementa Rails/PostgreSQL
con Devise e PWA offline essenziale, su richiesta dell'utente. Leggere
[RAILS_MIGRATION.md](RAILS_MIGRATION.md), [PROGRESS.md](PROGRESS.md) e il
[README corrente](../README.md). La V1 è conservata su `main` e `v1-react`.
Gli stati COMPLETE e i comandi Vite sotto riguardano il contesto storico V1;
non certificano la migrazione Rails. Nessun deploy server autorizzato.

## Contesto storico V1

PACKAGE_ID=HFS-STEP3-CODEX-KIT-20260922-V1
DATASET_ID=HFS-AGENT-DEMO-20260922-V1
BOOTSTRAP_STATUS=READY
FULL_APP_STATUS=COMPLETE_LOCAL
DEPLOY_STATUS=NOT_DEPLOYED

## Aggiornamento layout — 11/10/2026

Header/footer automatici e liste compatte completati localmente: 90 E2E e 437 controlli sulle viste PASS. Entrambe le barre partono aperte e si richiudono dopo un secondo; la riapertura manuale dura fino allo scroll centrale o delle liste. Da chiuse restano l'icona account e il tasto footer. Le sottoliste proteggono lo spazio per due schede leggibili; la compattazione precede lo scorrimento di sicurezza. Preview attiva e nuova build verificata su http://127.0.0.1:4173/. Report corrente: [ADAPTIVE_DOCKS_REPORT.md](../qa/ADAPTIVE_DOCKS_REPORT.md); [footer precedente](../qa/FOOTER_BEHAVIOR_REPORT.md); [layout iniziale](../qa/ELASTIC_LAYOUT_REPORT.md). Le certificazioni sottostanti sono storiche.

## Consegna locale completata — 22/09/2026

Refitting completato il 23/09: viste a piena finestra, pannelli scorrevoli, maggior contrasto e icone aggiornate. Collaudo corrente: 44 E2E e 176 verifiche layout PASS; vedere [REFIT_REPORT.md](../qa/REFIT_REPORT.md).

Il bootstrap è stato sostituito dall'app completa. M1–M8 concluse: 49 unit test e 36 E2E PASS, build e quattro viewport verificati. Stato corrente in [PROGRESS.md](PROGRESS.md), evidenze in [IMPLEMENTATION_REPORT.md](../qa/IMPLEMENTATION_REPORT.md). Le descrizioni del kit sotto riportano il contesto iniziale e le specifiche di partenza.

## Obiettivo richiesto dall'utente
Costruire un mockup interattivo HTML/CSS/JS, semplice ma curato, della App Agenti presentata in call. La consegna corrente è un pacchetto di setup e avvio Codex per implementarla localmente, non un nuovo giro di progettazione.
La base React rende gestibili stato condiviso e 22 viste. Tutta la UI è italiana. Le azioni business sono simulate ma modificano realmente lo stato locale.

## Cosa non deve essere rifatto
Non rianalizzare i cataloghi reali, non cercare contatti, non rigenerare il dataset. Il seed da usare è già in `src/data/hfs_demo_data.json`. Gli screenshot WA reali non sono asset della demo.
Non aspettare accesso Figma online: nella preparazione il connettore ha negato l'accesso perché non editor. Sono inclusi entrambi i FIG locali e gli estratti verificati. Non serve cambiare permessi al file remoto.

## Quale documento decide cosa
- `01_REQUIREMENTS.md`: controlli per ogni pagina e comportamenti.
- `references/functional/CALL_CONTEXT.md`: estrazione strutturata della call fornita dall'utente; non è una nuova trascrizione verbatim.
- PDF/PNG: posizione e gerarchia dei blocchi. I tratteggi viola e i pulsanti footer Precedente/Successiva sono ausili del PDF, non UI del prodotto.
- `03_DESIGN_SYSTEM.md`: font, colori e componenti. L'altra app nel FIG vale soltanto come esempio stilistico.
- `references/data/DATA_CONTRACT.md`: significato esatto dei dati e regole di calcolo.
- `05_ACCEPTANCE.md`: obiettivi verificabili della consegna.

## Stato iniziale da ottenere nell'app
Marco Rossi, AG-014, otto clienti assegnati; offline, sync alle 08:30; orologio 22/09/2026 09:30 Europe/Rome. Home con 2 bozze, 1 da inviare, 24 inviati, 3 verifiche WhatsApp. Non inventare un cambio agente perché il seed contiene quattro agenti.

## Verifiche del kit e della futura app
`qa/BOOTSTRAP_VALIDATION.json` riguarda solo quanto eseguito in preparazione. I 86 controlli del seed, i 20 controlli integrità e gli unit test non equivalgono al test completo dell'app.
La pagina bootstrap può essere rimossa quando parte l'implementazione. L'app finale deve mostrare Home e tutti i flussi, non questo documento o un pannello di sviluppo.

## Ripartenza in un altro turno Codex
Leggere `docs/PROGRESS.md`, poi il report QA più recente. Riprendere dalla milestone non conclusa senza ricreare seed, struttura o file già corretti. La cartella corrente è autorevole: non cercare percorsi assoluti scritti in una chat precedente.
