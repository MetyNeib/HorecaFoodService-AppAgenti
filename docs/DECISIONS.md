# Decision log

## Header/footer dopo un secondo e densità delle liste — 11/10/2026

La nuova decisione supera la sola chiusura del footer allo scroll. Entrambi i dock si presentano aperti all'ingresso in una vista e dopo reset, poi si richiudono dopo 1000 ms. La riapertura manuale rimane aperta fino al successivo scroll verticale del contenuto centrale o di una lista, in entrambe le direzioni. L'header chiuso lascia soltanto l'icona account in alto a destra; la riapertura mostra wordmark/Home e i dati dell'agente esistenti, senza aggiungere una funzione account. Il footer chiuso lascia soltanto il proprio tasto. I pulsanti sono da 44px e le barre ridotte non coprono il contenuto.

Un'interazione esplicita con i controlli (puntatore o tastiera) interrompe il timer, così l'utente può completarli. Il semplice ripristino del focus dopo il reset non interrompe il nuovo timer. Route e tab applicativi riavviano la presentazione; filtri e query di ricerca non la riavviano. Il timer e i listener vengono puliti al cambio vista e in StrictMode. Ridimensionamento, riapertura e animazione non generano chiusure spurie; focus, inert, aria-expanded e reduced motion restano attivi.

Per le sottoliste il solo vincolo numerico rigido è poter contenere almeno due schede complete quando esistono almeno due risultati. 2,5–6 è un obiettivo di ottimizzazione, non un tetto. Non si duplicano righe quando i risultati sono meno di due. Le schede conservano tutti i dati e controlli: titolo 18px, testo operativo 16px, metadati 14px e touch target 44px. Spazi e controlli vengono ricomposti tramite CSS e container query; manuale e WhatsApp usano gli stessi componenti.

Il minimo della regione viene misurato sulle coppie effettive di righe (anche tabellari), includendo wrapping e controlli. Si ricalcola dopo filtri, errori, resize e variazioni di contenuto. Le liste corte non aggiungono altezza vuota nella modalità scorrevole. Se due righe leggibili non entrano nel layout fisso, si estende la regione e si ammette lo scroll centrale come concordato: su finestre estreme più basse della regione stessa occorre muovere l'area centrale per esplorarla, senza rimpicciolire ulteriormente i controlli.

## Footer inizialmente aperto, chiusura allo scroll — 11/10/2026 (regola precedente)

La nuova richiesta inverte la precedente apertura automatica. Il footer parte aperto in ogni vista, anche compatta, e dopo reset. Al primo avanzamento dello scorrimento centrale si richiude con la stessa animazione, lasciando soltanto il tasto di apertura: anche lo stato rete è dentro il pannello richiudibile. Risalire o ridimensionare la finestra non lo riapre; la riapertura è manuale, disponibile anche da tastiera. Lo scroll delle liste interne non modifica il dock quando l'area centrale non scorre. Le variazioni di scroll causate dall'animazione del dock sono ignorate; `overflow-anchor: none` sull'area centrale impedisce spostamenti automatici durante il cambio d'altezza anche con reduced motion, così la riapertura rimane stabile a fondo pagina. I controlli chiusi restano inert e il focus torna al pulsante quando necessario.

## Layout elastico approvato — 11/10/2026

La richiesta successiva supera il divieto assoluto di scorrimento verticale su desktop/tablet. La priorità è rendere ogni funzione leggibile e raggiungibile: proporzioni normali, compattazione moderata, poi scorrimento dell'area centrale. Nessuna riduzione globale tramite transform/zoom. I testi principali rimangono almeno 16px; pulsanti principali almeno 44px; liste con spazio operativo minimo anziché regioni ridotte a pochi pixel.

La scelta usa le dimensioni effettive del DOM e si ripete per resize, variazioni dei contenuti, font e visualViewport. Il rapporto 19,5:9 resta un criterio di disposizione, non una barriera allo scorrimento di sicurezza. Clienti/Catalogo/Statistiche restano tre card separate, affiancate solo nella modalità compatta da 1100px; su tablet stretto Statistiche conserva la propria riga.

La regola iniziale del footer (stato rete visibile anche da chiuso, riapertura allo scroll) è stata sostituita dalla decisione successiva riportata sopra. Rimangono l'animazione in posto, che ridimensiona il contenuto senza coprirlo, i controlli chiusi inert, la gestione del focus e prefers-reduced-motion. Le liste interne mantengono scorrimento autonomo; i form si espandono quando lo spazio operativo è insufficiente.

## Rebrand e presentazione Centro Cash — 25/09/2026

La richiesta esplicita successiva dell'utente sostituisce il brand HFS nelle superfici visibili della demo e nella presentazione. Il seed storico `HFS-AGENT-DEMO-20260922-V1` e i codici ordine rimangono invariati; le etichette dei depositi vengono adattate solo in visualizzazione. Il wordmark viene dall'asset ufficiale CentroCash corrispondente al logo fornito dall'utente; il sottotitolo “ALIMENTARI ALL’INGROSSO” è composto come testo. I sette capitoli seguono la scaletta allegata e usano screenshot nuovi della build locale. L'esempio WhatsApp e gli invii restano simulati.

## Ripristino demo HFS — 11/10/2026

Su richiesta dell'utente, il runtime dell'app è tornato alla versione HFS neutra. La presentazione Centro Cash rimane un artefatto autonomo di proposta e non rappresenta una seconda variante avviabile della demo.

## Etichetta di confidenza WhatsApp — 23/09/2026

`confidencePercent` nelle viste ordine WhatsApp indica la confidenza dell'associazione prodotto. L'etichetta visibile è “Confidenza”; il calcolo e il seed restano invariati. Se il valore manca, l'interfaccia mostra “—” senza percentuale.

## Preview condivisa tramite ngrok — 23/09/2026

La preview Vite accetta esclusivamente `ngrok-free.dev` e i suoi sottodomini, per permettere URL temporanei ngrok senza abilitare qualunque host. Il server di sviluppo non viene esposto da questa configurazione.

## Refitting richiesto il 23/09/2026

- Desktop e tablet, anche 768×1024, usano tutta la finestra con shell fissa. Rimossa la larghezza massima 1240px. Scorrimento confinato a regioni con nome accessibile e focus da tastiera.
- Mobile verticale dal rapporto nominale 19,5:9: larghezza massima 650px e aspect-ratio massimo 0,465. La tolleranza copre gli arrotondamenti CSS (390×844); il rapporto è misurato sull'area del browser, così il layout si ricalcola al ridimensionamento.
- Totali e azioni ordine esterni alle liste. I form lunghi mantengono uno scorrimento interno di sicurezza per altezze ridotte e ingrandimento del browser.
- Maggior contrasto dei titoli/testi/bordi mantenendo fondo caldo, superfici bianche e blu del progetto. Nessuna modifica ai dati o al reducer.
- Referenti modificabili nel dialog condiviso, con tutti i campi e azioni mantenuti.
- Gli screenshot del refitting mostrano anche le scrollbar native: disabilitato il solo flag Playwright che normalmente le nasconde in modalità headless.

## Fissato dall'utente
Brand Horeca Food Service; logo semplice autorizzato; catalogo misto realistico ma sintetico; geografia Marche–Emilia-Romagna; nomi generici italiani. Tablet-first adaptive stessi elementi, struttura PDF conservata, stateful/localStorage, offline simulato. No prospects/configurazione alert/invii reali.

## Decisioni implementative del kit
- React/TypeScript/Vite, componenti custom, Context/reducer, HashRouter proposto.
- Minimo kit Node22.12, preferenza Node24LTS; nessun lockfile inventato perché registry non raggiungibile nel container.
- Font Inter locale/system fallback, nessun font binario incluso.
- Estrazioni FIG locali sostituiscono la necessità di accesso remoto editor; non certificano ogni pixel dell'altra app.
- Pubblicare in futuro solo dist, mai cartella references.
- Consegna corrente è un implementation kit per Codex, non l'app finita.

## Percorso Windows da chiarire con l'utente
La stringa digitata `C:77` è ambigua e non viene usata come percorso drive-relative. Guida propone `C:\HorecaFoodService-AppAgenti`; lo script richiede un ProjectRoot assoluto esplicito. Alternativa possibile `C:\77\HorecaFoodService-AppAgenti`. È solo una scelta del setup, non una dipendenza del codice.

## Decisioni successive
Codex registra qui dettagli tecnici ulteriori, distinguendoli dai requisiti dell'utente. Non introdurre nuove funzioni o correzioni semantiche del seed senza segnalarlo.

## Implementazione locale 22/09/2026
- Root verificata C:\HorecaFoodService-AppAgenti; il dubbio storico C:77 è superato dall'istruzione esplicita dell'utente.
- Riutilizzati node_modules e package-lock del baseline: nessun aggiornamento dipendenze.
- Rete simulata con timer 800 ms cancellato a offline/reset; coda unica per ordini, contatti e condivisioni.
- Quantità/prezzi salvati nell'ordine canonico; editor riga e referente mantengono una copia locale fino a Salva.
- Condizioni sovrapposte: sostituzione esplicita con conferma prima di salvare; non si modifica lo storico.
- Visual prodotto vettoriale generico sintetico (scatola HFS e codice), senza foto/font esterni. Inter solo se installato nel sistema.
- PDF resta una composizione HTML in dialog; tutti i canali registrano esclusivamente job locali simulati.
- Analisi e azioni sono sezioni consecutive della stessa vista, come consentito dalla specifica.
- Chromium nella cache .playwright-browsers del progetto, esclusa da git e dist, per rispettare i permessi della workspace.
- Collaudo: React Router usa `useTransitions={false}` per i cambi pagina locali, evitando che input rapidi vengano applicati alla vista precedente durante la transizione. I filtri hanno inoltre valore locale immediato e ritorno contestuale serializzato.
- Il seed originale conserva anche `branding.visualSystem`, una nota di provenienza per lo sviluppo. Questo solo campo è escluso dalla proiezione runtime e dal bundle: contiene il nome della fonte Figma che il controllo privacy vieta. Tutti gli altri campi vengono copiati esattamente e un test verifica questa equivalenza; il JSON canonico e il relativo SHA-256 sono invariati.
- Bundle separato in codice applicativo, librerie e dati demo, senza aggiungere dipendenze o indebolire `check:bundle`.
