# HFS — Rapporto di estrazione delle fonti
Data: 22 settembre 2026. Scopo: preparazione dati, prima dello Step 3.
Le cifre seguenti derivano dalla lettura programmatica dei file allegati. Le immagini sono state lette visivamente, senza OCR.

## Inventario effettivamente estratto
| File | Contenuto estratto | Utilizzo |
|---|---:|---|
| Anagra_art (2) (1).xls | 1 foglio; 1.851 righe articolo, esclusa intestazione; 73 colonne | Codici alfanumerici, descrizioni, UM, conversioni, confezioni, altri campi originali |
| Catalogo_itarca_1.xlsx | 1 foglio; 2.340 righe articolo, esclusa intestazione; 16 colonne | Codici, nomi, descrizioni organolettiche, categorie, formato, UM, confezioni |
| ARTICOLI.csv | 9.536 righe articolo, escluse intestazioni | Codici anche con zeri iniziali, confezioni, peso, classificazioni e flag |
| FIDO.csv | 4.827 righe e codici cliente distinti | Struttura di plafond e residuo, non importi trasferiti ai clienti demo |
| INSOLUTO.csv | 2.921 righe rata, 634 conti distinti, 2.119 coppie conto/partita distinte | Distinzione documento/rata/scadenza |
| TABGIR.csv | 19.549 righe, 6.164 codici cliente distinti, 42 codici giro | Relazioni cliente-giro-giorno |
| Analisi ordini WA commentata.xlsx | 13 fogli, 13 immagini, 130 righe tabellari riferite a 23 numeri ordine e 13 codici cliente | Esempi reali di linguaggio e confronto con note e prelievi |

I tre cataloghi contengono complessivamente 13.727 righe prodotto: **non** è un conteggio di articoli unici tra fornitori.
All'interno di ciascun catalogo i codici estratti risultano unici.
ARTICOLI contiene 5.228 righe con flag_bloccato=N e 4.308 con flag_bloccato=S; i valori originali sono preservati.

## Come è stata eseguita l'estrazione
CSV letti mantenendo i codici come stringhe, la separazione a punto e virgola e la precisione grezza dei campi.
Per ARTICOLI è stata usata la decodifica Windows-1252; gli altri CSV sono compatibili con ASCII/UTF-8.
Gli XLSX sono stati letti a livello XML, inclusi shared strings, celle, formule memorizzate e relazioni dei disegni.
Le 13 immagini sono state estratte da xl/media e associate a foglio e posizione di ancoraggio.
Il file XLS binario è stato letto mediante parser CFB/BIFF8: SST/CONTINUE, LABELSST, RK, MULRK, NUMBER e BOOLERR.
SST decodificata: 5.568 stringhe distinte. Il foglio contiene 1.852 righe non vuote inclusa intestazione.
Gli originali non sono stati modificati; nomi, dimensioni e SHA-256 sono in audit_private/source_manifest.json.

## Verifica visiva degli screenshot WhatsApp
Sono state lette tutte le 13 immagini e salvate 13 trascrizioni con riferimento a foglio, immagine, commenti e righe tabellari.
11 immagini contengono messaggi testuali WhatsApp; 2 sono fotografie di note manoscritte.
La trascrizione di image10.png / Sheet (4) mantiene esplicitamente le parole non leggibili con certezza.
Non è stata completata usando i prodotti della tabella.
In image8.png / Sheet (6) il testo principale è leggibile, ma il commento del foglio segnala “CI HANNO DATO UN ALTRO ORDINE”:
perciò non è un confronto affidabile riga-per-riga.
Le altre immagini possono contenere refusi o ambiguità semantiche anche quando il testo è leggibile.

## Osservazioni reali che influenzano la demo
1. Il cliente usa cart, ct, ca, pacchi, barattoli, pezzi, litri e kg, talvolta senza spazi.
2. “Solito”, “come l'ultima volta” e marche abbreviate richiedono contesto cliente, non una ricerca letterale soltanto.
3. Sigle come U/10 o 26/30 fanno parte della descrizione/calibro e non devono diventare quantità ordinate.
4. “Cotolette” può riferirsi a carne o pesce. La nota di Sheet (9) evidenzia questa ambiguità; non giustifica una regola globale.
5. In Sheet (12) è annotata una correzione della farina generica verso quella antigrumi.
6. Lo stesso screenshot può contenere richieste di informazioni sul prezzo, un ordine e un messaggio integrativo.
7. La quantità prelevata a peso può differire dalla quantità richiesta in pezzi. Non va presentata come conversione esatta.
8. Esistono righe non inserite, aggiunte successive e clienti non trovati; le note del revisore sono osservazioni, non verifiche indipendenti.
9. Alcuni messaggi omettono completamente quantità o unità. La demo non deve inventarle silenziosamente.
10. Il nome del distributore nel saluto non è un articolo da ricercare.

## Limiti delle fonti
Gli allegati non includono una tabella anagrafica completa clienti con ragioni sociali, P.IVA, indirizzi e recapiti.
FIDO e TABGIR contengono cod_cli; INSOLUTO utilizza cod_conto, senza tabella di corrispondenza esplicita.
Non è stato effettuato un join per somiglianza o per suffisso.
FIDO non dimostra che il fido usato coincida con la somma di INSOLUTO.
INSOLUTO non separa importo originario della fattura e importo già incassato: questi concetti sono stati creati nella demo, non estratti.
La convenzione di giorno_sett non è documentata: i valori grezzi restano tali. La demo usa esplicitamente ISO 1=lunedì…7=domenica.
In ARTICOLI i codici K/P/L/C non sono espansi indiscriminatamente: L ricorre anche per imballaggi e non può essere interpretato sempre come litro.
I prezzi, costi, stock, limiti di credito e pagamenti della demo sono tutti sintetici.
Nessuna analisi di affidabilità creditizia di clienti reali è stata eseguita.

## Separazione tra fonti e demo
audit_private contiene estrazioni reali, immagini, trascrizioni, note e collegamenti di provenienza dei prodotti.
demo contiene solo nuovi articoli/codici, nuovi clienti/identificativi, contatti non instradabili e scenari riscritti.
Nessun screenshot reale, URL staging, numero reale di telefono o codice cliente originale è previsto nella demo.
La mappa dei 120 articoli sintetici alle rispettive righe sorgente è conservata esclusivamente nell'archivio riservato.

## Risultato sintetico
120 articoli, 10 categorie, 12 clienti (8 nel portafoglio iniziale di Marco Rossi), 24 referenti, 4 agenti,
2 depositi, 4 giri, 4 listini e 480 prezzi listino-articolo, 240 giacenze articolo-deposito, 6 condizioni commerciali.
30 ordini canonici: 24 inviati, 2 bozze, 1 da inviare, 3 in verifica WhatsApp.
14 scenari sintetici: 13 ispirati alle immagini e 1 basato sul caso latte/spezzatino della call; 3 sono nell'inbox iniziale.
18 documenti, 19 rate e 5 incassi sintetici; 3 segnalazioni e 2 analisi.
Validazione automatica del seed: 86 PASS, 0 FAIL. Questa verifica non è un test dell'applicazione HTML.
