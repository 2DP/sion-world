const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const AI = require('../ai.js');

function arena(stage = 1) {
  const s = E.create({ seed: 123, stage, phase: 'playing' });
  s.tiles = s.tiles.map(t => t === 2 ? 0 : t); s.hidden = {}; return s;
}
function tick(s, seconds, inputs = {}, controller) { for (let i = 0; i < Math.round(seconds * 60); i++) E.step(s, inputs, 1 / 60, controller); }
function put(s, x, y, due = 2, range = 2, owner = 0) {
  const b = { id: s.nextBombId++, x, y, at: 0, due, range, owner, grace: new Set() }; s.bombs.push(b); return b;
}
function at(a, x, y) { a.x = a.prevX = x; a.y = a.prevY = y; }

test('five stages increase CPU count 1→5 and expand the late-stage maps', () => {
  for (let stage = 1; stage <= 5; stage++) {
    const s = E.create({ stage, seed: 5 });
    assert.equal(s.actors.length, stage + 1); assert.equal(s.enemies, stage);
    assert.equal(new Set(s.actors.map(a => E.key(a.x, a.y))).size, stage + 1);
    assert.equal(s.width, stage < 4 ? 13 : 17);
  }
});
test('100 generated maps have symmetric blocks/items, legal spawns, escape routes and connected destructible terrain', () => {
  for (let stage = 1; stage <= 5; stage++) for (let seed = 0; seed < 20; seed++) {
    const s = E.create({ stage, seed });
    s.tiles.forEach((t, i) => { assert.equal(t, s.tiles[s.tiles.length - 1 - i]); assert.equal(s.hidden[i], s.hidden[s.tiles.length - 1 - i]); });
    for (const a of s.actors) {
      assert.equal(E.tile(s, a.x, a.y), 0);
      assert.ok(AI.escape(s, a, AI.forecast(s, { id: -1, x: a.x, y: a.y, range: 2, due: 2 })).safe, `stage ${stage}, seed ${seed}, actor ${a.id}`);
    }
    const visited = new Set(), queue = [{ x: 1, y: 1 }];
    for (const p of queue) for (const [dx, dy] of Object.values(E.DIRS)) {
      const x = p.x + dx, y = p.y + dy, i = E.index(s, x, y);
      if (E.tile(s, x, y) !== 1 && !visited.has(i)) { visited.add(i); queue.push({ x, y }); }
    }
    for (const a of s.actors) assert.ok(visited.has(E.index(s, a.x, a.y)));
  }
});
test('a seed reproduces the same board and hidden items', () => {
  const a = E.create({ stage: 4, seed: 42 }), b = E.create({ stage: 4, seed: 42 });
  assert.deepEqual(a.tiles, b.tiles); assert.deepEqual(a.hidden, b.hidden);
});
test('countdown and pause do not consume the match timer or bomb fuse', () => {
  const s = arena(); s.phase = 'countdown'; E.place(s, s.actors[0]);
  tick(s, 1); assert.equal(s.countdown.toFixed(1), '2.0'); assert.equal(s.time, 0);
  E.pause(s); const before = JSON.stringify(s); tick(s, 10); assert.equal(JSON.stringify(s), before.replace(/"events":\[[\s\S]*?\],"nextBombId"/, '"events":[],"nextBombId"'));
  E.resume(s); tick(s, 2); assert.equal(s.phase, 'playing'); assert.equal(s.time, 0);
});
test('movement obeys walls, speed and legal directions', () => {
  const s = arena(), a = s.actors[0];
  assert.equal(E.move(s, a, 'diagonal'), false); assert.equal(E.move(s, a, 'left'), false);
  s.time = .25; assert.equal(E.move(s, a, 'right'), true); assert.equal(a.x, 2);
  assert.equal(E.move(s, a, 'right'), false); s.time = .5; assert.equal(E.move(s, a, 'down'), false);
});
test('planted bomb can be exited but not re-entered; capacity is enforced', () => {
  const s = arena(), a = s.actors[0]; assert.ok(E.place(s, a)); assert.equal(E.place(s, a), false);
  assert.ok(E.move(s, a, 'right')); s.time = .25; assert.equal(E.move(s, a, 'left'), false);
  assert.equal(E.place(s, a), false); assert.equal(s.bombs.length, 1);
});
test('base blast has nine cells and no diagonal cells in an open cross', () => {
  const s = arena(); const cells = E.blast(s, { x: 5, y: 5, range: 2 });
  assert.equal(cells.length, 9); assert.ok(!cells.includes(E.index(s, 6, 6)));
});
test('walls stop a ray, a crate is hit but protects cells behind it', () => {
  const s = arena(); s.tiles[E.index(s, 5, 3)] = 2;
  const cells = E.blast(s, { x: 3, y: 3, range: 4 });
  assert.ok(cells.includes(E.index(s, 5, 3))); assert.ok(!cells.includes(E.index(s, 6, 3)));
  assert.ok(!E.blast(s, { x: 3, y: 2, range: 4 }).includes(E.index(s, 5, 2)));
});
test('bombs use 2s fuses and 0.4s flames, returning capacity on explosion', () => {
  const s = arena(), p = s.actors[0]; E.place(s, p); at(p, 3, 3);
  tick(s, 119 / 60); assert.equal(s.bombs.length, 1);
  tick(s, 1 / 60); assert.equal(s.bombs.length, 0); assert.ok(E.burning(s, 1, 1));
  tick(s, 23 / 60); assert.ok(E.burning(s, 1, 1)); tick(s, 1 / 60); assert.ok(!E.burning(s, 1, 1));
});
test('blast chains multiple bombs in the same step, preserving blast lengths', () => {
  const s = arena(); put(s, 3, 3, .1, 2); put(s, 5, 3, 2, 4, 1); put(s, 9, 3, 3, 2);
  tick(s, .1); assert.equal(s.bombs.length, 0); assert.equal(s.flames.length, 3); assert.ok(E.burning(s, 11, 3));
});
test('same-time blasts cannot use a crate destroyed by another same-time blast', () => {
  const s = arena(); s.tiles[E.index(s, 5, 3)] = 2;
  put(s, 3, 3, .1, 4); put(s, 5, 1, .1, 4, 1); tick(s, .1);
  assert.equal(E.tile(s, 5, 3), 0); assert.equal(E.burning(s, 5, 4), false); assert.equal(E.burning(s, 6, 3), false);
});
test('hidden items appear only after all overlapping flames end', () => {
  const s = arena(), i = E.index(s, 3, 3); at(s.actors[0], 7, 7); s.tiles[i] = 2; s.hidden[i] = 'fire'; put(s, 3, 1, .1);
  tick(s, .1); assert.equal(s.pending[i], 'fire'); assert.equal(s.items[i], undefined);
  s.flames.push({ cells: new Set([i]), until: .8 }); tick(s, .4); assert.equal(s.items[i], undefined);
  tick(s, .3); assert.equal(s.items[i], 'fire');
});
test('exposed items burn, upgrades cap, planted bombs keep original range', () => {
  const s = arena(), p = s.actors[0]; E.place(s, p); s.items[E.index(s, p.x, p.y)] = 'fire';
  tick(s, 1 / 60); assert.equal(p.range, 3); assert.equal(s.bombs[0].range, 2);
  p.capacity = 3; s.items[E.index(s, p.x, p.y)] = 'bomb'; tick(s, 1 / 60); assert.equal(p.capacity, 3);
  at(p, 7, 7); s.items[E.index(s, 3, 3)] = 'speed'; put(s, 3, 1, .1); tick(s, .1); assert.equal(s.items[E.index(s, 3, 3)], undefined);
});
test('simultaneous pickup and bomb installation have a single winner', () => {
  const s = arena(); at(s.actors[1], 1, 1); s.items[E.index(s, 1, 1)] = 'bomb';
  E.step(s, { 0: { bomb: true }, 1: { bomb: true } });
  assert.equal(s.bombs.length, 1); assert.equal(s.actors.reduce((n, a) => n + a.collected, 0), 1);
  assert.ok(s.bombs[0].grace.has(0)); assert.ok(s.bombs[0].grace.has(1));
});
test('own bomb defeats the player and all later time is frozen', () => {
  const s = arena(); E.place(s, s.actors[0]); tick(s, 2);
  assert.equal(s.phase, 'defeat'); const time = s.time; tick(s, 5); assert.equal(s.time, time);
});
test('all remaining rivals must be defeated before a stage clears', () => {
  const s = arena(3); s.actors[1].alive = false; s.actors[2].alive = false;
  E.step(s); assert.equal(s.phase, 'playing'); s.actors[3].alive = false; E.step(s); assert.equal(s.phase, 'stage-clear');
});
test('stage five ends in final victory; new stage resets abilities and actors', () => {
  const s = arena(5); s.actors.slice(1).forEach(a => a.alive = false); E.step(s); assert.equal(s.phase, 'complete');
  const next = E.create({ stage: 4 }); assert.equal(next.phase, 'ready'); assert.equal(next.actors[0].range, 2); assert.equal(next.actors.length, 5);
});
test('the last CPU and player dying together is a draw, with other survivors it is defeat', () => {
  const s = arena(); at(s.actors[0], 3, 3); at(s.actors[1], 5, 3); put(s, 3, 3, .1); tick(s, .1); assert.equal(s.phase, 'draw');
  const many = arena(2); at(many.actors[0], 3, 3); at(many.actors[1], 5, 3); put(many, 3, 3, .1); tick(many, .1); assert.equal(many.phase, 'defeat');
});
test('time-out is a draw; damage at deadline takes priority', () => {
  const s = arena(); at(s.actors[0], 5, 5); at(s.actors[1], 7, 5); s.time = 180 - 1 / 60; E.step(s); assert.equal(s.phase, 'draw');
  assert.ok(s.actors.every(a => a.alive));
  const hit = arena(); at(hit.actors[0], 5, 5); at(hit.actors[1], 7, 5); hit.time = 180 - 1 / 60; put(hit, 5, 5, 180, 1); E.step(hit); assert.equal(hit.phase, 'defeat');
});
test('damage precedes movement and pickups on the exact detonation tick', () => {
  const s = arena(); s.items[E.index(s, 1, 1)] = 'speed'; put(s, 1, 1, 1 / 60);
  E.step(s, { 0: { dir: 'right' } }); assert.equal(s.actors[0].alive, false); assert.equal(s.actors[0].x, 1); assert.equal(s.actors[0].collected, 0);
});
test('moving into an existing flame causes immediate damage', () => {
  const s = arena(); s.flames.push({ cells: new Set([E.index(s, 2, 1)]), until: 1 });
  E.step(s, { 0: { dir: 'right' } }); assert.equal(s.phase, 'defeat');
});
test('forecast handles chains and later rays through previously destroyed crates without mutating the board', () => {
  const s = arena(); s.tiles[E.index(s, 5, 3)] = 2; put(s, 5, 1, .5); put(s, 3, 3, 1.5, 4); const third = put(s, 7, 3, 3, 2);
  const f = AI.forecast(s); assert.equal(f.due.get(third.id), 1.5); assert.ok(f.hazards.has(E.index(s, 6, 3))); assert.equal(E.tile(s, 5, 3), 2);
});
test('CPU refuses to plant in an enclosed pocket with no escape route', () => {
  const s = arena(), a = s.actors[1]; at(a, 3, 3);
  for (const [dx, dy] of Object.values(E.DIRS)) s.tiles[E.index(s, a.x + dx, a.y + dy)] = 2;
  assert.equal(AI.escape(s, a, AI.forecast(s, { id: -1, x: 3, y: 3, range: 2, due: 2 })).safe, false);
  assert.notEqual(AI.input(s, a).bomb, true);
});
test('CPU escapes its starting bomb on every difficulty, including a turn', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const s = arena(), a = s.actors[1]; s.difficulty = difficulty; E.place(s, a);
    tick(s, 2.5, { 0: {}, 1: undefined }, (world, cpu) => {
      const f = AI.forecast(world); return { dir: AI.escape(world, cpu, f).dir };
    });
    assert.equal(a.alive, true, difficulty);
  }
});
test('all AI modes play seeded matches without invalid positions, over-capacity bombs or NaN', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) for (let stage = 1; stage <= 5; stage++) {
    const s = E.create({ stage, seed: stage * 42, phase: 'playing', difficulty });
    let placements = 0;
    for (let n = 0; n < 60 * 35 && s.phase === 'playing'; n++) {
      E.step(s, { 0: AI.input(s, s.actors[0]) }, 1 / 60, AI.input);
      placements += s.events.filter(e => e.type === 'place').length;
      for (const a of s.actors) { assert.equal(E.tile(s, a.x, a.y), 0); assert.ok(Number.isFinite(a.x + a.y)); assert.ok(E.activeBombs(s, a) <= a.capacity); }
    }
    assert.ok(placements > 0, difficulty + ' stage ' + stage);
  }
});
