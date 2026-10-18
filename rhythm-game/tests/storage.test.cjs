'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const { Store } = require('../storage.js');
function memory(raw = null) { return { getItem: () => raw, setItem: (_, value) => { raw = value; } }; }
test('settings and independent records persist without downgrading achievements', () => {
  const storage = memory(); const store = new Store(storage);
  store.data.settings.offset = 35;
  store.record('stroll-easy', { score: 900000, accuracy: 90, maxCombo: 45, fullCombo: true, allPerfect: false });
  store.record('stroll-easy', { score: 800000, accuracy: 80, maxCombo: 50, fullCombo: false, allPerfect: false });
  const again = new Store(storage); assert.equal(again.data.settings.offset, 35);
  assert.deepEqual(again.data.records['stroll-easy'], { score: 900000, accuracy: 90, maxCombo: 50, fullCombo: true, allPerfect: false });
  assert.equal(again.data.records['stroll-normal'], undefined);
});
test('corrupt and unavailable storage keep the game usable in memory', () => {
  for (const storage of [memory('{bad'), null, { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }]) {
    const store = new Store(storage); assert.equal(store.data.settings.music, 70);
    store.record('jump-easy', { score: 100, accuracy: 1, maxCombo: 1, fullCombo: false, allPerfect: false }); assert.equal(store.data.records['jump-easy'].score, 100);
  }
});
test('loaded values are validated and unknown keys ignored', () => {
  const store = new Store(memory(JSON.stringify({ version: 1, settings: { music: 999, speed: 0, offset: -900, reduced: 'false' }, records: { 'stroll-easy': { score: '9000', maxCombo: null }, arbitrary: { score: 1 } } })), true);
  assert.equal(store.data.settings.music, 100); assert.equal(store.data.settings.speed, 1.8); assert.equal(store.data.settings.offset, -250); assert.equal(store.data.settings.reduced, true);
  assert.equal(store.data.records['stroll-easy'].score, 0); assert.equal(store.data.records.arbitrary, undefined);
});
