# QA — ambito delle verifiche

## Collaudo prodotto completato — 22/09/2026

Ultimo aggiornamento: [refitting 23/09/2026](REFIT_REPORT.md), 44 E2E PASS e [176 screenshot della build](refit/screenshots/index.html).

Vedi [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md): 49 unit test e 36 E2E PASS, build verificata e [92 screenshot](screenshots/index.html). Risultati in [e2e-results.json](e2e-results.json), [report Playwright](playwright-report/index.html) e [preview-verification.json](preview-verification.json). Le note seguenti descrivono il baseline storico del kit. I log finali e il report HTML sono presenti su disco anche se esclusi da git.

BOOTSTRAP_VALIDATION.json è il rapporto della preparazione del kit. I risultati registrano esclusivamente comandi realmente eseguiti nel container Linux.
Non confondere 86 test seed,20 controlli integrità e42 unit test con il collaudo delle22 schermate. React/npm/Playwright e l'installer Windows richiedono esecuzione locale.
I report `*_current.json` sono rigenerati dai comandi locali; il report bootstrap resta una fotografia della consegna iniziale.
Al completamento Codex produce IMPLEMENTATION_REPORT.md e screenshot. Non sovrascrivere un NOT_RUN con PASS senza prova.
