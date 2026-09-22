import { useState } from 'react';
import seed from '../data/hfs_demo_data.json';
import { normalizeSearch, homeCounts } from '../domain/core';

/** Bootstrap esplicito, NON la Home finale. Codex implementa le 22 viste documentate. */
export function App() {
  const [query, setQuery] = useState('');
  const counts = homeCounts(seed, seed.demoDefaults.currentAgentId, seed.demoDefaults.activeCustomerIds);
  const found = seed.products.filter(p => normalizeSearch(`${p.name} ${p.code}`).includes(normalizeSearch(query)));
  return <div className="bootstrap">
    <header className="app-header">
      <div className="wordmark"><b>HFS</b><span>Horeca Food Service<small>App agenti · ambiente di sviluppo</small></span></div>
      <span className="badge">SETUP / BOOTSTRAP</span>
    </header>
    <main className="main-content">
      <p className="eyebrow">STEP 3 / IMPLEMENTAZIONE LOCALE</p>
      <h1>La base del progetto è pronta.</h1>
      <p className="lead">Dataset approvato, token del design system e contratti sono caricati. Questa è la schermata di avvio tecnico: i flussi dell'app devono ancora essere realizzati con il prompt Codex incluso.</p>
      <section className="card" aria-labelledby="next-step">
        <h2 id="next-step">Prossimo passo: Codex</h2>
        <p>Apri <code>docs/CODEX_START_PROMPT.md</code> e incolla il contenuto nella chat Codex di questa cartella. Inizia da <code>AGENTS.md</code> e <code>docs/00_START_HERE.md</code>.</p>
      </section>
      <section className="metrics" aria-label="Stato iniziale previsto della demo">
        {[[seed.products.length,'Articoli'],[counts.drafts,'Bozze'],[counts.pending,'Da inviare'],[counts.sent,'Inviati'],[counts.whatsapp,'Verifiche WhatsApp']].map(([n,label]) => <div className="card metric" key={label}><strong>{n}</strong><span>{label}</span></div>)}
      </section>
      <section className="card" aria-labelledby="data-check">
        <h2 id="data-check">Controllo di lettura del catalogo</h2>
        <label htmlFor="seed-search">Cerca per nome o codice nel seed</label>
        <input id="seed-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Per esempio: lager, latte, 0107417"/>
        <p role="status">{found.length} risultati · primi 8 mostrati in questa diagnostica</p>
        <div className="seed-list">{found.slice(0,8).map(p=><div className="seed-row" key={p.id}><span>{p.name}</span><code>{p.code}</code></div>)}</div>
      </section>
      <footer className="notice">Dati sintetici · Nessuna trasmissione reale · Seed {seed.meta.datasetId}</footer>
    </main>
  </div>;
}
