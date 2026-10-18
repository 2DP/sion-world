/* CPU opponents use only public board information and the shared actions. */
(function (root) {
  'use strict';
  const E = typeof module !== 'undefined' && module.exports ? require('./engine.js') : root.BlockBomber;
  const cadence = { easy: .4, normal: .25, hard: .12 };
  function forecast(s, extra) {
    const bombs = extra ? [...s.bombs, extra] : s.bombs.slice();
    const due = new Map(bombs.map(b => [b.id, b.due]));
    const hazards = new Map();
    const add = (i, from, to) => { if (!hazards.has(i)) hazards.set(i, []); hazards.get(i).push([from, to]); };
    for (const f of s.flames) for (const i of f.cells) add(i, s.time, f.until);
    // Simulate chronological batches: an earlier blast may remove a block
    // and expose a much longer lane for a later bomb. Same-time blasts all
    // see the same pre-destruction terrain, matching the engine.
    const sim = { ...s, tiles: s.tiles.slice() };
    let remaining = bombs.slice();
    while (remaining.length) {
      const time = Math.min(...remaining.map(b => b.due));
      const queue = remaining.filter(b => Math.abs(b.due - time) < 1e-8), done = new Set(), destroyed = new Set();
      for (let n = 0; n < queue.length; n++) {
        const b = queue[n]; if (done.has(b.id)) continue;
        done.add(b.id); due.set(b.id, time);
        const cells = new Set(E.blast(sim, b, remaining));
        for (const i of cells) { add(i, time, time + .4); if (sim.tiles[i] === 2) destroyed.add(i); }
        for (const other of remaining) if (!done.has(other.id) && cells.has(E.index(s, other.x, other.y))) queue.push(other);
      }
      for (const i of destroyed) sim.tiles[i] = 0;
      remaining = remaining.filter(b => !done.has(b.id));
    }
    return { bombs, due, hazards, until: Math.max(s.time + .6, ...bombs.map(b => due.get(b.id) + .5), ...s.flames.map(f => f.until + .1)) };
  }
  function safe(s, f, x, y, from, to) {
    return !E.tile(s, x, y) && !(f.hazards.get(E.index(s, x, y)) || []).some(([a, b]) => from < b - 1e-8 && to >= a - 1e-8);
  }
  function walkAt(s, f, x, y, t, current) {
    if (E.tile(s, x, y)) return false;
    return !f.bombs.some(b => b.x === x && b.y === y && f.due.get(b.id) > t && !(current && current.x === x && current.y === y));
  }
  function escape(s, a, f) {
    const interval = 1 / a.speed, firstTime = Math.max(s.time + 1 / 60, a.nextMove);
    const queue = [{ x: a.x, y: a.y, t: s.time, depth: 0, dir: null }], seen = new Set();
    for (let n = 0; n < queue.length && n < 7000; n++) {
      const p = queue[n];
      if (safe(s, f, p.x, p.y, p.t, f.until)) return { safe: true, dir: p.dir, steps: p.depth };
      if (p.depth > 18) continue;
      const t = firstTime + p.depth * interval;
      if (!safe(s, f, p.x, p.y, p.t, t)) continue;
      for (const [dir, [dx, dy]] of [...Object.entries(E.DIRS), [null, [0, 0]]]) {
        const x = p.x + dx, y = p.y + dy, k = x + ',' + y + ',' + (p.depth + 1);
        if (seen.has(k) || !walkAt(s, f, x, y, t, p) || !safe(s, f, x, y, t, t + .02)) continue;
        seen.add(k); queue.push({ x, y, t, depth: p.depth + 1, dir: p.depth ? p.dir : dir });
      }
    }
    return { safe: false, dir: null, steps: 0 };
  }
  function useful(a, item) {
    if (item === 'bomb') return a.capacity < 3;
    if (item === 'fire' || item === 'superfire') return a.range < E.MAX_RANGE;
    if (item === 'shield') return a.shield < 1;
    return item === 'speed' && a.speed < 6;
  }
  function choose(s, a, f) {
    const rivals = s.actors.filter(p => p.alive && p.id !== a.id);
    const queue = [{ x: a.x, y: a.y, depth: 0, dir: null }], seen = new Set([E.index(s, a.x, a.y)]);
    let best = -Infinity, direction = null;
    for (let n = 0; n < queue.length; n++) {
      const p = queue[n], i = E.index(s, p.x, p.y);
      if (p.depth) {
        const near = Math.min(...rivals.map(r => Math.abs(r.x - p.x) + Math.abs(r.y - p.y)));
        const crates = Object.values(E.DIRS).filter(([dx, dy]) => E.tile(s, p.x + dx, p.y + dy) === 2).length;
        const exits = Object.values(E.DIRS).filter(([dx, dy]) => !E.tile(s, p.x + dx, p.y + dy)).length;
        const item = s.items[i], repeats = a.memory.filter(v => v === i).length;
        const score = (useful(a, item) ? 14 : 0) + crates * 2.6 - near * .65 - p.depth * .5 - repeats * .8 + exits * .2 + s.rng() * .25;
        if (score > best) { best = score; direction = p.dir; }
      }
      if (p.depth >= 14) continue;
      for (const [dir, [dx, dy]] of Object.entries(E.DIRS)) {
        const x = p.x + dx, y = p.y + dy, id = E.index(s, x, y), arrival = Math.max(s.time + 1 / 60, a.nextMove) + p.depth / a.speed;
        if (seen.has(id) || !walkAt(s, f, x, y, arrival) || !safe(s, f, x, y, s.time, Math.max(f.until, arrival + 1 / a.speed))) continue;
        seen.add(id); queue.push({ x, y, depth: p.depth + 1, dir: p.dir || dir });
      }
    }
    return direction;
  }
  function input(s, a) {
    if (s.time + 1e-8 < a.ai.next) {
      // Execute an already chosen escape route at movement speed, including
      // turns; a slower strategic decision interval must not repeat one turn.
      if (s.time + 1e-8 >= a.nextMove && a.ai.dir) {
        const f = forecast(s);
        if (a.ai.evading) a.ai.dir = escape(s, a, f).dir;
        else {
          const [dx, dy] = E.DIRS[a.ai.dir];
          if (!safe(s, f, a.x + dx, a.y + dy, s.time, Math.max(f.until, s.time + 1 / a.speed))) a.ai.dir = null;
        }
      }
      return { dir: a.ai.dir };
    }
    a.ai.next = s.time + cadence[s.difficulty];
    a.ai.evading = false;
    const f = forecast(s), retreat = escape(s, a, f);
    if (!safe(s, f, a.x, a.y, s.time, f.until)) {
      a.ai.evading = true; a.ai.dir = retreat.dir; return { dir: retreat.dir };
    }
    if (s.time >= a.ai.nextBomb && !E.bombAt(s, a.x, a.y) && E.activeBombs(s, a) < a.capacity) {
      const test = { id: -1, x: a.x, y: a.y, range: a.range, due: s.time + 2 }, cells = E.blast(s, test);
      const crates = cells.some(i => s.tiles[i] === 2);
      const attack = s.actors.some(r => r.id !== a.id && r.alive && (cells.includes(E.index(s, r.x, r.y)) ||
        (s.difficulty === 'hard' && E.DIRS[r.dir] && cells.includes(E.index(s, r.x + E.DIRS[r.dir][0], r.y + E.DIRS[r.dir][1])))));
      if ((crates || attack) && (s.difficulty !== 'easy' || crates || s.rng() < .55)) {
        // Account for the full reaction delay after planting, not just instantaneous movement.
        const delayed = { ...a, nextMove: Math.max(a.nextMove, s.time + cadence[s.difficulty] + 1 / 60) };
        if (escape(s, delayed, forecast(s, test)).safe) {
          a.ai.dir = null; a.ai.nextBomb = s.time + .85; return { bomb: true };
        }
      }
    }
    a.ai.dir = choose(s, a, f); return { dir: a.ai.dir };
  }
  const api = { input, forecast, safe, escape };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BlockBomberAI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
