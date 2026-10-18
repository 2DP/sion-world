'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine, judgment, grade } = require('../engine.js');
const note = (time, lane = 0) => ({ time, lane });
test('judgment includes exact positive and negative boundaries', () => {
  for (const sign of [-1, 1]) for (const [ms, expected] of [[0, 'Perfect'], [50, 'Perfect'], [50.001, 'Great'], [100, 'Great'], [100.001, 'Good'], [140, 'Good'], [140.001, null]]) assert.equal(judgment(ms * sign), expected);
});
test('early and empty inputs do not consume notes, and a note cannot score twice', () => {
  const e = new Engine([note(1000)]);
  assert.equal(e.hit(0, 859), null); assert.equal(e.hit(1, 1000), null);
  assert.equal(e.hit(0, 1000).result, 'Perfect'); assert.equal(e.hit(0, 1000), null);
  e.update(2000); assert.equal(e.score, 1000000); assert.equal(e.counts.Miss, 0);
});
test('misses are processed once and corrected time controls both hits and expiration', () => {
  for (const offset of [-250, 0, 250]) {
    const e = new Engine([note(1000)], offset);
    e.update(1000 + offset + 140); assert.equal(e.processed, 0);
    assert.equal(e.hit(0, 1000 + offset + 140).result, 'Good');
    const m = new Engine([note(1000)], offset);
    m.update(1000 + offset + 141); m.update(10000);
    assert.equal(m.counts.Miss, 1); assert.equal(m.hit(0, 10000), null);
  }
});
test('chord combo is independent of lane order including partial misses', () => {
  for (const order of [[0, 2], [2, 0]]) {
    const e = new Engine([note(1000, 0), note(1000, 2), note(2000, 0), note(2000, 2)]);
    order.forEach(lane => e.hit(lane, 1000)); assert.equal(e.combo, 2);
    e.hit(order[0], 2000); e.update(2141); assert.equal(e.combo, 0); assert.equal(e.maxCombo, 2);
    assert.equal(e.score, 750000);
  }
});
test('overlapping hit windows finalize combos in chart order', () => {
  const e = new Engine([note(1000, 0), note(1200, 2)]);
  e.hit(2, 1060); assert.equal(e.combo, 0);
  e.update(1141); assert.equal(e.combo, 1); assert.equal(e.maxCombo, 1);
});
test('specification score example, all-perfect and all-miss results', () => {
  const notes = Array.from({ length: 100 }, (_, i) => note(i * 500));
  const example = new Engine(notes);
  for (let i = 0; i < 95; i++) example.hit(0, i * 500 + (i < 80 ? 0 : i < 90 ? 75 : 120));
  example.update(60000); const r = example.result(); assert.equal(r.score, 905000); assert.equal(r.accuracy, 90.5); assert.equal(r.grade, 'A'); assert.equal(r.fullCombo, false);
  const perfect = new Engine(notes); notes.forEach(n => perfect.hit(n.lane, n.time)); assert.equal(perfect.result().score, 1000000); assert.equal(perfect.result().allPerfect, true);
  const misses = new Engine(notes); misses.update(60000); assert.equal(misses.result().score, 0); assert.equal(misses.result().counts.Miss, 100);
});
test('grade boundaries use unrounded accuracy', () => {
  for (const [n, g] of [[97, 'S'], [96.999, 'A'], [90, 'A'], [89.999, 'B'], [80, 'B'], [65, 'C'], [64.999, 'D']]) assert.equal(grade(n), g);
});
test('repeated fractional judgments retain exact grade thresholds', () => {
  const e = new Engine(Array.from({ length: 100 }, (_, i) => note(i * 500)));
  for (let i = 0; i < 100; i++) e.hit(0, i * 500 + (i < 50 ? 0 : 75));
  assert.equal(e.result().accuracy, 90); assert.equal(e.result().grade, 'A');
});
test('different frame rates produce identical results from the same timed inputs', () => {
  const notes = Array.from({ length: 60 }, (_, i) => note(1000 + i * 350, i % 4));
  const input = notes.filter((_, i) => i % 6 !== 0).map((n, i) => ({ ...n, when: n.time + [0, -50, 75, -120][i % 4], kind: 'hit' }));
  const results = [30, 60, 144].map(fps => {
    const e = new Engine(notes); const events = [...input];
    for (let frame = 0; frame < 24 * fps; frame++) events.push({ when: frame * 1000 / fps, kind: 'frame' });
    events.sort((a, b) => a.when - b.when);
    for (const event of events) { if (event.kind === 'hit') e.hit(event.lane, event.when); else e.update(event.when); }
    return e.result();
  });
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]); assert.equal(results[0].counts.Miss, 10);
});
