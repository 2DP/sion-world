const test = require("node:test");
const assert = require("node:assert/strict");
const { Game } = require("./engine.js");
function seeded(seed = 42) { return () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296); }
function game(options = {}) { return new Game({ size: 25, sizeIncrease: 0, random: seeded(), ...options }).reset(); }
function tick(g, duration, direction) {
  let remaining = duration;
  while (remaining > 1e-9) { const dt = Math.min(1 / 60, remaining); g.update(dt, direction); remaining -= dt; }
}
function frozenHazards(g) { g.nextHazardAt = 100000; g.nextBonusAt = 100000; }
test("squirrel moves one cell each second without visiting or scoring and cancels a hazard plan", () => {
  const g = game({ hazards: 0 }); frozenHazards(g);
  g.squirrelItem = { ...g.player, expires: 10 }; g.update(0);
  assert.ok(g.squirrel); assert.equal(g.squirrelItem, null);
  g.hazards = [{ x: 14, y: 12 }];
  g.update(.99); assert.equal(g.squirrel.x, 12);
  g.update(.01); assert.equal(g.squirrel.x, 13); assert.equal(g.visitedCount, 1);
  g.plans = [{ x: 15, y: 12 }]; g.nextHazardAt = 2;
  g.update(1); assert.equal(g.squirrel.x, 14); assert.equal(g.hazards[0].x, 14);
  assert.equal(g.hazards[0].disabledUntil, 17); assert.equal(g.dangerous(g.hazards[0]), false);
  assert.equal(g.visitedCount, 1); assert.equal(g.score, 0);
});
test("acorn freezes hazards and damage for fifteen seconds, then normal rules resume", () => {
  const g = game({ hazards: 0 });
  g.hazards = [{ x: 13, y: 12 }]; g.squirrel = { x: 13, y: 12, expires: 30, nextMoveAt: 100 };
  g.placeAcorn(); g.squirrel = null;
  g.update(0, "right"); assert.equal(g.lives, 10); assert.equal(g.visitedCount, 2);
  tick(g, 14.9); assert.equal(g.hazards[0].x, 13); assert.equal(g.hazards[0].y, 12);
  assert.equal(g.lives, 10); assert.equal(g.dangerous(), false);
  g.nextHazardAt = 100; g.update(.11); assert.equal(g.dangerous(), true); assert.equal(g.lives, 9);
  g.plans = null; g.planHazards();
  assert.equal(Math.abs(g.plans[0].x - 13) + Math.abs(g.plans[0].y - 12), 1);
});
test("a hazard moving onto the squirrel gets an acorn and frozen hazards stay distinct", () => {
  const g = game({ hazards: 0 });
  g.hazards = [{ x: 0, y: 0 }, { x: 2, y: 0 }];
  g.plans = [{ x: 1, y: 0 }, { x: 2, y: 1 }];
  g.squirrel = { x: 1, y: 0, expires: 30, nextMoveAt: 100 };
  g.update(1); assert.ok(g.disabled(g.hazards[0]));
  const until = g.hazards[0].disabledUntil;
  tick(g, 5); assert.equal(g.hazards[0].disabledUntil, until);
  assert.equal(g.hazards[0].x, 1); assert.equal(g.hazards[0].y, 0);
  assert.equal(new Set(g.hazards.map(h => g.index(h))).size, 2);
});
test("squirrel item lifecycle, pause and stage reset also handle acorns", () => {
  const g = game({ hazards: 0 }); g.update(34.99); assert.equal(g.squirrelItem, null);
  g.update(.02); assert.ok(g.squirrelItem);
  const items = [g.squirrelItem, g.heal, g.bonus, g.booster, g.shieldItem, g.rabbitItem].filter(Boolean);
  assert.equal(new Set(items.map(p => g.index(p))).size, items.length);
  g.update(10); assert.equal(g.squirrelItem, null);
  g.squirrelItem = { ...g.player, expires: g.time + 10 }; g.update(0);
  g.hazards = [{ x: 0, y: 0, disabledUntil: g.time + 15 }];
  g.pause(); const snapshot = JSON.stringify(g); tick(g, 50); assert.equal(JSON.stringify(g), snapshot);
  g.resume(); g.update(30); assert.equal(g.squirrel, null);
  g.status = "stage-clear"; g.nextStage(); assert.equal(g.squirrelItem, null); assert.equal(g.squirrel, null);
  assert.ok(g.hazards.every(h => !g.disabled(h)));
  g.squirrel = { x: 0, y: 0, expires: 100 }; g.reset(); assert.equal(g.squirrel, null);
});
test("shield blocks contact for ten seconds without gold scoring, then damage resumes", () => {
  const g = game({ hazards: 0 }); frozenHazards(g);
  g.shieldItem = { ...g.player, expires: 10 }; g.update(0);
  assert.ok(g.shielded); assert.equal(g.shieldUntil, 10); assert.equal(g.shieldItem, null);
  g.hazards = [{ x: 13, y: 12 }]; g.update(0, "right");
  assert.equal(g.lives, 10); assert.equal(g.score, 0); assert.equal(g.visitedCount, 1);
  tick(g, 9.99); assert.equal(g.lives, 10);
  tick(g, .02); assert.equal(g.shielded, false); assert.equal(g.lives, 9);
});
test("shield timer pauses, refreshes and clears with stages and restart", () => {
  const g = game({ hazards: 0 }); g.shieldItem = { ...g.player, expires: 10 }; g.update(0);
  g.pause(); tick(g, 20); assert.equal(g.time, 0); assert.ok(g.shielded);
  g.resume(); g.update(5); g.shieldItem = { ...g.player, expires: 20 }; g.update(0);
  assert.equal(g.shieldUntil, 15);
  g.goldUntil = 6; g.hazards = [{ ...g.player }]; frozenHazards(g); g.update(2);
  assert.ok(g.shielded); assert.equal(g.lives, 10);
  g.status = "stage-clear"; g.nextStage(); assert.equal(g.shieldUntil, 0); assert.equal(g.shieldItem, null);
  g.shieldUntil = 50; g.reset(); assert.equal(g.shielded, false); assert.equal(g.nextShieldAt, 25);
});
test("shield items spawn safely and expire, and adjacent booster presses do not collect them", () => {
  const g = game({ hazards: 0 }); g.invulnerableUntil = Infinity;
  g.update(24.99); assert.equal(g.shieldItem, null);
  g.update(.02); assert.ok(g.shieldItem); const expires = g.shieldItem.expires;
  const items = [g.shieldItem, g.heal, g.bonus, g.booster].filter(Boolean);
  assert.equal(new Set(items.map(p => g.index(p))).size, items.length);
  g.update(expires - g.time); assert.equal(g.shieldItem, null);
  g.boostUntil = g.time + 10; g.shieldItem = { x: 13, y: 12, expires: g.time + 10 }; g.update(0);
  assert.ok(g.shieldItem); assert.equal(g.shielded, false);
  g.update(0, "right"); assert.ok(g.shielded);
});
test("hearts appear every ten seconds even after early collection", () => {
  const g = game({ hazards: 0 });
  g.update(9.99); assert.equal(g.heal, null);
  g.update(.01); assert.ok(g.heal); assert.equal(g.nextHealAt, 20);
  g.player = { ...g.heal }; g.update(0); assert.equal(g.heal, null);
  g.update(9.99); assert.equal(g.heal, null);
  g.update(.01); assert.ok(g.heal); assert.ok(Math.abs(g.nextHealAt - 30) < 1e-9);
  const first = g.heal; g.update(10);
  assert.ok(g.heal); assert.notEqual(g.heal, first); assert.ok(Math.abs(g.nextHealAt - 40) < 1e-9);
});
test("rabbit item spawns safely, expires and does not overlap other items", () => {
  const g = game(); g.invulnerableUntil = Infinity;
  tick(g, 29.99); assert.equal(g.rabbitItem, null);
  tick(g, .03); assert.ok(g.rabbitItem);
  assert.ok(!g.dangerous(g.rabbitItem));
  const items = [g.rabbitItem, g.bonus, g.heal, g.booster].filter(Boolean);
  assert.equal(new Set(items.map(p => g.index(p))).size, items.length);
  const expires = g.rabbitItem.expires;
  while (g.time < expires - .02) { g.update(.01); assert.ok(!g.dangerous(g.rabbitItem)); }
  tick(g, .04); assert.equal(g.rabbitItem, null);
});
test("rabbit walks slowly and presses hazardous tiles without damaging the player", () => {
  const g = game({ hazards: 0 }); frozenHazards(g);
  g.player = { x: 0, y: 0 }; g.rabbitItem = { x: 0, y: 0, expires: 10 };
  g.update(0); assert.ok(g.rabbit); assert.equal(g.rabbitItem, null);
  g.player = { x: 12, y: 12 };
  g.visited[g.index({ x: 0, y: 1 })] = 1; g.visitedCount++;
  g.hazards = [{ x: 1, y: 0 }];
  g.update(.99); assert.equal(g.rabbit.x, 0); assert.equal(g.rabbit.y, 0);
  const score = g.score; g.update(.01);
  assert.equal(g.rabbit.x, 1); assert.equal(g.rabbit.y, 0);
  assert.equal(g.visited[g.index({ x: 1, y: 0 })], 1);
  assert.equal(g.lives, 10); assert.equal(g.score, score + 10);
  g.player = { x: 1, y: 0 }; g.update(0); assert.equal(g.lives, 9);
});
test("rabbit pauses, expires at 30 seconds, and resets with stages and new games", () => {
  const g = game({ hazards: 0 }); g.rabbitItem = { ...g.player, expires: 10 }; g.update(0);
  const initial = { ...g.rabbit }; g.pause(); tick(g, 50); assert.deepEqual(g.rabbit, initial);
  g.resume(); tick(g, 29.99); assert.ok(g.rabbit); assert.ok(g.inside(g.rabbit));
  tick(g, .02); assert.equal(g.rabbit, null);
  g.rabbitItem = { ...g.player, expires: 40 }; g.update(0); assert.ok(g.rabbit);
  g.status = "stage-clear"; g.nextStage(); assert.equal(g.rabbit, null); assert.equal(g.rabbitItem, null);
  g.rabbitItem = { ...g.player, expires: 40 }; g.update(0); g.reset(); assert.equal(g.rabbit, null);
});
test("rabbit can finish a stage without collecting items or awarding duplicate points", () => {
  const g = game({ hazards: 0 }); frozenHazards(g);
  g.visited.fill(1); g.visited[1] = 0; g.visitedCount = g.visited.length - 1;
  g.rabbit = { x: 0, y: 0, expires: 20, nextMoveAt: 2 };
  g.heal = { x: 1, y: 0, expires: 10 }; g.lives = 8;
  g.update(2); assert.equal(g.status, "stage-clear"); assert.equal(g.score, 10);
  assert.ok(g.heal); assert.equal(g.lives, 8);
  g.update(2); assert.equal(g.score, 10);
});
test("booster presses a cross, ignores adjacent hazards and damages only the center", () => {
  const g = game({ hazards: 0 }); frozenHazards(g);
  g.player = { x: 5, y: 5 };
  g.booster = { ...g.player, expires: 10 };
  g.hazards = [{ x: 5, y: 4 }, { x: 6, y: 5 }];
  g.update(0);
  assert.equal(g.boosted, true); assert.equal(g.boostUntil, 10);
  assert.equal(g.visitedCount, 6); assert.equal(g.score, 50); assert.equal(g.lives, 10);
  assert.equal(g.visited[g.index({ x: 4, y: 4 })], 0);
  g.update(0); assert.equal(g.score, 50);
  g.update(0, "right"); assert.equal(g.lives, 9);
  assert.equal(g.visited[g.index({ x: 7, y: 5 })], 1);
});
test("booster respects boundaries, pauses, expires and resets between stages", () => {
  const g = game({ hazards: 0 }); g.player = { x: 0, y: 0 }; g.boostUntil = 10;
  g.update(0); assert.equal(g.visitedCount, 4); assert.equal(g.score, 30);
  g.pause(); tick(g, 20); assert.equal(g.boostUntil, 10); assert.equal(g.time, 0);
  g.resume(); g.update(10, "right"); assert.equal(g.boosted, false);
  assert.equal(g.visited[g.index({ x: 2, y: 0 })], 0);
  g.status = "stage-clear"; g.boostUntil = 40; g.booster = { x: 2, y: 2, expires: 40 };
  g.nextStage(); assert.equal(g.boostUntil, 0); assert.equal(g.booster, null);
});
test("booster spawns safely, expires, and adjacent items require direct contact", () => {
  const g = game({ hazards: 0 }); g.nextBoosterAt = 0; g.update(0);
  assert.ok(g.booster); assert.ok(!g.dangerous(g.booster));
  assert.ok(g.booster.x !== g.player.x || g.booster.y !== g.player.y);
  g.spawnBonus(); g.spawnBonus("heal");
  assert.equal(new Set([g.booster, g.bonus, g.heal].map(p => g.index(p))).size, 3);
  g.update(10); assert.equal(g.booster, null);
  g.boostUntil = 30; g.lives = 8;
  g.heal = { x: 13, y: 12, expires: 30 }; g.update(0);
  assert.equal(g.lives, 8); assert.ok(g.heal);
  g.update(0, "right"); assert.equal(g.lives, 9);
});
test("gold and booster combine scores and a cross can finish the stage", () => {
  const g = game({ hazards: 0 }); g.player = { x: 0, y: 0 };
  g.visited.fill(1); g.visitedCount = g.visited.length - 3;
  for (const p of [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]) g.visited[g.index(p)] = 0;
  g.boostUntil = 10; g.goldUntil = 5; g.hazards = [{ ...g.player }]; g.update(0);
  assert.equal(g.status, "stage-clear"); assert.equal(g.score, 60); assert.equal(g.lives, 10);
});
test("new game has 625 targets, safe spawn, 3 distinct hazards and 10 lives", () => {
  const g = game();
  assert.equal(g.visited.length, 625); assert.equal(g.visitedCount, 1); assert.equal(g.score, 0); assert.equal(g.lives, 10);
  assert.equal(g.hazards.length, 3); assert.equal(new Set(g.hazards.map(h => g.index(h))).size, 3);
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
  const g = game({ hazards: 0, stages: 1 });
  g.visited.fill(1); g.visited[g.index({ x: 13, y: 12 })] = 0; g.visitedCount = 624;
  g.update(0, "right"); assert.equal(g.status, "won"); assert.equal(g.score, 1010);
  g.update(10, "right"); assert.equal(g.score, 1010);
});

test("all ten stages increase difficulty, preserve the run and win only on stage ten", () => {
  const g = new Game({ random: seeded() }).reset(); g.lives = 7; g.time = 42;
  for (let stage = 1; stage <= 10; stage++) {
    assert.equal(g.stage, stage);
    assert.equal(g.size, 7 + (stage - 1) * 2);
    assert.equal(g.visited.length, g.size * g.size);
    assert.equal(g.hazards.length, 3 + (stage - 1) * 2);
    assert.ok(Math.abs(g.hazardInterval - (1 - (stage - 1) * .07)) < 1e-9);
    assert.equal(new Set(g.hazards.map(h => g.index(h))).size, g.hazards.length);
    const before = structuredClone(g.hazards);
    g.nextHazardAt = g.time + g.hazardInterval;
    g.update(g.hazardInterval - .01); assert.deepEqual(g.hazards, before);
    g.update(.011); assert.equal(g.plans, null);
    assert.ok(g.hazards.some((h, i) => h.x !== before[i].x || h.y !== before[i].y));
    g.hazards = []; g.visited.fill(1); g.visitedCount = g.visited.length; g.update(0);
    assert.equal(g.status, stage === 10 ? "won" : "stage-clear");
    const time = g.time; g.update(50); assert.equal(g.time, time);
    g.bonus = { x: 0, y: 0 }; g.heal = { x: 1, y: 0 }; g.goldUntil = time + 5;
    g.nextStage();
    if (stage < 10) {
      assert.equal(g.status, "playing"); assert.equal(g.visitedCount, 1);
      assert.equal(g.lives, 7); assert.equal(g.score, 0); assert.equal(g.time, time);
      assert.equal(g.bonus, null); assert.equal(g.heal, null); assert.equal(g.goldUntil, 0);
      assert.equal(g.nextHazardAt, time + g.hazardInterval);
    }
  }
  assert.equal(g.score, 700); assert.equal(g.stage, 10);
  g.reset(); assert.equal(g.stage, 1); assert.equal(g.hazards.length, 3);
  assert.equal(g.hazardInterval, 1); assert.equal(g.heal, null);
});

test("hearts spawn safely, expire, freeze on pause and avoid hazards and gold", () => {
  const g = game(); g.invulnerableUntil = Infinity;
  assert.equal(g.nextHealAt, 10);
  tick(g, g.nextHealAt + .01); assert.ok(g.heal);
  assert.ok(!g.dangerous(g.heal)); assert.notDeepEqual(g.player, g.heal);
  const heart = { ...g.heal };
  g.spawnBonus(); assert.ok(g.bonus.x !== heart.x || g.bonus.y !== heart.y);
  g.pause(); tick(g, 30); assert.deepEqual(g.heal, heart); g.resume();
  while (g.time < heart.expires - .02) {
    g.update(.01); assert.ok(!g.dangerous(heart));
  }
  tick(g, .04); assert.ok(g.heal); assert.ok(g.heal.expires > heart.expires);
  tick(g, g.nextHealAt - g.time + .01); assert.ok(g.heal);
});

test("heart collection heals once, caps lives and works in gold mode", () => {
  const g = game({ hazards: 0 }); g.lives = 8;
  g.heal = { x: 13, y: 12, expires: 10 }; g.update(0, "right");
  assert.equal(g.lives, 9); assert.equal(g.heal, null); assert.equal(g.score, 10);
  g.update(.17, "left"); g.update(.17, "right"); assert.equal(g.lives, 9);
  g.goldUntil = 10; g.heal = { ...g.player, expires: 10 }; g.update(0);
  assert.equal(g.lives, 10);
  g.heal = { ...g.player, expires: 10 }; g.update(0); assert.equal(g.lives, 10);
  g.nextHealAt = g.time; g.update(0); assert.ok(g.heal);
});
test("zero lives loses before collecting the last tile; reset clears all timers and state", () => {
  const g = game(); frozenHazards(g); g.lives = 1; g.hazards = [{ x: 13, y: 12 }];
  g.visited.fill(1); g.visited[g.index({ x: 13, y: 12 })] = 0; g.visitedCount = 624;
  g.update(0, "right"); assert.equal(g.status, "lost"); assert.equal(g.visitedCount, 624); assert.equal(g.score, 0);
  g.reset(); assert.equal(g.status, "playing"); assert.equal(g.lives, 10); assert.equal(g.visitedCount, 1);
  assert.equal(g.goldUntil, 0); assert.equal(g.bonus, null); assert.equal(g.time, 0); assert.equal(g.score, 0);
  assert.equal(g.nextHazardAt, 1); assert.equal(g.nextBonusAt, 15); assert.equal(g.invulnerableUntil, 0);
});
