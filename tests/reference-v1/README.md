# Riferimento del dominio V1

Questi due moduli TypeScript conservano i calcoli e il modello puro della V1 per
eseguire i 49 test di compatibilità in `tests/core/domain.test.mjs`. Non importano
React e non fanno parte del runtime, degli asset Rails o della shell offline.

La versione completa dell'interfaccia V1 è conservata nel branch `v1-react` e nel
tag `v1.0.0-react`. Nel branch Rails il codice applicativo autorevole si trova in
`app/services/hfs/`; la proiezione offline usa `app/javascript/hfs/`.

Il seed rimane esclusivamente in `src/data/hfs_demo_data.json`, senza modifiche.
L'import del modello è stato aggiornato soltanto per il nuovo percorso.

Verifiche dalla root:

```powershell
npm.cmd test
npm.cmd run test:domain-parity
```

La seconda verifica confronta il JavaScript offline con i risultati prodotti dal
dominio Ruby. La prima conserva la regressione storica senza reintrodurre una
seconda applicazione React nel progetto Rails.
