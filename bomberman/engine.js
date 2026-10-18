/* Shared, deterministic rules. Works in a browser and in Node tests. */
(function (root) {
  'use strict';
  const DIRS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
  const STAGES = [
    ['첫 번째 불꽃',13,11,1,1], ['함께 걷는 길',15,11,1,1],
    ['두 번째 라이벌',15,13,2,1], ['넓어진 골목',17,13,2,1],
    ['세 갈래 작전',17,15,3,1], ['블록 정원',19,15,3,1],
    ['지원군 도착',21,17,4,2], ['팀워크의 시간',21,19,4,2],
    ['다섯 라이벌',23,19,5,2], ['커다란 놀이터',25,21,5,2],
    ['마지막 작전',27,21,6,2], ['불꽃 팀 챔피언',29,23,6,2]
  ].map(([name,width,height,enemies,allies], i) => ({ name,width,height,enemies,allies,stormStart:120 + Math.floor(i / 2) * 15 }));
  const COLORS = ['#247f77', '#e57460', '#9875bc', '#d69a37', '#538fcb', '#c66f9e'];
  const ITEMS = Object.freeze({
    bomb: { name: '폭탄 추가', weight: 25 }, fire: { name: '범위 강화', weight: 25 },
    speed: { name: '이동 강화', weight: 15 }, shield: { name: '1회용 실드', weight: 25 },
    superfire: { name: '슈퍼 불꽃', weight: 10 }
  });
  const MAX_RANGE = 6, SHIELD_GRACE = .8;
  const CPU_LEVELS = STAGES.map((_, i) => {
    const t = i / (STAGES.length - 1);
    return { activity: .35 + .65 * t, itemInterest: .1 + .9 * t, attack: .2 + .8 * t, cooldown: 3.2 - 2.35 * t, delay: .55 * (1 - t) };
  });
  const ALLY_LEVEL = { activity: .8, itemInterest: .8, attack: .7, cooldown: 1.5, delay: .15 };
  const cpuLevel = (s, a) => a && a.id && a.team === 0 ? ALLY_LEVEL : CPU_LEVELS[s.stage - 1];
  const opponents = (a, b) => a.team !== b.team;
  const teamCounts = s => ({ ours: s.actors.filter(a => a.alive && a.team === 0).length, enemies: s.actors.filter(a => a.alive && a.team === 1).length });
  const PERSONALITIES = { attacker: '공격형', collector: '수집형', trapper: '함정형' };
  // The outer floor turns dangerous, rather than adding walls that split the maze.
  function stormDue(s, x, y) {
    const depth = Math.min(x, y, s.width - 1 - x, s.height - 1 - y);
    return depth > 0 && depth <= Math.floor(Math.min(s.width, s.height) / 2) - 2 ? (s.stormStart || 120) + (depth - 1) * 12 : Infinity;
  }
  function storm(s) {
    const max = Math.floor(Math.min(s.width, s.height) / 2) - 2;
    const ring = s.time + 1e-8 < (s.stormStart || 120) ? 0 : Math.min(max, 1 + Math.floor((s.time - (s.stormStart || 120) + 1e-8) / 12));
    const due = ring < max ? (s.stormStart || 120) + ring * 12 : Infinity;
    return { ring, due, warning: due - s.time <= 8 };
  }
  function randomItem(rng) {
    let roll = rng() * 100;
    for (const [type, item] of Object.entries(ITEMS)) { roll -= item.weight; if (roll < 0) return type; }
    return 'superfire';
  }
  const key = (x, y) => x + ',' + y;
  const index = (s, x, y) => y * s.width + x;
  const wantsItem = (s, a, i) => !a.id || ((i * 37 + a.id * 17 + (s.seed % 100)) % 100) < Math.round(cpuLevel(s, a).itemInterest * 100);
  const inside = (s, x, y) => x >= 0 && y >= 0 && x < s.width && y < s.height;
  const tile = (s, x, y) => inside(s, x, y) ? s.tiles[index(s, x, y)] : 1;
  function random(seed) {
    let n = seed >>> 0;
    return () => { n += 0x6D2B79F5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function create(options = {}) {
    const stage = Math.max(1, Math.min(STAGES.length, Math.floor(options.stage || 1)));
    const cfg = STAGES[stage - 1];
    const seed = options.seed === undefined ? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 : options.seed >>> 0;
    const rng = random(seed);
    const s = { ...cfg, stage, seed, rng, difficulty: ['easy', 'normal', 'hard'].includes(options.difficulty) ? options.difficulty : 'easy',
      time: 0, tick: 0, settling: false, phase: options.phase || 'ready', countdown: 3,
      tiles: Array(cfg.width * cfg.height).fill(0), hidden: {}, items: {}, pending: {},
      bombs: [], flames: [], actors: [], events: [], nextBombId: 0 };
    const midX = Math.floor(s.width / 2) | 1, midY = Math.floor(s.height / 2) | 1;
    const enemySpawns = [[s.width-2,s.height-2],[s.width-2,1],[s.width-2,midY],[midX,1],[midX,s.height-2],[midX,midY]];
    const points = [[1,1,0], ...enemySpawns.slice(0,cfg.enemies).map(p => [...p,1]), ...[[1,s.height-2],[1,midY]].slice(0,cfg.allies).map(p => [...p,0])];
    const reserved = new Set();
    for (const [x, y] of points) {
      const cx = Math.max(2, Math.min(s.width - 3, x));
      const cy = Math.max(2, Math.min(s.height - 3, y));
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        reserved.add(key(cx + dx, cy + dy));
        reserved.add(key(s.width - 1 - cx - dx, s.height - 1 - cy - dy));
      }
    }
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) {
      if (!x || !y || x === s.width - 1 || y === s.height - 1 || (!(x % 2) && !(y % 2))) s.tiles[index(s, x, y)] = 1;
    }
    for (let i = 0; i < s.tiles.length; i++) {
      const j = s.tiles.length - 1 - i, x = i % s.width, y = Math.floor(i / s.width);
      if (i > j || s.tiles[i] || reserved.has(key(x, y))) continue;
      if (rng() < .55) {
        s.tiles[i] = s.tiles[j] = 2;
        if (rng() < .45) { const type = randomItem(rng); s.hidden[i] = s.hidden[j] = type; }
      }
    }
    points.forEach(([x, y, team], id) => s.actors.push({
      id, team, x, y, prevX: x, prevY: y, movedAt: -1, dir: 'down', alive: true,
      color: team === 0 ? (id ? '#369ca0' : COLORS[0]) : COLORS[1 + (id - 1) % (COLORS.length - 1)], name: id === 0 ? '나' : team === 0 ? '아군 ' + (id - cfg.enemies) : '적 ' + id, capacity: 1, range: 2, speed: 4,
      shield: 0, protectedUntil: 0, kills: 0, death: null,
      personality: ['attacker', 'collector', 'trapper'][(id - 1 + 3) % 3],
      nextMove: 0, blocks: 0, collected: 0, memory: [], ai: { next: 0, dir: null, nextBomb: 0 }
    }));
    if (stage > 1 && options.bonus === 'shield') s.actors[0].shield = 1;
    if (stage > 1 && options.bonus === 'bomb') s.actors[0].capacity = 2;
    return s;
  }
  const bombAt = (s, x, y) => s.bombs.find(b => b.x === x && b.y === y);
  const burning = (s, x, y) => s.flames.some(f => f.until > s.time + 1e-8 && f.cells.has(index(s, x, y)));
  const activeBombs = (s, a) => s.bombs.filter(b => b.owner === a.id).length;
  function canWalk(s, a, x, y) {
    if (tile(s, x, y)) return false;
    const b = bombAt(s, x, y);
    return !b || (x === a.x && y === a.y && b.grace.has(a.id));
  }
  function move(s, a, dir) {
    if (!a.alive || !DIRS[dir] || s.time + 1e-8 < a.nextMove) return false;
    const [dx, dy] = DIRS[dir], x = a.x + dx, y = a.y + dy;
    a.dir = dir; a.nextMove = s.time + 1 / a.speed;
    if (!canWalk(s, a, x, y)) return false;
    a.prevX = a.x; a.prevY = a.y; a.x = x; a.y = y; a.movedAt = s.time;
    for (const b of s.bombs) if (b.x !== x || b.y !== y) b.grace.delete(a.id);
    a.memory.push(index(s, x, y)); if (a.memory.length > 12) a.memory.shift();
    return true;
  }
  function place(s, a) {
    if (s.settling || !a.alive || tile(s, a.x, a.y) || bombAt(s, a.x, a.y) || burning(s, a.x, a.y) || activeBombs(s, a) >= a.capacity) return false;
    const b = { id: s.nextBombId++, x: a.x, y: a.y, owner: a.id, range: a.range, at: s.time, due: s.time + 2,
      grace: new Set(s.actors.filter(p => p.alive && p.x === a.x && p.y === a.y).map(p => p.id)) };
    s.bombs.push(b); s.events.push({ type: 'place', x: a.x, y: a.y, id: a.id }); return true;
  }
  function blast(s, b, bombs = s.bombs) {
    const cells = [index(s, b.x, b.y)];
    for (const [dx, dy] of Object.values(DIRS)) for (let d = 1; d <= b.range; d++) {
      const x = b.x + dx * d, y = b.y + dy * d, t = tile(s, x, y);
      if (t === 1) break;
      cells.push(index(s, x, y));
      if (t === 2 || bombs.some(other => other.x === x && other.y === y)) break;
    }
    return cells;
  }
  function explode(s) {
    const snapshot = s.bombs.slice(), queued = snapshot.filter(b => b.due <= s.time + 1e-8), done = new Set(), hits = new Map();
    for (let n = 0; n < queued.length; n++) {
      const b = queued[n]; if (done.has(b.id)) continue;
      done.add(b.id);
      const cells = new Set(blast(s, b, snapshot));
      for (const other of snapshot) if (!done.has(other.id) && cells.has(index(s, other.x, other.y))) queued.push(other);
      s.flames.push({ cells, until: s.time + .4, owner: b.owner, bombId: b.id, team: s.actors.find(a => a.id === b.owner)?.team });
      s.events.push({ type: 'explode', x: b.x, y: b.y });
      for (const i of cells) {
        delete s.items[i];
        if (s.tiles[i] === 2) { if (!hits.has(i)) hits.set(i, new Set()); hits.get(i).add(b.owner); }
      }
    }
    for (const [i, owners] of hits) {
      s.tiles[i] = 0;
      if (s.hidden[i]) { s.pending[i] = s.hidden[i]; delete s.hidden[i]; }
      for (const owner of owners) { const a = s.actors.find(p => p.id === owner); if (a) a.blocks++; }
      s.events.push({ type: 'block', x: i % s.width, y: Math.floor(i / s.width) });
    }
    s.bombs = snapshot.filter(b => !done.has(b.id));
  }
  function damage(s) {
    for (const a of s.actors) if (a.alive) {
      const danger = stormDue(s, a.x, a.y) <= s.time + 1e-8;
      const hits = s.flames.filter(f => f.until > s.time + 1e-8 && f.cells.has(index(s, a.x, a.y)) && (f.owner === a.id || f.team === undefined || f.team !== a.team));
      if (!danger && (!hits.length || s.time + 1e-8 < a.protectedUntil)) continue;
      if (!danger && a.shield > 0) {
        a.shield = 0; a.protectedUntil = s.time + SHIELD_GRACE;
        s.events.push({ type: 'shield', x: a.x, y: a.y, id: a.id });
        continue;
      }
      const hit = hits.find(f => Number.isInteger(f.owner) && f.owner !== a.id) || hits[0];
      const killer = !danger && hit ? s.actors.find(p => p.id === hit.owner && p.id !== a.id) : null;
      if (killer) killer.kills++;
      a.death = { at: s.time, cause: danger ? 'storm' : hit?.owner === a.id ? 'self' : 'bomb', killerId: killer?.id ?? null,
        cells: danger ? [index(s, a.x, a.y)] : [...new Set(hits.flatMap(f => [...f.cells]))], x: a.x, y: a.y };
      a.alive = false; s.events.push({ type: 'death', x: a.x, y: a.y, color: a.color, id: a.id, killerId: killer?.id ?? null });
    }
  }
  function step(s, input = {}, dt = 1 / 60, controller) {
    s.events = [];
    if (s.phase === 'countdown') { s.countdown = Math.max(0, s.countdown - dt); if (s.countdown < 1e-8) { s.phase = 'playing'; s.events.push({ type: 'start' }); } return; }
    if (s.phase !== 'playing') return;
    s.time += dt; s.tick++;
    s.flames = s.flames.filter(f => f.until > s.time + 1e-8);
    explode(s); damage(s);
    const before = teamCounts(s);
    if (!before.ours || !before.enemies) s.settling = true;
    const order = s.tick % 2 ? s.actors : s.actors.slice().reverse(), intents = new Map();
    for (const a of order) if (a.alive) {
      const command = input[a.id] || (a.id && controller ? controller(s, a) : {}) || {};
      intents.set(a.id, command); if (command.dir) move(s, a, command.dir);
    }
    damage(s);
    const after = teamCounts(s);
    if (!after.ours || !after.enemies) s.settling = true;
    for (const i of Object.keys(s.pending)) if (!burning(s, Number(i) % s.width, Math.floor(Number(i) / s.width))) { s.items[i] = s.pending[i]; delete s.pending[i]; }
    for (const a of order) if (a.alive) {
      const i = index(s, a.x, a.y), item = s.items[i];
      // Low-stage CPUs leave most items on the floor, even when passing over them.
      const interested = wantsItem(s, a, i);
      if (item && interested) {
        let upgraded = false;
        if (item === 'bomb') upgraded = a.capacity < 3;
        if (item === 'fire' || item === 'superfire') upgraded = a.range < MAX_RANGE;
        if (item === 'speed') upgraded = a.speed < 6;
        if (item === 'shield') upgraded = a.shield < 1;
        if (item === 'bomb') a.capacity = Math.min(3, a.capacity + 1);
        if (item === 'fire' || item === 'superfire') a.range = Math.min(MAX_RANGE, a.range + (item === 'superfire' ? 2 : 1));
        if (item === 'speed') a.speed = Math.min(6, a.speed + 1);
        if (item === 'shield') a.shield = 1;
        a.collected++; delete s.items[i]; s.events.push({ type: 'item', id: a.id, item, upgraded, x: a.x, y: a.y });
      }
      if (intents.get(a.id)?.bomb) place(s, a);
    }
    const teams = teamCounts(s);
    if (!teams.ours || !teams.enemies) s.settling = true;
    if (s.settling && !s.bombs.length && !s.flames.length) {
      if (!teams.ours) s.phase = teams.enemies ? 'defeat' : 'draw';
      else if (!teams.enemies) s.phase = s.stage === STAGES.length ? 'complete' : 'stage-clear';
    }
    if (s.phase !== 'playing') s.events.push({ type: 'result', result: s.phase });
  }
  function pause(s) { if (s.phase === 'playing' || s.phase === 'countdown') { s.resumePhase = s.phase; s.phase = 'paused'; return true; } return false; }
  function resume(s) { if (s.phase === 'paused') { s.phase = s.resumePhase; return true; } return false; }
  const api = { DIRS, STAGES, COLORS, ITEMS, MAX_RANGE, SHIELD_GRACE, CPU_LEVELS, cpuLevel, opponents, teamCounts, PERSONALITIES, wantsItem, stormDue, storm, create, random, key, index, tile, bombAt, burning, activeBombs, canWalk, move, place, blast, step, pause, resume };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BlockBomber = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
