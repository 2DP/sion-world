(function () {
  'use strict';
  const E = window.PitchFlight, R = window.PitchRhythm, $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const STORE = 'sion-world-pitch-flight-rhythm-v2';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let records = {};
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved && typeof saved === 'object') for (const [key, value] of Object.entries(saved)) {
      if (/^(practice|challenge)-(easy|normal|hard)-(free|exact)$/.test(key) && Number.isFinite(value) && value >= 0) records[key] = Math.floor(value);
    }
  } catch (_) { /* Storage is optional. */ }
  let state = E.create(), playing = false, demo = false, requesting = false, requestId = 0;
  let stream = null, audio = null, source = null, analyser = null, samples = null;
  let transport = null, preview = null, previewRound = null, beatMuted = false;
  let inputHz = null, inputRms = 0, history = [], lastSample = 0, ignoreUntil = 0;
  let lastTime = performance.now(), visualTime = 0, lastUI = 0, resultShown = false;
  let particles = [], flash = 0, flashSuccess = true, statusText = '', statusUntil = 0;
  let sceneWidth = 1100;
  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    sceneWidth = Math.round(600 * bounds.width / Math.max(1, bounds.height));
    canvas.width = sceneWidth; canvas.height = 600;
  }
  new ResizeObserver(resizeCanvas).observe(canvas);
  const chapters = [ ['구름 정원', 'CLOUD GARDEN'], ['노을 산책', 'SUNSET WALK'], ['별빛 여행', 'STARLIGHT TRIP'] ];
  const palettes = [ ['#eaf4ee', '#dcece1', '#c9e0d3'], ['#f8eee6', '#eddfdb', '#dbcbd9'], ['#ecebf7', '#dedeee', '#c4cce1'] ];
  function options() { return { mode: document.querySelector('input[name=mode]:checked').value, difficulty: $('difficulty').value, freeOctave: $('free-octave').checked }; }
  function recordKey() { const o = options(); return `${o.mode}-${o.difficulty}-${o.freeOctave ? 'free' : 'exact'}`; }
  function updateRecord() {
    const o = options();
    $('best-score').innerHTML = `${records[recordKey()] || 0}<small>점</small>`;
    $('record-caption').textContent = `${o.mode === 'practice' ? '연습' : '도전'} · ${E.LEVELS[o.difficulty].label} · ${o.freeOctave ? '옥타브 자유' : '정확한 옥타브'}`;
  }
  function setMic(active) {
    $('mic-status').classList.toggle('active', active);
    $('mic-status').innerHTML = `<i></i> ${active ? '마이크 켜짐' : '마이크 꺼짐'}`;
    $('live-dot').classList.toggle('active', active);
  }
  function lockSettings(locked) {
    $('mode-options').disabled = locked;
    $('difficulty').disabled = locked;
    $('free-octave').disabled = locked;
  }
  function refreshTarget() {
    const v = rhythmView(), slot = v.round.notes[v.index];
    const n = slot.midi === null ? null : E.note(E.frequency(slot.midi)), config = E.LEVELS[state.difficulty];
    $('target-name').textContent = n ? n.name : '쉼';
    $('target-letter').textContent = n ? n.letter + n.octave : 'REST';
    $('target-hz').textContent = `${beatLabel(slot.beats)}박${n ? ' · ' + E.frequency(slot.midi).toFixed(1) + ' Hz' : ' 쉬어요'}`;
    $('target-chip').textContent = `${Math.min(state.gates + 1, state.total)} / ${state.total} 번째 문`;
    $('listen').disabled = state.mode === 'challenge' || requesting || !!preview || (playing && demo);
    $('listen').innerHTML = state.mode === 'challenge' ? '도전 모드 · 소리 힌트 없음' : preview ? '멜로디 듣는 중…' : '<span aria-hidden="true">▷</span> 이번 멜로디 들어보기';
    $('target-help').textContent = !n ? '쉼표에서는 목소리를 잠깐 멈춰요.' : state.freeOctave ? '편한 높이로 부르며 박자를 따라가요.' : `${n.letter}${n.octave}의 높이까지 맞춰주세요.`;
    $('settings-note').textContent = `허용 오차 ±${config.tolerance}센트 · 하트 3개`;
    $('safe-zone').style.left = (50 - config.tolerance / 2) + '%';
    $('safe-zone').style.width = config.tolerance + '%';
    const chapter = Math.min(2, Math.floor(state.gates / 4));
    $('stage-number').textContent = String(chapter + 1).padStart(2, '0');
    $('stage-name').innerHTML = `${chapters[chapter][0]}<small>${chapters[chapter][1]}</small>`;
  }
  function resetInput() { inputHz = null; inputRms = 0; history = []; lastSample = 0; }
  function beatLabel(beats) { return String(beats).replace('0.5', '½').replace('1.5', '1½'); }
  function rhythmView() {
    const round = previewRound || E.currentRound(state);
    const beat = preview ? preview.position() / round.secondsPerBeat : state.beat;
    const phraseBeat = Math.max(0, beat - round.countIn);
    const found = round.notes.findIndex(n => phraseBeat < n.beat + n.beats - 1e-7);
    const index = found < 0 ? round.notes.length - 1 : found;
    return { round, beat, phraseBeat, index, countin: beat < round.countIn, active: playing || !!preview };
  }
  function renderRhythm() {
    const v = rhythmView(), r = v.round, beat = Math.floor(v.beat + 1e-7) % 4;
    $('tempo').textContent = `${r.bpm} BPM`;
    $('rhythm-stage').textContent = `${r.stage + 1}스테이지 · ${r.notes.filter(n => n.midi !== null).length}개 음 · ${r.beats}박`;
    $('beat-dots').innerHTML = [0, 1, 2, 3].map(i => `<span class="${v.active && i === beat ? 'active' : ''}">${i + 1}</span>`).join('');
    $('beat-caption').textContent = preview ? (v.countin ? '들어보기 · 네 박자 준비' : '멜로디를 듣고 기억해요') : !playing ? '시작하면 네 박자 뒤에 노래해요' : v.countin ? `준비 · ${Math.min(4, Math.floor(v.beat) + 1)} / 4` : state.target === null ? '쉼표 · 잠깐 쉬어요' : `${v.index + 1}번째 음 · ${beatLabel(r.notes[v.index].beats)}박 유지`;
    $('melody-notes').innerHTML = r.notes.map((n, i) => {
      const result = preview ? null : n.result;
      const active = v.active && !v.countin && i === v.index;
      return `<div class="melody-note${n.midi === null ? ' rest' : ''}${active ? ' current' : ''}${result === true ? ' hit' : result === false ? ' miss' : ''}" style="flex:${n.beats}" aria-label="${n.midi === null ? '쉼표' : E.NOTES[n.midi % 12]} ${n.beats}박${active ? ', 지금' : ''}${result === true ? ', 성공' : result === false ? ', 놓침' : ''}"><strong>${n.midi === null ? '쉼' : E.NOTES[n.midi % 12]}</strong><small>${beatLabel(n.beats)}박</small><i>${result === true ? '✓' : result === false ? '×' : n.midi === null ? '𝄽' : n.beats < 1 ? '♪' : '♩'}</i></div>`;
    }).join('');
    $('melody-cursor').hidden = !v.active || v.countin;
    $('melody-cursor').style.left = Math.min(100, v.phraseBeat / r.beats * 100) + '%';
  }
  function stopTransport() { if (transport) { transport.dispose(); transport = null; } }
  function applyBeatVolume() {
    const volume = Number($('beat-volume').value) / 100;
    transport?.setVolume(volume, beatMuted); preview?.setVolume(volume, beatMuted);
    $('beat-toggle').textContent = beatMuted ? '비트 꺼짐' : '비트 켜짐';
    $('beat-toggle').setAttribute('aria-pressed', !beatMuted);
    $('beat-toggle').setAttribute('aria-label', beatMuted ? '배경 비트 켜기' : '배경 비트 끄기');
  }
  function startTransport() { stopTransport(); transport = new R.Track(audio, R.beatEvents(state.rounds)); applyBeatVolume(); transport.start(state.elapsed); }
  function stopTone() {
    if (preview) { preview.dispose(); preview = null; previewRound = null; }
    ignoreUntil = 0;
  }
  function releaseMic() {
    requestId++;
    if (stream) { for (const track of stream.getTracks()) { track.onended = null; track.onmute = null; track.stop(); } stream = null; }
    if (source) { try { source.disconnect(); } catch (_) {} source = null; }
    analyser = null; samples = null; resetInput(); setMic(false);
  }
  async function audioContext() {
    if (!audio || audio.state === 'closed') {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('이 브라우저는 소리 분석을 지원하지 않아요. 최신 Chrome, Edge 또는 Safari에서 열어주세요.');
      audio = new Audio();
      audio.onstatechange = () => { if (playing && audio && audio.state !== 'running') pause('소리 장치가 일시 중단됐어요. 다시 연결해 주세요.'); };
    }
    if (audio.state !== 'running') await audio.resume();
    return audio;
  }
  function microphoneError(error) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') return '마이크 권한이 필요해요. 브라우저의 사이트 설정에서 마이크를 허용한 뒤 다시 눌러주세요.';
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') return '마이크를 찾을 수 없어요. 마이크를 연결한 뒤 다시 시도해 주세요.';
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') return '마이크를 열 수 없어요. 다른 앱이 사용 중인지, 기기 설정에서 꺼져 있는지 확인해 주세요.';
    return error.message || '마이크 연결에 실패했어요. 연결 상태를 확인하고 다시 시도해 주세요.';
  }
  async function startGame() {
    if (requesting || playing) return;
    if (demo && state.status === 'paused') return resumeDemo();
    stopTone();
    $('error').hidden = true;
    requesting = true; $('start').disabled = true; $('start').textContent = '마이크 연결 중…';
    $('demo').textContent = '연결 취소하고 둘러보기';
    lockSettings(true); refreshTarget();
    const token = ++requestId;
    let obtained = null, failed = false;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('마이크는 HTTPS 또는 localhost에서 사용할 수 있어요. 게임을 보안 주소로 열어주세요.');
      const ac = await audioContext();
      if (token !== requestId) return;
      obtained = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: false }, video: false });
      if (token !== requestId || document.hidden) { obtained.getTracks().forEach(t => t.stop()); return; }
      stream = obtained;
      source = ac.createMediaStreamSource(stream);
      analyser = ac.createAnalyser(); analyser.fftSize = 4096; analyser.smoothingTimeConstant = 0;
      source.connect(analyser); samples = new Float32Array(analyser.fftSize);
      for (const track of stream.getAudioTracks()) {
        track.onended = () => pause('마이크 연결이 끊겼어요. 연결한 뒤 다시 시작해 주세요.');
        track.onmute = () => pause('마이크 입력이 중단됐어요. 다시 연결해 주세요.');
      }
      if (resultShown || demo || state.status === 'won' || state.status === 'lost') state = E.create(options());
      else E.restartRound(state);
      state.status = 'running'; demo = false; playing = true; resultShown = false;
      state.hold = 0; resetInput(); stopTone(); startTransport();
      $('start-panel').hidden = true; $('demo-badge').hidden = true; $('sky').classList.remove('demo');
      $('pause').disabled = false; setMic(true); lastTime = performance.now();
      message('하나, 둘, 셋, 넷! 비트에 맞춰 준비해요', 2);
    } catch (error) {
      if (token !== requestId) { obtained?.getTracks().forEach(t => t.stop()); return; }
      failed = true;
      releaseMic();
      $('error').textContent = microphoneError(error); $('error').hidden = false;
    } finally {
      if (token === requestId || failed) {
        requesting = false; $('start').disabled = false;
        $('start').innerHTML = '<span aria-hidden="true">♩</span> 마이크 켜고 시작 <span aria-hidden="true">→</span>';
        $('demo').textContent = '먼저 둘러보기 ↗';
        lockSettings(playing || state.status === 'paused'); refreshTarget();
      }
    }
  }
  async function startDemo() {
    releaseMic(); stopTone(); stopTransport(); requesting = true;
    const token = requestId;
    try { await audioContext(); } catch (error) { if (token === requestId) { requesting = false; $('error').textContent = error.message; $('error').hidden = false; } return; }
    if (token !== requestId || document.hidden) return;
    requesting = false; demo = true;
    if (resultShown || state.status === 'won' || state.status === 'lost') state = E.create(options());
    else E.restartRound(state);
    state.status = 'running'; playing = true; resultShown = false;
    $('start').disabled = false; $('error').hidden = true; $('start-panel').hidden = true;
    $('demo-badge').hidden = false; $('sky').classList.add('demo'); $('pause').disabled = false;
    lockSettings(true); startTransport(); refreshTarget(); lastTime = performance.now();
    message('시연 중 · 비트와 음표의 길이를 따라가요', 3);
  }
  async function resumeDemo() {
    requesting = true; const token = ++requestId;
    try {
      await audioContext(); if (token !== requestId || document.hidden) return;
      E.restartRound(state); state.status = 'running'; playing = true; startTransport(); refreshTarget();
      $('start-panel').hidden = true; $('pause').disabled = false; lastTime = performance.now();
    } catch (error) { $('error').textContent = error.message; $('error').hidden = false; }
    finally { if (token === requestId) requesting = false; }
  }
  function pause(reason = '잠깐 쉬어가요. 준비되면 다시 출발!') {
    if (!playing) return;
    playing = false; state.status = 'paused'; state.hold = 0; state.matched = false;
    releaseMic(); stopTone(); stopTransport();
    $('start-panel').hidden = false; $('panel-kicker').textContent = 'TAKE A BREATH';
    $('panel-title').textContent = '잠깐, 숨 고르기'; $('panel-text').textContent = reason + ' 이어하면 현재 멜로디를 네 박자부터 다시 시작해요.';
    $('result').hidden = true; $('error').hidden = true; $('pause').disabled = true;
    $('start').disabled = false;
    $('start').innerHTML = `<span aria-hidden="true">▷</span> ${demo ? '시연 계속하기' : '마이크 켜고 이어하기'} <span aria-hidden="true">→</span>`;
    $('demo').textContent = '처음으로 돌아가기';
    statusText = ''; updateUI(performance.now());
  }
  function resetLobby() {
    playing = false; demo = false; requesting = false; releaseMic(); stopTone(); stopTransport();
    state = E.create(options()); resultShown = false; particles = []; flash = 0; statusText = '';
    $('start-panel').hidden = false; $('panel-kicker').textContent = 'READY TO SING?';
    $('panel-title').textContent = '목소리에 날개를 달아볼까요?'; $('panel-text').textContent = '네 박자를 센 뒤, 음표의 길이대로 멜로디를 불러요.';
    $('start').innerHTML = '<span aria-hidden="true">♩</span> 마이크 켜고 시작 <span aria-hidden="true">→</span>';
    $('start').disabled = false; $('demo').textContent = '먼저 둘러보기 ↗';
    $('result').hidden = true; $('error').hidden = true; $('demo-badge').hidden = true; $('sky').classList.remove('demo');
    $('pause').disabled = true; lockSettings(false); refreshTarget(); updateRecord(); updateUI(performance.now());
  }
  function finish() {
    if (resultShown) return;
    resultShown = true; playing = false; releaseMic(); stopTone(); stopTransport();
    if (!demo && state.score > (records[recordKey()] || 0)) {
      records[recordKey()] = state.score;
      try { localStorage.setItem(STORE, JSON.stringify(records)); } catch (_) {}
    }
    $('start-panel').hidden = false; $('panel-kicker').textContent = demo ? 'THAT WAS A DEMO' : state.status === 'won' ? 'A LOVELY FLIGHT!' : 'EVERY VOICE CAN FLY';
    $('panel-title').textContent = demo ? '이제 내 목소리로 날아봐요!' : state.status === 'won' ? '멋진 비행이었어요!' : '다시 한번 날아볼까요?';
    $('panel-text').textContent = demo ? '시연 기록은 저장되지 않아요. 마이크를 켜볼까요?' : state.status === 'won' ? '열두 개의 문을 지나 여행을 마쳤어요.' : '조금씩 내 음을 찾아가면 돼요.';
    $('result').innerHTML = `<div><strong>${state.score.toLocaleString()}</strong><small>비행 점수</small></div><div><strong>${state.passed} / 12</strong><small>통과한 문</small></div><div><strong>${state.maxCombo}</strong><small>최대 콤보</small></div>`;
    $('result').hidden = false; $('start').innerHTML = '<span aria-hidden="true">♩</span> 마이크 켜고 다시 비행 <span aria-hidden="true">→</span>';
    $('start').disabled = false; $('demo').textContent = '처음으로 돌아가기'; $('pause').disabled = true;
    lockSettings(false); updateRecord(); refreshTarget();
  }
  async function playReference() {
    if (state.mode === 'challenge' || requesting || preview || (playing && demo)) return;
    $('error').hidden = true;
    const token = requestId;
    try {
      const ac = await audioContext(); if (token !== requestId || document.hidden) return;
      stopTransport(); E.restartRound(state); resetInput();
      previewRound = { ...E.currentRound(state), start: 0 };
      preview = new R.Track(ac, [...R.beatEvents([previewRound]), ...R.melodyEvents(previewRound)].sort((a, b) => a.time - b.time));
      applyBeatVolume(); preview.start(0); ignoreUntil = Infinity; refreshTarget();
      message('멜로디 듣는 중 · 음표의 길이도 들어보세요', previewRound.duration + .5);
    } catch (error) {
      $('error').textContent = error.message; $('error').hidden = false;
      message('멜로디를 재생할 수 없어요', 3);
      stopTone(); if (playing) startTransport();
    }
  }
  function message(text, seconds) { statusText = text; statusUntil = performance.now() + seconds * 1000; }
  function sample(now) {
    if (!analyser || !samples || !playing || demo || now < ignoreUntil) { resetInput(); return; }
    if (now - lastSample < 33) return;
    lastSample = now; analyser.getFloatTimeDomainData(samples);
    let power = 0; for (const x of samples) power += x * x;
    inputRms = Math.sqrt(power / samples.length);
    const pitch = E.detectPitch(samples, audio.sampleRate, Number($('sensitivity').value) / 1000);
    if (!pitch) { inputHz = null; history = []; return; }
    history.push(pitch.frequency); if (history.length > 3) history.shift();
    inputHz = [...history].sort((a, b) => a - b)[Math.floor(history.length / 2)];
  }
  function burst(success) {
    flash = 1; flashSuccess = success;
    if (reducedMotion) return;
    for (let i = 0; i < (success ? 30 : 12); i++) particles.push({ x: 210, y: 280, vx: (Math.random() - 0.5) * 330, vy: (Math.random() - 0.6) * 270, life: 1.2, color: success ? ['#b8a1db', '#efcf79', '#a1c5a5', '#f1b4b6'][i % 4] : '#d8a5a1', size: 3 + Math.random() * 4 });
  }
  function updateUI(now) {
    $('score').textContent = String(state.score).padStart(5, '0');
    $('gate-count').innerHTML = `${state.gates} <small>/ 12</small>`;
    $('hearts').innerHTML = [0, 1, 2].map(i => `<span${i >= state.lives ? ' class="empty"' : ''}>♥</span>`).join('');
    $('hearts').setAttribute('aria-label', `남은 기회 ${state.lives}개`);
    $('journey-fill').style.width = state.gates / 12 * 100 + '%'; $('journey').setAttribute('aria-valuenow', state.gates);
    $('journey-text').textContent = state.gates ? `${state.gates} / 12개의 문` : '12개의 음표 문';
    const config = E.LEVELS[state.difficulty], holding = Math.round(state.hold * 100);
    $('hold-value').textContent = holding + '%'; $('hold-fill').style.width = holding + '%';
    $('hold-caption').textContent = playing && state.phase === 'singing' ? `이번 음 정확도 · ${state.remaining.toFixed(1)}초 남음` : '음마다 박자 안에서 맞춰요';
    const hz = demo && playing ? state.target === null ? null : E.frequency(state.target) : inputHz, n = E.note(hz);
    const cents = E.centsFrom(hz, state.target, state.freeOctave), matched = Math.abs(cents) <= config.tolerance;
    $('detected-note').textContent = n ? n.name : '—';
    $('detected-hz').textContent = n ? (demo ? '시연 음정' : hz.toFixed(1) + ' Hz') : '대기 중';
    $('needle').hidden = !n; $('needle').style.left = Math.max(1, Math.min(99, 50 + cents / 2)) + '%'; $('needle').classList.toggle('match', matched);
    $('volume').style.width = (demo ? 0 : Math.min(100, inputRms * 650)) + '%';
    $('cents-label').textContent = n ? `${cents > 0 ? '+' : ''}${Math.round(cents)} 센트` : '딱 맞아요';
    let hint = '마이크를 연결하면 음정이 보여요';
    if (demo && playing) hint = '자동 시연 · 마이크 입력 아님';
    else if (now < ignoreUntil) hint = '멜로디 듣는 중 · 판정은 쉬어요';
    else if (playing && state.phase === 'countin') hint = '네 박자를 듣고 첫 음을 준비해요';
    else if (playing && state.target === null) hint = n ? '쉼표예요 · 소리를 잠깐 멈춰요' : '잘 쉬고 있어요 · 다음 음을 준비해요';
    else if (playing && !n) hint = inputRms > .015 ? '현재 음을 또렷하게 불러보세요' : '편하게 “아—” 하고 불러주세요';
    else if (playing && matched) hint = '좋아요! 이 음을 유지해요';
    else if (playing && n) hint = cents < 0 ? '목소리를 조금 높여주세요 ↑' : '목소리를 조금 낮춰주세요 ↓';
    $('input-hint').textContent = hint;
    const text = now < statusUntil ? statusText : playing ? (state.phase === 'countin' ? `준비! ${Math.min(4, Math.floor(state.beat) + 1)} · 첫 음은 ${E.NOTES[state.target % 12]}` : state.target === null ? '쉼표 · 목소리를 잠깐 쉬어요' : state.matched ? '좋아요! 박자선을 따라 계속 불러요 ♫' : '지금 표시된 음을 박자에 맞춰 불러요') : '';
    if ($('game-message').textContent !== text) $('game-message').textContent = text;
    $('canvas-hint').textContent = demo ? '마이크 없이 둘러보는 중' : playing && state.combo > 1 ? `${state.combo} COMBO · 멋지게 날고 있어요!` : state.freeOctave ? '높이보다 음정이 중요해요' : '표시된 옥타브까지 맞춰주세요';
    renderRhythm();
  }
  function roundRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function star(x, y, size, color, rotation = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? size * .49 : size; const px = Math.cos(a) * r, py = Math.sin(a) * r; if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore();
  }
  function cloud(x, y, scale, opacity = .7) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.globalAlpha = opacity;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, 66, 17, 0, 0, Math.PI * 2); ctx.ellipse(-24, -12, 25, 23, 0, 0, Math.PI * 2); ctx.ellipse(12, -22, 32, 32, 0, 0, Math.PI * 2); ctx.ellipse(40, -9, 23, 21, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function island(x, y, size, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - size, y); ctx.bezierCurveTo(x - size * .7, y + 100, x + size * .4, y + 115, x + size, y); ctx.fill();
    ctx.fillStyle = '#d1ddbc'; ctx.beginPath(); ctx.ellipse(x, y, size, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a2b28d'; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) { let p = x - size * .5 + i * size * .23; ctx.beginPath(); ctx.moveTo(p, y - 3); ctx.quadraticCurveTo(p - 4, y - 18 - i % 2 * 8, p - 8, y - 12); ctx.stroke(); }
  }
  function drawGate(x, target, active = false, alpha = 1) {
    const n = target === null ? { name: '쉼', letter: 'REST', octave: '' } : E.note(E.frequency(target)), open = active && state.matched && playing;
    ctx.save(); ctx.globalAlpha = alpha; ctx.lineWidth = 1.5;
    const gateColor = open ? '#a2c7aa' : '#b7a8cb', edge = open ? '#83b48f' : '#a394bb';
    // A soft floating arch; the center veil visibly opens only for the right pitch.
    ctx.fillStyle = gateColor; ctx.beginPath(); ctx.moveTo(x, 430); ctx.lineTo(x, 212); ctx.bezierCurveTo(x, 120, x + 110, 120, x + 110, 212); ctx.lineTo(x + 110, 430); ctx.lineTo(x + 87, 430); ctx.lineTo(x + 87, 214); ctx.bezierCurveTo(x + 87, 156, x + 23, 156, x + 23, 214); ctx.lineTo(x + 23, 430); ctx.closePath(); ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
    ctx.fillStyle = open ? '#cce9c32a' : '#cbbce355'; ctx.fillRect(x + 23, 217, 64, 211);
    ctx.setLineDash([4, 7]); ctx.strokeStyle = open ? '#a8c89b' : '#bbacd1'; ctx.beginPath(); ctx.moveTo(x + 55, 225); ctx.lineTo(x + 55, 410); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) star(x + 39 + i % 2 * 30, 243 + i * 43, 4, open ? '#8abd91' : '#b5a5cf');
    roundRect(x - 5, 424, 120, 14, 7, open ? '#98ba97' : '#ab9ac0');
    roundRect(x + 22, 172, 66, 60, 18, '#faf8fd', open ? '#98bd9d' : '#c1b4d3');
    ctx.fillStyle = open ? '#5c9470' : '#8b76a5'; ctx.textAlign = 'center'; ctx.font = '800 28px "Noto Sans KR",sans-serif'; ctx.fillText(n.name, x + 55, 211);
    ctx.font = '700 13px Nunito,sans-serif'; ctx.fillStyle = '#a192b5'; ctx.fillText(n.letter + n.octave, x + 55, 121);
    if (active && playing && state.phase === 'singing') {
      const r = E.currentRound(state), slot = r.notes[state.noteIndex];
      roundRect(x - 4, 455, 118, 5, 3, '#d8d9d1'); roundRect(x - 4, 455, 118 * state.remaining / (slot.beats * r.secondsPerBeat), 5, 3, '#a7ba97');
      ctx.font = '600 13px "Noto Sans KR",sans-serif'; ctx.fillStyle = '#879477'; ctx.fillText(`${state.noteIndex + 1} / ${r.notes.length} · ${beatLabel(slot.beats)}박`, x + 55, 486);
    }
    ctx.restore();
  }
  function drawCharacter(y) {
    const x = 210, bob = reducedMotion ? 0 : Math.sin(visualTime * 2.6) * 7;
    ctx.save(); ctx.translate(x, y + bob);
    const halo = ctx.createRadialGradient(0, 0, 12, 0, 0, 90); halo.addColorStop(0, '#fff6c880'); halo.addColorStop(1, '#fff6c800'); ctx.fillStyle = halo; ctx.fillRect(-90, -90, 180, 180);
    if (playing && state.matched) { ctx.strokeStyle = '#a8c9a7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 58 + Math.sin(visualTime * 4) * 4, -.5, 1.9); ctx.stroke(); }
    ctx.save(); ctx.rotate(-.12); ctx.fillStyle = '#fffdf1'; ctx.strokeStyle = '#e3dcbf'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(-37, 9, 22, 11, -.5 + Math.sin(visualTime * 7) * .12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(37, 9, 22, 11, .5 - Math.sin(visualTime * 7) * .12, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.shadowColor = '#9fa87b30'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 5; star(0, 0, 44, '#f6d88a', -.12); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#756d61'; ctx.beginPath(); ctx.ellipse(-9, 0, 2.6, 3.9, 0, 0, Math.PI * 2); ctx.ellipse(10, 0, 2.6, 3.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e7b0a0'; ctx.beginPath(); ctx.ellipse(-18, 9, 5.5, 3.5, 0, 0, Math.PI * 2); ctx.ellipse(19, 9, 5.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8c7960'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(1, 7, 5, .1, Math.PI - .1); ctx.stroke();
    if (playing) { ctx.font = '700 24px serif'; ctx.fillStyle = state.matched ? '#7ba480' : '#b6a1ce'; ctx.fillText('♪', 54, -36 + Math.sin(visualTime * 3) * 5); }
    ctx.restore();
  }
  function draw(dt) {
    const chapter = Math.min(2, Math.floor(state.gates / 4)), colors = palettes[chapter];
    ctx.clearRect(0, 0, 1100, 600);
    const bg = ctx.createLinearGradient(0, 0, 0, 600); bg.addColorStop(0, colors[0]); bg.addColorStop(1, colors[1]); ctx.fillStyle = bg; ctx.fillRect(0, 0, 1100, 600);
    ctx.fillStyle = '#ffffff60'; ctx.beginPath(); ctx.arc(sceneWidth * .84, 124, 50, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#faf9e8'; ctx.beginPath(); ctx.arc(sceneWidth * .84, 124, 34, 0, Math.PI * 2); ctx.fill();
    cloud(145 - Math.sin(visualTime * .07) * 20, 130, .8, .7); cloud(504 - Math.sin(visualTime * .05) * 20, 87, .65, .6); cloud(1032, 260, 1.1, .45);
    for (let i = 0; i < 17; i++) { const x = (i * 173 + 75) % 1100, y = (i * 79 + 90) % 420; star(x, y, i % 3 === 0 ? 5 : 3, i % 2 ? '#c4cfb8' : '#cfbedb', .2); }
    ctx.fillStyle = colors[2] + '70'; ctx.beginPath(); ctx.moveTo(0, 540); ctx.bezierCurveTo(160, 360, 310, 575, 480, 474); ctx.bezierCurveTo(650, 370, 840, 554, 1100, 420); ctx.lineTo(1100, 600); ctx.lineTo(0, 600); ctx.fill();
    cloud(130, 490, 2.1, .65); cloud(610, 558, 2.8, .6); cloud(1090, 536, 2.5, .68);
    island(95, 565, 85, '#becbb6'); island(943, 499, 135, '#bfcbb7');
    ctx.strokeStyle = '#d2ddd0'; ctx.lineWidth = 1.6; ctx.setLineDash([4, 9]); ctx.beginPath(); ctx.moveTo(80, 285); ctx.bezierCurveTo(400, 240, 600, 320, 1060, 275); ctx.stroke(); ctx.setLineDash([]);
    if (!playing && state.status !== 'paused' && !resultShown) { drawGate(Math.min(670, sceneWidth * .72), state.target, false, .9); drawGate(960, 64, false, .35); }
    else { drawGate(state.gateX + 535, E.currentRound(state).notes[Math.min(state.noteIndex + 1, E.currentRound(state).notes.length - 1)].midi, false, .3); drawGate(state.gateX, state.target, true); }
    drawCharacter(!playing && state.status !== 'paused' && !resultShown && sceneWidth < 850 ? 125 : 277);
    if (playing && state.phase === 'singing') {
      const text = state.target === null ? '𝄽  잠깐 쉬어요' : '♪  ' + E.NOTES[state.target % 12] + '—';
      roundRect(139, 352, 142, 34, 17, '#ffffffce'); ctx.font = '600 14px "Noto Sans KR",sans-serif'; ctx.fillStyle = state.matched ? '#77a080' : '#9a89b1'; ctx.textAlign = 'center'; ctx.fillText(text, 210, 374);
    }
    for (const p of particles) { if (playing) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 100 * dt; p.life -= dt; } ctx.globalAlpha = Math.max(0, p.life / 1.2); star(p.x, p.y, p.size, p.color, p.life); }
    particles = particles.filter(p => p.life > 0); ctx.globalAlpha = 1;
    if (flash > 0) { ctx.fillStyle = flashSuccess ? `rgba(255,250,210,${flash * .13})` : `rgba(217,140,140,${flash * .2})`; ctx.fillRect(0, 0, 1100, 600); flash = Math.max(0, flash - dt * 2); }
  }
  function frame(now) {
    const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000)); lastTime = now;
    if (!reducedMotion && state.status !== 'paused' && !document.hidden) visualTime += dt;
    sample(now);
    if (preview) {
      preview.pump(); refreshTarget();
      if (preview.position() >= previewRound.duration + .45) { stopTone(); resetInput(); if (playing) startTransport(); refreshTarget(); }
    }
    if (playing && !preview && transport) {
      transport.pump();
      const elapsed = transport.position() - state.elapsed;
      if (elapsed > .25) { pause('화면이 잠시 느려져 박자를 다시 맞출게요.'); }
      else {
        const oldKey = `${state.gates}:${state.noteIndex}:${state.phase}`;
        E.tick(state, elapsed, demo ? state.target === null ? null : E.frequency(state.target) : inputHz);
        if (oldKey !== `${state.gates}:${state.noteIndex}:${state.phase}`) refreshTarget();
      }
      if (state.event === 'pass' || state.event === 'miss') { burst(state.event === 'pass'); message(state.event === 'pass' ? `${state.combo > 1 ? state.combo + ' COMBO · ' : ''}멜로디 통과!` : '다음에는 음표의 길이도 맞춰봐요', 1.3); }
      if (state.status === 'won' || state.status === 'lost') finish();
    }
    if (now - lastUI > 70) { updateUI(now); lastUI = now; }
    draw(dt); requestAnimationFrame(frame);
  }
  $('start').addEventListener('click', startGame);
  $('demo').addEventListener('click', () => { if (state.status === 'paused' || resultShown) resetLobby(); else return startDemo(); });
  $('pause').addEventListener('click', () => pause()); $('listen').addEventListener('click', playReference);
  $('beat-toggle').addEventListener('click', () => { beatMuted = !beatMuted; applyBeatVolume(); });
  $('beat-volume').addEventListener('input', applyBeatVolume);
  for (const input of document.querySelectorAll('input[name=mode], #difficulty, #free-octave')) input.addEventListener('change', resetLobby);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && playing) { event.preventDefault(); pause(); } });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (playing) pause('다른 화면에 있는 동안 비행을 멈췄어요.');
      if (requesting) { releaseMic(); requesting = false; $('start').disabled = false; $('start').textContent = '마이크 켜고 시작'; lockSettings(state.status === 'paused'); refreshTarget(); }
      stopTone();
    }
    lastTime = performance.now();
  });
  window.addEventListener('pagehide', () => { if (playing) pause(); releaseMic(); stopTone(); stopTransport(); if (audio) audio.close().catch(() => {}); });
  window.addEventListener('blur', () => { if (playing) pause(); else { stopTone(); refreshTarget(); } });
  resizeCanvas(); applyBeatVolume(); refreshTarget(); updateRecord(); updateUI(performance.now()); requestAnimationFrame(frame);
})();
