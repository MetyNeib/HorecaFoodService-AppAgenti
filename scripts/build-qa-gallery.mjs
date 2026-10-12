import fs from 'node:fs';
const refit = process.argv.includes('--refit');
const directory = new URL(refit ? '../qa/refit/screenshots/' : '../qa/screenshots/', import.meta.url);
const files = fs.readdirSync(directory).filter(name => name.endsWith('.png')).sort();
const groups = [
  ['phone', 'Telefono · 390 × 844'],
  ['tablet-portrait', 'Tablet verticale · 768 × 1024'],
  ['tablet-landscape', 'Tablet orizzontale · 1024 × 768'],
  ['desktop', 'Desktop · 1440 × 900'],
  ['preview', 'Build di produzione · quattro viewport'],
  ...(refit ? [['wide-desktop', 'Desktop ampio · 1920 × 872'], ['laptop', 'Notebook · 1366 × 768'], ['compact-tablet', 'Tablet compatto · 600 × 960'], ['tall-phone', 'Telefono verticale · 412 × 915']] : []),
];
const sections = groups.map(([prefix, title]) => `<section><h2>${title}</h2><div class="grid">${files.filter(name => name.startsWith(prefix + '-')).map(name => `<a href="${name}"><img loading="lazy" src="${name}" alt="${name.replace('.png', '').replaceAll('-', ' ')}"><span>${name}</span></a>`).join('')}</div></section>`).join('');
fs.writeFileSync(new URL('index.html', directory), `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HFS — screenshot QA</title><style>body{font:16px system-ui;margin:32px;background:#f7f4ef;color:#303641}h1{margin-bottom:8px}section{margin-block:40px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}a{display:flex;flex-direction:column;background:white;border:1px solid #ddd;border-radius:10px;overflow:hidden;color:#234ae5;text-decoration:none}a:focus-visible{outline:3px solid #315eff}img{width:100%;height:260px;object-fit:contain;object-position:top;background:#eee}span{padding:12px;overflow-wrap:anywhere}</style><h1>Horeca Food Service — screenshot QA</h1><p>${files.length} immagini · ${refit ? '22 viste × 8 viewport, dalla build di produzione.' : '22 viste × 4 viewport e 4 schermate della build.'} Seleziona una miniatura per aprire l'immagine completa.</p>${sections}</html>`);
console.log(`PASS: galleria con ${files.length} screenshot.`);
