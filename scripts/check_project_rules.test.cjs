const test = require('node:test');
const assert = require('node:assert/strict');
const { inspect } = require('./check_project_rules.cjs');

test('rejects compressed CSS and preserves line numbers', () => {
  const issues = inspect('app/assets/stylesheets/test.css', '\n.x { color: red; margin: 0; }');
  assert.equal(issues.length, 1);
  assert.equal(issues[0].line, 2);
});

test('accepts multiline CSS, comments and semicolons in values', () => {
  const source = '/* .x { color:red; margin:0; } */\n.x {\n  color: red;\n  content: "a;b:c";\n  background: url(data:image/png;base64,abc);\n}';
  assert.deepEqual(inspect('app/assets/stylesheets/test.css', source), []);
});

test('rejects inline attributes and executable script blocks', () => {
  const source = '<div style="color:red" onclick="go()"></div>\n<style>.x{}</style>\n<script type="module">go()</script>';
  assert.equal(inspect('app/views/test.html.erb', source).length, 4);
});

test('accepts data scripts, external script tags and comments', () => {
  const source = '<%# <div style="color:red"> %>\n<script type="application/json">{}</script>\n<script type="application/ld+json">{}</script>\n<script type="importmap">{}</script>\n<script src="/application.js"></script>';
  assert.deepEqual(inspect('app/views/test.html.erb', source), []);
});

test('rejects HTML strings, including chart tooltip markup', () => {
  assert.equal(inspect('app/javascript/test.js', 'const tip = `<strong>${value}</strong><br>`;').length, 1);
});

test('accepts DOM operations and ignores comment examples', () => {
  assert.deepEqual(inspect('app/javascript/test.js', '// Never use "<div>"\nnode.textContent = value;\n/* <span>example</span> */'), []);
});

test('ERB Ruby variables are not event attributes; dynamic inline attributes remain forbidden', () => {
  const source = '<% online = true %>\n<button onclick="<%= handler %>" style="<%= css %>">OK</button>';
  const issues = inspect('app/views/test.html.erb', source);
  assert.equal(issues.length, 2);
  assert.ok(issues.every(issue => issue.line === 2));
});
