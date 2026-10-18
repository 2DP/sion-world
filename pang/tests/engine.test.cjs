const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const run = (s, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds * 120); i++) E.step(s, input, 1 / 120); };
const active = (stage = 1) => { const s = E.create(stage); E.start(s); return s; };

test('both difficulties start and retry with stage-specific life capacity', () => {
  for (const difficulty of ['easy', 'normal']) for (let stage = 1; stage <= E.STAGES.length; stage++) {
    const expected = stage >= 8 ? 7 : stage >= 5 ? 6 : 5;
    const s = E.create(stage, difficulty);
    assert.equal(s.lives, expected); assert.equal(s.maxLives, expected);
    s.lives--;
    assert.equal(E.create(s.stage, s.difficulty).lives, expected);
  }
});

test('each bubble size bounces about 16–17 percent higher in both difficulties', () => {
  for (const difficulty of ['easy', 'normal']) for (let size = 0; size < 3; size++) {
    const s = E.create(8, difficulty); E.start(s); s.player.invincible = 100;
    const r = E.RADII[size], floor = E.FLOOR - r;
    s.bubbles = [{ size, r, x: 100, y: floor, vx: 0, vy: 1 }];
    let apex = floor;
    for (let frame = 0; frame < 360; frame++) { E.step(s, {}, 1 / 120); apex = Math.min(apex, s.bubbles[0].y); }
    const oldHeight = [265, 370, 485][size] ** 2 / (2 * 620);
    assert.ok((floor - apex) / oldHeight > 1.14);
    assert.ok((floor - apex) / oldHeight < 1.18);
  }
});
test('all stages use valid separated spawns and bounded long-running physics', () => {
  for (let stage = 1; stage <= E.STAGES.length; stage++) {
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
  E.step(s, {}, .005); assert.equal(s.lives, 4); assert.ok(s.player.invincible > 1.9);
  E.step(s, {}, .1); assert.equal(s.lives, 4);
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
  const fresh = E.create(s.stage, s.difficulty); assert.equal(fresh.status, 'ready'); assert.equal(fresh.lives, 5); assert.equal(fresh.weapon, 'basic'); assert.equal(fresh.shots.length, 0);
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
  for (const difficulty of ['easy', 'normal']) {
  const save = E.cleanSave();
  for (let stage = 1; stage <= E.STAGES.length; stage++) {
    const s = E.create(stage, difficulty); E.start(s); s.player.invincible = 10000;
    // Deterministic aiming fixture removes navigation difficulty but exercises real line flight and split physics.
    for (let frame = 0; frame < 18000 && s.status === 'playing'; frame++) {
      if (s.bubbles.length) s.player.x = s.bubbles[0].x;
      E.step(s, { fire: true }, 1 / 120);
    }
    assert.equal(s.status, 'won', `stage ${stage}`); const score = s.score;
    E.step(s, { fire: true }, .1); assert.equal(s.score, score); E.record(save, s); E.record(save, s);
    assert.equal(save[difficulty].scores[stage - 1], score); assert.equal(save[difficulty].unlocked, Math.min(stage + 1, E.STAGES.length));
  }
  assert.equal(save[difficulty === 'easy' ? 'normal' : 'easy'].unlocked, 1);
  }
});

test('thirty-stage campaign preserves old saves and opens 11 only after an old finale win', () => {
  assert.equal(E.STAGES.length, 30);
  assert.equal(new Set(E.STAGES.map(s => s[0])).size, 30);
  const scores = Array(10).fill(0); scores[0] = 3490; scores[9] = 5780;
  const save = E.cleanSave({ muted: true, easy: { unlocked: 10, scores }, normal: { unlocked: 10, scores: [2000] } });
  assert.equal(save.easy.unlocked, 11); assert.equal(save.normal.unlocked, 10);
  assert.equal(save.easy.scores.length, 30); assert.equal(save.easy.scores[0], 3490);
  assert.equal(save.easy.scores[9], 5780); assert.equal(save.easy.scores[29], 0); assert.equal(save.muted, true);
  assert.deepEqual(E.cleanSave(save), save);
  assert.equal(E.create(999).stage, 30); assert.equal(E.create(-1).stage, 1);
});
test('save sanitizer rejects corrupt values and bounds records', () => {
  assert.equal(E.cleanSave(null).easy.unlocked, 1);
  const save = E.cleanSave({ difficulty: 'bad', muted: 'true', easy: { unlocked: 999, scores: [-5, 'bad', Infinity] } });
  assert.equal(save.difficulty, 'easy'); assert.equal(save.muted, false); assert.equal(save.easy.unlocked, E.STAGES.length);
  assert.deepEqual(save.easy.scores.slice(0, 3), [0, 0, 1000000]);
});

test('easy softens stages 4, 8 and crowded new stages while normal keeps its designed layouts', () => {
  for (let stage = 1; stage <= E.STAGES.length; stage++) {
    assert.deepEqual(E.create(stage, 'normal').bubbles.map(b => b.size), E.STAGES[stage - 1][1]);
    assert.deepEqual(E.create(stage, 'easy').bubbles.map(b => b.size), ({ 4: [2, 0], 8: [1, 1, 1, 0, 0] })[stage] || (stage > 10 && E.STAGES[stage - 1][1].length >= 5 ? E.STAGES[stage - 1][1].slice(1) : E.STAGES[stage - 1][1]));
  }
});
test('sticky replaces only the oldest ceiling line and fires at the new position', () => {
  const s = active(); s.weapon = 'sticky'; s.weaponTime = 10;
  const older = { x: 500, top: 12, hold: 1, sticky: true }, newer = { x: 600, top: 12, hold: .3, sticky: true };
  s.shots = [newer, older]; s.player.x = 750;
  E.step(s, { fire: true }, .005);
  assert.equal(s.shots.length, 2); assert.ok(s.shots.includes(newer)); assert.ok(!s.shots.includes(older));
  assert.equal(s.shots.find(shot => shot !== newer).x, 750); assert.ok(s.cooldown > .24);
  E.step(s, { fire: true }, .1); assert.ok(s.shots.includes(newer), 'cooldown prevents another recall');
});
test('two rising sticky lines cannot be recalled, while one ceiling line can', () => {
  const s = active(); s.weapon = 'sticky'; s.weaponTime = 10;
  const rising = { x: 500, top: 300, hold: 0, sticky: true }, other = { x: 600, top: 200, hold: 0, sticky: true };
  s.shots = [rising, other]; E.step(s, { fire: true }, .01);
  assert.equal(s.shots.length, 2); assert.ok(s.shots.includes(rising) && s.shots.includes(other)); assert.equal(s.cooldown, 0);
  other.top = 12; other.hold = .5; E.step(s, { fire: true }, .005);
  assert.ok(s.shots.includes(rising)); assert.ok(!s.shots.includes(other)); assert.equal(s.shots.length, 2);
});
test('sticky automatic fire respects two-line cap and cooldown; basic/double never recall', () => {
  const s = active(); s.weapon = 'sticky'; s.weaponTime = 10; s.player.invincible = 100;
  s.bubbles[0].x = 50; s.bubbles[0].vx = 0;
  let elapsed = 0, lastFire = -1, fires = 0;
  for (let i = 0; i < 360; i++) {
    elapsed += 1 / 120; E.step(s, { fire: true }, 1 / 120);
    assert.ok(s.shots.length <= 2);
    if (s.events.includes('fire')) { if (lastFire >= 0) assert.ok(elapsed - lastFire >= .249); lastFire = elapsed; fires++; }
  }
  assert.ok(fires >= 6, 'held fire continues after ceiling recall');
  for (const weapon of ['basic', 'double']) {
    const trial = active(); trial.weapon = weapon; trial.weaponTime = 10;
    const lines = Array.from({ length: weapon === 'basic' ? 1 : 2 }, (_, i) => ({ x: 500 + i * 70, top: 12, hold: .2, sticky: true }));
    trial.shots = [...lines]; E.step(trial, { fire: true }, .005);
    assert.deepEqual(trial.shots, lines); assert.equal(trial.cooldown, 0);
  }
});
