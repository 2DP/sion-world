import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {buildBundle} from '../build.mjs';

const root = new URL('../', import.meta.url);
test('committed bundle matches source modules', async () => {
  const saved = (await readFile(new URL('game.bundle.js', root), 'utf8')).replace(/\r\n/g, '\n');
  assert.equal(saved, await buildBundle());
});

test('file entry uses a classic relative script and renders without module loading', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)src="([^"]+)"([^>]*)>/g)];
  assert.equal(scripts.length, 1);
  assert.doesNotMatch(scripts[0][0], /type\s*=\s*["']module["']/);
  const entry = new URL(scripts[0][2], new URL('index.html', root));
  assert.equal(entry.protocol, 'file:');
  assert.equal(entry.href, new URL('game.bundle.js', root).href);
  const app = {innerHTML: ''};
  const context = {
    document: {querySelector: () => app, addEventListener() {}},
    window: {addEventListener() {}},
    localStorage: {getItem: () => null},
  };
  vm.runInNewContext(await readFile(entry, 'utf8'), context);
  assert.match(app.innerHTML, /오늘도,/);
  assert.match(app.innerHTML, /data-action="new"/);
  assert.match(app.innerHTML, /이어서 하기/);
});
