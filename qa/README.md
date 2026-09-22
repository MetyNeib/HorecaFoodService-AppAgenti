# QA — ambito delle verifiche

BOOTSTRAP_VALIDATION.json è il rapporto della preparazione del kit. I risultati registrano esclusivamente comandi realmente eseguiti nel container Linux.
Non confondere 86 test seed,20 controlli integrità e42 unit test con il collaudo delle22 schermate. React/npm/Playwright e l'installer Windows richiedono esecuzione locale.
I report `*_current.json` sono rigenerati dai comandi locali; il report bootstrap resta una fotografia della consegna iniziale.
Al completamento Codex produce IMPLEMENTATION_REPORT.md e screenshot. Non sovrascrivere un NOT_RUN con PASS senza prova.
