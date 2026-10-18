'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path');
const root = path.join(__dirname, '..');
test('every local HTML asset exists and game loads without external dependencies', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(/(?:src|href)=["']https?:/.test(html), false);
  for (const [, file] of html.matchAll(/(?:src|href)="\.\/([^"?#]+)/g)) assert.ok(fs.existsSync(path.join(root, file)), file);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]); assert.equal(new Set(ids).size, ids.length);
});
test('all directly referenced UI elements exist', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'); const js = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  for (const [, id] of js.matchAll(/\$\('([^']+)'\)/g)) assert.ok(html.includes(`id="${id}"`), id);
});
