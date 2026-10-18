const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const AI = require('../ai.js');
function arena(stage = 1) {
  const s = E.create({ stage, seed: 101, phase: 'playing' });
  s.tiles = s.tiles.map(t => t === 2 ? 0 : t); s.hidden = {};
  return s;
}
function at(a, x, y) { Object.assign(a, { x, y, prevX: x, prevY: y, nextMove: 0 }); }

test('stage penalties progressively reduce resting and increase actual item pickups', () => {
  const pickups = [], actions = [];
  for (let stage = 1; stage <= E.STAGES.length; stage++) {
    let collected = 0, active = 0;
    for (let seed = 0; seed < 100; seed++) {
      // Identical geometry and actors isolate the stage penalty from enemy count.
      const s = arena(); s.stage = stage; s.seed = seed;
      const a = s.actors[1]; s.items[E.index(s, a.x, a.y)] = 'shield';
      E.step(s); collected += a.collected;
    }
    const s = arena(); s.stage = stage; const a = s.actors[1];
    for (let tick = 0; tick < 300; tick++) {
      s.time = tick / 60;
      if (AI.input(s, a).dir) active++;
    }
    pickups.push(collected); actions.push(active);
  }
  assert.equal(pickups[0], 10); assert.equal(pickups.at(-1), 100);
  for (let i=1;i<pickups.length;i++) assert.ok(pickups[i]>pickups[i-1]);
  for (let i = 1; i < actions.length; i++) assert.ok(actions[i] > actions[i - 1], JSON.stringify(actions));
});

test('early CPU leaves ignored items intact and the player can collect them', () => {
  const s = arena(), cpu = s.actors[1], p = s.actors[0];
  while (E.wantsItem(s, cpu, E.index(s, cpu.x, cpu.y))) s.seed++;
  const i = E.index(s, cpu.x, cpu.y); s.items[i] = 'superfire';
  E.step(s); assert.equal(cpu.range, 2); assert.equal(s.items[i], 'superfire');
  at(p, cpu.x, cpu.y); E.step(s); assert.equal(p.range, 4); assert.equal(s.items[i], undefined);
});

test('resting CPU still escapes a bomb and the announced shrinking border', () => {
  for (const kind of ['bomb', 'storm']) {
    const s = arena(), a = s.actors[1]; at(a, 1, 1); at(s.actors[0], 7, 5);
    s.time = kind === 'bomb' ? 2 : 117;
    if (kind === 'bomb') E.place(s, a);
    for (let tick = 0; tick < 181 && s.phase === 'playing'; tick++) E.step(s, {}, 1 / 60, AI.input);
    assert.ok(a.alive, kind); assert.ok(a.x !== 1 || a.y !== 1, kind);
    if (kind === 'storm') assert.ok(E.stormDue(s, a.x, a.y) > s.time);
  }
});

test('border warns eight seconds ahead, pauses, affects both sides and leaves a center', () => {
  const s = arena(); s.time = 111.99; assert.equal(E.storm(s).warning, false);
  s.time = 112; assert.equal(E.storm(s).warning, true);
  E.pause(s); E.step(s, {}, 10); assert.equal(s.time, 112); E.resume(s);
  const p = s.actors[0], cpu = s.actors[1]; at(cpu, 7, 5); p.shield = 1; p.protectedUntil = 200;
  s.time = 120 - 1/60; E.step(s);
  assert.equal(E.storm(s).ring, 1);
  assert.equal(s.phase, 'defeat'); assert.equal(p.death.cause, 'storm'); assert.equal(cpu.kills, 0);
  assert.equal(E.stormDue(s, 5, 5), Infinity);
  for (const stage of [1,5]) {
    const w = arena(stage); w.time = 180;
    assert.ok(w.tiles.some((t, i) => !t && E.stormDue(w, i % w.width, Math.floor(i / w.width)) === Infinity));
  }
});

test('player kills are attributed once; suicide is separate; chains keep original ownership', () => {
  const s = arena(3), p = s.actors[0]; at(p, 3, 3); E.place(s, p); at(p, 1, 5);
  at(s.actors[1], 4, 3); at(s.actors[2], 3, 4);
  s.time = 2 - 1/60; E.step(s);
  assert.equal(p.kills, 2); assert.equal(s.events.filter(e => e.type === 'death' && e.killerId === 0).length, 2);
  E.step(s); assert.equal(p.kills, 2);
  const own = arena(); E.place(own, own.actors[0]); own.time = 2 - 1/60; E.step(own);
  assert.equal(own.actors[0].death.cause, 'self'); assert.equal(own.actors[0].kills, 0);
  const chain = arena(2), a = chain.actors;
  at(a[0], 1, 3); E.place(chain, a[0]); at(a[0], 1, 5);
  at(a[1], 3, 3); E.place(chain, a[1]); chain.bombs[1].due = 3; at(a[1], 7, 5);
  at(a[2], 5, 3); chain.time = 2 - 1/60; E.step(chain);
  assert.equal(a[2].death.killerId, 1); assert.equal(a[1].kills, 1); assert.equal(a[0].kills, 0);
});

test('shield blocks kill credit and overlapping explosions never double-count a victim', () => {
  const s = arena(2), p = s.actors[0], cpu = s.actors[1]; at(cpu, 3, 3); cpu.shield = 1;
  s.flames.push({ cells: new Set([E.index(s, 3, 3)]), owner: 0, until: 2 });
  s.flames.push({ cells: new Set([E.index(s, 3, 3)]), owner: 2, until: 2 });
  E.step(s); assert.equal(p.kills, 0); assert.ok(cpu.alive);
  s.time = 1; E.step(s); assert.equal(p.kills, 1); assert.equal(s.actors[2].kills, 0);
});

test('start rewards are bounded and only apply to the player after stage one', () => {
  assert.equal(E.create({ stage: 1, bonus: 'shield' }).actors[0].shield, 0);
  for (const bonus of ['shield', 'bomb']) {
    const s = E.create({ stage: 2, bonus });
    assert.equal(s.actors[0].shield, bonus === 'shield' ? 1 : 0);
    assert.equal(s.actors[0].capacity, bonus === 'bomb' ? 2 : 1);
    assert.ok(s.actors.slice(1).every(a => a.shield === 0 && a.capacity === 1));
  }
});
