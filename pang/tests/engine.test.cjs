const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const run = (s, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds * 120); i++) E.step(s, input, 1 / 120); };
const active = (stage = 1) => { const s = E.create(stage); E.start(s); return s; };
test('all stages use valid separated spawns and bounded long-running physics', () => {
  for (let stage = 1; stage <= 10; stage++) {
    const s = active(stage); s.player.invincible = 1000;
    run(s, 30);
    for (const b of s.bubbles) { assert.ok(b.x >= b.r && b.x <= E.W - b.r); assert.ok(b.y >= b.r && b.y <= E.FLOOR - b.r); }
  }
});
test('one line splits only one bubble; children remain bounded and diverge', () => {
  const s = active(3), b = s.bubbles[0]; b.x = b.r; b.y = 150;
  s.shots = [{ x: b.x, top: 140, sticky: false, hold: 0 }]; E.step(s, {}, .01);
  assert.equal(s.bubbles.length, 2); assert.equal(s.score, 100); assert.equal(s.shots.length, 0);
  assert.deepEqual(s.bubbles.map(b => b.size), [1, 1]); assert.ok(s.bubbles[0].vx < 0 && s.bubbles[1].vx > 0);
  assert.ok(s.bubbles.every(b => b.x >= b.r));
});
test('line body catches a sideways bubble and consumes one target', () => {
  const s = active(2); s.bubbles.forEach(b => { b.x = 400; b.y = 260; });
  s.shots = [{ x: 400, top: 20, sticky: true, hold: 0 }]; E.step(s, {}, .005);
  assert.equal(s.hits, 1); assert.equal(s.bubbles.length, 3);
});
test('overlapping bubbles cause one hit, grace prevents immediate repeats', () => {
  const s = active(2); s.player.invincible = 0;
  for (const b of s.bubbles) { b.x = s.player.x; b.y = E.FLOOR - b.r; b.vy = 0; }
  E.step(s, {}, .005); assert.equal(s.lives, 2); assert.ok(s.player.invincible > 1.9);
  E.step(s, {}, .1); assert.equal(s.lives, 2);
});
test('double shot limit, sticky ceiling lifetime and weapon expiry', () => {
  const s = active(); s.bubbles[0].x = 50; s.weapon = 'double'; s.weaponTime = 10;
  run(s, .32, { fire: true }); assert.equal(s.shots.length, 2);
  s.shots = [{ x: 480, top: 12, sticky: true, hold: 0 }]; run(s, 1.9); assert.equal(s.shots.length, 1);
  run(s, .2); assert.equal(s.shots.length, 0);
  s.weaponTime = .05; run(s, .1); assert.equal(s.weapon, 'basic');
});
test('pickup switches weapons and refreshes duration; stale items disappear', () => {
  const s = active(); s.items = [{ x: s.player.x, y: E.FLOOR - 14, age: 0, type: 'sticky' }];
  E.step(s, {}, .01); assert.equal(s.weapon, 'sticky'); assert.ok(s.weaponTime > 9.9);
  s.items = [{ x: 10, y: 200, age: 7.99, type: 'double' }]; E.step(s, {}, .02); assert.equal(s.items.length, 0);
});
test('pause freezes complete simulation, resume and retry reset lifecycle', () => {
  const s = active(); s.weapon = 'double'; s.weaponTime = 7; E.pause(s);
  const before = JSON.stringify(s); E.step(s, { right: true, fire: true }, 8); assert.equal(JSON.stringify(s), before);
  E.start(s); E.step(s, {}, .05); assert.ok(s.time < 150);
  const fresh = E.create(s.stage, s.difficulty); assert.equal(fresh.status, 'ready'); assert.equal(fresh.lives, 3); assert.equal(fresh.weapon, 'basic'); assert.equal(fresh.shots.length, 0);
});
test('timeout loses and huge frame gaps advance at most 0.1 seconds', () => {
  const s = active(); E.step(s, {}, 100); assert.ok(s.time > 149.89);
  s.time = .01; E.step(s, {}, .05); assert.equal(s.status, 'lost');
});
test('last shot wins before simultaneous player contact; fatal unprotected contact loses', () => {
  const s = active(); s.lives = 1; s.player.invincible = 0;
  s.bubbles = [{ size: 0, r: 15, x: s.player.x, y: E.FLOOR - 20, vx: 0, vy: 0 }];
  s.shots = [{ x: s.player.x, top: E.FLOOR - 40, sticky: false, hold: 0 }];
  E.step(s, {}, .005); assert.equal(s.status, 'won'); assert.equal(s.lives, 1);
  const danger = active(); danger.lives = 1; danger.player.invincible = 0;
  danger.bubbles[0].x = danger.player.x; danger.bubbles[0].y = E.FLOOR - 29; danger.bubbles[0].vy = 0;
  E.step(danger, {}, .005); assert.equal(danger.status, 'lost'); assert.equal(danger.lives, 0);
});
test('real shooting clears every stage, bonuses are awarded once and records unlock campaign', () => {
  const save = E.cleanSave();
  for (let stage = 1; stage <= 10; stage++) {
    const s = active(stage); s.player.invincible = 10000;
    // Deterministic aiming fixture removes navigation difficulty but exercises real line flight and split physics.
    for (let frame = 0; frame < 18000 && s.status === 'playing'; frame++) {
      if (s.bubbles.length) s.player.x = s.bubbles[0].x;
      E.step(s, { fire: true }, 1 / 120);
    }
    assert.equal(s.status, 'won', `stage ${stage}`); const score = s.score;
    E.step(s, { fire: true }, .1); assert.equal(s.score, score); E.record(save, s); E.record(save, s);
    assert.equal(save.easy.scores[stage - 1], score); assert.equal(save.easy.unlocked, Math.min(stage + 1, 10));
  }
  assert.equal(save.normal.unlocked, 1);
});
test('save sanitizer rejects corrupt values and bounds records', () => {
  assert.equal(E.cleanSave(null).easy.unlocked, 1);
  const save = E.cleanSave({ difficulty: 'bad', muted: 'true', easy: { unlocked: 999, scores: [-5, 'bad', Infinity] } });
  assert.equal(save.difficulty, 'easy'); assert.equal(save.muted, false); assert.equal(save.easy.unlocked, 10);
  assert.deepEqual(save.easy.scores.slice(0, 3), [0, 0, 1000000]);
});
