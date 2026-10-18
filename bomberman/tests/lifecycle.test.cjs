const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Engine = require('../engine.js');
const AI = require('../ai.js');
const folder = path.resolve(__dirname, '..');

// A DOM boundary fixture exercises actual game.js handlers and engine results,
// without adding a debug/cheat API to the shipped game or changing browser saves.
function app(options = {}) {
  const elements = new Map(), handlers = {}, storage = new Map();
  if (options.saved) storage.set('sion-world-block-bomber-v1', JSON.stringify(options.saved));
  let current, raf, now = 0;
  const context2d = new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) });
  class Element {
    constructor(id = '') { this.id = id; this.children = []; this.listeners = {}; this.dataset = {}; this.attrs = {}; this.textContent = ''; this.innerHTML = ''; this.hidden = false; this.disabled = false; this.value = ''; this.classes = new Set(); this.style = { setProperty() {} }; this.classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c), toggle: (c, v) => v ? this.classes.add(c) : this.classes.delete(c) }; }
    addEventListener(event, fn) { (this.listeners[event] ||= []).push(fn); }
    dispatch(event, args = {}) { for (const fn of this.listeners[event] || []) fn(args); }
    click() { if (!this.disabled) this.dispatch('click'); }
    append(e) { this.children.push(e); if (e.id) elements.set(e.id, e); }
    replaceChildren() { this.children = []; }
    setAttribute(k, v) { this.attrs[k] = v; }
    focus() {} scrollIntoView() {} setPointerCapture() {} getContext() { return context2d; }
  }
  const html = fs.readFileSync(path.join(folder, 'index.html'), 'utf8');
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) elements.set(id, new Element(id));
  const body = new Element(), arena = new Element(), dpad = Object.keys(Engine.DIRS).map(dir => { const e = new Element(); e.dataset.dir = dir; return e; });
  elements.get('timer').parentElement = new Element();
  const document = {
    body, hidden: false, getElementById: id => elements.get(id), createElement: () => new Element(),
    querySelector: selector => selector === '.arena-card' ? arena : null,
    querySelectorAll: selector => selector === '[data-dir]' ? dpad : [...elements.values()].filter(e => e.classes.has('pressed')),
    addEventListener: (event, fn) => { handlers[event] = fn; }
  };
  const scope = { document, console, performance: { now: () => now }, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }), addEventListener: (event, fn) => { handlers['window:' + event] = fn; },
    localStorage: {
      getItem: key => { if (options.storageFails) throw new Error('blocked'); return options.corrupt ? '{broken' : storage.get(key) || null; },
      setItem: (key, value) => { if (options.storageFails) throw new Error('blocked'); storage.set(key, value); }
    },
    requestAnimationFrame: fn => { raf = fn; },
    BlockBomber: { ...Engine, create: opts => (current = Engine.create({ ...opts, seed: 123 })) }, BlockBomberAI: AI,
    BlockBomberAudio: options.audio || require('../audio.js')
  };
  scope.window = scope;
  vm.runInNewContext(fs.readFileSync(path.join(folder, 'game.js'), 'utf8'), scope, { filename: 'game.js' });
  return { elements, handlers, storage, state: () => current, click: id => elements.get(id).click(),
    advance: ticks => { for (let n = 0; n < ticks; n++) { now += 1000 / 60 + .001; raf(now); } } };
}
test('real UI handlers advance through 12 team stages, unlock stages, save once per win, and finish the campaign', () => {
  const ui = app();
  assert.equal(ui.elements.get('stages').children[1].disabled, true);
  ui.click('primary');
  for (let stage = 1; stage <= Engine.STAGES.length; stage++) {
    assert.equal(ui.state().stage, stage); assert.equal(ui.state().actors.length, 1 + ui.state().enemies + ui.state().allies);
    ui.advance(181); assert.equal(ui.state().phase, 'playing');
    ui.state().actors.slice(1).forEach(a => { a.alive = false; }); ui.advance(151);
    assert.equal(ui.state().phase, stage < Engine.STAGES.length ? 'stage-clear' : 'complete');
    assert.equal(ui.elements.get('overlay').hidden, false);
    ui.advance(120);
    const saved = JSON.parse([...ui.storage.values()][0]);
    assert.equal(saved.unlocked, Math.min(Engine.STAGES.length, stage + 1)); assert.equal(saved.records.easy.wins, stage);
    if (stage < Engine.STAGES.length) ui.click('primary');
  }
  assert.match(ui.elements.get('overlay-title').innerHTML, /챔피언/);
  ui.click('secondary'); assert.ok(ui.elements.get('stages').children.every(b => !b.disabled));
  ui.elements.get('stages').children[11].click(); assert.equal(ui.state().stage, 12);
  ui.click('primary'); assert.equal(ui.state().enemies, 6);
});
test('defeat retries the same stage, while pause and blur clear pending input and freeze time', () => {
  const ui = app(); ui.click('primary'); ui.advance(181);
  const key = { code: 'ArrowRight', repeat: false, preventDefault() {} }; ui.handlers.keydown(key);
  ui.click('pause'); const time = ui.state().time, x = ui.state().actors[0].x;
  ui.advance(180); assert.equal(ui.state().time, time); ui.click('primary'); ui.advance(1); assert.equal(ui.state().actors[0].x, x);
  ui.handlers['window:blur'](); assert.equal(ui.state().phase, 'paused'); ui.click('primary');
  ui.state().actors.filter(a => a.team === 0).forEach(a => { a.alive = false; }); ui.advance(1); assert.equal(ui.state().phase, 'defeat');
  ui.click('primary'); assert.equal(ui.state().stage, 1); assert.equal(ui.state().phase, 'countdown'); assert.ok(ui.state().actors[0].alive);
});
test('short key taps between simulation frames still move once; held space does not repeat', () => {
  const ui = app(); ui.click('primary'); ui.advance(181);
  ui.handlers.keydown({ code: 'ArrowRight', repeat: false, preventDefault() {} }); ui.handlers.keyup({ code: 'ArrowRight' });
  ui.advance(1); assert.equal(ui.state().actors[0].x, 2); ui.advance(20); assert.equal(ui.state().actors[0].x, 2);
  ui.handlers.keydown({ code: 'Space', repeat: false, preventDefault() {} }); ui.advance(1); assert.equal(ui.state().bombs.filter(b => b.owner === 0).length, 1);
  ui.handlers.keydown({ code: 'Space', repeat: true, preventDefault() {} }); ui.advance(1); assert.equal(ui.state().bombs.filter(b => b.owner === 0).length, 1);
});
test('corrupt or unavailable browser storage does not block start, results or retry', () => {
  for (const options of [{ storageFails: true }, { corrupt: true }]) {
    const ui = app(options); ui.click('primary'); ui.advance(181); ui.state().actors[1].alive = false; ui.advance(1);
    assert.equal(ui.state().phase, 'stage-clear'); ui.click('primary'); assert.equal(ui.state().stage, 2);
  }
});
test('shield and range HUD, pickup notices and rendering follow the actual new item effects', () => {
  const ui = app(); ui.click('primary'); ui.advance(181);
  const s = ui.state(), p = s.actors[0], i = Engine.index(s, p.x, p.y);
  s.items[i] = 'shield'; ui.advance(1); assert.equal(ui.elements.get('power-shield').textContent, '1회');
  assert.match(ui.elements.get('toast').textContent, /실드 장착/);
  s.items[i] = 'superfire'; ui.advance(1); assert.equal(ui.elements.get('power-fire').textContent, '4칸');
  s.flames.push({ cells: new Set([i]), until: s.time + .4 }); ui.advance(1);
  assert.equal(ui.elements.get('power-shield').textContent, '보호 중'); assert.match(ui.elements.get('toast').textContent, /실드가 막았어요/);
  ui.advance(49); assert.equal(ui.elements.get('power-shield').textContent, '없음'); assert.equal(p.alive, true);
  s.items[Engine.index(s, 3, 3)] = 'superfire'; s.items[Engine.index(s, 3, 1)] = 'shield'; ui.advance(1);
});
test('shipped page references exist and the root card points to the real game and icons', () => {
  for (const file of [path.join(folder, 'index.html'), path.join(folder, '..', 'index.html')]) {
    const html = fs.readFileSync(file, 'utf8');
    for (const [, value] of html.matchAll(/(?:src|href)="(\.[^"]+)"/g)) {
      const local = path.resolve(path.dirname(file), value.split('?')[0]); assert.ok(fs.existsSync(local), value);
    }
  }
  const root = fs.readFileSync(path.join(folder, '..', 'index.html'), 'utf8');
  assert.match(root, /href="\.\/bomberman\/"/); assert.match(root, /bomberman\/assets\/icon.svg/);
  const listedGames = [...root.matchAll(/<a\s+class="game(?:\s|")/g)].length;
  assert.equal(Number(root.match(/class="count">게임 (\d+)개/)[1]), listedGames);
});

test('clear reward choice survives a retry, is replaced at the next clear, and resets at home', () => {
  const ui = app(); ui.click('primary'); ui.advance(181);
  ui.state().actors.slice(1).forEach(a => { a.alive = false; }); ui.advance(1);
  assert.equal(ui.elements.get('reward-choice').hidden, false);
  ui.elements.get('reward').value = 'bomb'; ui.click('primary');
  assert.equal(ui.state().actors[0].capacity, 2); assert.equal(ui.state().actors[0].shield, 0);
  ui.advance(181); ui.state().actors.filter(a => a.team === 0).forEach(a => { a.alive = false; }); ui.advance(1); ui.click('primary');
  assert.equal(ui.state().stage, 2); assert.equal(ui.state().actors[0].capacity, 2);
  ui.advance(181); ui.state().actors.slice(1).forEach(a => { a.alive = false; }); ui.advance(1);
  ui.elements.get('reward').value = 'shield'; ui.click('primary');
  assert.equal(ui.state().actors[0].shield, 1); assert.equal(ui.state().actors[0].capacity, 1);
  ui.click('pause'); ui.click('secondary'); ui.click('primary');
  assert.equal(ui.state().actors[0].shield, 0); assert.equal(ui.state().actors[0].capacity, 1);
});

test('fatal hit reveals actual cause and path before presenting retry; simulation stays frozen', () => {
  const ui = app(); ui.click('primary'); ui.advance(181);
  const s = ui.state(), p = s.actors[0]; s.actors.filter(a => a.id && a.team === 0).forEach(a => { a.alive = false; });
  s.flames.push({ cells: new Set([Engine.index(s, p.x, p.y)]), owner: 0, until: s.time + .4 });
  ui.advance(25); const time = s.time;
  assert.equal(s.phase, 'defeat'); assert.equal(ui.elements.get('overlay').hidden, true);
  assert.match(ui.elements.get('battle-notice').textContent, /내 폭탄/);
  assert.equal(p.death.cells.length, 1);
  ui.advance(100); assert.equal(s.time, time); assert.equal(ui.elements.get('overlay').hidden, false);
  assert.match(ui.elements.get('overlay-copy').innerHTML, /내 폭탄/);
});

test('kill feedback and stage best times reflect actual kills and only improve on faster wins', () => {
  const ui = app(); ui.click('primary'); ui.advance(181);
  let s = ui.state(); s.stage = 2;
  s.actors.push({ ...s.actors[1], id: 3, team: 1, x: 7, y: 5, alive: true });
  const victim = s.actors[1]; s.flames.push({ cells: new Set([Engine.index(s, victim.x, victim.y)]), owner: 0, until: s.time + .4 });
  ui.advance(1); assert.match(ui.elements.get('toast').textContent, /CPU 1 처치/);
  s.stage = 1; s.time = 20; s.actors.filter(a => a.team === 1).forEach(a => { a.alive = false; }); ui.advance(1);
  assert.match(ui.elements.get('result-stats').innerHTML, /직접 처치/);
  let saved = JSON.parse([...ui.storage.values()][0]); const best = saved.bests.easy[1];
  assert.ok(best >= 20 && best < 21);
  ui.click('secondary'); ui.click('primary'); ui.advance(181); s = ui.state(); s.time = 30;
  s.actors.slice(1).forEach(a => { a.alive = false; }); ui.advance(1);
  saved = JSON.parse([...ui.storage.values()][0]); assert.equal(saved.bests.easy[1], best);
});

test('elapsed HUD continues after three minutes and longer best times load and save', () => {
  const ui = app({ saved: { bests: { easy: { 1: 240.5 } } } });
  assert.match(ui.elements.get('record').textContent, /240.5초/);
  ui.click('primary'); ui.advance(181);
  const s = ui.state(); s.actors.forEach((a, i) => { a.x = 5 + i * 2; a.y = 5; a.nextMove = Infinity; a.ai.next = Infinity; });
  s.bombs = []; s.flames = []; s.time = 181; ui.advance(1);
  assert.equal(s.phase, 'playing'); assert.equal(ui.elements.get('timer').textContent, '03:01');
  s.actors[1].alive = false; ui.advance(1);
  const saved = JSON.parse([...ui.storage.values()][0]);
  assert.ok(saved.bests.easy[1] > 180 && saved.bests.easy[1] < 182);
  assert.equal(saved.records.easy.draws, 0);
});

test('game events request distinct audio effects, warning beeps, and victory music', () => {
  const played = [], controls = [];
  const ui = app({ audio: { create: () => ({ unlock: async () => {}, play: type => played.push(type), stop: () => controls.push('stop'), setMuted: value => controls.push(value) }) } });
  ui.click('primary'); ui.advance(181);
  assert.ok(played.includes('countdown')); assert.ok(played.includes('start'));
  const s = ui.state(), p = s.actors[0]; s.items[Engine.index(s,p.x,p.y)] = 'superfire'; ui.advance(1);
  assert.ok(played.includes('item-superfire'));
  s.time = 112; ui.advance(1); const warnings = played.filter(t => t === 'warning').length;
  ui.advance(2); assert.equal(played.filter(t => t === 'warning').length, warnings);
  ui.click('pause'); assert.ok(controls.includes('stop')); ui.click('primary');
  s.actors[1].alive = false; ui.advance(1); assert.ok(played.includes('stage-clear'));
  ui.click('sound'); assert.equal(controls.at(-1), true);
});

test('player death keeps the live team game visible and an ally win saves a victory', () => {
  const ui=app(); ui.click('primary'); ui.advance(181);
  const s=ui.state(); s.actors[0].alive=false;
  ui.advance(1); assert.equal(s.phase,'playing'); assert.equal(ui.elements.get('overlay').hidden,true);
  assert.match(ui.elements.get('battle-notice').textContent,/관전 중/);
  assert.equal(ui.elements.get('team-alive').textContent,'우리 팀 1 / 2');
  assert.equal(ui.storage.size,0);
  s.actors.filter(a=>a.team===1).forEach(a=>a.alive=false); ui.advance(151);
  assert.equal(s.phase,'stage-clear'); assert.match(ui.elements.get('overlay-copy').innerHTML,/아군이 해냈어요/);
  const saved=JSON.parse([...ui.storage.values()][0]); assert.equal(saved.records.easy.wins,1); assert.equal(saved.records.easy.losses,0);
  ui.click('primary'); assert.equal(ui.state().stage,2);
});

test('result UI stays hidden during the last fuse and flame and is saved only after settlement', () => {
  const ui=app(); ui.click('primary'); ui.advance(181);
  const s=ui.state(),p=s.actors[0]; Engine.place(s,p); p.x=3; p.y=3;
  s.actors.filter(a=>a.team===1).forEach(a=>a.alive=false); ui.advance(1);
  assert.equal(ui.elements.get('overlay').hidden,true); assert.match(ui.elements.get('battle-notice').textContent,/마지막 폭탄/);
  assert.equal(ui.storage.size,0); ui.advance(120); assert.equal(ui.storage.size,0);
  ui.advance(24); assert.equal(s.phase,'stage-clear'); assert.equal(ui.elements.get('overlay').hidden,false);
});
