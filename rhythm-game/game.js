(function () {
  'use strict';
  const S = window.Starbeat;
  const $ = id => document.getElementById(id);
  const colors = ['#c7b2ff', '#8ee7d3', '#ffb4cf', '#ffe4a1'];
  const symbols = ['●', '▲', '◆', '✦'];
  const keys = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
  let storage; try { storage = window.localStorage; } catch { storage = null; }
  const store = new S.Store(storage, matchMedia('(prefers-reduced-motion: reduce)').matches);
  const audio = new S.Audio();
  let selected = S.songs[0], difficulty = 'easy', activeSong = null, engine = null;
  let state = 'menu', operation = 0, resumeAt = 0, pausedPosition = 0, lastCount = null;
  let preparing = null, tutorialAfter = false, lastComboMilestone = 0;
  let calibration = null, toastTimer, feedbackUntil = 0;
  const pressedKeys = new Set(), pointers = new Map(), flashes = [0, 0, 0, 0], particles = [];
  const canvas = $('stage'), ctx = canvas.getContext('2d');
  let width = 500, height = 500;
  const fmt = value => Math.round(value).toLocaleString('en-US');
  const clock = value => `${Math.floor(Math.max(0, value) / 60)}:${String(Math.floor(Math.max(0, value)) % 60).padStart(2, '0')}`;
  const settings = () => store.data.settings;
  const isRunning = () => ['playing', 'countdown', 'resuming'].includes(state);
  function toast(message) {
    $('toast').textContent = message; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
  }
  function saveSettings() { audio.volume(settings().music, settings().effects); document.body.classList.toggle('reduced', settings().reduced); if (!store.save()) toast('기록을 저장할 수 없어 이번 실행 동안만 유지해요.'); }
  function screen(id) {
    for (const section of document.querySelectorAll('main > .screen')) section.hidden = section.id !== id;
    document.body.classList.toggle('playing', id === 'play-screen');
    $('settings-open').hidden = id === 'play-screen';
    window.scrollTo(0, 0);
  }
  function renderMenu() {
    const record = store.data.records[`${selected.id}-${difficulty}`];
    $('song-list').innerHTML = S.songs.map((song, i) => `<button class="song-card ${selected.id === song.id ? 'active' : ''}" data-song="${song.id}" aria-pressed="${selected.id === song.id}"><span class="song-art ${song.art}" aria-hidden="true">${['☾', '☁', '♄'][i]}</span><span class="song-card-copy"><small>${song.genre}</small><strong>${song.title}</strong><p>${song.bpm} BPM <span> · </span> ${clock(song.bars * 240 / song.bpm)}</p></span><span class="song-card-index">${selected.id === song.id ? '♫' : `0${i + 1}`}</span></button>`).join('');
    $('song-title').textContent = selected.title; $('song-subtitle').textContent = selected.subtitle;
    $('song-genre').textContent = selected.genre; $('album-tag').textContent = selected.genre;
    $('album').dataset.art = selected.art;
    document.querySelector('.album-number').textContent = `SIDE A · 0${selected.index + 1}`;
    $('song-meta').textContent = `${selected.bpm} BPM · ${clock(selected.bars * 240 / selected.bpm)}`;
    $('note-count').textContent = `${S.makeChart(selected, difficulty).length}개의 작은 별`;
    $('best-score').textContent = record ? `${fmt(record.score)} · ${record.accuracy.toFixed(1)}%` : '아직 만나지 않은 별';
    $('record-badge').textContent = record?.allPerfect ? 'AP' : record?.fullCombo ? 'FC' : '';
    document.querySelectorAll('[data-difficulty]').forEach(button => { const on = button.dataset.difficulty === difficulty; button.classList.toggle('active', on); button.setAttribute('aria-pressed', String(on)); });
  }
  function releaseInputs() { pressedKeys.clear(); pointers.clear(); document.querySelectorAll('[data-lane]').forEach(b => b.classList.remove('pressed')); }
  function closeDialogs() { for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); }
  function backToMenu() {
    operation++; audio.stop(); stopCalibration(); releaseInputs(); closeDialogs(); state = 'menu'; engine = null;
    screen('menu'); renderMenu(); $('play').focus({ preventScroll: true });
  }
  async function start(song = selected, isTutorial = false) {
    const ticket = ++operation; stopCalibration(); audio.stop(); releaseInputs(); closeDialogs();
    activeSong = song; tutorialAfter = isTutorial; state = 'loading';
    $('loading-title').textContent = '별빛을 모으는 중이에요'; $('loading-message').textContent = '잠시만요. 연주할 음악을 준비하고 있어요.'; $('loading-retry').hidden = true;
    $('loading-dialog').showModal();
    try {
      // Unlock immediately inside the user gesture, before asynchronous rendering.
      await audio.unlock();
      audio.ctx.onstatechange = () => { if (audio.ctx.state !== 'running' && isRunning()) pause(); };
      audio.volume(settings().music, settings().effects);
      if (preparing) await preparing;
      if (ticket !== operation) return;
      preparing = audio.prepare(song);
      try { await preparing; } finally { preparing = null; }
      if (ticket !== operation) return;
      engine = new S.Engine(S.makeChart(song, isTutorial ? 'easy' : difficulty), settings().offset);
      particles.length = 0; flashes.fill(0); feedbackUntil = 0; lastComboMilestone = 0;
      $('judgment').classList.remove('show'); $('combo').classList.remove('show');
      $('play-title').textContent = song.title;
      $('play-difficulty').textContent = isTutorial ? 'TUTORIAL · D F J K 순서대로 눌러요' : `${difficulty === 'easy' ? 'EASY' : 'NORMAL'} · ${song.bpm} BPM`;
      $('lumi-message').innerHTML = isTutorial ? '처음엔 D부터!<br>음표와 선이 만날 때 톡.' : '준비됐나요?<br>우리 같이 반짝여요.';
      closeDialogs(); screen('play-screen'); resize();
      lastCount = null; audio.play(-4 * 60 / song.bpm); state = 'countdown';
      updateHud(); $('pause').focus({ preventScroll: true });
      if (document.hidden || audio.ctx.state !== 'running') pause();
    } catch (error) {
      if (ticket !== operation) return;
      state = 'error'; audio.stop(); $('loading-title').textContent = '잠깐, 음악을 준비하지 못했어요';
      $('loading-message').textContent = error.message || '다시 한 번 시도해 주세요.'; $('loading-retry').hidden = false;
      if (!$('loading-dialog').open) $('loading-dialog').showModal();
    }
  }
  function pause() {
    if (!isRunning()) return;
    pausedPosition = audio.pause(); state = 'paused'; releaseInputs(); $('countdown').hidden = true;
    if (!$('pause-dialog').open) $('pause-dialog').showModal();
  }
  async function resume() {
    if (state !== 'paused') return;
    const ticket = operation;
    try {
      await audio.unlock();
      if (ticket !== operation || state !== 'paused') return;
      if (document.hidden) return;
      $('pause-dialog').close(); audio.play(pausedPosition, 3); resumeAt = audio.ctx.currentTime + 3;
      lastCount = null; state = 'resuming'; $('pause').focus({ preventScroll: true });
    } catch (error) { toast(error.message); }
  }
  function finish() {
    if (!engine || !isRunning()) return;
    audio.stop(); state = 'result'; releaseInputs(); $('countdown').hidden = true;
    const result = engine.result();
    const previous = tutorialAfter ? { score: 0 } : store.record(`${activeSong.id}-${difficulty}`, result);
    if (tutorialAfter) { store.data.tutorial = true; store.save(); }
    $('result-title').textContent = tutorialAfter ? '첫 연주, 잘했어요!' : '또 하나의 별이 빛나요';
    $('result-song').textContent = `${activeSong.title} · ${tutorialAfter ? '연습' : difficulty === 'easy' ? '쉬움' : '보통'}`;
    $('result-grade').textContent = result.grade; $('result-score').textContent = fmt(result.score);
    $('result-badge').textContent = result.allPerfect ? '✦ ALL PERFECT ✦' : result.fullCombo ? '✦ FULL COMBO ✦' : 'STAGE COMPLETE';
    $('result-accuracy').textContent = `${result.accuracy.toFixed(2)}%`;
    $('result-combo').innerHTML = `${result.maxCombo} <small>/ ${result.total}</small>`;
    $('result-counts').innerHTML = Object.entries(result.counts).map(([name, count]) => `<div><span>${name}</span><strong>${count}</strong></div>`).join('');
    $('result-record').textContent = tutorialAfter ? '이제 좋아하는 곡을 만나러 가요.' : result.score > previous.score ? `✧ NEW BEST · +${fmt(result.score - previous.score)}` : `이전 최고 ${fmt(previous.score)} · ${result.score === previous.score ? '같은 점수예요' : `${fmt(result.score - previous.score)}점`}`;
    screen('result-screen'); $('retry').focus({ preventScroll: true });
    if (!store.available) toast('기록을 저장할 수 없어 이번 실행 동안만 유지해요.');
  }
  function feedback(event) {
    const { lane, result, error } = event; const now = performance.now();
    const label = $('judgment'); label.querySelector('strong').textContent = result;
    label.querySelector('strong').style.color = result === 'Miss' ? '#b0a6c5' : result === 'Perfect' ? '#ffe4a1' : result === 'Great' ? '#bba9ff' : '#8ee7d3';
    label.querySelector('span').textContent = result === 'Miss' ? '괜찮아요, 다음 별을 만나요' : result === 'Perfect' ? '' : error < 0 ? '조금 빨라요' : '조금 늦어요';
    label.classList.add('show'); feedbackUntil = now + 650;
    if (result !== 'Miss') {
      flashes[lane] = now;
      if (!settings().reduced) for (let i = 0; i < 9; i++) particles.push({ x: (lane + 0.5) * width / 4, y: height - 31, vx: (Math.random() - .5) * 130, vy: -40 - Math.random() * 180, born: now, color: colors[lane] });
    }
  }
  function hit(lane, event) {
    if (!(state === 'playing' || (state === 'countdown' && audio.time() >= -0.14))) return;
    const lag = event?.timeStamp ? Math.min(100, Math.max(0, performance.now() - event.timeStamp)) : 0;
    const result = engine.hit(lane, audio.time() * 1000 - lag);
    if (result) audio.hit(lane);
    engine.drainEvents().forEach(feedback); updateHud();
  }
  function updateHud() {
    if (!engine) return;
    $('score').textContent = String(engine.score).padStart(7, '0');
    $('accuracy').textContent = engine.processed ? `${engine.accuracy.toFixed(1)}%` : '—';
    $('combo').classList.toggle('show', engine.combo >= 2); $('combo').querySelector('strong').textContent = engine.combo;
    const milestone = Math.floor(engine.combo / 25);
    if (milestone > lastComboMilestone) { $('lumi-message').innerHTML = `${milestone * 25}콤보, 반짝!<br>너의 리듬이 들려요.`; lastComboMilestone = milestone; }
    if (!engine.combo) lastComboMilestone = 0;
  }
  function resize() {
    const box = canvas.getBoundingClientRect(); if (!box.width || !box.height) return;
    width = box.width; height = box.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  function draw(time, now) {
    ctx.clearRect(0, 0, width, height);
    const laneWidth = width / 4, line = height - 31;
    for (let lane = 0; lane < 4; lane++) {
      const x = lane * laneWidth;
      ctx.fillStyle = lane % 2 ? '#181a30' : '#1d1c33'; ctx.fillRect(x, 0, laneWidth, height);
      const gradient = ctx.createLinearGradient(0, 0, 0, height); gradient.addColorStop(0, `${colors[lane]}00`); gradient.addColorStop(1, `${colors[lane]}16`);
      ctx.fillStyle = gradient; ctx.fillRect(x + 1, 0, laneWidth - 2, height);
      ctx.fillStyle = '#ffffff0b'; ctx.fillRect(x, 0, 1, height);
      const flash = Math.max(0, 1 - (now - flashes[lane]) / 260);
      if (flash) { ctx.fillStyle = colors[lane]; ctx.globalAlpha = flash * .12; ctx.fillRect(x, height * .45, laneWidth, height); ctx.globalAlpha = 1; }
      ctx.fillStyle = `${colors[lane]}40`; ctx.fillRect(x + 6, line - 1, laneWidth - 12, 2);
      ctx.strokeStyle = `${colors[lane]}90`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x + 10, line - 9, laneWidth - 20, 18, 6); ctx.stroke();
    }
    if (activeSong) {
      const beat = 60000 / activeSong.bpm;
      const first = Math.floor(time / beat);
      for (let b = first; b < first + settings().speed * 1000 / beat + 3; b++) {
        const y = line - (b * beat - time) / (settings().speed * 1000) * (line + 12);
        if (y < 0 || y > height) continue;
        ctx.fillStyle = b % 4 === 0 ? '#ffffff0c' : '#ffffff05'; ctx.fillRect(0, y, width, 1);
      }
    }
    if (engine) for (const note of engine.notes) {
      if (note.result) continue;
      const y = line - (note.time + settings().visual - time) / (settings().speed * 1000) * (line + 12);
      if (y < -20 || y > height + 20) continue;
      const x = note.lane * laneWidth + 10; const color = colors[note.lane];
      ctx.shadowColor = color; ctx.shadowBlur = settings().reduced ? 0 : 12;
      ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y - 8, laneWidth - 20, 16, 5); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff9'; ctx.fillRect(x + 7, y - 5, laneWidth - 34, 2);
      ctx.fillStyle = '#302b46'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(symbols[note.lane], x + (laneWidth - 20) / 2, y + 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; const age = (now - p.born) / 1000;
      if (age > .55) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - age / .55; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x + p.vx * age, p.y + p.vy * age + 120 * age * age, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const shade = ctx.createLinearGradient(0, 0, 0, 60); shade.addColorStop(0, '#141629'); shade.addColorStop(1, '#14162900'); ctx.fillStyle = shade; ctx.fillRect(0, 0, width, 60);
  }
  function count(value) {
    $('countdown').hidden = false; $('countdown').textContent = value;
    if (lastCount !== value) { audio.tick(value === 1); lastCount = value; }
  }
  function frame(now) {
    if (isRunning() && engine) {
      let time = audio.time();
      if (state === 'resuming') {
        const left = resumeAt - audio.ctx.currentTime;
        if (left > 0) count(Math.ceil(left)); else { state = time < 0 ? 'countdown' : 'playing'; lastCount = null; }
      }
      if (state === 'countdown') {
        if (time < 0) count(Math.ceil(-time / (60 / activeSong.bpm)));
        else { state = 'playing'; $('countdown').hidden = true; }
      }
      if (state === 'playing') {
        $('countdown').hidden = true;
        engine.update(time * 1000); const events = engine.drainEvents(); events.forEach(feedback); if (events.length) updateHud();
        const end = Math.max(S.duration(activeSong), (engine.notes.at(-1).time + settings().offset + 141) / 1000);
        const progress = Math.min(1, Math.max(0, time / end));
        $('progress').style.width = `${progress * 100}%`; $('time-left').textContent = clock(end - time);
        $('constellation').querySelector('path').style.strokeDashoffset = String(650 * (1 - progress));
        if (time >= end) finish();
      }
      draw(time * 1000, now);
    } else if (state === 'paused' && engine) draw(pausedPosition * 1000, now);
    if (now > feedbackUntil) $('judgment').classList.remove('show');
    if (calibration && audio.ctx?.state === 'running') {
      const elapsed = audio.ctx.currentTime - calibration.start;
      const beat = Math.floor(elapsed / .625);
      if (beat !== calibration.beat && elapsed >= 0) { calibration.beat = beat; audio.tick(beat % 4 === 0); }
      const phase = ((elapsed - settings().visual / 1000) / .625 + .5) % 1;
      $('calibration-dot').style.left = `${(phase < 0 ? phase + 1 : phase) * 100}%`;
    }
    requestAnimationFrame(frame);
  }
  function updateSettingsUI() {
    for (const key of ['music', 'effects', 'offset', 'visual']) { $(`${key}-setting`).value = settings()[key]; $(`${key}-output`).textContent = `${settings()[key] > 0 && ['offset', 'visual'].includes(key) ? '+' : ''}${settings()[key]}${['music', 'effects'].includes(key) ? '%' : ' ms'}`; }
    $('speed-setting').value = settings().speed; $('reduced-setting').checked = settings().reduced;
  }
  function stopCalibration() {
    calibration = null; $('calibrate-start').textContent = '박자 맞춰보기'; $('calibrate-tap').disabled = true;
  }
  function calibrationTap() {
    if (!calibration) return;
    const elapsed = (audio.ctx.currentTime - calibration.start) * 1000;
    if (elapsed < 0) return;
    const raw = elapsed - Math.round(elapsed / 625) * 625; const delta = raw - settings().offset;
    $('calibrate-message').textContent = Math.abs(delta) <= 50 ? '잘 맞아요! 이 느낌으로 연주해요.' : `${Math.round(Math.abs(delta))}ms ${delta > 0 ? '늦게' : '빠르게'} 눌렀어요. 입력 보정을 ${delta > 0 ? '+' : '−'} 방향으로 조절해 보세요.`;
    flashes[0] = performance.now();
  }
  $('song-list').addEventListener('click', event => { const button = event.target.closest('[data-song]'); if (!button) return; selected = S.songs.find(s => s.id === button.dataset.song); renderMenu(); document.querySelector(`[data-song="${selected.id}"]`).focus({ preventScroll: true }); });
  document.querySelectorAll('[data-difficulty]').forEach(button => button.addEventListener('click', () => { difficulty = button.dataset.difficulty; renderMenu(); }));
  $('play').addEventListener('click', () => start()); $('tutorial-start').addEventListener('click', () => start(S.tutorial, true));
  $('pause').addEventListener('click', pause); $('resume').addEventListener('click', resume);
  $('restart').addEventListener('click', () => start(activeSong, tutorialAfter)); $('retry').addEventListener('click', () => start(activeSong, tutorialAfter));
  $('pause-back').addEventListener('click', backToMenu); $('result-back').addEventListener('click', backToMenu); $('loading-back').addEventListener('click', backToMenu);
  $('loading-retry').addEventListener('click', () => start(activeSong, tutorialAfter));
  $('pause-dialog').addEventListener('cancel', event => { event.preventDefault(); resume(); });
  $('loading-dialog').addEventListener('cancel', event => { event.preventDefault(); backToMenu(); });
  $('settings-open').addEventListener('click', () => { updateSettingsUI(); $('settings-dialog').showModal(); });
  $('settings-dialog').addEventListener('close', stopCalibration);
  for (const key of ['music', 'effects', 'offset', 'visual', 'speed', 'reduced']) $(`${key}-setting`).addEventListener('input', event => {
    settings()[key] = key === 'reduced' ? event.target.checked : Number(event.target.value); updateSettingsUI(); saveSettings();
  });
  $('settings-reset').addEventListener('click', () => { store.data.settings = { ...S.defaults, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches }; updateSettingsUI(); saveSettings(); });
  $('calibrate-start').addEventListener('click', async () => {
    if (calibration) { stopCalibration(); return; }
    try { await audio.unlock(); if (!$('settings-dialog').open) return; audio.volume(settings().music, settings().effects); calibration = { start: audio.ctx.currentTime + .625, beat: -1 }; $('calibrate-start').textContent = '연습 멈추기'; $('calibrate-tap').disabled = false; }
    catch (error) { toast(error.message); }
  });
  $('calibrate-tap').addEventListener('pointerdown', event => { event.preventDefault(); calibrationTap(); });
  $('calibrate-tap').addEventListener('click', event => { if (event.detail === 0) calibrationTap(); });
  document.addEventListener('keydown', event => {
    if ($('settings-dialog').open) { if (calibration && event.code === 'Space' && !['INPUT', 'SELECT'].includes(event.target.tagName)) { event.preventDefault(); if (!event.repeat) calibrationTap(); } return; }
    if (event.code === 'Escape' && isRunning()) { event.preventDefault(); pause(); return; }
    const lane = keys.indexOf(event.code); if (lane < 0 || !isRunning()) return;
    event.preventDefault(); if (event.repeat || pressedKeys.has(event.code)) return;
    pressedKeys.add(event.code); document.querySelector(`[data-lane="${lane}"]`).classList.add('pressed'); hit(lane, event);
  });
  document.addEventListener('keyup', event => { pressedKeys.delete(event.code); const lane = keys.indexOf(event.code); if (lane >= 0 && ![...pointers.values()].includes(lane)) document.querySelector(`[data-lane="${lane}"]`).classList.remove('pressed'); });
  document.querySelectorAll('[data-lane]').forEach(button => {
    const lane = Number(button.dataset.lane);
    button.addEventListener('pointerdown', event => { event.preventDefault(); if (!isRunning()) return; if (event.pointerType === 'mouse' && event.button !== 0) return; button.setPointerCapture(event.pointerId); pointers.set(event.pointerId, lane); button.classList.add('pressed'); hit(lane, event); });
    const release = event => { pointers.delete(event.pointerId); if (![...pointers.values()].includes(lane) && !pressedKeys.has(keys[lane])) button.classList.remove('pressed'); };
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', event => event.preventDefault());
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); stopCalibration(); } });
  window.addEventListener('blur', () => { pause(); releaseInputs(); stopCalibration(); });
  let previousSize = { w: innerWidth, h: innerHeight };
  window.addEventListener('resize', () => { const changed = Math.abs(innerWidth - previousSize.w) > 70 || Math.abs(innerHeight - previousSize.h) > 160; if (changed) pause(); previousSize = { w: innerWidth, h: innerHeight }; resize(); });
  new ResizeObserver(resize).observe(canvas.parentElement);
  audio.volume(settings().music, settings().effects); document.body.classList.toggle('reduced', settings().reduced);
  renderMenu(); updateSettingsUI(); requestAnimationFrame(frame);
})();
