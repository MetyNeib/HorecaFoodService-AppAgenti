# Amelia3 — checkpoint e trasferimento Mac, 14/10/2026

## IMPLEMENTATO

- Base V5 e follow-up UM/catalogo/riattivazione conservati nel checkpoint
  `amelia3-demo-baseline-20261014`, a partire da `223a231`.
- Branch successivo `feature/amelia3-demo-polish`; main resta a `81587c7`.
- Repository pubblico per scelta esplicita dell'utente; dati commerciali,
  credenziali e screenshot reali esclusi. Controllo sui segreti privati noti
  e sui nomi cliente nei file testuali; solo etichetta agente approvata presente.
- Script di export con pausa/ripresa dei servizi, dump PostgreSQL custom,
  fingerprint SHA-256 ordinato di tutte le tabelle e checksum dei file privati.
- Script Bash di ripristino Mac che rifiuta sovrascritture di configurazioni
  o database esistenti, verifica integrità e avvia web senza avviare il worker.
- Configurazione FTP preservata; attivazione con `docker compose up -d worker`.
- Guida macOS, priorità ordine/WhatsApp/CRM e revisioni manuali documentate in
  [MAC_HANDOFF](../docs/MAC_HANDOFF.md). Nessun merge, deploy o scrittura FTP.

## TESTATO — PASS

- Suite completa **170 RSpec**, zero fallimenti.
- RuboCop: zero infrazioni; Brakeman: zero avvisi. Script fingerprint aggiunto
  successivamente controllato separatamente con RuboCop, zero infrazioni.
- Seed 20/20, dominio HFS 49/49, parità dominio, Amelia3/service worker 17/17,
  regole progetto e bundle (58 file pubblici senza riferimenti privati noti).
- Backup database di 84.242.186 byte, completo di tenant reali e sintetici.
- Ripristino isolato PostgreSQL 16: **28 tabelle, 3.913.567 righe**; tutti i
  fingerprint identici. Il database temporaneo è stato rimosso solo dopo PASS;
  nessun dato nel database di sviluppo è stato cancellato o sostituito.
- Immagine Docker **linux/arm64** costruita da zero con Ruby 4.0.5, gemme ARM64
  e `zeitwerk:check` PASS in emulazione. Nessuna dipendenza dall'immagine x86_64
  o dai volumi Windows per l'installazione sul Mac.
- Sintassi Bash dello script di ripristino PASS; asset precompilati PASS.
- Ultimo collaudo applicativo precedente al trasferimento: 20 scenari browser
  sui cinque profili Chromium/WebKit, più due sessioni reali in sola lettura.
  L'applicazione non è stata modificata funzionalmente in questo handoff.

Esiti macchina: [RSpec](amelia3-v5/handoff-rspec.json),
[RuboCop](amelia3-v5/handoff-rubocop.json),
[Brakeman](amelia3-v5/handoff-brakeman.json),
[restore](amelia3-v5/handoff-restore.json),
[segreti](amelia3-v5/handoff-secret-scan.json),
[nomi](amelia3-v5/handoff-name-scan.json).
La CI remota del commit è consultabile in GitHub Actions: i risultati locali
non vengono presentati come esecuzione sul Mac fisico o come CI remota.

## DA VERIFICARE / NOT_RUN

- Avvio sul MacBook Pro dell'utente, disponibilità Docker e login browser.
- Coda IndexedDB del browser Windows: non è parte del backup PostgreSQL;
  sincronizzarla prima del passaggio. Modifiche successive all'export non incluse.
- Campione congelato, ingresso WhatsApp e revisione manuale dei falsi alert
  sono obiettivi del nuovo branch, non funzionalità completate in questo handoff.
- Accesso FTP dal Mac non verificato; nessuna connessione FTP richiesta per
  ripristinare e usare i dati del pacchetto.
