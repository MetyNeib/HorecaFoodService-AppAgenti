import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';

// Importmap resolves every source module through Propshaft; no bundler or runtime CDN.
const output = 'vendor/javascript';
mkdirSync(`${output}/ralix`, { recursive: true });
const files = ['index.js', ...readdirSync('node_modules/ralix/src').filter(name => name.endsWith('.js')).map(name => `src/${name}`)];
for (const file of files) {
  const source = readFileSync(`node_modules/ralix/${file}`, 'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g, (_match, _quote, specifier) => {
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)).replace(/\.js$/, '');
    return `from 'ralix/${resolved}'`;
  });
  const destination = `${output}/ralix/${file.replace('src/', '')}`;
  writeFileSync(destination, source);
}
copyFileSync('node_modules/dompurify/dist/purify.es.mjs', `${output}/dompurify.js`);
copyFileSync('node_modules/ralix/LICENSE', `${output}/ralix/LICENSE`);
copyFileSync('node_modules/dompurify/LICENSE', `${output}/DOMPURIFY-LICENSE`);
console.log('Ralix e DOMPurify vendorizzati dalle versioni del lockfile.');
