# Decision log

## Trasferimento Mac e obiettivi demo — 14/10/2026

L'utente sceglie copia completa del database e dei file privati su Mac M1 Pro,
con Docker installato. Mantiene disponibili gli aggiornamenti FTP e rinvia al
branch demo la selezione di un campione congelato. Conferma esplicitamente
repository pubblico per il solo codice revisionato, dopo verifica della visibilità.
Checkpoint V5 e tag sul branch Amelia3; nuovo branch demo dalla stessa base;
nessun merge su main o deploy. Backup PostgreSQL custom per portabilità tra
x86_64 e ARM64, confronto di tutte le righe dopo restore, file privati separati.
Priorità: ordine, ingresso WhatsApp e CRM alert. Revisioni manuali documentate
per prodotti comparabili e cambi di ragione sociale, basate sui dati aggiornati
alla presentazione; nessun algoritmo di associazione automatica richiesto.
Dettagli operativi e ripartenza in docs/MAC_HANDOFF.md.

La verifica CI del trasferimento ha evidenziato una corsa nei test HFS:
lo stato del comando viene aggiornato prima del montaggio dell'HTML e una
conferma deve essere visibile prima di inviare Escape. I test attendono ora
queste condizioni esplicite, senza ritardi fissi, retry automatici o riduzione
delle verifiche. Nessuna modifica funzionale all'app o ai dati del seed.

## UM singola e clienti da riattivare — 13/10/2026

Su richiesta dell'utente, una sola UM ordinabile viene mostrata come testo;
con più UM valide resta il selettore. Le alternative continuano a dipendere
dalle regole canoniche e dai prezzi/stock attestati: nessuna nuova conversione
economica o deroga all'indivisibilità. Identico comportamento online e offline.

Oltre 90 giorni dall'ultimo acquisto consegnato nello storico importato, il
cliente viene classificato `CUSTOMER_REACTIVATION` (etichetta «Da riattivare»)
ed escluso da tutti e tre gli alert ordinari. A 90 giorni esatti resta nella
popolazione ordinaria. Si considerano tutte le date storiche con spedito positivo,
anche oltre i 12 mesi; restano esclusi i giorni correnti/futuri come nel contratto
alert preesistente. Assenza di storico non significa inattività dimostrata.
Bozze e conferme locali, non trasmesse al gestionale, non attestano consegne.

La classificazione ha una sezione distinta negli Alert, con filtri e paginazione
da 10, e badge in elenco/scheda cliente, disponibili anche negli snapshot offline.
Sono inclusi anche i clienti bloccati, conservando il divieto di nuovi ordini;
il portafoglio autorizzato resta applicato. Il mix 4/4/2 degli alert ordinari
rimane separato. Una nuova consegna importata fa cessare la classificazione al
ricalcolo successivo. Nuova versione delle regole per invalidare la cache;
i risultati precedenti restano conservati e le segnalazioni superate risolte.

## Scelta UM e articoli generici — follow-up del 12/10/2026

Su richiesta dell'utente, ogni scheda espone un menu UM con una sola opzione
operativa visibile per volta: prezzo, disponibilità, quantità e Aggiungi seguono
l'unità selezionata. Al cambio unità si riparte dalla quantità minima ammessa,
oppure dal campo vuoto per KG liberi, senza reinterpretare la quantità precedente.
I form conservano separatamente unità, prezzo esatto e versione della conversione.
Il comportamento è identico online e offline, anche senza IndexedDB disponibile.

Sono esclusi dalle liste i segnaposto con denominazioni iniziali come ARTICOLO
VARIO, ARTICOLI VARI, ART. VARIO, PRODOTTO GENERICO, MERCE VARIA e MERCI DIVERSE,
anche preceduti da punteggiatura o prefissi DS/OM. Il confronto per parole evita
di escludere prodotti normali come Caramelle gusti vari o Articolo variante.
Snapshot con indicatore catalogExcluded e controllo del nome nelle vecchie copie
offline. Nessuna eliminazione dal database o variazione delle formule economiche.

## Catalogo demo filtrato — richiesta del 12/10/2026

L'utente richiede di eliminare dal catalogo della demo i prodotti problematici
per le UM. Si applica un'esclusione dalla selezione, senza distruggere import,
storico o riferimenti degli ordini: gli articoli privi di quotazioni valide non
compaiono nelle liste; quelli parzialmente validi espongono solo le UM verificate.
Il filtro usa le condizioni del cliente e precede paginazione e conteggio.
Si escludono anche blocchi fonte, assenza stock e prezzi non attestati, affinché
le schede mostrate siano utilizzabili. Lo stesso criterio vale offline, anche
su record precedentemente memorizzati. Le schede dirette restano consultabili.
La richiesta di una demo funzionante viene soddisfatta tramite questa esclusione:
non si attivano conversioni nominali definitive né un consuntivo a peso effettivo.
Le verifiche commerciali e l'autorizzazione dei comandi restano attive.

## Amelia3 v5 canonica — 12/10/2026

Il pacchetto v5 e la successiva risposta tecnica dell'utente prevalgono sul
checkpoint precedente. Conservati HEAD `223a231`, branch e lavoro precedente;
nessun commit/push/merge/deploy implicito. Il seed HFS resta isolato per regressioni.

Le evidenze economiche sono versionate separatamente dai CSV. La fonte tecnica
fornita dall'utente abilita prezzo 000 per tipo_um, stock originali CF/PZ/PE e
fattori di conteggio; i file dell'altro repository non sono stati ispezionati qui.
Peso nominale, prezzi fissi personali e listini alternativi non diventano prove
per analogia. I KG accettano decimali senza passo commerciale globale; dodici
decimali sono il limite tecnico del protocollo. Ruby Rational e JS BigInt
arrotondano HALF_UP una sola volta per riga. Gli ordini confermati restano immutati.

Storico raggruppato per cliente/riferimento con riepiloghi derivati e dettaglio
originale; niente importi ricostruiti. Alert pubblicati atomicamente dopo il job,
mai ricalcolati nella richiesta della lista. Profili e firme indipendenti dalla
posizione nel CSV consentono riuso; data e blocchi correnti governano le finestre.
Le 06:30 dipendono dall'import riuscito delle 06:05; il primo calcolo locale è
etichettato development. Full e incrementale confrontano anche alert risolti.

La PWA installa entrambe le shell neutrali con tutte le loro risorse prima di
attivare un aggiornamento. Non elimina IndexedDB o code pendenti. WebKit richiede
che il trigger dei dialoghi sia conservato esplicitamente per restituire il focus.
Report corrente: `qa/AMELIA3_V5_REPORT.md`; prove reali identificative solo private.

## Checkpoint richiesto dall'utente — 12/10/2026

Dopo i test Amelia3 e le verifiche sui CSV reali, interrompere il lavoro.
Non correggere ulteriormente la demo: l'utente ne richiede l'eliminazione nel
prossimo turno. La rimozione non è eseguita nel checkpoint; la CI resta
complessivamente FAILURE per un test della UI demo, mentre i 45 casi Amelia3
passano. Conservare dati privati e integrazione commerciale nel lavoro seguente;
le fixture sintetiche isolate servono ancora ai test dell'integrazione reale.

## Amelia3 — dati condivisi, fonte commerciale e offline — 12/10/2026

Il pacchetto operativo approvato in `docs/amelia3/` sostituisce per questo tenant
i vincoli del bootstrap sintetico. Rails promosso su main mediante PR #1 e CI
sullo SHA esatto; implementazione sul branch feature/amelia3-ftp-import, senza
deploy pubblico. Seed originale e account sintetici restano separati.

Tabelle commerciali per batch immutabile e un solo puntatore attivo per tenant.
Import streaming PG COPY; nove checksum, staging, relazioni e pubblicazione
atomica. Fingerprint comprende la versione del mapping; una correzione del
mapping richiede un nuovo batch. Ordini normalizzati separati dalle importazioni,
prezzi salvati per riga, revisioni per ordine e ricevute idempotenti per utente.
Non cancellare automaticamente batch/ordini o copie private dell'utente.

Listino 000 e sconto percentuale valido; precisione attestata, HALF_UP una volta
per riga. Solo P/P con stock pz intero è attualmente ordinabile; altre UM restano
consultabili con blocco motivato, senza conversioni supposte. Quantità cf/pz/pe
rimangono distinte, costi e margini assenti. Destinazioni con flag punto consegna
S, non bloccate e nello scope dell'account; cod_int non concede permessi.

Admin e agente 34 hanno ordini condivisi per cliente, creatore separato
dall'agente commerciale. Capoarea resta negato. Namespace IndexedDB include
utente/tenant/ruolo/codice agente e hash del portafoglio; autorizzazione della
copia scade dopo 24 ore. Cache limitata a 100 clienti/500 prodotti/20 ordini
recenti più contesto; storico/finanze interrogati online. Coda e copia prezzo
pendenti conservate in caso di import o conflitto, con recupero esplicito.

Scheduler locale Sidekiq, controllo ogni 20s delle 06:05 Europe/Rome, DST,
unicità giornaliera, lock PostgreSQL e cinque retry. Avvio tardivo recupera
soltanto la giornata corrente. Credenziali FTP solo nel worker; protocollo
in chiaro autorizzato, nessuna mutazione remota. Conferme ordini soltanto locali.
LAN HTTPS via Caddy/CA esistente, niente router/tunnel o modifiche globali al trust.

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


## 14/10/2026 — Perfezionamento demo Mac approvato

Confermate regole UM correnti e soglia clienti fermi oltre 90 giorni. Bloccati
hanno priorità; clienti senza storico consegnato sono Fermi con badge esplicito.
Nel picker ordine una lista dei soli non bloccati, inclusi fermi segnalati.
Cambio UM in carrello: equivalenza esatta e verificata oppure nuova quantità;
nessun arrotondamento implicito, stessa riga, nuovo prezzo attestato e Salva riga.
Storico con un solo canale quantità: evitare di dedurre conversioni storiche
usando l'anagrafica attuale. Connessione visibile nel menu e nella barra inferiore
quando serve attenzione. Alert con soglie invariate e spiegazione naturale:
il ritardo numerico è oltre la soglia di attesa, non oltre la sola cadenza mediana.

### 2026-10-14 — Selettore account per la demo
Confermati solo Admin e Agente 34 reali, permessi effettivi dell’account
selezionato, scritture attribuite all’account con tracciabilità dell’Admin,
pagina conservata se autorizzata, blocco su lavoro pendente e uso solo online.
Funzione locale opt-in: login Admin sempre richiesto, ritorno senza password,
identità visibile. Ultima selezione conservata nella stessa sessione; nuovo
login riparte dall’Admin. Nessun cambiamento alle funzioni di invio simulate.


## 15/10/2026 — Ingresso FTP, prodotti abituali e sostituzioni

Le decisioni successive dell’utente superano il placeholder WhatsApp e la sola
revisione statica manuale previsti al trasferimento. Sono autorizzati polling
FTP in lettura ogni tre minuti, catalogo supplementare dinamico, prodotti
abituali degli ultimi sei mesi, confronto locale con fallback OpenAI e audit.
Gli ordini inizialmente presenti sono archivio; solo nuovi arrivi aumentano
la notifica. Apertura e presa in carico non equivalgono a conferma. Timer di
30 minuti dalla ricezione; alla scadenza resta necessaria la conferma manuale,
senza alcun invio automatico. Originale immutabile e copia demo separata,
condivisione Admin/Agente 34, permessi e conflitti espliciti. Nessun prezzo o
fattore UM ricostruito dal file ordine; rimangono valide le attestazioni V5.

La ricerca parte dai prodotti abituali e offre il tab Intero catalogo. Il set
è riconciliato con acquisti consegnati positivi negli ultimi sei mesi. Per
sopprimere un alert prodotto serve almeno un acquisto storico positivo del
sostitutivo successivo all’ultimo acquisto dell’originale e recente rispetto
alla soglia dell’alert. Gli ordini WhatsApp/tablet non sono prova di consegna.
Marca, provenienza, pezzatura, conservazione e taglio possono essere diversi;
varianti zero/senza zucchero, senza lattosio, senza glutine, senza alcol o
caffeina restano distinte. In dubbio plausibile si preferisce sopprimere.
Un errore tecnico resta invece in verifica: niente equivalenza inventata.

Fuzzy e regex locali precedono l’AI, invocata solo in assenza di risultati.
Modello richiesto esplicitamente dall’utente: `gpt-6-luna`, Responses API,
ragionamento low, JSON vincolato, `store: false`. Batch di massimo 12 confronti,
cache per modello/regola/candidati, limite locale di 300 richieste al giorno.
Si trasmettono descrizioni prodotto e identificatori temporanei, non clienti,
prezzi, credenziali FTP o storico commerciale. Chiave e configurazione in
`.env.openai.local`, escluso da Git. La configurazione `.env` esistente è
conservata. Il worker dedicato gestisce anche import 06:05 e alert 06:30;
quello precedente rimane fermo per evitare due scheduler.
