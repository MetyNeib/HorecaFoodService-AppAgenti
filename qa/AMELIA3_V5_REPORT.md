# Amelia3 v5 — implementazione e collaudo locale

## Follow-up UM e riattivazione — 13 ottobre 2026

Aggiornamento 14/10: salvataggio autorizzato della base sul tag
`amelia3-demo-baseline-20261014`, nuovo branch `feature/amelia3-demo-polish`,
repository pubblico con dati privati separati. Il precedente stato «working
tree non committato» descrive le verifiche del 12–13 ottobre.
Per trasferimento, controlli aggiornati e limiti vedere
[MAC_HANDOFF_REPORT](MAC_HANDOFF_REPORT.md) e [guida Mac](../docs/MAC_HANDOFF.md).

**IMPLEMENTATO:** unità unica mostrata come testo, selettore solo con più UM
effettivamente ordinabili; prezzo, disponibilità e quantità seguono la selezione
online/offline. Nessuna estensione delle conversioni o dell'indivisibilità.
Nuova classificazione «Da riattivare» per ultimo acquisto consegnato oltre 90
giorni, distinta dai tre alert ordinari e visibile anche nei clienti preparati
offline. Include storico oltre 12 mesi e clienti bloccati (ancora non ordinabili).
Nessuna classificazione arbitraria dei clienti senza storico. Soglia stretta:
90 giorni ordinario, 91 riattivazione. I risultati precedenti restano conservati;
il nuovo calcolo usa regole versionate e risolve le segnalazioni superate.

**TESTATO — PASS:**

- 29 test Rails: soglie, storico lungo, quantità non positive, assenza storico,
  nuove consegne, confronto incrementale/completo, portafogli, viste e snapshot.
- 17 test JavaScript, 20 scenari browser sui cinque profili Chromium/WebKit:
  UM unica/multipla, importi salvati, riavvio offline, badge e contatti.
- Due sessioni browser reali in sola lettura, desktop Chromium e tablet WebKit:
  UM, paginazione riattivazione, scheda cliente online/offline, nessun overflow.
  Screenshot reali esclusivamente nell'area privata; ispezionato anche lo
  screenshot sintetico del telefono.
- Audit del 13/10 sui profili già importati, **zero righe CSV rilette**:
  2.842 clienti da riattivare; zero loro segnalazioni negli alert ordinari.
  Alert correnti: 168 cliente fermo, 1.885 prodotto mancante, 57 frequenza in calo.
- Catalogo: 1.399 prodotti ordinabili, 1.375 a UM unica e 24 con due alternative.
  Distribuzione: PZ 294, COLL 601, CONF 464, KG 16, CONF/PZ 21, COLL/PZ 3.
- Regole progetto: 103 file, zero violazioni. Asset compilati; web e worker
  locali riavviati; `/up` HTTP 200. Nessun commit, push, merge o deploy.

Esiti: [audit reale](amelia3-v5/reactivation-real-audit.json),
[browser sintetici](amelia3-v5/reactivation-playwright.json),
[browser reali](amelia3-v5/reactivation-real-browser.json).
Prima esecuzione Rails: fixture del nuovo test priva del campo obbligatorio
`source`, corretta. Controllo browser reale: corrette le attese del test per
preparazione service worker e rendering asincrono dopo reload offline.
Tutte le esecuzioni finali pertinenti PASS, nessun errore applicativo irrisolto.

**DA VERIFICARE / NOT_RUN:** dispositivi fisici Android/iOS non collaudati in
questo turno. La classificazione riflette lo storico consegne importato, non
eventuali attività gestionali successive non ancora importate o bozze locali.
Le limitazioni economiche già documentate sui pesi non attestati restano valide.

---

12 ottobre 2026, Europe/Rome. Branch **feature/amelia3-ftp-import**, base locale e remota **223a2312172a6a2d83cb19012abf908adef2357b**. La v5 è nel **working tree locale non committato**. Nessun commit, push, PR, merge, deploy o scrittura FTP. I test riguardano le modifiche locali oltre al commit di base.

Stato: **IMPLEMENTATO E TESTATO LOCALMENTE**, con verifiche esterne elencate sotto. Verifiche locali concluse; nessun FAIL applicativo irrisolto.

Identificazione del codice locale: [manifest SHA-256 di 99 file modificati](amelia3-v5/source-manifest.json). Riepilogo verificabile degli ultimi esiti per scenario: [60 Amelia3 e 28 PWA condivisa](amelia3-v5/browser-coverage.json). I FAIL delle prime esecuzioni rimangono nei report originali.

## Fonti e salvaguardia

### Follow-up selettore UM e segnaposto generici

IMPLEMENTATO: menu nativo con etichetta accessibile e ID univoco nelle schede
online, stesso selettore nel renderer offline. È visibile soltanto il pannello
dell'unità scelta; ciascun form mantiene il proprio prezzo esatto, unità e versione
di conversione. Al cambio unità si reimposta la quantità al passo minimo, o vuota
per KG senza passo prefissato. Dati nel carrello e prezzi importati invariati.

Esclusi i nomi iniziali di segnaposto generici (articolo vario/vari, prodotto
generico, merce varia e simili), senza rimuovere anagrafiche o storico. La regola
vale prima della paginazione e nella selezione iniziale offline; flag nello
snapshot e riconoscimento del nome anche sulle copie precedenti. Tre nomi reali
corrispondenti; catalogo per il cliente della nuova segnalazione: 1.399 articoli.

TESTATO: 20 request/quote spec e 17 test JavaScript/service worker PASS. Il test
iniziale del plurale ARTICOLI VARI ha individuato un difetto del filtro, corretto
sia in Ruby sia in JS. Verificati anche i controesempi Caramelle gusti vari,
Mix verdure e Articolo variante speciale, che devono restare selezionabili.
Controlli reali [7 PASS](amelia3-v5/unit-selector-real-browser.json): quattro
viewport Chromium, tablet WebKit e cold reload offline nei due motori; selezione
su un articolo reale con due UM, un solo pannello visibile, zero overflow,
nessuna mutazione commerciale. Screenshot e campioni esclusivamente privati.

Verifica in sola lettura dell'articolo generico segnalato: il prezzo unitario
coincide con prezzo del collo diviso confezioni/collo e pezzi/confezione; fattori
positivi e importo inferiore al centesimo. Non emerge un errore aritmetico in quel
caso; non si estende questa verifica alla validità commerciale dei dati generici.
Esclusione applicata come richiesto, senza modificare prezzi o coefficienti.

Il primo collaudo browser è stato interrotto per correggere l'etichetta del menu
(testo delle opzioni incluso nella ricerca per label e ID duplicati). Seconda
esecuzione interrotta per correggere soltanto l'aspettativa testuale 1/1.0:
la quantità numerica era già corretta. Una successiva esecuzione si è fermata
con 2 PASS e 1 FAIL perché il nuovo test leggeva l'ID ordine prima che terminasse
la navigazione: aggiunta attesa dell'URL e asserzione ID non nullo, senza modifiche
applicative. [Report intermedio](amelia3-v5/unit-selector-verified-playwright.json).

Collaudo completato il 13/10: [15/15 PASS](amelia3-v5/unit-selector-complete-playwright.json)
sui cinque profili previsti. Verificati selezione online e offline, singolo gruppo
di controlli visibile, quantità reimpostata, importi esatti salvati (fixture:
0,25 KG = 80 centesimi e 1 COLL = 1.600 centesimi), righe distinte nello stesso
ordine, cold reload e sincronizzazione, nonché funzionamento online senza
IndexedDB. RuboCop mirato, checker e bundle PASS; asset ricompilati e Rails
riavviato. [Hash sorgenti](amelia3-v5/unit-selector-source-hashes.json).
Nessun commit/push/merge/deploy e nessuna scrittura commerciale nei dati reali.

### Follow-up catalogo demo utilizzabile

IMPLEMENTATO su richiesta successiva alla diagnosi: esclusione dalle liste
Catalogo e Aggiunta ordine degli articoli privi di UM quotabile. Filtraggio prima
di paginazione/conteggio e sul cliente dell'ordine, comprese condizioni personali
e sovrapposizioni. Nei prodotti con almeno una UM valida, si mostrano soltanto
quelle valide. La selezione si ricalcola sui dati correnti senza cambiare i CSV,
il batch, le attestazioni o i prezzi.

Offline: preparazione iniziale di 180 articoli validi invece dei primi 180 non
bloccati; contesto ordine, richieste esplicite e storico restano conservati.
Il renderer filtra anche record esclusi presenti in una vecchia cache, applicando
le condizioni cliente. Nessun azzeramento di IndexedDB o outbox. Dettagli UM
ordine/prezzo/giacenza espliciti, controlli quantità affiancati di almeno 44 px,
stato vuoto e conteggio dei risultati disponibili. Scheda prodotto corretta
per la prima UM effettivamente valida, senza dichiarare sempre UM P.

TESTATO: 19 request/quote spec PASS, 16 test JavaScript/service worker PASS,
RuboCop mirato, checker 103 file e bundle PASS. Tre nuove regressioni Rails:
filtraggio prima della paginazione con 103 record sintetici, UM secondaria valida
e prezzo cliente ambiguo, snapshot ordinabile con conservazione dei record
richiesti esplicitamente. Test JS su record esclusi, clienti bloccati e condizioni.

Browser reale in sola lettura: [7 controlli PASS](amelia3-v5/filtered-catalog-real-browser.json),
quattro viewport Chromium e tablet WebKit, cold reload offline in entrambi i
motori. Per il cliente della segnalazione, 1.400 prodotti ordinabili e 50/50
schede utilizzabili nella prima pagina, zero pulsanti Aggiungi disabilitati.
235 prodotti validi preparati nei due browser di prova; quantità allineate,
nessun overflow. Schermate reali private; nessuna mutazione commerciale.
Tempi navigazione osservati con test concorrenti: circa 4,8–7,3 secondi.

Flussi sintetici: 30 scenari complessivamente PASS su telefono, tablet,
landscape, desktop Chromium e tablet WebKit: navigazione e overflow, ordine
condiviso Admin/agente e conferma, cold reload offline e sync idempotente,
blocchi API, cache di prodotti esclusi, multi-UM e KG decimali.
[Prima esecuzione](amelia3-v5/filtered-catalog-playwright.json): 25/30 PASS;
cinque FAIL nello stesso scenario che chiedeva di conservare nella nuova
selezione server un prodotto ora escluso. Il test è stato corretto preparando
esplicitamente la scheda e passando offline prima della navigazione: verifica
così che il renderer nasconda il record ancora memorizzato, conservandolo insieme
all'ordine e al totale. [Ripetizione](amelia3-v5/filtered-catalog-offline-retest.json):
5/5 PASS; nessuna modifica applicativa per questo caso. Anche il primo tentativo
del controllo reale ha richiesto un selettore più preciso per il conteggio,
perché la pagina contiene tre elementi con role=status. Il controllo finale è PASS.
Hash degli otto file applicativi del follow-up in
[filtered-catalog-source-hashes.json](amelia3-v5/filtered-catalog-source-hashes.json).

DA VERIFICARE: peso fisso e consuntivo restano come già documentato. Per rendere
utilizzabile la demo è stata applicata l'esclusione richiesta, senza abilitare
conversioni economiche nominali o implementare un consuntivo non disponibile.
Gli articoli restano consultabili tramite scheda/storico, ma non selezionabili.
Nessun commit, push, merge o deploy; servizio Rails locale riavviato dopo build.

### Follow-up spaziatura Home del 12 ottobre

CSS limitato alla Home Amelia3: altezza delle righe determinata dal contenuto
invece delle altezze frazionarie della demo, padding 20 px nelle azioni e 16 px
nelle card di navigazione, controlli di almeno 44 px. Sul viewport 1348×798 le
schede principali passano da 375 a 161 px, spazio sopra il titolo da 138 a 21 px.
[Prima](amelia3-v5/home-spacing-before.json), [dopo](amelia3-v5/home-spacing-after.json):
sei controlli Chromium/WebKit PASS, otto collegamenti conservati, nessun overflow
o contenuto tagliato. Screenshot sintetici ispezionati su desktop e telefono.
Checker 103 file e bundle PASS; asset ricompilati e servizio locale riavviato.
Nessuna modifica a dati, ordini o permessi.

### Follow-up accesso Chrome del 12 ottobre

Dopo il collaudo v5 è stata corretta la presentazione del rifiuto a un account
demo già autenticato: GET HTML mostra una pagina esplicativa e il collegamento
alla demo per il normale logout protetto. HTTP/API restano 403; sessione, dati,
permessi e account non vengono modificati automaticamente. Non occorre cancellare
cookie o IndexedDB. Il manifest del collaudo v5 sopra precede questo follow-up.

Verifiche: [8 request spec PASS](amelia3-v5/account-access-spec.json),
[3 controlli Chromium PASS](amelia3-v5/account-access-browser.json) con ritorno
alla demo e accesso separato agente 34/Admin reali, senza mutazioni commerciali.
RuboCop sui due file Ruby PASS, checker 103 file senza violazioni.

Letti 00/01 v5, tutti gli allegati tecnici, analisi, script, handoff UM e requisiti v4. Verificati 33 payload SHA-256 e v4 byte-identico. Partenza pulita da 223a231, non dal vecchio e0c6570. Il riferimento WhatsApp è stato letto dal pacchetto privato, senza introdurlo nel runtime. Nove export originali conservati.

Backup preventivo privato: backups/pre-amelia3-v5-223a231.dump, **54.809.144 byte**. Database, volumi, credenziali, scheduler e lavoro precedente conservati. I **due ordini reali già confermati sono invariati**, verificati tramite digest completo prima/dopo. Browser sugli account reali solo in lettura; mutazioni esclusivamente nel tenant QA.

Seed HFS immutato e isolato, come richiesto da v5. Nessuna correzione delle funzioni demo; aggiornati shell PWA e dialoghi condivisi per compatibilità. [Preflight](amelia3-v5/preflight.json), [GitHub](amelia3-v5/github-final.json), [migrazioni da database vuoto](amelia3-v5/empty-migrations.json).

## IMPLEMENTATO

| Milestone | Risultato |
|---|---|
| M0 | Stato locale/remoto, CI precedente e protezione del lavoro |
| M1 | P=PZ, C=CONF, K=KG, L=COLL; preferita/seconda UM dai flag; sconosciute chiuse |
| M2 | Attestazioni versionate, quote per UM, stock coerente, calcolo esatto, confermati immutabili |
| M3 | Offline reale, quantità decimali, coda idempotente, isolamento account, conflitti conservativi |
| M4 | Logo originale, drawer 252 px, sette destinazioni, nessun header/footer/dock Amelia3 |
| M5 | Bozze/Confermati/Storico, 20 ordini storici/pagina, dettaglio condiviso, WhatsApp placeholder e contatti |
| M6 | Tre alert v4, profili incrementali, pubblicazione atomica, 10/pagina mix 4/4/2, job 06:30 dopo FTP |
| M7 | Test, benchmark, build, controlli statici e documentazione |

Identità reale dell'account nel drawer, disclosure stato/coda/import in testata, installazione e uscita in fondo. FTP tecnico nel dettaglio Admin senza ottava destinazione commerciale. Indicatore nascosto quando Rails, coda e sessione sono regolari. Escape, sfondo, pulsante e navigazione chiudono il drawer; trigger esplicito per restituire il focus su WebKit.

Storico per coppia cliente/riferimento, filtri server prima della paginazione, righe ripetute e quantità originali preservate, nessun ricavo/stato ERP inventato. Riepiloghi derivati evitano aggregazioni complete nelle liste. Storico e alert richiedono collegamento e non mostrano dati sintetici offline. Popup con righe statiche Nome–telefono, normalizzazione separata e link individuali wa.me senza testo o invio automatico; recapiti invalidi disabilitati.

La PWA prepara entrambe le shell neutrali con tutti gli asset prima di attivare un aggiornamento. Preparazione fallita: cache precedente conservata; IndexedDB e coda mai eliminate. Limiti 100 clienti/500 prodotti/20 ordini, incluso un ordine più vecchio aperto esplicitamente entro il limite. Prezzo, UM, fattori e versione sono salvati nell'ordine; cambio batch/evidenza conserva la coda e richiede riconciliazione.

## TESTATO — UM, prezzi e dati reali

**5.440/5.440 corrispondenze canoniche, zero divergenze**; derivazione sui 9.847 ARTICOLI, 5.420 non bloccati consultabili. I 20 SKU Enabled nel riferimento ma bloccati nel gestionale restano bloccati. 3.829 mono-UM e 1.611 a due UM nel riferimento. [Audit](amelia3-v5/canonical-audit.json).

La [risposta tecnica successiva dell'utente](../docs/amelia3/V5_UNIT_EVIDENCE.md) aggiorna il preflight NOT_ATTESTED: prezzo 000 per tipo_um, CF/PZ/PE separati, fattori di conteggio, KG senza passo commerciale globale. Fonte fornita dall'utente con riferimenti di codice: **quei sorgenti sull'altro computer non sono stati ispezionati direttamente**. Quattro attestazioni applicate dopo dry-run.

Peso nominale non equivale a peso fisso e non abilita conversioni economiche conteggio/KG. CF/PZ/PE non si sommano; canali confrontabili discordanti bloccano la quota. Solo un canale principale assente può usare un'altra rappresentazione attestata e convertibile: zero/negativo non attivano il ripiego.

| Verifica reale | Esito |
|---|---:|
| Offerte con formula indipendente e parità Ruby/JS | **1.425 PASS** |
| Offerte dirette / convertite | 1.183 / 242 |
| Prodotti con almeno una quota valida | 1.400 / 9.847 |
| Storici agente 34: mappati / almeno una quota valida | 447 / 175 |
| Ultimi 12 mesi agente 34: mappati / quotabili | 65 / 29 |
| Clienti agente 34 / attivi / bloccati | 16 / 12 / 4 |
| Clienti con recapiti interpretabili / candidati | 4 / 8 |

I seguenti conteggi riguardano **opzioni UM**, non SKU: 4.572 bloccate dalla fonte; 5.606 non quotabili, di cui 3.723 per stock assente/non positivo, 1.871 per fattore/divisibilità non attestati, 3 per prezzo non valido/attestato, 5 per stock discordante e 4 per quantità minima non disponibile. Non si dichiarano tutti i 5.420 articoli non bloccati ordinabili.

Ruby Rational/JS BigInt: prezzo a sei decimali, sconto a quattro, HALF_UP una volta sul totale di riga. KG con step libero, limite tecnico 12 decimali; test 0,123456 KG e stock sotto 1 KG, senza multipli imposti di 0,001. [Quote reali](amelia3-v5/real-quotes.json), [parità JavaScript](amelia3-v5/real-quote-js-parity.json). Campioni identificativi solo in imports/private/amelia3/verification-v5/.

## TESTATO — alert, prestazioni e scheduler

Baseline reale **12/10/2026**, regole HFS-AMELIA3-SALES-ALERTS-12M-v1: **373 clienti fermi + 1.896 prodotti mancanti + 50 cali = 2.319 alert**, su 1.148 clienti; **agente 34: zero**. Nessun alert inventato. Conta il blocco articolo, non la quotabilità/giacenza corrente.

| Misura locale | Risultato |
|---|---|
| Primo calcolo completo, inclusi profili | 99,023 s; 1.036.814 righe, 5.029 profili, 4.426 rivalutati |
| Confronto completo successivo | 38,719 s; digest identico, anche evidenze, ordinamento e risoluzioni |
| Ripetizione stessa fonte/data/versione | Idempotente: 0 righe storico e 0 profili rivalutati |
| Servizio lista Admin | 10 risultati, mix 4/4/2, 7 query, 85 ms, zero query storico |
| Snapshot pagina alert Admin | 201.127 byte, 33 query, 490 ms, zero query storico |
| Snapshot pagina alert agente | 150.222 byte, 21 query, 46 ms, zero query storico |
| Picco RSS processo benchmark snapshot | 107.620 KB, incluso avvio Rails |
| Migrazioni da database vuoto isolato | PASS, schema finale identico a db/schema.rb |

Tempi locali, non SLA; snapshot esclusi HTTP/asset browser. Nelle altre viste resta la preparazione abituali preesistente, limitata al portafoglio agente; pagina alert e relativo refresh non interrogano lo storico, verificato con request spec. [Benchmark snapshot](amelia3-v5/snapshot-benchmark.json).

Profili con firma indipendente dall'ordine CSV, sensibile a duplicati/correzioni/cancellazioni. Indice per scansione a blocchi di 5.000; SHA invariato riusato, finestre rivalutate al cambio data, blocchi/permessi correnti applicati. EXPLAIN in [benchmark alert](amelia3-v5/alerts-benchmark.json).

L'import originale dello stesso batch misurava 57,102 s e RSS 107.188 KB: [evidenza v3 preservata](amelia3/local-import.json), **non nuovo benchmark end-to-end v5**. Profili/riepiloghi v5 misurati separatamente; un futuro export diverso permetterà la nuova misura completa senza ripetere la ricognizione CSV.

Worker e heartbeat verificati: prossimi avvii **13/10 alle 06:05 FTP e 06:30 alert, Europe/Rome**. Catch-up del giorno dopo riavvio PASS, baseline development riusata senza duplicati. FTP già riuscito il 12/10 alle 18:10:43; nessun nuovo download FTP v5 dichiarato. Retry/attesa 15 minuti, massimo 8, lease 30 minuti, lock condiviso con import e ultimo risultato valido conservato. DST, batch cambiato e import invariato/fallito coperti dai test. [Scheduler](amelia3-v5/scheduler-status.json).

## TESTATO — suite, browser e controlli

| Controllo | Esito |
|---|---|
| RSpec completo | **163 PASS, 0 FAIL/pending**, seed 45288, 44 s — [JSON](amelia3-v5/rspec-complete.json) |
| Amelia3 JS + service worker | **15 PASS** — [controlli finali](amelia3-v5/final-checks.json) |
| Dominio originale / parità HFS | **49 PASS / 12 PASS** — [controlli locali](amelia3-v5/local-checks.json) |
| Seed / checker | **20 PASS**, 7 test checker PASS; 102 file, 0 violazioni |
| RuboCop | **134 file, 0 violazioni** — [JSON](amelia3-v5/rubocop-final.json) |
| Brakeman | **0 warning di sicurezza** — [JSON](amelia3-v5/brakeman-final.json) |
| Docker/assets/bundle/privacy immagine | **PASS**, nessun dato privato incluso — [JSON](amelia3-v5/final-checks.json) |
| Browser reali, sola lettura | **70 verifiche PASS**, 5 profili × 2 ruoli × 7 viste — [JSON](amelia3-v5/real-browser.json) |
| Nuovi flussi v5, asset definitivi | **15/15 PASS** — [JSON](amelia3-v5/browser-v5-complete.json) |
| Scenari Amelia3 complessivi | Tutti i 60 hanno un esito PASS; prima matrice più ripetizioni mirate, non una nuova singola esecuzione 60/60 |
| PWA condivisa | 28 scenari coperti con esito PASS tra matrice e ripetizioni; recupero finale **2/2 PASS** — [JSON](amelia3-v5/legacy-recovery-complete.json) |

Chromium: 390×844, 768×1024, 1024×768, 1440×900. WebKit: 768×1024. Flussi mutativi sintetici: ordini condivisi, protezioni API, storage negato, account/sessione, coda/conflitti, riapertura offline, cambio batch, multi-UM e centesimi dopo sync. Controllate assenza di overflow e richieste commerciali esterne. Nessun link WhatsApp seguito o messaggio inviato.

Traccia dei FAIL iniziali, conservati nei rispettivi report:

- Prima matrice Amelia3 **56/60 PASS**: un errore Chromium di rete prima del login, due difetti di focus WebKit, un'intercettazione rete non applicata da WebKit attraverso service worker. Caso Chromium ripetuto **1/1 PASS** ([report](amelia3-v5/landscape-business-retest.json)).
- Focus corretto conservando il trigger. Test rete ora disconnette il trasporto lasciando navigator.onLine=true, con identico risultato atteso.
- Ripetizione intermedia **13/15 PASS**: Rails serviva ancora il vecchio manifest. Ricompilazione/riavvio, [asset serviti verificati](amelia3-v5/served-assets.json), poi **15/15 PASS**.
- PWA condivisa iniziale **27/28 PASS**; recupero/upgrade ripetuti **4/4 PASS**. Dopo il manifest definitivo il recupero WebKit ha riprodotto un errore: il test ricaricava prima della conclusione della navigazione asincrona. Aggiunta attesa del messaggio di completamento, preservando tutte le asserzioni sull'archivio. Ripetizione finale **2/2 PASS**, nessun cambio al codice applicativo per questo caso; upgrade definitivo Chromium/WebKit già PASS.

Screenshot pubblicabili soltanto sintetici in qa/amelia3-v5/. Le 40 immagini reali restano nella cartella privata ignorata. Ispezione visiva del drawer mobile, catalogo multi-UM e popup contatti WebKit eseguita, oltre ai controlli browser.

## DA VERIFICARE / NOT_RUN

1. **Peso fisso/effettivo:** peso nominale insufficiente per conversioni conteggio/KG. Servono prove per prodotto; peso di consegna non acquisito.
2. **UM prezzi fissi personali/listini alternativi:** chiusi senza attestazione. Nei 16 clienti del 34 cod_lis non è fornito; un futuro codice diverso da 000 non attiverà fallback silenziosi.
3. **Android/iPhone/iPad fisici:** NOT_RUN. Chromium/WebKit non certificano installazione hardware. Procedura HTTPS in [LOCAL_PWA](../docs/LOCAL_PWA.md); nessuna promessa di sync a browser chiuso.
4. **Evento del 13/10 alle 06:05/06:30:** NOT_RUN. Scheduler/retry/catch-up verificati; PC/Docker/worker devono restare accesi. Primo run development.
5. **CI GitHub v5:** NOT_RUN, nessuna pubblicazione implicita autorizzata. [CI precedente 38289890582](https://github.com/MetyNeib/HorecaFoodService-AppAgenti/actions/runs/38289890582) su c180cdf resta FAILURE per 1/24 UI demo, Amelia3 45/45 PASS. Quel caso demo fu riprodotto PASS in 42 s prima della v5. Nessuna CI precedente attribuita al working tree nuovo.

## Riproduzione ed esercizio

### Diagnosi ordinabilità richiesta dall'utente — 12/10, 23:15

TESTATO: interrogazione del database locale con `SET TRANSACTION READ ONLY`,
sul batch già verificato e sul cliente dello screenshot, includendo le sue
condizioni commerciali. Dettagli privati in
`imports/private/amelia3/verification-v5/orderability-diagnosis.json` (ignorato).
Non è stata ripetuta la ricognizione CSV; nessuna modifica a dati o regole.

- 9.847 prodotti: 4.427 bloccati dalla fonte; 1.400 ordinabili in almeno una UM.
- Prima pagina per nome: 46/50 bloccati dalla fonte, 1 ordinabile, 1 con conversione
  non attestata, 2 con prezzo non valido/attestato. Entrambi gli articoli indicati
  nello screenshot sono bloccati dalla fonte e hanno stock principale zero.
- Escludendo soltanto i bloccati dalla fonte, la prima pagina avrebbe comunque
  solo 5/50 ordinabili: occorre distinguere ordinabilità e stato anagrafico.
- Cause nella UM preferita: 4.427 blocchi fonte, 1.871 fattori non attestati,
  2.153 giacenza autorevole non disponibile, 4 quantità minima insufficiente,
  5 giacenze discordanti, 3 prezzi non validi/attestati, 1.384 offerte valide.
  Altri 16 prodotti sono ordinabili soltanto in una UM alternativa (totale 1.400).
- I 1.871 casi di conversione sono tutti a prezzo KG: ordine COLL 1.400,
  CONF 339, PZ 110, KG 22 (anche l'indivisibilità può richiedere il rapporto
  peso/confezione). Tutti hanno peso nominale positivo; non prova peso fisso.
  1.488 hanno stock principale positivo: sono candidati da approfondire,
  non prodotti automaticamente sbloccabili con una sola attestazione.
- Cliente non bloccato, nessun listino alternativo indicato; 0 prodotti perdono
  quotabilità per le sue condizioni. 1.425 combinazioni prodotto/UM quotabili,
  confermando il precedente conteggio generale anche nel contesto esaminato.

LIMITI IMPLEMENTATIVI: lista alfabetica senza priorità agli ordinabili; badge
generico che non distingue conversione prezzo, stock e indivisibilità; stato
`QUOTE_NEEDS_EVIDENCE` usato anche per assenza stock; percorso nominale/consuntivo
assente. Il precedente PASS delle formule non certifica ordinabilità dell'intero
catalogo, né copertura di tutti i listini cliente.

PROPOSTA, NON IMPLEMENTATA: nella composizione ordine dare priorità agli ordinabili
e rendere selezionabile un filtro esplicito, conservando la consultazione dei
bloccati. Separare UM ordine, UM prezzo e stock CF/PZ/PE con motivi precisi.
Per peso fisso usare solo fattori attestati; per peso variabile introdurre importo
stimato da peso nominale e consuntivo da peso consegnato, previa definizione della
relativa regola operativa. Non sommare CF/PZ/PE, non ignorare indiscriminatamente
zero/discordanze, non trasformare peso nominale in conversione definitiva.

Comandi: npm.cmd run test:amelia3-domain, check:rules, validate:data, test, test:domain-parity, build, build:assets e check:bundle. Nel container web: bundle exec rspec, bundle exec rubocop, bundle exec brakeman --no-pager e bin/rails db:migrate. Docker richiamabile tramite node scripts/docker.mjs. Dopo precompile riavviare web per caricare il nuovo manifest.

Browser: npm.cmd run test:amelia3-prepare, poi npx.cmd playwright test -c playwright.amelia3.config.mjs. Preparazione limitata al tenant amelia3-browser-qa. Usare HFS_AMELIA_REPORT/HFS_AMELIA_OUTPUT per separare i report; PWA condivisa con playwright.rails-pwa.config.mjs.

Runner reali: verify-amelia3-real-quotes.rb, check-amelia3-real-quote-parity.mjs, benchmark-amelia3-alerts.rb, benchmark-amelia3-snapshots.rb e check-amelia3-real-browser.mjs. Aggregati pubblicabili separati da quotazioni, credenziali e immagini private. Git ignore e immagine Docker controllati.

Guida: [AMELIA3_V5_LOCAL](../docs/AMELIA3_V5_LOCAL.md). App: http://127.0.0.1:3002/amelia3. Un clone GitHub ottiene ancora la versione precedente finché non viene autorizzato il salvataggio remoto della v5.
