# Decision log

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
