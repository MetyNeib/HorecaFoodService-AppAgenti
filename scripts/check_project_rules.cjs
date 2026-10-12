// Small dependency-free checks. These detect specific patterns, not all violations.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function inspect(file, source) {
  const issues = [];
  const report = (index, rule) => issues.push({
    file,
    line: source.slice(0, index).split('\n').length,
    rule
  });
  // Keep offsets intact while ignoring comments. This is intentionally not a parser.
  let clean = source.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '));

  if (file.endsWith('.css')) {
    clean = clean.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|url\([^)]*\)/g,
      match => match.replace(/[^\n]/g, ' '));
    let offset = 0;
    for (const line of clean.split('\n')) {
      const declarations = line.match(/(?:^|[;{])\s*(?:--[\w-]+|[a-zA-Z][\w-]*)\s*:/g) || [];
      if (declarations.length > 1) report(offset, 'CSS: una proprietà per riga');
      offset += line.length + 1;
    }
  }

  if (file.endsWith('.erb')) {
    clean = clean.replace(/<%#[\s\S]*?%>|<!--[\s\S]*?-->/g, match => match.replace(/[^\n]/g, ' '));
    // Ruby variables such as `online =` are not HTML event attributes.
    // Preserve offsets and inspect the surrounding markup after removing ERB code.
    clean = clean.replace(/<%[\s\S]*?%>/g, match => match.replace(/[^\n]/g, ' '));
    for (const match of clean.matchAll(/\s(?:style|on[a-z]+)\s*=/gi)) {
      report(match.index, 'View: attributo CSS/JS inline vietato');
    }
    for (const match of clean.matchAll(/<style\b/gi)) report(match.index, 'View: blocco CSS inline vietato');
    for (const match of clean.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      const attributes = match[1];
      const dataOnly = /\btype\s*=\s*["'](?:application\/(?:ld\+)?json|importmap)["']/i.test(attributes);
      if (!dataOnly && match[2].trim()) report(match.index, 'View: codice JS inline vietato');
    }
  }

  if (file.endsWith('.js')) {
    // Literal HTML tags are not needed in application JS: templates belong in ERB.
    // Line comments are ignored; string-built markup on other lines is reported.
    let offset = 0;
    for (const line of clean.split('\n')) {
      if (!line.trimStart().startsWith('//') && /<\/?[a-z][a-z0-9-]*(?:\s[^>]*|\s*\/?)>/i.test(line)) {
        report(offset, 'JS: markup HTML da spostare in template server');
      }
      offset += line.length + 1;
    }
  }
  return issues;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root, encoding: 'utf8'
  }).split('\0').filter(Boolean))];
  const selected = files.filter(file => /^app\/(?:assets\/stylesheets\/.*\.css|javascript\/.*\.js|views\/.*\.erb)$/.test(file));
  const issues = selected.filter(file => fs.existsSync(path.join(root, file)))
    .flatMap(file => inspect(file, fs.readFileSync(path.join(root, file), 'utf8')));
  for (const issue of issues) process.stdout.write(`${issue.file}:${issue.line}: ${issue.rule}\n`);
  process.stdout.write(`${selected.length} file esaminati; ${issues.length} violazioni rilevate.\n`);
  process.exitCode = issues.length ? 1 : 0;
}

module.exports = { inspect };
if (require.main === module) main();
