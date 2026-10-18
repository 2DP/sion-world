(function () {
  'use strict';
  const E = window.BlockBomber, AI = window.BlockBomberAI, $ = id => document.getElementById(id);
  const canvas = $('board'), ctx = canvas.getContext('2d'), cell = 48;
  const storageKey = 'sion-world-block-bomber-v1';
  const difficulties = { easy: '쉬움', normal: '보통', hard: '어려움' };
  const defaults = () => ({ unlocked: 1, difficulty: 'easy', muted: false, reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches, records: {}, bests: {} });
  function load() {
    const data = defaults();
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved || typeof saved !== 'object') return data;
      data.unlocked = Number.isInteger(saved.unlocked) ? Math.min(E.STAGES.length, Math.max(1, saved.unlocked)) : 1;
      data.difficulty = Object.hasOwn(difficulties, saved.difficulty) ? saved.difficulty : 'easy';
      if (typeof saved.muted === 'boolean') data.muted = saved.muted;
      if (typeof saved.reduced === 'boolean') data.reduced = saved.reduced;
      for (const d of Object.keys(difficulties)) {
        data.bests[d] = {};
        for (let stage = 1; stage <= E.STAGES.length; stage++) {
          const best = saved.bests?.[d]?.[stage];
          if (typeof best === 'number' && Number.isFinite(best) && best > 0) data.bests[d][stage] = best;
        }
        const r = saved.records?.[d]; data.records[d] = {};
        for (const k of ['wins', 'losses', 'draws']) data.records[d][k] = Number.isSafeInteger(r?.[k]) && r[k] >= 0 ? r[k] : 0;
      }
    } catch (_) { /* A private or full storage must not prevent play. */ }
    return data;
  }
  const prefs = load();
  const sound = window.BlockBomberAudio.create(() => new (window.AudioContext || window.webkitAudioContext)());
  sound.setMuted(prefs.muted);
  function save() { try { localStorage.setItem(storageKey, JSON.stringify(prefs)); } catch (_) { /* Session-only settings are enough. */ } }
  let selected = 1, state = E.create({ stage: 1, difficulty: prefs.difficulty, seed: 20261018 });
  let last = performance.now(), accumulator = 0, queuedBomb = false, queuedMove = null, lastPhase = '', toastUntil = 0, lastCount = '';
  const held = new Map(), particles = [];
  let heldOrder = 0;
  let stageBonus = null, revealAt = 0, newBest = false, lastKillAt = -Infinity, combo = 0, lastWarning = null;
  const stageHint = n => n <= 3 ? '느긋한 시작 · 아군과 함께 아이템을 모으세요' : n <= 6 ? '차근차근 강해지는 적 · 길을 함께 열어요' : n <= 9 ? '지원군 합류 · 넓어진 맵에서 협력하세요' : '마지막 팀 대결 · 동료와 함께 살아남으세요';
  const stageNumber = n => String(n).padStart(2, '0');
  let manualZoom = null, zoomed = false;
  function deathCopy() {
    const death = state.actors[0].death;
    if (!death) return '다음에는 모퉁이 뒤로 피할 길을 찾아 보세요.';
    if (death.cause === 'storm') return '좁아진 경기장 바깥에 있었어요. 경고 칸은 실드로 막을 수 없으니 중앙으로 피하세요.';
    if (death.cause === 'self') return '내 폭탄의 불꽃에 닿았어요. 설치한 뒤 모퉁이 너머로 피하세요.';
    return (death.killerId == null ? '폭탄' : (state.actors.find(a => a.id === death.killerId)?.name || '상대') + '의 폭탄') + ' 불꽃에 닿았어요. 연쇄 폭발과 남은 불꽃도 조심하세요.';
  }
  function text(id, value) { const element = $(id); if (element.textContent !== String(value)) element.textContent = value; }
  function clearInput() { held.clear(); queuedBomb = false; queuedMove = null; document.querySelectorAll('.pressed').forEach(b => b.classList.remove('pressed')); }
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = state.width * cell * dpr; canvas.height = state.height * cell * dpr;
    $('board-wrap').style.setProperty('--board-ratio', state.width / state.height);
    zoomed = manualZoom ?? (window.innerWidth < 780 && state.width > 17);
    $('map-view').classList.toggle('zoomed', zoomed);
    $('map-view').style.setProperty('--map-width', state.width * 28 + 'px');
    text('map-zoom', zoomed ? '전체 맵 보기' : '확대 · 따라가기');
    $('map-zoom').setAttribute('aria-pressed', String(zoomed));
    text('map-size', state.width + ' × ' + state.height + '칸');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function settings() {
    $('difficulty').value = prefs.difficulty;
    $('sound').textContent = prefs.muted ? '효과음 꺼짐 ♩' : '효과음 켜짐 ♪';
    $('sound').setAttribute('aria-pressed', String(prefs.muted));
    $('sound').setAttribute('aria-label', prefs.muted ? '효과음 켜기' : '효과음 끄기');
    $('motion').setAttribute('aria-pressed', String(prefs.reduced));
    document.body.classList.toggle('reduced-motion', prefs.reduced);
  }
  function stages() {
    $('stages').replaceChildren();
    E.STAGES.forEach((stage, i) => {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'stage-step' + (i + 1 === selected ? ' current' : i + 1 < prefs.unlocked ? ' passed' : '');
      button.disabled = state.phase !== 'ready' || i + 1 > prefs.unlocked;
      button.setAttribute('aria-label', '스테이지 ' + (i + 1) + ', 적 ' + stage.enemies + '명, 아군 ' + stage.allies + '명' + (i + 1 > prefs.unlocked ? ', 잠김' : ''));
      if (i + 1 === selected) button.setAttribute('aria-current', 'step');
      button.innerHTML = '<span class="stage-number">' + stageNumber(i + 1) + '</span><span><strong>STAGE ' + stageNumber(i + 1) + '</strong><small>적 ' + stage.enemies + ' · 아군 ' + stage.allies + '</small></span><span class="stage-status">' + (i + 1 < prefs.unlocked ? '✓' : i + 1 > prefs.unlocked ? '·' : '✦') + '</span>';
      button.addEventListener('click', () => { selected = i + 1; home(); }); $('stages').append(button);
    });
  }
  function rivals() {
    $('rivals').replaceChildren();
    for (const a of state.actors.slice(1)) {
      const el = document.createElement('div'); el.className = 'rival'; el.id = 'rival-' + a.id; el.style.setProperty('--cpu', a.color);
      el.innerHTML = '<span></span>' + a.name + ' · ' + E.PERSONALITIES[a.personality]; $('rivals').append(el);
    }
  }
  function overlay(mode) {
    const visible = !['playing', 'countdown'].includes(mode);
    $('overlay').hidden = !visible; $('board-wrap').classList.toggle('menu-open', visible);
    $('setup').hidden = mode !== 'ready'; $('result-stats').hidden = ['ready', 'paused'].includes(mode);
    $('reward-choice').hidden = mode !== 'stage-clear';
    if (mode === 'stage-clear') $('reward').value = 'shield';
    $('secondary').hidden = mode === 'ready'; $('pause').disabled = !['playing', 'countdown', 'paused'].includes(mode);
    $('pause').setAttribute('aria-label', mode === 'paused' ? '게임 재개' : '일시정지');
    $('pause').innerHTML = mode === 'paused' ? '▶ <span>이어서 하기</span>' : 'Ⅱ <span>잠깐 쉬기</span>';
    if (!visible) return;
    const win = mode === 'stage-clear' || mode === 'complete';
    const titles = { ready: '블록 사이,<br>짜릿한 한 판!', paused: '잠깐, 숨 고르기', 'stage-clear': '스테이지 클리어!', complete: '놀이터의 챔피언!', defeat: '앗, 아쉬워요!', draw: '이번 판은 무승부!' };
    const descriptions = {
      ready: '아군 ' + state.allies + '명과 함께 적 ' + state.enemies + '명을 이겨요!<br>우리 팀이 남아 있으면 ' + (selected === E.STAGES.length ? '최종 우승이에요.' : '다음 스테이지가 열려요.'),
      paused: '폭탄도, 컴퓨터도 잠깐 쉬고 있어요.<br>준비되면 다시 이어서 플레이하세요.',
      'stage-clear': (state.actors[0].alive ? '우리 팀 승리!' : '아군이 해냈어요! 우리 팀 승리!') + '<br>다음 단계: 적 ' + (E.STAGES[selected]?.enemies || 0) + '명 · 아군 ' + (E.STAGES[selected]?.allies || 0) + '명',
      complete: '12단계의 팀 대결을 모두 이겼어요!<br>우리 팀이 놀이터의 챔피언이에요!',
      defeat: '우리 팀이 모두 탈락했어요.<br>' + deathCopy(),
      draw: '남은 폭탄과 불꽃이 끝난 뒤<br>양쪽 팀 모두 탈락해 무승부예요.'
    };
    $('overlay-title').innerHTML = titles[mode]; $('overlay-copy').innerHTML = descriptions[mode];
    text('overlay-kicker', mode === 'ready' ? 'READY, SET, BOOM!' : mode === 'paused' ? 'TAKE A LITTLE BREAK' : win ? 'A LITTLE VICTORY, A BIG SMILE' : 'ONE MORE LITTLE ADVENTURE');
    $('primary').innerHTML = (mode === 'ready' ? '스테이지 ' + selected + ' 시작' : mode === 'paused' ? '이어서 하기' : mode === 'stage-clear' ? '다음 스테이지로' : mode === 'complete' ? '스테이지 1부터 다시' : '같은 스테이지 다시 도전') + '<span>→</span>';
    text('overlay-foot', mode === 'ready' ? '방향키로 이동 · SPACE로 폭탄' : mode === 'paused' ? 'ESC로도 다시 시작할 수 있어요' : difficulties[state.difficulty] + ' · STAGE ' + stageNumber(state.stage));
    if (!['ready', 'paused'].includes(mode)) {
      const p = state.actors[0]; $('result-stats').innerHTML = '<span><strong>' + Math.ceil(state.time) + '초</strong>플레이 시간</span><span><strong>' + p.kills + '</strong>직접 처치</span><span><strong>' + p.blocks + '</strong>부순 블록</span><span><strong>' + p.collected + '</strong>얻은 아이템</span>';
      if (newBest && win) text('overlay-foot', '새 최고 기록! ' + state.time.toFixed(1) + '초 · ' + difficulties[state.difficulty]);
    }
    if (mode !== 'ready') {
      $('primary').focus({ preventScroll: true });
      if (mode !== 'paused') $('board-wrap').scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  }
  function refresh() {
    stages(); rivals(); text('stage-label', 'STAGE ' + stageNumber(selected)); text('stage-name', E.STAGES[selected - 1].name);
    $('mission-copy').innerHTML = '아군 ' + state.allies + '명과 적 ' + state.enemies + '명에게 도전!<br>' + (selected === E.STAGES.length ? '마지막 놀이터의 챔피언이 되세요.' : '다음 놀이터로 떠나 보세요.');
    text('total', ' / ' + state.enemies); updateHUD();
  }
  function home() {
    sound.stop(); stageBonus = null; revealAt = 0; newBest = false;
    clearInput(); particles.length = 0; toastUntil = 0;
    state = E.create({ stage: selected, difficulty: prefs.difficulty, seed: 20261018 + selected });
    lastPhase = 'ready'; resize(); refresh(); overlay('ready');
  }
  function start() {
    sound.stop(); lastWarning = null; revealAt = 0; newBest = false; combo = 0; lastKillAt = -Infinity;
    initAudio(); clearInput(); particles.length = 0; toastUntil = 0;
    state = E.create({ stage: selected, difficulty: prefs.difficulty, phase: 'countdown', bonus: stageBonus });
    lastPhase = 'countdown'; lastCount = ''; accumulator = 0; resize(); refresh(); overlay('countdown'); canvas.focus({ preventScroll: true });
    document.querySelector('.arena-card').scrollIntoView({ block: 'start', behavior: prefs.reduced ? 'instant' : 'smooth' });
  }
  function togglePause() {
    sound.stop();
    clearInput(); accumulator = 0;
    if (state.phase === 'paused') { initAudio(); E.resume(state); canvas.focus({ preventScroll: true }); }
    else E.pause(state);
    lastPhase = state.phase; overlay(state.phase);
  }
  function initAudio() { return sound.unlock(); }
  function tone(type) { sound.play(type); }
  function showToast(message) { text('toast', message); toastUntil = state.time + 1.8; }
  function events() {
    const sounds = new Set();
    for (const ev of state.events) {
      if (ev.type === 'result') sounds.add(state.phase);
      else if (ev.type === 'item' && ev.id === 0) sounds.add('item-' + ev.item);
      else if (['place', 'explode', 'block', 'start'].includes(ev.type) || ev.id === 0) sounds.add(ev.type);
      if (ev.type === 'item' && ev.id === 0) showToast(ev.upgraded ? {
        bomb: '폭탄 추가! 최대 ' + state.actors[0].capacity + '개 설치',
        fire: '범위 강화! 상하좌우 ' + state.actors[0].range + '칸',
        superfire: '슈퍼 불꽃! 상하좌우 ' + state.actors[0].range + '칸',
        speed: '스피드 업! 발걸음이 가벼워요', shield: '실드 장착! 폭발을 한 번 막아요'
      }[ev.item] : E.ITEMS[ev.item].name + ' · 이미 최대예요');
      if (ev.type === 'shield' && ev.id === 0) showToast('실드가 막았어요! 지금 피하세요');
      if (ev.type === 'death' && ev.killerId === 0) {
        combo = state.time - lastKillAt <= 2 ? combo + 1 : 1; lastKillAt = state.time;
        showToast(combo > 1 ? combo + '연속 처치! 멋진 폭발이에요!' : 'CPU ' + ev.id + ' 처치! 내 폭탄이 명중했어요');
        sounds.add(combo > 1 ? 'combo' : 'kill');
      }
      if (['block', 'death'].includes(ev.type) && !prefs.reduced) for (let i = 0; i < 5; i++) particles.push({ x: (ev.x + .5) * cell, y: (ev.y + .5) * cell, vx: (Math.random() - .5) * 95, vy: -25 - Math.random() * 75, at: state.time, color: ev.color || '#dd996b' });
    }
    sounds.forEach(tone);
    if (state.phase !== lastPhase) {
      if (['stage-clear', 'complete', 'defeat', 'draw'].includes(state.phase)) {
        const r = prefs.records[state.difficulty] || (prefs.records[state.difficulty] = { wins: 0, losses: 0, draws: 0 });
        const kind = state.phase === 'defeat' ? 'losses' : state.phase === 'draw' ? 'draws' : 'wins'; r[kind]++;
        if (kind === 'wins') {
          prefs.unlocked = Math.max(prefs.unlocked, Math.min(E.STAGES.length, selected + 1));
          const bests = prefs.bests[state.difficulty] || (prefs.bests[state.difficulty] = {});
          newBest = !bests[selected] || state.time < bests[selected];
          if (newBest) bests[selected] = state.time;
        }
        save(); clearInput(); stages();
      }
      lastPhase = state.phase;
      if (['defeat', 'draw'].includes(state.phase) && state.actors[0].death && state.time - state.actors[0].death.at < 1) {
        revealAt = performance.now() + 1600; overlay('playing'); $('pause').disabled = true;
      } else overlay(state.phase);
    }
  }
  function updateHUD() {
    const p = state.actors[0], seconds = Math.floor(state.time);
    const border = E.storm(state), notice = $('battle-notice');
    if (border.warning && state.phase === 'playing') {
      const warning = Math.ceil(border.due - state.time);
      if (warning !== lastWarning) { tone('warning'); lastWarning = warning; }
    } else if (!border.warning) lastWarning = null;
    text('battle-notice', revealAt ? deathCopy() : ['complete', 'stage-clear'].includes(state.phase) ? '우리 팀 승리! 마지막 불꽃까지 모두 확인했어요.' : ['defeat', 'draw'].includes(state.phase) ? '경기가 끝났어요. 다시 도전해 보세요!' : state.settling ? '마지막 폭탄과 불꽃이 끝날 때까지 기다려요! 아직 피할 수 있어요.' : !p.alive ? '관전 중 · 아군이 싸우고 있어요! 우리 팀이 남아 있으면 패배가 아니에요.' : border.warning ? '⚠ ' + Math.max(1, Math.ceil(border.due - state.time)) + '초 후 표시된 바닥이 위험해져요! 중앙으로 이동 · 실드 방어 불가' : border.ring ? '⚠ 바깥쪽은 위험해요! 중앙에서 승부를 끝내세요 · 실드 방어 불가' : stageHint(selected));
    notice.classList.toggle('danger', !!revealAt || border.warning || border.ring > 0);
    text('alive', E.teamCounts(state).enemies);
    text('team-alive', '우리 팀 ' + E.teamCounts(state).ours + ' / ' + (state.allies + 1));
    text('timer', String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'));
    $('timer').parentElement.classList.toggle('urgent', border.warning || border.ring > 0);
    text('power-bomb', (p.capacity - E.activeBombs(state, p)) + ' / ' + p.capacity); text('power-fire', p.range + '칸'); text('power-speed', p.speed + '칸/초');
    const protectedNow = state.time + 1e-8 < p.protectedUntil;
    text('power-shield', p.shield ? '1회' : protectedNow ? '보호 중' : '없음');
    $('power-shield').classList.toggle('active-shield', !!p.shield || protectedNow);
    $('power-shield').setAttribute('aria-label', p.shield ? '실드 1회 준비' : protectedNow ? '실드 발동 후 잠깐 보호 중' : '실드 없음');
    $('power-bomb').setAttribute('aria-label', '사용 가능한 폭탄 ' + (p.capacity - E.activeBombs(state, p)) + '개, 최대 ' + p.capacity + '개');
    for (const a of state.actors.slice(1)) { const el = $('rival-' + a.id); if (el) { el.classList.toggle('out', !a.alive); el.setAttribute('aria-label', a.name + (a.alive ? ' 생존' : ' 탈락')); } }
    const r = prefs.records[prefs.difficulty] || { wins: 0, losses: 0, draws: 0 };
    const best = prefs.bests[prefs.difficulty]?.[selected];
    text('record', difficulties[prefs.difficulty] + ' 전적 · ' + r.wins + '승 ' + r.losses + '패 ' + r.draws + '무 · 최고 해금 ' + prefs.unlocked + '단계' + (best ? ' · 이 단계 최고 ' + best.toFixed(1) + '초' : ''));
    $('toast').classList.toggle('visible', state.time < toastUntil && state.phase === 'playing');
    $('countdown').hidden = state.phase !== 'countdown';
    if (state.phase === 'countdown') { const count = String(Math.ceil(state.countdown)); text('countdown', count); if (lastCount !== count) { lastCount = count; tone('countdown'); } }
  }
  function round(x, y, w, h, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
  function circle(x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function label(value, x, y, size, color, weight = 'bold') { ctx.fillStyle = color; ctx.font = weight + ' ' + size + 'px "Malgun Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(value, x, y); }
  function star(x, y, r, color) {
    ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, d = i % 2 ? r * .32 : r; const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function shieldShape(x, y, size, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size * .8, y - size * .65);
    ctx.quadraticCurveTo(x + size * .85, y + size * .5, x, y + size);
    ctx.quadraticCurveTo(x - size * .85, y + size * .5, x - size * .8, y - size * .65); ctx.closePath(); ctx.fill();
  }
  function drawItem(type, x, y) {
    const colors = { bomb: ['#ede3f1', '#706781'], fire: ['#fff0c7', '#db9853'], speed: ['#e3f0df', '#4c927a'], shield: ['#dceffd', '#548fc1'], superfire: ['#ffe0db', '#cc6654'] }, [bg, fg] = colors[type];
    round(x + 9, y + 12, 30, 30, 9, '#405b3720'); round(x + 9, y + 8, 30, 30, 8, '#fffdf4'); round(x + 12, y + 11, 24, 24, 6, bg);
    if (type === 'bomb') { circle(x + 23, y + 24, 7, fg); ctx.strokeStyle = fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 24, y + 17); ctx.lineTo(x + 28, y + 14); ctx.stroke(); label('+', x + 34, y + 34, 11, fg); }
    if (type === 'fire') star(x + 24, y + 23, 10, fg);
    if (type === 'superfire') { star(x + 20, y + 24, 9, fg); star(x + 30, y + 19, 6, '#e8a43c'); label('+2', x + 30, y + 33, 8, '#a14c3d'); }
    if (type === 'shield') { shieldShape(x + 24, y + 23, 10, fg); label('1', x + 24, y + 23, 12, '#fffdf6'); }
    if (type === 'speed') { ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(x + 27, y + 13); ctx.lineTo(x + 17, y + 25); ctx.lineTo(x + 24, y + 25); ctx.lineTo(x + 21, y + 34); ctx.lineTo(x + 32, y + 21); ctx.lineTo(x + 25, y + 21); ctx.closePath(); ctx.fill(); }
  }
  function drawBomb(b) {
    const x = b.x * cell + 24, y = b.y * cell + 27, left = Math.max(0, b.due - state.time), flash = left < .5 && !prefs.reduced && Math.floor(state.time * 12) % 2;
    ctx.save(); if (!prefs.reduced) { const scale = 1 + Math.sin(state.time * (left < .5 ? 24 : 8)) * .035; ctx.translate(x, y); ctx.scale(scale, scale); ctx.translate(-x, -y); }
    ctx.fillStyle = '#334d3730'; ctx.beginPath(); ctx.ellipse(x, y + 12, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a18252'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + 3, y - 12); ctx.quadraticCurveTo(x + 5, y - 23, x + 12, y - 21); ctx.stroke();
    star(x + 12, y - 21, 5, '#fff3b4'); round(x - 3, y - 16, 10, 7, 2, '#60726a'); circle(x, y, 15, flash ? '#bb674e' : '#354b47'); circle(x - 5, y - 5, 4, flash ? '#e8a576' : '#6d8a78');
    ctx.strokeStyle = '#f9d17a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left / 2); ctx.stroke(); ctx.restore();
  }
  function drawActor(a) {
    if (!a.alive) return;
    const t = prefs.reduced ? 1 : Math.min(1, Math.max(0, (state.time - a.movedAt) / .13));
    const x = (a.prevX + (a.x - a.prevX) * t) * cell + 24, y = (a.prevY + (a.y - a.prevY) * t) * cell + 25;
    const bob = prefs.reduced || t >= 1 ? 0 : -Math.sin(t * Math.PI) * 2;
    ctx.save(); ctx.translate(x, y + bob);
    const protectedNow = state.time + 1e-8 < a.protectedUntil;
    if (a.shield || protectedNow) {
      ctx.fillStyle = protectedNow ? '#d1f4ff70' : '#d1edff38'; ctx.strokeStyle = protectedNow ? '#f5fdff' : '#69b6dc'; ctx.lineWidth = protectedNow ? 3 : 2;
      ctx.beginPath(); ctx.ellipse(0, -3, 22, 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#345a3430'; ctx.beginPath(); ctx.ellipse(0, 15 - bob, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
    if (!a.id) { ctx.strokeStyle = '#fff9d9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 15 - bob, 19, 8, 0, 0, Math.PI * 2); ctx.stroke(); }
    round(-11, 8, 9, 9, 3, '#3a5149'); round(3, 8, 9, 9, 3, '#3a5149');
    round(-13, -1, 26, 15, 7, a.color); round(-17, 0, 6, 10, 3, a.color); round(11, 0, 6, 10, 3, a.color);
    round(-16, -21, 32, 28, 11, a.color); round(-12, -16, 24, 18, 7, '#fff1cf');
    if (a.id) { round(-2, -26, 4, 7, 2, '#586958'); circle(0, -27, 4, a.color); } else { round(-10, -23, 20, 5, 2, '#afd8ba'); }
    const look = E.DIRS[a.dir] || [0, 0]; circle(-5 + look[0], -8 + look[1], 2, '#3a5149'); circle(5 + look[0], -8 + look[1], 2, '#3a5149');
    circle(-9, -3, 2, '#edbb9f'); circle(9, -3, 2, '#edbb9f'); round(-3, 4, 6, 5, 2, '#f7d27b');
    round(-12, -39, 24, 11, 4, a.id ? '#fcf9e6e8' : '#2c6557'); label(a.id ? (a.team === 0 ? '아' + (a.id - state.enemies) : '적' + a.id) : '나', 0, -33, 8, a.id ? '#576b52' : '#fff6d8');
    if (a.shield) { shieldShape(16, -20, 7, '#548fc1'); label('1', 16, -20, 8, '#fff'); }
    ctx.restore();
  }
  function draw() {
    const w = state.width * cell, h = state.height * cell;
    ctx.clearRect(0, 0, w, h);
    for (let y = 0; y < state.height; y++) for (let x = 0; x < state.width; x++) {
      const px = x * cell, py = y * cell, t = E.tile(state, x, y);
      ctx.fillStyle = (x + y) % 2 ? '#cbdcb6' : '#d3e2bf'; ctx.fillRect(px, py, cell, cell);
      if ((x * 7 + y * 13) % 11 === 0 && !t) { circle(px + 8, py + 37, 1.2, '#a3bd90'); circle(px + 12, py + 35, 1, '#a3bd90'); }
      if (t === 1) {
        round(px + 2, py + 6, 44, 41, 8, '#416f5e'); round(px + 2, py + 2, 44, 39, 8, '#6b9780'); round(px + 6, py + 5, 36, 29, 6, '#83aa8a');
        round(px + 10, py + 8, 27, 3, 2, '#aac5a1'); circle(px + 10, py + 28, 1.5, '#628b73'); circle(px + 37, py + 28, 1.5, '#628b73');
      } else if (t === 2) {
        round(px + 4, py + 8, 40, 38, 7, '#b87955'); round(px + 3, py + 3, 42, 37, 7, '#e2a576'); round(px + 7, py + 6, 34, 30, 5, '#edbb8e');
        ctx.strokeStyle = '#c99064'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px + 13, py + 11); ctx.lineTo(px + 35, py + 30); ctx.moveTo(px + 35, py + 11); ctx.lineTo(px + 13, py + 30); ctx.stroke();
        for (const dx of [10, 38]) for (const dy of [9, 32]) circle(px + dx, py + dy, 1.2, '#ffe1b5');
      }
    }
    for (const [i, type] of Object.entries(state.items)) drawItem(type, Number(i) % state.width * cell, Math.floor(Number(i) / state.width) * cell);
    for (let y = 1; y < state.height - 1; y++) for (let x = 1; x < state.width - 1; x++) {
      const due = E.stormDue(state, x, y), left = due - state.time;
      if (E.tile(state, x, y) === 1 || left > 8) continue;
      round(x * cell + 2, y * cell + 2, 44, 44, 7, left <= 1e-8 ? '#923b46dd' : '#eeaa4470');
      label(left <= 1e-8 ? '×' : '!', x * cell + 24, y * cell + 24, 24, '#fff6db');
    }
    for (const f of state.flames) for (const i of f.cells) {
      const x = i % state.width * cell, y = Math.floor(i / state.width) * cell;
      round(x + 1, y + 1, 46, 46, 10, '#edaa4b'); round(x + 8, y + 5, 32, 38, 12, '#ffd781'); star(x + 24, y + 24, prefs.reduced ? 16 : 15 + Math.sin(state.time * 25 + i) * 3, '#fff7ce');
    }
    state.bombs.forEach(drawBomb);
    if (zoomed) {
      const followed = state.actors[0].alive ? state.actors[0] : state.actors.find(a => a.alive && a.team === 0);
      const view = $('map-view');
      if (followed) { view.scrollLeft = (followed.x + .5) * canvas.clientWidth / state.width - view.clientWidth / 2; view.scrollTop = (followed.y + .5) * canvas.clientHeight / state.height - view.clientHeight / 2; }
    }
    state.actors.slice().sort((a, b) => a.y - b.y || a.id - b.id).forEach(drawActor);
    const death = state.actors[0].death;
    if (revealAt && death) {
      ctx.strokeStyle = '#fff7ed'; ctx.lineWidth = 3;
      for (const i of death.cells) ctx.strokeRect(i % state.width * cell + 3, Math.floor(i / state.width) * cell + 3, 42, 42);
      circle(death.x * cell + 24, death.y * cell + 24, 17, '#963f4c');
      label('나 ×', death.x * cell + 24, death.y * cell + 24, 13, '#fff');
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i], t = state.time - p.at; if (t > .65) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, 1 - t / .65); round(p.x + p.vx * t, p.y + p.vy * t + t * t * 110, 5, 5, 1, p.color); ctx.globalAlpha = 1;
    }
  }
  const keyDirs = { ArrowUp: 'up', KeyW: 'up', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left' };
  document.addEventListener('keydown', ev => {
    if (ev.code === 'Escape' && ['playing', 'paused', 'countdown'].includes(state.phase)) { ev.preventDefault(); if (!ev.repeat) togglePause(); return; }
    if (state.phase !== 'playing') return;
    if (keyDirs[ev.code]) { ev.preventDefault(); if (!held.has(ev.code)) { held.set(ev.code, { dir: keyDirs[ev.code], order: ++heldOrder }); queuedMove = { dir: keyDirs[ev.code], until: state.time + .3 }; } }
    if (ev.code === 'Space') { ev.preventDefault(); if (!ev.repeat) queuedBomb = true; }
  });
  document.addEventListener('keyup', ev => { held.delete(ev.code); if (ev.code === 'Space' && state.phase === 'playing') ev.preventDefault(); });
  for (const b of document.querySelectorAll('[data-dir]')) {
    b.addEventListener('pointerdown', ev => { ev.preventDefault(); if (state.phase !== 'playing') return; b.setPointerCapture(ev.pointerId); held.set('touch-' + ev.pointerId, { dir: b.dataset.dir, order: ++heldOrder }); queuedMove = { dir: b.dataset.dir, until: state.time + .3 }; b.classList.add('pressed'); });
    const release = ev => { held.delete('touch-' + ev.pointerId); b.classList.remove('pressed'); };
    b.addEventListener('pointerup', release); b.addEventListener('pointercancel', ev => { release(ev); queuedMove = null; }); b.addEventListener('lostpointercapture', release);
    b.addEventListener('contextmenu', ev => ev.preventDefault());
  }
  $('bomb-button').addEventListener('pointerdown', ev => { ev.preventDefault(); if (state.phase !== 'playing') return; queuedBomb = true; $('bomb-button').classList.add('pressed'); $('bomb-button').setPointerCapture(ev.pointerId); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('bomb-button').addEventListener(type, () => $('bomb-button').classList.remove('pressed'));
  $('bomb-button').addEventListener('click', ev => { if (!ev.detail && state.phase === 'playing') queuedBomb = true; });
  $('bomb-button').addEventListener('contextmenu', ev => ev.preventDefault());
  $('primary').addEventListener('click', () => {
    if (state.phase === 'paused') { initAudio(); togglePause(); return; }
    if (state.phase === 'stage-clear') { stageBonus = $('reward').value === 'bomb' ? 'bomb' : 'shield'; selected++; }
    else if (state.phase === 'complete') { selected = 1; stageBonus = null; }
    start();
  });
  $('secondary').addEventListener('click', home);
  $('map-zoom').addEventListener('click', () => { manualZoom = !zoomed; resize(); });
  $('pause').addEventListener('click', togglePause);
  $('difficulty').addEventListener('change', () => { prefs.difficulty = $('difficulty').value; state.difficulty = prefs.difficulty; save(); updateHUD(); });
  $('sound').addEventListener('click', () => { prefs.muted = !prefs.muted; sound.setMuted(prefs.muted); initAudio().then(() => { if (!prefs.muted) tone('item'); }); save(); settings(); });
  $('motion').addEventListener('click', () => { prefs.reduced = !prefs.reduced; save(); settings(); });
  function deactivate() { sound.stop(); clearInput(); if (E.pause(state)) { lastPhase = state.phase; overlay('paused'); } accumulator = 0; }
  window.addEventListener('blur', deactivate);
  document.addEventListener('visibilitychange', () => { if (document.hidden) deactivate(); last = performance.now(); });
  window.addEventListener('resize', resize);
  function frame(now) {
    accumulator += Math.min(.1, (now - last) / 1000); last = now;
    while (accumulator >= 1 / 60) {
      if (queuedMove && queuedMove.until < state.time) queuedMove = null;
      const direction = [...held.values()].sort((a, b) => b.order - a.order)[0]?.dir || queuedMove?.dir;
      if (direction && state.time + 1 / 60 + 1e-8 >= state.actors[0].nextMove) queuedMove = null;
      const bomb = queuedBomb; queuedBomb = false;
      E.step(state, { 0: { dir: direction, bomb } }, 1 / 60, AI.input);
      if (bomb && state.phase === 'playing' && !state.events.some(e => e.type === 'place' && e.id === 0) && E.activeBombs(state, state.actors[0]) >= state.actors[0].capacity) showToast('폭탄이 터지면 다시 놓을 수 있어요');
      events(); accumulator -= 1 / 60;
    }
    if (revealAt && now >= revealAt) { revealAt = 0; overlay(state.phase); }
    updateHUD(); draw(); requestAnimationFrame(frame);
  }
  settings(); resize(); refresh(); overlay('ready'); lastPhase = 'ready'; requestAnimationFrame(frame);
})();
