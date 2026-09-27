const test = require("node:test");
const assert = require("node:assert/strict");
const { Game } = require("./engine.js");
function seeded(seed = 42) { return () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296); }
function game(options = {}) { return new Game({ random: seeded(), ...options }).reset(); }
function tick(g, duration, direction) {
  let remaining = duration;
  while (remaining > 1e-9) { const dt = Math.min(1 / 60, remaining); g.update(dt, direction); remaining -= dt; }
}
function frozenHazards(g) { g.nextHazardAt = 100000; g.nextBonusAt = 100000; }
test("new game has 625 targets, safe spawn, 12 distinct hazards and 10 lives", () => {
  const g = game();
  assert.equal(g.visited.length, 625); assert.equal(g.visitedCount, 1); assert.equal(g.score, 0); assert.equal(g.lives, 10);
  assert.equal(g.hazards.length, 12); assert.equal(new Set(g.hazards.map(h => g.index(h))).size, 12);
  assert.ok(g.hazards.every(h => Math.max(Math.abs(h.x - 12), Math.abs(h.y - 12)) > 2));
});
test("first visit scores once and revisiting an extinguished tile is safe", () => {
  const g = game({ hazards: 0 });
  g.update(0, "right"); assert.equal(g.score, 10); assert.equal(g.visitedCount, 2);
  g.update(.17, "left"); g.update(.17, "right");
  assert.equal(g.score, 10); assert.equal(g.visitedCount, 2); assert.equal(g.lives, 10);
});
test("holding movement is limited to 6 cells per second and cannot leave the board", () => {
  const g = game({ hazards: 0 }); tick(g, 1, "right");
  assert.equal(g.player.x, 18); tick(g, 10, "right"); assert.equal(g.player.x, 24);
  assert.equal(g.player.y, 12); assert.equal(g.visitedCount, 13);
});
test("hazard contact costs one life, protects for 1 second, and cannot collect underlying tile", () => {
  const g = game(); frozenHazards(g); g.hazards = [{ x: 13, y: 12 }];
  g.update(0, "right"); assert.equal(g.lives, 9); assert.equal(g.visitedCount, 1);
  tick(g, .99); assert.equal(g.lives, 9);
  tick(g, .02); assert.equal(g.lives, 8); assert.equal(g.visitedCount, 1);
});
test("a hazard moving onto a stationary player also damages", () => {
  const g = game(); g.hazards = [{ x: 13, y: 12 }]; g.plans = [{ x: 12, y: 12 }];
  g.update(1); assert.equal(g.lives, 9);
});
test("hazards warn at .8 seconds and move one cardinal step at 1 second", () => {
  const g = game(); const before = structuredClone(g.hazards);
  g.update(.79); assert.equal(g.plans, null); assert.deepEqual(g.hazards, before);
  g.update(.02); assert.ok(g.plans); assert.deepEqual(g.hazards, before);
  g.update(.19);
  assert.ok(g.hazards.every((h, i) => Math.abs(h.x - before[i].x) + Math.abs(h.y - before[i].y) <= 1));
  assert.equal(g.plans, null);
});
test("long simulation keeps hazards distinct, in bounds and off a bonus", () => {
  const g = game(); g.invulnerableUntil = Infinity;
  for (let i = 0; i < 12000; i++) {
    g.update(1 / 60);
    assert.equal(new Set(g.hazards.map(h => g.index(h))).size, g.hazards.length);
    assert.ok(g.hazards.every(h => g.inside(h)));
    if (g.bonus) assert.ok(!g.hazards.some(h => h.x === g.bonus.x && h.y === g.bonus.y));
  }
});
test("bonus appears after 15 active seconds and expires after 3", () => {
  const g = game({ hazards: 0 });
  tick(g, 14.99); assert.equal(g.bonus, null);
  tick(g, .03); assert.ok(g.bonus); const expires = g.bonus.expires;
  tick(g, expires - g.time + .01); assert.equal(g.bonus, null);
});
test("gold collection adds 100 plus 20, is safe on hazards and never rescores old tiles", () => {
  const g = game(); frozenHazards(g); g.hazards = [{ x: 14, y: 12 }];
  g.bonus = { x: 13, y: 12, expires: 3 };
  g.update(0, "right"); assert.ok(g.golden); assert.equal(g.score, 120);
  g.update(.17, "right"); assert.equal(g.score, 140); assert.equal(g.lives, 10); assert.equal(g.visitedCount, 3);
  g.update(.17, "left"); g.update(.17, "right"); assert.equal(g.score, 140);
  assert.equal(g.bonus, null);
});
test("gold expiration preserves visits and grants 1 second exit grace on a hazard", () => {
  const g = game(); frozenHazards(g); g.hazards = [{ ...g.player }];
  g.goldUntil = .5;
  tick(g, .49); assert.equal(g.lives, 10);
  tick(g, .02); assert.equal(g.golden, false); assert.equal(g.lives, 10);
  const count = g.visitedCount;
  tick(g, .95); assert.equal(g.lives, 10);
  tick(g, .1); assert.equal(g.lives, 9); assert.equal(g.visitedCount, count);
  assert.ok(g.nextBonusAt > 15);
});
test("no new bonus spawns during gold mode", () => {
  const g = game({ hazards: 0 }); g.goldUntil = 5; g.nextBonusAt = .1;
  tick(g, 4.9); assert.equal(g.bonus, null);
});
test("pause freezes all simulation state and resume continues", () => {
  const g = game(); g.bonus = { x: 0, y: 0, expires: 3 }; g.goldUntil = 5;
  g.pause(); const snapshot = JSON.stringify(g);
  tick(g, 40, "right"); assert.equal(JSON.stringify(g), snapshot);
  g.resume(); tick(g, .2, "right"); assert.ok(g.time > 0); assert.equal(g.player.x, 14);
});
test("visiting all cells wins once with remaining-life bonus", () => {
  const g = game({ hazards: 0 });
  g.visited.fill(1); g.visited[g.index({ x: 13, y: 12 })] = 0; g.visitedCount = 624;
  g.update(0, "right"); assert.equal(g.status, "won"); assert.equal(g.score, 1010);
  g.update(10, "right"); assert.equal(g.score, 1010);
});
test("zero lives loses before collecting the last tile; reset clears all timers and state", () => {
  const g = game(); frozenHazards(g); g.lives = 1; g.hazards = [{ x: 13, y: 12 }];
  g.visited.fill(1); g.visited[g.index({ x: 13, y: 12 })] = 0; g.visitedCount = 624;
  g.update(0, "right"); assert.equal(g.status, "lost"); assert.equal(g.visitedCount, 624); assert.equal(g.score, 0);
  g.reset(); assert.equal(g.status, "playing"); assert.equal(g.lives, 10); assert.equal(g.visitedCount, 1);
  assert.equal(g.goldUntil, 0); assert.equal(g.bonus, null); assert.equal(g.time, 0); assert.equal(g.score, 0);
  assert.equal(g.nextHazardAt, 1); assert.equal(g.nextBonusAt, 15); assert.equal(g.invulnerableUntil, 0);
});
