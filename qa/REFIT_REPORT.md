# Refitting delle viste — 23 settembre 2026

**COMPLETE — refitting implementato e collaudato.** Layout aggiornato nella root esistente, in base agli screenshot annotati e al PDF locale. Build aggiornata in `dist/`, servita e verificata su **http://127.0.0.1:4173/**.

## Risultato

- Tutte le 22 viste usano la larghezza disponibile. Header/footer compatti e area principale dimensionata sulla finestra.
- Home senza scorrimento esterno su desktop e tablet, anche verticale. Proporzioni più vicine al PDF, titoli e contatori più leggibili, maggior contrasto, documento con + e fumetto centrato.
- Prodotti e carrello hanno scorrimenti indipendenti; ricerca, filtri, totale e azioni rimangono fuori dalle liste.
- Clienti, ordini, WhatsApp, catalogo, partite, condizioni e analisi usano regioni interne con nome accessibile, focus e scrollbar native. I form estesi conservano uno scorrimento interno di sicurezza; nessun campo viene eliminato.
- Su telefoni verticali dal rapporto nominale 19,5:9 la pagina si impila e scorre normalmente. Soglia CSS: larghezza ≤650px e rapporto larghezza/altezza ≤0,465, con tolleranza per arrotondamenti come 390×844.
- Referenti modificabili nel dialog condiviso. Seed, lockfile e logica di dominio conservati.

## Collaudo

| Comando / controllo | Esito |
|---|---|
| `npm.cmd run validate:data` | PASS — 20/20 |
| `npm.cmd test` | PASS — 49/49 |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run check:bundle` | PASS — 5 file |
| `npm.cmd run test:e2e` | PASS — 44/44, 0 skipped, 0 flaky |
| `node scripts/verify-refit.mjs` con HFS_QA_URL=http://127.0.0.1:4173 | PASS — 176/176 viste |
| `node scripts/verify-preview.mjs` | PASS — quattro viewport, nessuna richiesta esterna o download reale |
| `git diff --check` | PASS |
| Deploy pubblico, Safari/Firefox | NOT_RUN — fuori da questo collaudo locale Chromium |

La verifica geometrica copre **22 viste × 8 viewport**: 390×844, 768×1024, 1024×768, 1440×900, 1920×872, 1366×768, 600×960 e 412×915. Controlla overflow, contenitori troncati, altezza dei pannelli, footer e barre di azione. Il contenuto scorrevole rimane confinato alle regioni previste sui tablet/desktop; su telefono viene verificato che i contenuti non si sovrappongano al footer.

I nuovi test E2E verificano anche End da tastiera nella lista clienti, indipendenza tra prodotti e carrello, conservazione della posizione del riepilogo, pulsante di conferma WA e area delle alternative dopo la selezione, Home senza sovrapposizioni e footer sotto le partite mobile. I 36 test funzionali preesistenti sono conservati.

Controllati visivamente Home, prodotti/carrello, editor riga, WhatsApp, partite, catalogo e analisi, con attenzione ai due orientamenti tablet, al desktop ampio e allo stacking mobile. Corrette durante il collaudo: compressione eccessiva delle alternative WA, sovrapposizione delle card Home sul tablet orizzontale, overflow dei tab prezzo su telefono e collasso della tabella partite mobile. I controlli sono stati estesi per coprire le regressioni trovate.

## Evidenze e ripetizione

Nessun FAIL finale. I problemi intermedi descritti sopra sono stati corretti e ricollaudati.

- [176 screenshot della build](refit/screenshots/index.html).
- [Risultati geometrici](refit/layout-results.json).
- [Risultati E2E](e2e-results.json) e [report Playwright](playwright-report/index.html).
- [Verifica preview](preview-verification.json).

Per ripetere la verifica del layout con `npm.cmd run preview` attivo:

```powershell
$env:HFS_QA_URL = 'http://127.0.0.1:4173'
node scripts/verify-refit.mjs
node scripts/build-qa-gallery.mjs --refit
```

Avvio sviluppo invariato: `npm.cmd run dev` → http://127.0.0.1:5173/. Per vedere la nuova build nella preview già aperta basta ricaricare la pagina.
