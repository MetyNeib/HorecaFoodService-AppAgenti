# Design system — estratto verificato, non layout dell'altra app

## Provenienza
I due file FIG allegati sono archivi con lo stesso `canvas.fig` (SHA-256 `b4434ed2b1910dcfee7ebe496fb70d34b1ebb1ba6f4bb14f0770f8ac1c62ac7f`) e thumbnail/meta differenti.
Il canvas è stato decodificato localmente: 12.122 nodi. Pagine: `0:1 Design system`, `0:2 Internal Only Canvas`, `1:5825 Mockup`. Sono stati estratti 133 stili e 560 SYMBOL. È un inventario dei valori memorizzati, non un export di codice React né una renderizzazione completa di tutte le varianti/istanze.
L'accesso remoto Figma get_design_context è stato tentato e negato per mancanza di permesso editor. Non bloccare l'implementazione sul connettore; usare gli allegati locali e questi estratti.

## Non confondere i Primary
Nel file sono presenti stili legacy con nomi duplicati: verde #002E2C, viola #4338CA e altri. La famiglia selezionata per questa demo è Brand/Electric blue `1:12 #2E60FF`, non il primo stile chiamato Primary trovato nel JSON.
Colori selezionati con ID sono in `hfs_tokens_verified.json`; `src/design-system/tokens.css` li rende disponibili. Background #F7F4EF, card bianche, titolo #31343F, testo #454A59, coral #EB5930 come accento. Successo/attenzione/errore sono semantici: non colorare un margine solo per decorazione.

## Tipografia
Inter è presente negli stili. H1 1:81 32px Bold, H2 1:94 28px Bold, H3 1:95 20px Bold; altezza riga 1.3. CTA 1:13 16px Semi Bold, body 1:96 16px Medium /1.5, label/placeholder 1:58 14px Medium /1.4, small 1:60 12px /1.3, micro 1:61 10px /1.6.
Non impacchettare font binari dal computer di lavoro. Il CSS usa Inter solo se già presente localmente e altrimenti system-ui/Segoe UI. La fedeltà tipografica pixel-perfect con Inter non è certificata sul PC di destinazione; mantenere spaziatura e gerarchia con fallback. 10px solo per informazioni realmente accessorie, non per campi operativi.

## Componenti di riferimento
| Famiglia | Node ID / riferimento | Regola per implementazione |
|---|---|---|
| Button large | 1:929, 138x52, radius8, padding32/14 | Primaria su azione principale; dimensione minima touch |
| Button medium | 1:949, 111x44, radius8, padding24/13 | Default operativo; larghezza può adattarsi al testo |
| Button small | 1:969, 88x32, radius6, padding16/8 | Info secondarie; hit area touch almeno44 se necessario |
| Shadow | stile1:3 | 0 1px 3px nero10% + 0 1px 2px nero6% |
| Switch/checkbox/radio | 1:428 / 1:448 / 1:496 | Stato selezionato, disabilitato, focus; mai solo colore |
| Dropdown/input | 1:1128 / 1:1241 | Label sempre leggibile, errore inline, bordi coerenti |
| Segmented | 1:1732 | Modalità prezzo e gruppi; mantenere semantica accessibile |
| Snackbar | 1:1779 | Feedback breve, aria-live, nessuna conferma fittizia invio reale |
| Modal/dialog | 1:1864 / 1:1889 | Focus trap, Escape, titolo; chiusura e ritorno focus |
| Bottom sheet | 1:2276 | Usarlo solo se coerente per TUTTI i device, non al posto di una pagina soltanto mobile |
| Liste/tab/calendario | 1:1545 / 1:2136 / 1:2076 | Gerarchie, stati e densità, non navigazione dell'altra app |

I nodi elenco sono contenitori di famiglie e possono includere più varianti. Per dettagli consultare `figma_components_extracted.json` (560 record) e gli stili, senza assumere che ogni record rappresenti un componente target necessario.

## Scelte aggiunte al DS per questa implementazione
Spacing 4/8/12/16/24/32, raggio card12, max-width1240, durata150/220ms sono decisioni di progetto dichiarate, non token nominati estratti dal FIG. Preservare prefer-reduced-motion e focus visibile. Le microanimazioni non devono cambiare i dati o rallentare l'agente.

## Fedeltà e review
Apparire come un'app operativa pulita, non una landing page. Niente gradienti decorativi o grafiche estranee. In ogni revisione confrontare la struttura con il PNG del PDF, e colori/componenti con questo DS. Non prendere la schermata dell'altra app Figma come “Home” del prodotto HFS.
