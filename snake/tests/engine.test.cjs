const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const running = options => { const s = E.create(options); E.start(s); return s; };

test('starts with a safe four-cell snake, waits for start and scores/grows on food', () => {
  const s = E.create();
  assert.equal(s.status, 'ready'); assert.equal(s.snake.length, 4);
  E.advance(s, 500); assert.equal(s.snake[0].x, 7);
  E.start(s);
  for (let i = 0; i < 4; i++) assert.equal(E.step(s), 'move');
  assert.equal(E.step(s, () => 0), 'eat');
  assert.equal(s.score, 10); assert.equal(s.eaten, 1); assert.equal(s.snake.length, 5);
  assert.ok(!s.snake.some(p => p.x === s.food.x && p.y === s.food.y));
});

test('prevents reversal and consumes two rapid turns on separate grid steps', () => {
  const s = running();
  assert.equal(E.turn(s, 'left'), false);
  assert.equal(E.turn(s, 'up'), true);
  assert.equal(E.turn(s, 'up'), false);
  assert.equal(E.turn(s, 'down'), false);
  assert.equal(E.turn(s, 'left'), true);
  assert.equal(E.turn(s, 'down'), false, 'bounded queue does not retain stale turns');
  E.step(s); assert.deepEqual(s.snake[0], { x: 7, y: 9 });
  E.step(s); assert.deepEqual(s.snake[0], { x: 6, y: 9 });
  assert.equal(s.status, 'playing');
});

test('classic walls end the round once, with no further movement or scoring', () => {
  const s = running(); s.snake = [{ x: 19, y: 10 }, { x: 18, y: 10 }];
  assert.equal(E.step(s), 'lost'); assert.equal(s.reason, 'wall');
  const snapshot = JSON.stringify(s);
  E.step(s); E.start(s); E.turn(s, 'down'); E.advance(s, 1000);
  assert.equal(JSON.stringify(s), snapshot);
});

test('walk mode wraps each edge while retaining body collisions', () => {
  for (const [direction, head, expected] of [
    ['right', { x: 19, y: 9 }, { x: 0, y: 9 }], ['left', { x: 0, y: 9 }, { x: 19, y: 9 }],
    ['up', { x: 9, y: 0 }, { x: 9, y: 19 }], ['down', { x: 9, y: 19 }, { x: 9, y: 0 }]
  ]) {
    const s = running({ mode: 'wrap' }); s.direction = direction; s.snake = [head];
    E.step(s); assert.deepEqual(s.snake[0], expected); assert.equal(s.status, 'playing');
  }
  const s = running({ mode: 'wrap' });
  s.snake = [{ x: 19, y: 9 }, { x: 0, y: 9 }, { x: 1, y: 9 }];
  assert.equal(E.step(s), 'lost'); assert.equal(s.reason, 'body');
});

test('can enter a vacating tail but cannot enter another body cell', () => {
  const shape = [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 2 }];
  const s = running(); s.snake = shape.map(p => ({ ...p })); s.direction = 'left';
  assert.equal(E.step(s), 'move'); assert.deepEqual(s.snake[0], { x: 1, y: 2 });
  const blocked = running(); blocked.snake = shape; blocked.direction = 'down';
  assert.equal(E.step(blocked), 'lost'); assert.equal(blocked.reason, 'body');
});

test('food selection terminates on a nearly full or completely full board', () => {
  const s = running(); s.size = 3; s.snake = [];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (x !== 2 || y !== 2) s.snake.push({ x, y });
  for (const random of [0, .4, .99, 1, NaN]) assert.deepEqual(E.foodFor(s, () => random), { x: 2, y: 2 });
  s.snake.push({ x: 2, y: 2 }); assert.equal(E.foodFor(s), null);
});

test('filling the last free cell wins and freezes the completed board', () => {
  const s = running(); s.size = 2; s.direction = 'right';
  s.snake = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]; s.food = { x: 1, y: 0 };
  assert.equal(E.step(s), 'won'); assert.equal(s.food, null); assert.equal(s.score, 10);
  assert.equal(s.snake.length, 4); assert.deepEqual(E.advance(s, 500), []);
});

test('pause clears buffered turns but preserves movement phase without catching up hidden time', () => {
  const s = running(); E.turn(s, 'up'); E.advance(s, 50); E.pause(s);
  assert.equal(s.queue.length, 0); assert.equal(s.elapsed, 50);
  const before = JSON.stringify(s.snake); E.advance(s, 60000); assert.equal(JSON.stringify(s.snake), before);
  E.start(s); E.advance(s, 94); assert.equal(JSON.stringify(s.snake), before);
  E.advance(s, 1); assert.equal(s.snake[0].x, 8); assert.equal(s.direction, 'right');
});

test('visual positions move between cells without altering collision coordinates', () => {
  const s = running(); E.advance(s, 145);
  assert.equal(s.snake[0].x, 8); assert.equal(E.pose(s).snake[0].x, 7);
  E.advance(s, 72.5);
  assert.equal(E.pose(s).snake[0].x, 7.5); assert.equal(E.pose(s).snake[1].x, 6.5);
  assert.equal(s.snake[0].x, 8);
  const frozen = E.pose(s); E.pause(s); E.advance(s, 5000);
  assert.deepEqual(E.pose(s), frozen); E.start(s); assert.deepEqual(E.pose(s), frozen);
  E.advance(s, 72.5); assert.equal(E.pose(s).snake[0].x, 8);
});

test('turns rotate smoothly, growth starts at the tail, and wrap takes the short path', () => {
  const s = running(); E.turn(s, 'up'); E.advance(s, 145); E.advance(s, 72.5);
  assert.equal(E.pose(s).snake[0].y, 9.5); assert.equal(E.pose(s).angle, -Math.PI / 4);
  const growth = running(); growth.food = { x: 8, y: 10 }; E.advance(growth, 145);
  assert.deepEqual(E.pose(growth).snake.slice(-2), [{ x: 4, y: 10 }, { x: 4, y: 10 }]);
  for (const [direction, from, expected] of [['right', 19, 19.5], ['left', 0, -.5]]) {
    const wrap = running({ mode: 'wrap' }); wrap.snake = [{ x: from, y: 4 }]; wrap.direction = direction;
    E.advance(wrap, 145); E.advance(wrap, 72.5);
    assert.equal(E.pose(wrap).snake[0].x, expected);
  }
});

test('speed increases every three apples and remains bounded in all difficulties', () => {
  for (const [difficulty, speed] of [['easy', 190], ['normal', 145], ['fast', 105]]) {
    const s = running({ difficulty }); assert.equal(E.interval(s), speed);
    s.eaten = 2; assert.equal(E.interval(s), speed);
    s.eaten = 3; assert.equal(E.interval(s), speed - 5);
    s.eaten = 390; assert.equal(E.interval(s), 65);
  }
});

test('frame timing is deterministic, bounded, and rejects invalid deltas', () => {
  const a = running(), b = running();
  for (let i = 0; i < 10; i++) E.advance(a, 29);
  E.advance(b, 145); E.advance(b, 145); assert.deepEqual(a, b);
  for (const value of [-1, 0, Infinity, NaN]) assert.deepEqual(E.advance(a, value), []);
  const c = running(); E.advance(c, 60000); assert.equal(c.snake[0].x, 8);
  assert.equal(E.create({ difficulty: '__proto__', mode: 'invalid' }).difficulty, 'normal');
});

test('seeded random play preserves grid bounds, unique segments, and unoccupied food', () => {
  let seed = 1234567;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let round = 0; round < 30; round++) {
    const s = running({ mode: round % 2 ? 'wrap' : 'classic' });
    for (let tick = 0; tick < 500 && s.status === 'playing'; tick++) {
      if (random() < .4) E.turn(s, ['up', 'down', 'left', 'right'][Math.floor(random() * 4)]);
      E.step(s, random);
      const cells = new Set(s.snake.map(p => p.x + ',' + p.y));
      assert.equal(cells.size, s.snake.length);
      assert.ok(s.snake.every(p => p.x >= 0 && p.x < 20 && p.y >= 0 && p.y < 20));
      if (s.food) assert.ok(!cells.has(s.food.x + ',' + s.food.y));
      assert.equal(s.snake.length, 4 + s.eaten); assert.equal(s.score, s.eaten * 10);
    }
  }
});
