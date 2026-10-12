import { Link } from 'react-router-dom';
import { useApp } from '../../app/Store';
import { homeCounts } from '../../domain/core';
import { Icon, Badge } from '../../design-system/ui';
export function Home() {
    const { state: { data: d } } = useApp();
    const n = homeCounts(d, d.demoDefaults.currentAgentId, d.demoDefaults.activeCustomerIds);
    return <div className="view home-view">
    <div className="page-title home-title">
    <div>
    <p className="eyebrow">MARTEDÌ 22 SETTEMBRE 2026</p>
    <h1>Home</h1>
    </div>
    <span>La tua giornata, a portata di mano.</span>
    </div>
    <div className="grid two home-heroes">
    <section className="card hero-card">
    <div className="row">
    <Icon name="new-order"/>
    <div>
    <h2>Nuovo ordine</h2>
    <p>Seleziona il cliente e componi l’ordine.</p>
    </div>
    </div>
    <Link className="button primary wide" to="/orders/new/customer">Inserisci nuovo ordine <span>→</span>
    </Link>
    </section>
    <section className="card hero-card">
    <div className="row">
    <Icon name="chat"/>
    <div>
    <h2>Ordini WhatsApp</h2>
    <p>Controlla, modifica e conferma.</p>
    </div>
    <Badge tone="warning">{n.whatsapp} da verificare</Badge>
    </div>
    <Link className="button primary wide" to="/fastorder">Verifica ordini <span>→</span>
    </Link>
    </section>
    </div>
    <h2 className="section-heading">
    <Icon name="order"/> I miei ordini</h2>
    <div className="grid three order-metrics">{[['drafts', 'Bozze', n.drafts, 'Da completare'], ['pending', 'Da inviare', n.pending, 'Confermati, in attesa di rete'], ['sent', 'Inviati', n.sent, 'Trasmissione simulata riuscita']].map(([tab, label, count, desc]) => <Link className="card navigation-card" to={`/orders?tab=${tab}`} key={tab}>
        <div>
        <h3>{label} <Badge tone={tab === 'pending' ? 'warning' : tab === 'sent' ? 'success' : ''}>{count}</Badge>
        </h3>
        <p>{desc}</p>
        </div>
        <span className="arrow">→</span>
        </Link>)}</div>
    <div className="grid two home-links">{[['customers', 'Clienti', 'Anagrafiche, ordini e partite aperte', 'users'], ['catalog', 'Catalogo', 'Prodotti e disponibilità', 'box']].map(([path, title, desc, icon]) => <Link className="card navigation-card" to={`/${path}`} key={path}>
        <Icon name={icon}/>
        <div>
        <h2>{title}</h2>
        <p>{desc}</p>
        </div>
        <span className="arrow">→</span>
        </Link>)}
    <Link className="card navigation-card insight-entry" to="/insights">
    <Icon name="chart"/>
    <div>
    <h2>Statistiche e segnalazioni</h2>
    <p>{d.insights.filter(i => i.status === 'TO_REVIEW').length} segnalazioni da valutare · Abitudini d’acquisto e riordini</p>
    </div>
    <Badge>Evolutiva</Badge>
    <span className="arrow">→</span>
    </Link>
    </div>
    </div>;
}
