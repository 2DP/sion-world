(function () {
  'use strict';
  const E = window.SnakeEngine;
  const $ = id => document.getElementById(id);
  const canvas = $('board'), ctx = canvas.getContext('2d');
  const modeNames = { classic: '클래식', wrap: '산책' };
  const speedNames = { easy: '느긋하게', normal: '보통', fast: '빠르게' };
  const storageKey = 'sion-snake-v1';
  let records = {}, sound = false, audio, state, lastTime, swipe = null;
  let previousBest = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (saved && typeof saved === 'object') {
      sound = saved.sound === true;
      if (saved.records && typeof saved.records === 'object') {
        for (const mode of Object.keys(modeNames)) for (const difficulty of Object.keys(speedNames)) {
          const key = mode + ':' + difficulty, value = saved.records[key];
          if (Number.isSafeInteger(value) && value >= 0 && value <= (E.SIZE * E.SIZE - 4) * 10) records[key] = value;
        }
      }
    }
  } catch (_) { /* Storage is optional, including private/file browsing. */ }
  const recordKey = () => state.mode + ':' + state.difficulty;
  const best = () => records[recordKey()] || 0;
  const format = n => String(n).padStart(3, '0');
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify({ records, sound })); } catch (_) { /* Keep the session record. */ }
  }
  function initAudio() {
    if (!sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audio) audio = new Audio();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
    } catch (_) { /* Audio support is optional. */ }
  }
  function tone(frequency, duration, offset = 0) {
    if (!sound || !audio || audio.state !== 'running') return;
    try {
      const oscillator = audio.createOscillator(), volume = audio.createGain(), t = audio.currentTime + offset;
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, t);
      volume.gain.setValueAtTime(0, t); volume.gain.linearRampToValueAtTime(0.065, t + .012);
      volume.gain.exponentialRampToValueAtTime(.001, t + duration);
      oscillator.connect(volume); volume.connect(audio.destination);
      oscillator.start(t); oscillator.stop(t + duration + .02);
      oscillator.onended = () => { oscillator.disconnect(); volume.disconnect(); };
    } catch (_) { /* An unavailable audio device must not interrupt play. */ }
  }
  function soundLabel() {
    $('sound').textContent = sound ? '♪ 소리 켜짐' : '♪ 소리 꺼짐';
    $('sound').setAttribute('aria-pressed', String(sound));
  }
  function announce(text) { $('announcement').textContent = text; }
  function stats() {
    $('score').textContent = format(state.score);
    $('best').textContent = format(best());
    $('eaten').textContent = state.eaten;
    $('length').textContent = state.snake.length;
    $('mode-label').textContent = modeNames[state.mode] + ' · ' + speedNames[state.difficulty];
  }
  function panel() {
    const playing = state.status === 'playing', locked = playing || state.status === 'paused';
    $('overlay').hidden = playing;
    $('mode').disabled = locked; $('difficulty').disabled = locked;
    $('pause').disabled = !locked;
    $('pause').textContent = state.status === 'paused' ? '▷' : 'Ⅱ';
    $('pause').setAttribute('aria-label', state.status === 'paused' ? '게임 계속하기' : '게임 일시정지');
    if (playing) return;
    let title, description, action, kicker;
    if (state.status === 'ready') {
      title = '한 입 하러 갈까요?'; description = '작은 사과 하나에서 시작하는\n아주 긴 모험.'; action = '게임 시작 →'; kicker = 'READY, SET, MUNCH!';
    } else if (state.status === 'paused') {
      title = '잠깐, 쉬어 가요'; description = '서두르지 않아도 괜찮아요.\n준비되면 이어서 냠냠!'; action = '계속하기 →'; kicker = 'TAKE A LITTLE BREAK';
    } else {
      const record = state.score > previousBest;
      title = state.status === 'won' ? '정원을 가득 채웠어요!' : record ? '나의 새로운 최고 기록!' : '즐거운 한 입이었어요!';
      const reason = state.reason === 'wall' ? '앗, 정원 벽에 닿았어요.' : '앗, 내 몸에 닿았어요.';
      description = (state.status === 'won' ? '400칸 모두 완성! 대단해요.' : reason) + '\n사과 ' + state.eaten + '개 · ' + state.score + '점 · 길이 ' + state.snake.length;
      action = '다시 도전 →'; kicker = state.status === 'won' ? 'A GARDEN FULL OF YOU' : 'ONE MORE BITE?';
    }
    $('overlay-title').textContent = title;
    $('overlay-description').textContent = description;
    $('primary').textContent = action;
    $('panel-kicker').textContent = kicker;
    $('keyboard-hint').textContent = state.status === 'paused' ? 'Space 키로도 계속할 수 있어요' : 'Space 키를 눌러 시작';
    announce(title + '. ' + description.replace('\n', ' '));
  }
  function fresh() {
    state = E.create({ mode: $('mode').value, difficulty: $('difficulty').value });
    previousBest = best(); lastTime = undefined; swipe = null;
    $('mode-note').textContent = state.mode === 'wrap' ? '벽을 지나면 반대편으로! 내 몸은 조심해요.' : '벽이나 내 몸에 닿으면 게임이 끝나요.';
    stats(); panel(); draw();
  }
  function play() {
    initAudio();
    if (state.status === 'lost' || state.status === 'won') fresh();
    E.start(state); lastTime = undefined; swipe = null; panel();
    announce('게임 시작. ' + modeNames[state.mode] + ' 모드, ' + speedNames[state.difficulty] + ' 속도.');
    canvas.focus({ preventScroll: true });
  }
  function pause(focus = false) {
    if (state.status !== 'playing') return;
    E.pause(state); swipe = null; lastTime = undefined; panel();
    if (focus) $('primary').focus({ preventScroll: true });
  }
  function togglePause() { if (state.status === 'playing') pause(true); else if (state.status === 'paused') play(); }
  function rounded(x, y, w, h, r, fill) {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  }
  function apple(x, y, cell) {
    ctx.save(); ctx.translate(x + cell / 2, y + cell / 2);
    ctx.fillStyle = '#aac08d55'; ctx.beginPath(); ctx.ellipse(0, cell * .36, cell * .31, cell * .1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.scale(cell / 30, cell / 30);
    ctx.fillStyle = '#d77c61'; ctx.beginPath();
    ctx.moveTo(0, -7); ctx.bezierCurveTo(-14, -14, -17, 2, -8, 10); ctx.bezierCurveTo(-4, 14, -2, 10, 0, 11);
    ctx.bezierCurveTo(4, 14, 9, 11, 12, 4); ctx.bezierCurveTo(17, -9, 6, -13, 0, -7); ctx.fill();
    ctx.strokeStyle = '#6b7d47'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(1, -13); ctx.stroke();
    ctx.fillStyle = '#749657'; ctx.beginPath(); ctx.ellipse(5, -11, 5, 2.4, -.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5b39a'; ctx.beginPath(); ctx.ellipse(-6, -3, 2, 3, .4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function draw() {
    const cell = canvas.width / state.size;
    ctx.fillStyle = '#e6edd6'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < state.size; y++) for (let x = 0; x < state.size; x++) {
      if ((x + y) % 2 === 0) { ctx.fillStyle = '#e0e9cc'; ctx.fillRect(x * cell, y * cell, cell, cell); }
      ctx.fillStyle = '#bbcea066'; ctx.fillRect(x * cell, y * cell, 1.5, 1.5);
    }
    if (state.mode === 'wrap') {
      ctx.strokeStyle = '#a9c290'; ctx.lineWidth = 3; ctx.setLineDash([6, 8]); ctx.strokeRect(2, 2, 596, 596); ctx.setLineDash([]);
    }
    if (state.food) apple(state.food.x * cell, state.food.y * cell, cell);
    for (let i = state.snake.length - 1; i >= 0; i--) {
      const p = state.snake[i], next = state.snake[i - 1];
      const fill = i === 0 ? '#456c3f' : i % 2 ? '#86a95c' : '#95b76b';
      // Join neighbors, but never draw a bridge across a wrapped edge.
      if (next && Math.abs(p.x - next.x) + Math.abs(p.y - next.y) === 1) {
        rounded(Math.min(p.x, next.x) * cell + 3, Math.min(p.y, next.y) * cell + 3,
          Math.abs(p.x - next.x) * cell + cell - 6, Math.abs(p.y - next.y) * cell + cell - 6, 6, fill);
      }
      rounded(p.x * cell + 2, p.y * cell + 2, cell - 4, cell - 4, i === 0 ? 9 : 7, fill);
      if (i > 0) rounded(p.x * cell + 6, p.y * cell + 5, cell - 12, 4, 2, '#c1d69a66');
    }
    const head = state.snake[0];
    ctx.save(); ctx.translate((head.x + .5) * cell, (head.y + .5) * cell);
    ctx.rotate({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[state.direction]);
    for (const y of [-6, 6]) {
      rounded(1, y - 4, 8, 8, 4, '#fffdf0'); rounded(5, y - 2, 3, 4, 1.5, '#263f2e');
    }
    ctx.restore();
  }
  $('primary').addEventListener('click', play);
  $('pause').addEventListener('click', togglePause);
  $('restart').addEventListener('click', () => { fresh(); $('primary').focus({ preventScroll: true }); });
  $('mode').addEventListener('change', fresh);
  $('difficulty').addEventListener('change', fresh);
  $('sound').addEventListener('click', () => { sound = !sound; soundLabel(); initAudio(); tone(660, .1); save(); });
  const keys = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const target = event.target;
    if (target && target.closest('select, input, textarea, [contenteditable="true"]')) return;
    if (keys[event.code] && state.status === 'playing') {
      event.preventDefault(); if (!event.repeat) E.turn(state, keys[event.code]); return;
    }
    if (event.code !== 'Space' && event.code !== 'KeyP' && event.code !== 'Escape') return;
    // Let focused buttons and links keep their native Space activation.
    if (event.code === 'Space' && target && target.closest('button, a')) return;
    event.preventDefault(); if (event.repeat) return;
    if (state.status === 'playing') pause(true);
    else if (event.code === 'Space' || (event.code === 'KeyP' && state.status === 'paused')) play();
  });
  for (const button of document.querySelectorAll('[data-direction]')) {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault(); E.turn(state, button.dataset.direction);
    });
    button.addEventListener('click', event => { if (event.detail === 0) E.turn(state, button.dataset.direction); });
  }
  canvas.addEventListener('pointerdown', event => {
    if (state.status !== 'playing' || event.button !== 0 || swipe) return;
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    E.turn(state, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    swipe.x = event.clientX; swipe.y = event.clientY;
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, event => { if (swipe && swipe.id === event.pointerId) swipe = null; });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', () => pause());
  function frame(time) {
    const delta = lastTime === undefined ? 0 : time - lastTime;
    lastTime = time;
    const events = E.advance(state, delta);
    if (events.length) {
      if (state.score > best()) { records[recordKey()] = state.score; save(); }
      stats(); draw();
      if (events.includes('eat')) { tone(520, .09); tone(780, .12, .06); }
      if (state.status === 'lost' || state.status === 'won') {
        tone(state.status === 'won' ? 880 : 220, .24); panel(); $('primary').focus({ preventScroll: true });
      }
    }
    requestAnimationFrame(frame);
  }
  soundLabel(); fresh(); requestAnimationFrame(frame);
})();
