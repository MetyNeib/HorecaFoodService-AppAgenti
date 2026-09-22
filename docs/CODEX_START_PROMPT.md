Implementa completamente la demo “Horeca Food Service — App Agenti” nella cartella di progetto attualmente aperta. Il setup è già stato eseguito: non reinstallare lo ZIP e non creare una seconda cartella annidata.

Questa è un'autorizzazione a realizzare il progetto locale e a eseguire i test necessari. Non limitarti a un piano, a una Home o al bootstrap: completa i flussi, verifica l'interfaccia e produci la build. Rispetta i permessi del tuo ambiente; non disabilitare sandbox/approvazioni e non operare fuori dalla cartella del progetto.

LETTURA INIZIALE
1. AGENTS.md, docs/00_START_HERE.md e docs/PROGRESS.md.
2. docs/01_REQUIREMENTS.md, docs/02_ARCHITECTURE.md e references/data/DATA_CONTRACT.md.
3. references/functional/CALL_CONTEXT.md, tutti i 22 PNG in references/functional/pages/ e pdf_navigation.json. Il PDF originale è incluso.
4. docs/03_DESIGN_SYSTEM.md e gli estratti JSON in references/design/. I due FIG originali sono inclusi ma non occorre accesso online.
5. src/data/hfs_demo_data.json, docs/06_DATA_GUIDE.md, fixtures/step3_acceptance_scenarios.json.
6. docs/04_IMPLEMENTATION_PLAN.md e docs/05_ACCEPTANCE.md.

FONTI E VINCOLI
Il PDF decide struttura e organizzazione. La call precisa i comportamenti. Il design system Figma decide lo stile. Il mockup Figma è UN'ALTRA APP: non copiarne navigazione o funzionalità e non aggiungere una sidebar.
Usa il seed approvato HFS-AGENT-DEMO-20260922-V1 senza rigenerarlo o cambiarne codici/nomi/prezzi. I dati runtime sono una copia modificabile, il seed resta immutabile.
Tablet first con gli stessi elementi su desktop e telefono: solo ricomposizione/stacking, nessuna funzione o colonna soppressa per dispositivo.
React + TypeScript + Vite, CSS token e componenti riutilizzabili; stato condiviso Context/useReducer, routing contestuale e localStorage con schemaVersion/reset.
Niente backend, AI reale, prospect, configuratore alert, registrazione incassi o nuove funzioni fido. WhatsApp/email/PDF sono esclusivamente simulati. Nessuna API key richiesta dalla demo.
Nota per documento consegna, senza tre checkbox; pagamento override soltanto per ordine. Clock demo fisso, centesimi interi, conversioni UM esplicite, margini e condizioni come nel contratto.
Non includere references, FIG/PDF/XLSX, font binari o screenshot reali nella build. Inter locale con fallback di sistema.

ESECUZIONE
Verifica i file presenti e riusa la base. Installa le dipendenze da package.json usando npm.cmd su Windows e genera il package-lock.json reale. Non inventare lockfile o risultati. Esegui prima validate:data e unit test.
Poi implementa M1–M8 senza chiedere conferma dopo ogni milestone: DS/shell/Home; ordine manuale e prezzi; offline/sync/liste; FastOrder e disambiguazioni; clienti/partite/condivisioni/condizioni; catalogo/scheda; insight/azioni; QA finale.
Rendi funzionanti ricerca, filtri, quantità, UM, margini, salvataggi, ritorni, condizioni, persistenza e contatori. Non sostituire le funzioni centrali con toast generici. Solo gli invii esterni sono simulati.
Usa lo stesso ordine canonico e gli stessi componenti per manuale e WhatsApp. La coda deve essere idempotente anche con doppio click/reconnect/StrictMode. Le ambiguità WA non possono essere risolte inventando quantità o UM.
Mantieni docs/PROGRESS.md e docs/DECISIONS.md aggiornati. Chiedi soltanto per un vero blocco non risolvibile dai file, continuando le parti indipendenti.

VERIFICA E CONSEGNA
Esegui npm.cmd run validate:data, npm.cmd test, npm.cmd run typecheck e npm.cmd run build. Completa la suite Playwright, installa Chromium tramite npx.cmd playwright install chromium quando necessario e consentito, poi esegui npm.cmd run test:e2e e npm.cmd run check:bundle.
Verifica i flussi di accettazione e screenshot a 390x844, 768x1024, 1024x768 e 1440x900. Controlla overflow, CTA raggiungibili, focus, dati coerenti e assenza di richieste business esterne.
Sostituisci il test bootstrap con test del prodotto. Non dichiarare l'app completa per il solo passaggio dei test dati.
Consegna codice funzionante, dist, test e qa/IMPLEMENTATION_REPORT.md con comandi ed esiti PASS/FAIL/NOT_RUN. Indica il comando esatto per avvio locale e l'URL verificato; non dichiarare un deploy pubblico non eseguito.
Se raggiungi un limite tecnico, salva checkpoint preciso e stato dei file e segnala cosa manca, senza marcare COMPLETE o inventare test superati.
