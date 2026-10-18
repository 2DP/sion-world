/* Deterministic, DOM-free Bubble Pang rules. */
(function (root) {
  'use strict';
  const W = 960, H = 540, FLOOR = 492;
  const STAGES = [
    ['솜사탕 첫걸음', [1]], ['둘이서 통통', [1, 1]], ['커다란 선물', [2]],
    ['별빛 교차로', [2, 0, 0]], ['민트빛 오후', [1, 1, 1]], ['구름 위 소동', [2, 1, 1]],
    ['무지개 파도', [2, 2]], ['반짝이는 소나기', [1, 1, 1, 1, 0, 0]],
    ['달빛 대행진', [2, 2, 1]], ['버블 페스티벌', [2, 2, 2]],
    ['새벽빛 산책', [2, 2, 1, 0]], ['꽃잎 징검다리', [2, 1, 1, 1, 1]],
    ['구름 기차', [2, 2, 1, 1]], ['별사탕 소나기', [2, 1, 1, 1, 1, 0]],
    ['노을빛 무도회', [2, 2, 2, 0]], ['초승달 정원', [2, 2, 1, 1, 0]],
    ['은하수 물결', [2, 2, 2, 1]], ['오로라 놀이터', [2, 2, 1, 1, 1, 0]],
    ['별똥별 행진', [2, 2, 2, 1, 0]], ['하늘빛 축제', [2, 2, 2, 2]],
    ['달무리 쉼터', [2, 2, 1, 1, 1, 1]], ['혜성의 꼬리', [2, 2, 2, 1, 1]],
    ['반짝이는 성운', [2, 2, 2, 2, 0]], ['별빛 회오리', [2, 2, 2, 1, 1, 0]],
    ['우주 꽃밭', [2, 2, 2, 2, 1]], ['달빛 퍼레이드', [2, 2, 2, 1, 1, 1]],
    ['은빛 별자리', [2, 2, 2, 2, 1, 0]], ['무지개 은하', [2, 2, 2, 2, 1, 1]],
    ['마지막 별의 문', [2, 2, 2, 2, 2, 0]], ['서른 번째 별빛', [2, 2, 2, 2, 2, 1, 1]]
  ];
  const RADII = [15, 29, 49], SPEEDS = [164, 128, 98], BOUNCE = [285, 400, 525];
  const EASY_BUBBLES = { 4: [2, 0], 8: [1, 1, 1, 0, 0] };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function bubble(size, x, y, direction, scale) {
    const r = RADII[size];
    return { size, r, x: clamp(x, r, W - r), y: clamp(y, r + 12, FLOOR - r), vx: direction * SPEEDS[size] * scale, vy: -BOUNCE[size] * scale };
  }
  function create(stage = 1, difficulty = 'easy') {
    stage = clamp(Math.floor(Number(stage) || 1), 1, STAGES.length);
    difficulty = difficulty === 'normal' ? 'normal' : 'easy';
    const maxLives = stage >= 8 ? 7 : stage >= 5 ? 6 : 5;
    const scale = (difficulty === 'easy' ? .8 : 1) * (stage === 1 ? .85 : 1);
    let sizes = STAGES[stage - 1][1];
    // New easy stages remove one large bubble when the opening is crowded.
    if (difficulty === 'easy') sizes = EASY_BUBBLES[stage] || (stage > 10 && sizes.length >= 5 ? sizes.slice(1) : sizes);
    return { stage, difficulty, scale, status: 'ready', time: difficulty === 'easy' ? 150 : 110,
      lives: maxLives, maxLives, score: 0, hits: 0, player: { x: W / 2, invincible: 1.5 },
      bubbles: sizes.map((size, i, all) => bubble(size, 90 + i * 780 / Math.max(1, all.length - 1), 100 + i % 2 * 60, i % 2 ? -1 : 1, scale)),
      shots: [], items: [], weapon: 'basic', weaponTime: 0, cooldown: 0, events: [] };
  }
  function start(s) { if (s.status === 'ready' || s.status === 'paused') s.status = 'playing'; }
  function pause(s) { if (s.status === 'playing') s.status = 'paused'; }
  function hit(s, b) {
    s.bubbles.splice(s.bubbles.indexOf(b), 1);
    s.score += [200, 150, 100][b.size]; s.hits++;
    s.events.push('pop');
    if (b.size > 0) for (const direction of [-1, 1]) s.bubbles.push(bubble(b.size - 1, b.x + direction * 8, b.y, direction, s.scale));
    if (s.hits % 4 === 0) s.items.push({ x: b.x, y: b.y, age: 0, type: s.hits % 8 === 0 ? 'sticky' : 'double' });
  }
  function finish(s, status) {
    if (s.status !== 'playing') return;
    s.status = status;
    if (status === 'won') s.score += Math.ceil(s.time) * 10 + s.lives * 500;
    s.events.push(status);
  }
  function substep(s, input, dt) {
    s.time = Math.max(0, s.time - dt);
    s.player.invincible = Math.max(0, s.player.invincible - dt);
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.weaponTime = Math.max(0, s.weaponTime - dt);
    if (!s.weaponTime) s.weapon = 'basic';
    s.player.x = clamp(s.player.x + ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 290 * dt, 20, W - 20);
    if (input.fire && !s.cooldown) {
      const limit = s.weapon === 'basic' ? 1 : 2;
      if (s.weapon === 'sticky' && s.shots.length >= limit) {
        const oldest = s.shots.filter(shot => shot.sticky && shot.top === 12).sort((a, b) => b.hold - a.hold)[0];
        if (oldest) s.shots.splice(s.shots.indexOf(oldest), 1);
      }
      if (s.shots.length < limit) {
        s.shots.push({ x: s.player.x, top: FLOOR - 33, hold: 0, sticky: s.weapon === 'sticky' });
        s.cooldown = .25; s.events.push('fire');
      }
    }
    for (const b of s.bubbles) {
      b.vy += 620 * s.scale * s.scale * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y > FLOOR - b.r) { b.y = FLOOR - b.r; b.vy = -BOUNCE[b.size] * s.scale; }
      if (b.y < b.r + 12) { b.y = b.r + 12; b.vy = Math.abs(b.vy); }
    }
    for (const shot of [...s.shots]) {
      shot.top = Math.max(12, shot.top - 650 * dt);
      // Lowest intersection is the first point reached by an upward-growing line.
      const candidates = s.bubbles.filter(b => Math.abs(b.x - shot.x) <= b.r + 3 && b.y + Math.sqrt(Math.max(0, (b.r + 3) ** 2 - (b.x - shot.x) ** 2)) >= shot.top && b.y - b.r <= FLOOR);
      candidates.sort((a, b) => (b.y + Math.sqrt(Math.max(0, (b.r + 3) ** 2 - (b.x - shot.x) ** 2))) - (a.y + Math.sqrt(Math.max(0, (a.r + 3) ** 2 - (a.x - shot.x) ** 2))));
      if (candidates.length) { hit(s, candidates[0]); s.shots.splice(s.shots.indexOf(shot), 1); }
      else if (shot.top === 12) {
        shot.hold += dt;
        if (!shot.sticky || shot.hold >= 2) s.shots.splice(s.shots.indexOf(shot), 1);
      }
    }
    if (!s.bubbles.length) { finish(s, 'won'); return; }
    if (!s.player.invincible && s.bubbles.some(b => {
      const nearX = clamp(b.x, s.player.x - 13, s.player.x + 13), nearY = clamp(b.y, FLOOR - 35, FLOOR - 3);
      return (b.x - nearX) ** 2 + (b.y - nearY) ** 2 < b.r ** 2;
    })) {
      s.lives--; s.player.invincible = 2; s.shots = []; s.events.push('hurt');
      for (const b of s.bubbles) if (Math.abs(b.x - s.player.x) < b.r + 65) { b.y = Math.min(b.y, FLOOR - 100 - b.r); b.vy = -BOUNCE[b.size] * s.scale; }
      if (!s.lives) { finish(s, 'lost'); return; }
    }
    for (const item of [...s.items]) {
      item.age += dt; item.y = Math.min(FLOOR - 14, item.y + 125 * dt);
      if (Math.abs(item.x - s.player.x) < 31 && item.y > FLOOR - 50) {
        s.weapon = item.type; s.weaponTime = 10; s.events.push(item.type);
        s.items.splice(s.items.indexOf(item), 1);
      } else if (item.age >= 8) s.items.splice(s.items.indexOf(item), 1);
    }
    if (!s.time) finish(s, 'lost');
  }
  function step(s, input = {}, seconds = 1 / 60) {
    s.events = [];
    if (s.status !== 'playing') return;
    let remaining = clamp(Number(seconds) || 0, 0, .1);
    while (remaining > 1e-8 && s.status === 'playing') { const dt = Math.min(remaining, 1 / 240); substep(s, input, dt); remaining -= dt; }
  }
  function cleanSave(raw) {
    const out = { difficulty: 'easy', muted: false, easy: { unlocked: 1, scores: [] }, normal: { unlocked: 1, scores: [] } };
    if (!raw || typeof raw !== 'object') return out;
    out.difficulty = raw.difficulty === 'normal' ? 'normal' : 'easy'; out.muted = raw.muted === true;
    for (const mode of ['easy', 'normal']) {
      const data = raw[mode] || {};
      out[mode].unlocked = clamp(Math.floor(Number(data.unlocked) || 1), 1, STAGES.length);
      out[mode].scores = Array.from({ length: STAGES.length }, (_, i) => clamp(Math.floor(Number(data.scores?.[i]) || 0), 0, 1000000));
      // v1 saves capped progress at 10, even after completing the old finale.
      if (out[mode].unlocked === 10 && out[mode].scores[9] > 0) out[mode].unlocked = 11;
    }
    return out;
  }
  function record(save, s) {
    if (s.status !== 'won') return;
    const data = save[s.difficulty]; data.unlocked = Math.max(data.unlocked, Math.min(STAGES.length, s.stage + 1));
    data.scores[s.stage - 1] = Math.max(data.scores[s.stage - 1] || 0, s.score);
  }
  const api = { W, H, FLOOR, STAGES, RADII, create, start, pause, step, cleanSave, record };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PangEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
