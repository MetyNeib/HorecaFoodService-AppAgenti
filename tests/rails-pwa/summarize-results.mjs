import { readFileSync, writeFileSync } from 'node:fs';

// Pass reports in execution order; later observations supersede earlier ones per test.
const paths = process.argv.slice(2);
if (!paths.length) throw new Error('Passa uno o più report JSON Playwright in ordine di esecuzione.');
const cases = new Map(), sources = [];
function visit(suite, source) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      const key = `${spec.file}:${test.projectName}:${spec.title}`;
      const record = cases.get(key) || { file: spec.file, title: spec.title, project: test.projectName, history: [] };
      const result = test.results.at(-1);
      record.history.push({ source, status: result.status, durationMs: result.duration,
        errors: (result.errors || []).map(error => error.message?.replace(/\u001b\[[0-9;]*m/g, '').slice(0, 1500)) });
      record.status = result.status; record.source = source;
      cases.set(key, record);
    }
  }
  for (const child of suite.suites || []) visit(child, source);
}
for (const path of paths) {
  const report = JSON.parse(readFileSync(path, 'utf8'));
  sources.push({ path, startedAt: report.stats.startTime, stats: report.stats });
  for (const suite of report.suites) visit(suite, path);
}
const results = [...cases.values()];
const counts = { unique: results.length, passed: results.filter(test => test.status === 'passed').length,
  failed: results.filter(test => !['passed', 'skipped'].includes(test.status)).length, skipped: results.filter(test => test.status === 'skipped').length };
const summary = { generatedAt: new Date().toISOString(), counts, sources, harnessCorrections: [
  { title: 'viste offline essenziali', reason: 'La matrice produce venti screenshot per motore. Il budget di 60 secondi è stato portato a 120; le verifiche di geometria e raggiungibilità sono invariate.' },
  { title: 'archivio negato', reason: 'La verifica attende il commit della navigazione HTML allo stesso URL prima del fetch di controllo, evitando la cancellazione della richiesta durante unload.' },
  { title: 'offline reale', reason: 'Dopo Conferma il test attende la transazione IndexedDB tramite expect.poll. Status PENDING_SEND, nota e pagamento attesi sono rimasti identici.' }
], cases: results };
writeFileSync('qa/rails/pwa-validation-summary.json', JSON.stringify(summary, null, 2) + '\n');
process.stdout.write(JSON.stringify(counts) + '\n');
if (counts.failed || counts.skipped) process.exitCode = 1;
