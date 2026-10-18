(() => {
  'use strict';
  const E = window.PangEngine, $ = id => document.getElementById(id), canvas = $('canvas'), ctx = canvas.getContext('2d');
  const KEY = 'sion-world-bubble-pang-v1';
  let save; try { save = E.cleanSave(JSON.parse(localStorage.getItem(KEY))); } catch { save = E.cleanSave(); }
  let state = E.create(1, save.difficulty), last = 0, mode = 'menu', toastUntil = 0, audio, particles = [], seen = new Set(), fireQueued = false;
  const keys = new Set(), pointers = new Map(), buttonKeys = new Map(), tapped = new Set(), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const names = { basic: '✦ 별빛 줄', double: 'Ⅱ 더블 줄', sticky: '✧ 붙는 줄' };
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} }
  function clearInput() { keys.clear(); pointers.clear(); buttonKeys.clear(); tapped.clear(); fireQueued = false; }
  function input() { const values = [...keys].map(code => mapping[code]).concat([...pointers.values()], [...buttonKeys.values()], [...tapped]); tapped.clear(); const fire = values.includes('fire') || fireQueued; fireQueued = false; return { left: values.includes('left'), right: values.includes('right'), fire }; }
  function sound(type) {
    if (save.muted) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime;
      osc.type = type === 'hurt' ? 'triangle' : 'sine';
      const f = { fire: 600, pop: 880, hurt: 160, won: 1046, lost: 120, double: 740, sticky: 830 }[type] || 600;
      osc.frequency.setValueAtTime(f, t); osc.frequency.exponentialRampToValueAtTime(type === 'hurt' ? 80 : f * 1.4, t + .12);
      gain.gain.setValueAtTime(.055, t); gain.gain.exponentialRampToValueAtTime(.001, t + .18);
      osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(t + .2);
    } catch {}
  }
  function toast(text) { $('toast').textContent = text; $('toast').classList.add('show'); toastUntil = performance.now() + 3500; }
  function clearToast() { toastUntil = 0; $('toast').textContent = ''; $('toast').classList.remove('show'); }
  function overlay(html) { $('overlay').classList.remove('hidden'); $('panel').innerHTML = html; $('panel').querySelector('button,select')?.focus({ preventScroll: true }); }
  function button(text, action, primary = false) { return `<button ${primary ? 'class="primary"' : ''} data-action="${action}">${text}</button>`; }
  function menu() {
    clearInput(); clearToast(); mode = 'menu'; state = E.create(1, save.difficulty); $('pause').disabled = true;
    overlay(`<div class="symbol">✦</div><div class="subtitle">TEN LITTLE ADVENTURES</div><h2>버블을 톡, 모험을 시작!</h2><p>좌우로 움직이고 발사를 꾹 눌러 보세요.<br>모든 버블을 없애면 다음 모험이 열려요.</p><label for="difficulty">난이도</label><select id="difficulty"><option value="easy" ${save.difficulty === 'easy' ? 'selected' : ''}>쉬움 · 여유로운 별빛 산책</option><option value="normal" ${save.difficulty === 'normal' ? 'selected' : ''}>일반 · 신나는 버블 모험</option></select><label for="stage-select">출발할 스테이지</label><select id="stage-select"></select><div class="actions">${button('✦ 모험 시작', 'ready', true)}</div>`);
    stageOptions(); $('difficulty').addEventListener('change', event => { save.difficulty = event.target.value; persist(); stageOptions(); state = E.create(1, save.difficulty); });
  }
  function stageOptions() { $('stage-select').innerHTML = E.STAGES.map((s, i) => `<option value="${i + 1}" ${i + 1 > save[save.difficulty].unlocked ? 'disabled' : ''}>${String(i + 1).padStart(2, '0')} · ${s[0]}${i + 1 > save[save.difficulty].unlocked ? ' 🔒' : ''}</option>`).join(''); }
  function ready(stage) {
    clearInput(); clearToast(); state = E.create(stage, save.difficulty); particles = []; mode = 'ready'; $('pause').disabled = true;
    overlay(`<div class="symbol">☁</div><div class="subtitle">STAGE ${String(stage).padStart(2, '0')}</div><h2>${E.STAGES[stage - 1][0]}</h2><p>생명 3개 · ${state.time}초<br>큰 버블은 둘로 나뉘어요. 작은 버블까지 모두 팡!</p><div class="actions">${button('준비됐어요!', 'play', true)}${button('단계 선택', 'menu')}</div>`);
  }
  function play() { clearInput(); E.start(state); mode = 'play'; last = performance.now(); $('overlay').classList.add('hidden'); $('pause').disabled = false; $('pause').textContent = 'Ⅱ 일시정지'; sound('fire'); }
  function pause() {
    if (state.status === 'paused') { play(); return; }
    if (state.status !== 'playing') return;
    E.pause(state); clearInput(); mode = 'pause'; $('pause').textContent = '▶ 이어하기';
    overlay(`<div class="symbol">☾</div><h2>별빛도 잠깐 쉬어요</h2><p>준비되면 이어서 버블을 톡!</p><div class="actions">${button('▶ 이어하기', 'play', true)}${button('다시 도전', 'retry')}${button('단계 선택', 'menu')}</div>`);
  }
  function result() {
    clearInput(); mode = 'result'; $('pause').disabled = true;
    const won = state.status === 'won', final = won && state.stage === 10;
    if (won) { E.record(save, state); persist(); }
    overlay(`<div class="symbol">${won ? '✦' : '☁'}</div><div class="subtitle">${final ? 'ALL TEN STAGES COMPLETE' : won ? 'STAGE CLEAR' : 'ONE MORE LITTLE ADVENTURE'}</div><h2>${final ? '열 번의 모험, 모두 성공!' : won ? '반짝반짝, 클리어!' : state.time <= 0 ? '시간이 다 됐어요' : '조금만 더, 할 수 있어요!'}</h2><p>${final ? '당신은 최고의 별 사냥꾼이에요.<br>' : ''}점수 <b>${state.score.toLocaleString()}</b> · 최고 <b>${(save[state.difficulty].scores[state.stage - 1] || 0).toLocaleString()}</b>${won ? '<br>남은 시간과 생명 보너스가 포함되었어요.' : '<br>움직이면서 발사를 꾹 눌러 보세요.'}</p><div class="actions">${won && !final ? button('다음 모험 →', 'next', true) : button('다시 도전', 'retry', true)}${button('단계 선택', 'menu')}${final ? '<a class="home" href="../index.html">SION WORLD로</a>' : ''}</div>`);
  }
  $('panel').addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'ready') ready(Number($('stage-select').value));
    if (action === 'play') play(); if (action === 'retry') ready(state.stage);
    if (action === 'next') ready(state.stage + 1); if (action === 'menu') menu();
  });
  $('pause').addEventListener('click', pause);
  function soundLabel() { $('sound').textContent = save.muted ? '♪ 소리 꺼짐' : '♪ 소리 켜짐'; $('sound').setAttribute('aria-pressed', String(!save.muted)); }
  $('sound').addEventListener('click', () => { save.muted = !save.muted; soundLabel(); persist(); if (!save.muted) sound('pop'); });
  const mapping = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'fire', KeyJ: 'fire' };
  document.addEventListener('keydown', event => {
    if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) { pause(); return; }
    const control = event.target?.closest?.('[data-control]')?.dataset.control;
    if (state.status === 'playing' && event.code === 'Enter' && control) {
      // Prevent native repeated clicks: the simulation owns held activation.
      event.preventDefault();
      if (!event.repeat) { buttonKeys.set('Enter', control); tapped.add(control); }
      return;
    }
    if (state.status !== 'playing' || !mapping[event.code]) return;
    event.preventDefault(); keys.add(event.code); tapped.add(mapping[event.code]); if (mapping[event.code] === 'fire') fireQueued = true;
  });
  document.addEventListener('keyup', event => { if (mapping[event.code]) keys.delete(event.code); buttonKeys.delete(event.code); });
  for (const btn of document.querySelectorAll('[data-control]')) {
    btn.addEventListener('pointerdown', event => { if (state.status !== 'playing') return; event.preventDefault(); btn.setPointerCapture(event.pointerId); pointers.set(event.pointerId, btn.dataset.control); tapped.add(btn.dataset.control); if (btn.dataset.control === 'fire') fireQueued = true; });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(name, event => pointers.delete(event.pointerId));
    btn.addEventListener('blur', () => { if (buttonKeys.get('Enter') === btn.dataset.control) { buttonKeys.delete('Enter'); tapped.delete(btn.dataset.control); } });
    btn.addEventListener('click', event => {
      // Assistive technology may activate a button without pointer/key events.
      // Pointer clicks already went through pointerdown; do not enqueue twice.
      if (state.status === 'playing' && event.detail === 0 && !buttonKeys.size) tapped.add(btn.dataset.control);
    });
    btn.addEventListener('contextmenu', event => event.preventDefault());
  }
  window.addEventListener('blur', () => { clearInput(); if (state.status === 'playing') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (state.status === 'playing') pause(); } last = performance.now(); });
  function circle(x, y, r, fill, stroke, line = 2) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); } }
  function star(x, y, r, color) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .43 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
  function draw(now) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 540); gradient.addColorStop(0, '#e9effc'); gradient.addColorStop(1, '#f8f2ed'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 960, 540);
    circle(800, 90, 47, '#fff8db');
    for (const [x, y, r] of [[130, 135, 37], [185, 140, 49], [235, 150, 31], [640, 220, 33], [680, 205, 45], [725, 220, 30]]) circle(x, y, r, '#ffffff80');
    for (let i = 0; i < 15; i++) star(30 + i * 67, 30 + (i * 73) % 320, i % 3 ? 3 : 6, '#b7b4d167');
    ctx.fillStyle = '#d6e8e2'; ctx.beginPath(); ctx.moveTo(0, 480); ctx.quadraticCurveTo(200, 350, 410, 480); ctx.quadraticCurveTo(700, 340, 960, 480); ctx.lineTo(960, 540); ctx.lineTo(0, 540); ctx.fill();
    ctx.fillStyle = '#f6e7d3'; ctx.fillRect(0, E.FLOOR, 960, 48); ctx.fillStyle = '#d9c9b6'; ctx.fillRect(0, E.FLOOR, 960, 3);
    for (let i = 0; i < 18; i++) { ctx.fillStyle = '#e5d5c5'; ctx.fillRect(i * 60 + 10, 515 + i % 2 * 10, 18, 3); }
    for (const shot of state.shots) { ctx.strokeStyle = '#a49bc3'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(shot.x, E.FLOOR - 5); ctx.lineTo(shot.x, shot.top); ctx.stroke(); ctx.strokeStyle = '#fff6ca'; ctx.lineWidth = 3; ctx.stroke(); star(shot.x, shot.top, 11, '#fff1a6'); }
    const colors = [['#b9e3db', '#75b4aa'], ['#f4bdc4', '#d58d9a'], ['#c9bce7', '#a08cc6']];
    for (const b of state.bubbles) { const [fill, stroke] = colors[b.size]; circle(b.x, b.y, b.r, fill, stroke, 3); ctx.globalAlpha = .6; circle(b.x - b.r * .3, b.y - b.r * .3, b.r * .2, '#fff'); ctx.globalAlpha = 1; circle(b.x - 5, b.y + 2, 2, '#786f90'); circle(b.x + 5, b.y + 2, 2, '#786f90'); }
    for (const item of state.items) { circle(item.x, item.y, 15, '#fff4be', '#d5b86a'); ctx.fillStyle = '#8f799f'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(item.type === 'double' ? 'Ⅱ' : '✧', item.x, item.y + 6); }
    const x = state.player.x, y = E.FLOOR;
    ctx.save(); if (state.player.invincible > 0) circle(x, y - 25, 35, '#ffffff30', '#a9c4df', 2);
    if (state.player.invincible && !reduced && Math.floor(now / 100) % 2) ctx.globalAlpha = .55;
    ctx.fillStyle = '#7d83ac'; ctx.beginPath(); ctx.roundRect(x - 17, y - 35, 34, 34, 10); ctx.fill(); circle(x, y - 37, 23, '#959bc4', '#757fa7', 2); circle(x, y - 34, 16, '#fff0df'); circle(x - 6, y - 36, 2.2, '#575d7e'); circle(x + 6, y - 36, 2.2, '#575d7e'); star(x + 15, y - 52, 8, '#fff1a8'); ctx.fillStyle = '#626c95'; ctx.fillRect(x - 18, y - 5, 14, 6); ctx.fillRect(x + 4, y - 5, 14, 6); ctx.restore();
    for (const p of particles) star(p.x, p.y, p.life * 7, p.color);
    $('stage-hud').textContent = `${String(state.stage).padStart(2, '0')} · ${E.STAGES[state.stage - 1][0]}`;
    $('lives').textContent = '♥ '.repeat(state.lives) + '♡ '.repeat(3 - state.lives);
    $('time').textContent = String(Math.ceil(state.time)).padStart(3, '0'); $('score').textContent = state.score.toLocaleString();
    $('weapon').textContent = names[state.weapon] + (state.weaponTime ? ` ${Math.ceil(state.weaponTime)}s` : '');
    $('best').textContent = `최고 기록 ${(save[state.difficulty].scores[state.stage - 1] || 0).toLocaleString()}`;
  }
  function frame(now) {
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    E.step(state, input(), dt);
    for (const event of state.events) {
      sound(event);
      if ((event === 'double' || event === 'sticky') && !seen.has(event)) { seen.add(event); toast(event === 'double' ? '더블 줄! 10초 동안 두 줄을 함께 쏴요.' : '붙는 줄! 천장에 닿아도 2초 동안 남아요.'); }
      if (event === 'pop' && !reduced) for (let i = 0; i < 7; i++) particles.push({ x: state.player.x, y: 350, vx: (Math.random() - .5) * 160, vy: -Math.random() * 140, life: 1, color: ['#e5a5b2', '#a69bc4', '#e8cc75'][i % 3] });
    }
    if (state.status === 'playing') { for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 2; } particles = particles.filter(p => p.life > 0); }
    if (mode === 'play' && (state.status === 'won' || state.status === 'lost')) result();
    if (now > toastUntil) $('toast').classList.remove('show'); draw(now); requestAnimationFrame(frame);
  }
  soundLabel(); menu(); requestAnimationFrame(frame);
})();
