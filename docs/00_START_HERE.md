# Step 3 — entrare nel progetto

PACKAGE_ID=HFS-STEP3-CODEX-KIT-20260922-V1
DATASET_ID=HFS-AGENT-DEMO-20260922-V1
BOOTSTRAP_STATUS=READY
FULL_APP_STATUS=NOT_IMPLEMENTED
DEPLOY_STATUS=NOT_DEPLOYED

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
