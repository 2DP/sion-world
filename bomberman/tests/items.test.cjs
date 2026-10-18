const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const AI = require('../ai.js');
function world() { const s = E.create({ seed: 12, phase: 'playing' }); s.tiles = s.tiles.map(t => t === 2 ? 0 : t); s.hidden = {}; return s; }
function get(s, a, type) { s.items[E.index(s, a.x, a.y)] = type; E.step(s); }
function ticks(s, n) { for (let i = 0; i < n; i++) E.step(s); }
function flame(s, a, duration = .4) { s.flames.push({ cells: new Set([E.index(s, a.x, a.y)]), until: s.time + duration }); }

test('all five item types appear in generated maps with symmetric drops', () => {
  const found = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    const s = E.create({ stage: 5, seed });
    for (const [i, type] of Object.entries(s.hidden)) { found.add(type); assert.equal(s.hidden[s.tiles.length - 1 - Number(i)], type); }
  }
  assert.deepEqual([...found].sort(), Object.keys(E.ITEMS).sort());
});
test('range and super fire increase by one and two, cap at six, and do not change planted bombs', () => {
  const s = world(), a = s.actors[0]; E.place(s, a); get(s, a, 'fire'); assert.equal(a.range, 3);
  get(s, a, 'superfire'); assert.equal(a.range, 5); get(s, a, 'superfire'); assert.equal(a.range, 6);
  get(s, a, 'fire'); assert.equal(a.range, 6); assert.equal(s.events.find(e => e.type === 'item').upgraded, false);
  assert.equal(s.bombs[0].range, 2);
  a.x = 5; a.y = 5; a.capacity = 2; E.place(s, a); assert.equal(s.bombs[1].range, 6);
  const cells = E.blast(s, s.bombs[1]); assert.ok(cells.includes(E.index(s, 11, 5)));
});
test('shield blocks own bomb and overlapping flames once, allowing movement after impact', () => {
  const s = world(), a = s.actors[0]; get(s, a, 'shield'); E.place(s, a);
  ticks(s, 119); E.step(s, { 0: { dir: 'right' } });
  assert.equal(a.alive, true); assert.equal(a.shield, 0); assert.equal(a.x, 2);
  assert.equal(s.events.filter(e => e.type === 'shield').length, 1); assert.equal(s.phase, 'playing');
  flame(s, a, .4); ticks(s, 24); assert.equal(a.alive, true);
});
test('a second hit after grace ends defeats the actor; staying in fire is not permanent immunity', () => {
  const s = world(), a = s.actors[0]; get(s, a, 'shield'); flame(s, a, 3);
  E.step(s); const end = a.protectedUntil; ticks(s, 47); assert.equal(a.alive, true);
  E.step(s); assert.ok(s.time + 1e-8 >= end); assert.equal(s.actors[0].alive, false);
});
test('shield cannot stack, and pause preserves its post-hit grace', () => {
  const s = world(), a = s.actors[0]; get(s, a, 'shield'); get(s, a, 'shield');
  assert.equal(a.shield, 1); assert.equal(s.events.find(e => e.type === 'item').upgraded, false);
  flame(s, a); E.step(s); const remaining = a.protectedUntil - s.time;
  E.pause(s); ticks(s, 600); assert.equal(a.protectedUntil - s.time, remaining);
  E.resume(s); ticks(s, 24); assert.equal(a.alive, true); assert.equal(a.shield, 0);
});
test('CPU gains the same range and shield effects; stage creation resets both', () => {
  const s = world(), cpu = s.actors[1]; s.stage = E.STAGES.length; get(s, cpu, 'superfire'); assert.equal(cpu.range, 4);
  get(s, cpu, 'shield'); flame(s, cpu); E.step(s); assert.equal(cpu.alive, true); assert.equal(cpu.shield, 0);
  const fresh = E.create({ stage: 2 }); assert.ok(fresh.actors.every(a => a.range === 2 && a.shield === 0 && a.protectedUntil === 0));
});
test('shield collection cannot rescue an already fatal same-frame hit', () => {
  const s = world(), a = s.actors[0]; flame(s, a); get(s, a, 'shield'); assert.equal(s.actors[0].alive, false); assert.equal(a.shield, 0);
});
test('AI seeks visible shield and super fire and keeps checking escapes with extended range', () => {
  for (const type of ['shield', 'superfire']) {
    const s = world(), a = s.actors[1]; s.stage = E.STAGES.length; s.items[E.index(s, a.x - 1, a.y)] = type;
    const action = AI.input(s, a); assert.equal(action.dir, 'left');
    E.step(s, { 1: action }); assert.equal(a.collected, 1);
  }
  const s = world(), a = s.actors[1]; a.range = 6;
  for (const [dx, dy] of Object.values(E.DIRS)) s.tiles[E.index(s, a.x + dx, a.y + dy)] = 2;
  a.shield = 1; assert.notEqual(AI.input(s, a).bomb, true);
});
test('reacquired shield during grace is saved, not consumed by the same remaining flame', () => {
  const s = world(), a = s.actors[0]; get(s, a, 'shield'); flame(s, a); E.step(s);
  a.x = 3; a.y = 3; get(s, a, 'shield'); assert.equal(a.shield, 1);
  flame(s, a, .2); ticks(s, 12); assert.equal(a.shield, 1); assert.equal(a.alive, true);
});
