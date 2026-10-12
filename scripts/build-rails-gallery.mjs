import { readdirSync, writeFileSync } from 'node:fs';

const directory = 'qa/rails-ui/screenshots';
const screens = readdirSync(directory).filter(file => /^(phone|tablet-portrait|tablet-landscape|desktop)-.+\.png$/.test(file)).sort();
const groups = [
  ['phone', 'Telefono · 390 × 844'],
  ['tablet-portrait', 'Tablet verticale · 768 × 1024'],
  ['tablet-landscape', 'Tablet orizzontale · 1024 × 768'],
  ['desktop', 'Desktop · 1440 × 900'],
];
const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HFS Rails — verifica visuale</title><style>
body{margin:24px;font:16px system-ui;background:#f7f4ef;color:#31343f}
h1,h2{margin-bottom:8px}a{color:#244bd8}section{margin-top:36px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
figure{margin:0;padding:12px;background:white;border:1px solid #d0d6e4;border-radius:12px}
img{display:block;width:100%;height:260px;object-fit:contain;background:#fafafa}
figcaption{margin-top:8px;overflow-wrap:anywhere}
</style></head><body><h1>HFS Rails — verifica visuale</h1>
<p>${screens.length} schermate acquisite in browser. Dati sintetici. La galleria accompagna il
<a href="../../RAILS_IMPLEMENTATION_REPORT.md">report di collaudo</a>; le immagini da sole non certificano i flussi.</p>
${groups.map(([prefix, label]) => `<section><h2>${label}</h2><div class="grid">${screens.filter(file => file.startsWith(prefix + '-')).map(file => `<figure><a href="${file}"><img loading="lazy" src="${file}" alt="${file.slice(prefix.length + 1, -4)}"></a><figcaption>${file.slice(prefix.length + 1, -4)}</figcaption></figure>`).join('\n')}</div></section>`).join('\n')}
</body></html>`;
writeFileSync(`${directory}/index.html`, html);
console.log(`Galleria Rails: ${screens.length} screenshot.`);
