# HFS — Amelia3 / handoff Codex v3

**Data:** 12 ottobre 2026. **Obiettivo:** demo 13 ottobre; consegna completa progettata per import, due account e sincronizzazione FTP schedulata.

## Contenuto del pacchetto (nessun CSV reale e nessuna credenziale)

1. `HFS_Amelia3_Prompt_Codex_20261012.md` — prompt principale, da incollare nella sessione Codex.
2. `HFS_Amelia3_Piano_Operativo_20261012.md` — sequenza Git autonoma, runtime, milestone e QA.
3. `HFS_Amelia3_Mappa_Codex_20261012.md` — schema dei nove CSV, relazioni e problemi reali.
4. `HFS_Amelia3_Manifest_Codex_20261012.json` — hash SHA-256, colonne, conteggi, riconciliazioni e profilo agente 34.
5. Questo file — guida di installazione dei materiali.

## Installazione dei documenti (non delle sorgenti commerciali)

Copia i file `.md`/`.json` in `docs/amelia3/` del repository locale, evitando duplicati di versioni precedenti. Il pacchetto ZIP **non contiene** i nove file CSV, `.env`, password, telefono, nomi dei clienti o documenti commerciali.

I CSV sono già presenti, secondo la conferma dell'utente, in `imports/private/amelia3/` e non devono entrare in Git. Il file `TABGIR.csv` è la copia rinominata del `TABGIR(1).csv` allegato a questa chat. I campioni sono del 12 ottobre; i file in `/UPLOAD` potrebbero essere cambiati legittimamente. Verificare checksum ed evidenziare differenze temporali.

La password è già in `.env` e **non va reinserita nel prompt**. I nomi delle chiavi per l'ora scheduler vanno letti da Codex senza stampare valori sensibili.

## Decisioni da non perdere

- Agent **34 — Sophia Buzzicotti**; 16 clienti, 12 non bloccati e 4 bloccati. Il precedente codice `7` è escluso dalla configurazione.
- FTP porta 21 **senza TLS**, rischio **approvato** per Amelia3; read-only su `/UPLOAD`, VPN futura.
- Scheduler realmente **attivo** alle **06:05 Europe/Rome**; il connettore non deve mai scrivere sul FTP.
- Git: Codex è autorizzato a effettuare PR + merge Rails → `main`, poi branch `feature/amelia3-ftp-import`, senza force-push e senza deploy.
- Docker CLI ora disponibile secondo utente; Codex esegua i test.
- Admin+Agente operativi su dati condivisi, Capoarea futuro; ordini solo nel DB Rails senza invii esterni.
- Storico: quantità/frequenze sì; ricavi/margini storici no senza sorgenti attendibili.
- Tablet/telefono: HTTPS LAN già predisposto nel repository (`compose.lan.yml` + `docs/LOCAL_PWA.md`).

## Stato fonte di verità

GitHub era ancora con `main=81e72bc`, Rails `3b15948d` e nessuna PR aperta all'ultima verifica. **Codex deve verificare lo stato remoto attuale prima del merge**. Una CI verde su `fbbaeec` non certifica automaticamente un commit diverso.
