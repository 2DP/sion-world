/* Snake rules shared by the browser and dependency-free Node tests. */
(function (root) {
  'use strict';
  const SIZE = 20;
  const DIRECTIONS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const SPEEDS = { easy: 190, normal: 145, fast: 105 };
  const same = (a, b) => a.x === b.x && a.y === b.y;

  function foodFor(s, random = Math.random) {
    const occupied = new Set(s.snake.map(p => p.y * s.size + p.x));
    const free = [];
    for (let y = 0; y < s.size; y++) for (let x = 0; x < s.size; x++) {
      if (!occupied.has(y * s.size + x)) free.push({ x, y });
    }
    if (!free.length) return null;
    const value = Number(random());
    const index = Math.floor(Math.max(0, Math.min(0.999999999, Number.isFinite(value) ? value : 0)) * free.length);
    return free[index];
  }

  function create(options = {}) {
    const difficulty = Object.hasOwn(SPEEDS, options.difficulty) ? options.difficulty : 'normal';
    return {
      size: SIZE, mode: options.mode === 'wrap' ? 'wrap' : 'classic', difficulty,
      status: 'ready', reason: '', direction: 'right', queue: [], elapsed: 0, eaten: 0, score: 0,
      snake: [{ x: 7, y: 10 }, { x: 6, y: 10 }, { x: 5, y: 10 }, { x: 4, y: 10 }],
      food: { x: 12, y: 10 }
    };
  }

  function interval(s) { return Math.max(65, SPEEDS[s.difficulty] - Math.floor(s.eaten / 3) * 5); }
  function start(s) {
    if (s.status !== 'ready' && s.status !== 'paused') return;
    s.status = 'playing'; s.elapsed = 0; s.queue = [];
  }
  function pause(s) {
    if (s.status !== 'playing') return;
    s.status = 'paused'; s.elapsed = 0; s.queue = [];
  }
  function turn(s, direction) {
    if (s.status !== 'playing' || !Object.hasOwn(DIRECTIONS, direction) || s.queue.length >= 2) return false;
    const previous = s.queue.at(-1) || s.direction;
    const a = DIRECTIONS[previous], b = DIRECTIONS[direction];
    if (previous === direction || (a.x + b.x === 0 && a.y + b.y === 0)) return false;
    s.queue.push(direction);
    return true;
  }
  function step(s, random = Math.random) {
    if (s.status !== 'playing') return null;
    s.direction = s.queue.shift() || s.direction;
    const d = DIRECTIONS[s.direction];
    const head = { x: s.snake[0].x + d.x, y: s.snake[0].y + d.y };
    if (s.mode === 'wrap') {
      head.x = (head.x + s.size) % s.size; head.y = (head.y + s.size) % s.size;
    } else if (head.x < 0 || head.y < 0 || head.x >= s.size || head.y >= s.size) {
      s.status = 'lost'; s.reason = 'wall'; s.queue = []; return 'lost';
    }
    const eating = s.food !== null && same(head, s.food);
    // The tail vacates its cell on a non-growing move and is safe to enter.
    const body = eating ? s.snake : s.snake.slice(0, -1);
    if (body.some(p => same(head, p))) {
      s.status = 'lost'; s.reason = 'body'; s.queue = []; return 'lost';
    }
    s.snake.unshift(head);
    if (!eating) { s.snake.pop(); return 'move'; }
    s.eaten++; s.score += 10;
    s.food = foodFor(s, random);
    if (!s.food) { s.status = 'won'; s.queue = []; return 'won'; }
    return 'eat';
  }
  function advance(s, milliseconds, random = Math.random) {
    if (s.status !== 'playing' || !Number.isFinite(milliseconds) || milliseconds <= 0) return [];
    // A stalled frame must not send the snake racing through unseen moves.
    s.elapsed += Math.min(milliseconds, 250);
    const events = [];
    while (s.status === 'playing' && s.elapsed >= interval(s)) {
      s.elapsed -= interval(s);
      events.push(step(s, random));
    }
    return events;
  }
  const api = { SIZE, DIRECTIONS, create, foodFor, interval, start, pause, turn, step, advance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SnakeEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
