const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const E = require('../engine.js');
function app(options = {}) {
  const elements = new Map(), handlers = {}, storage = new Map(); let current, raf, now = 0;
  const context = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }) }, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) });
  class Element {
    constructor(id) { this.id = id; this.listeners = {}; this.dataset = {}; this.value = id === 'difficulty' ? 'easy' : '1'; this.textContent = ''; this.classes = new Set(); this.classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c) }; }
    set innerHTML(v) { this.html = v; for (const [, id] of v.matchAll(/id="([^"]+)"/g)) elements.set(id, new Element(id)); }
    get innerHTML() { return this.html || ''; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    dispatch(name, event = {}) { for (const fn of this.listeners[name] || []) fn(event); }
    querySelector() { return { focus() {} }; }
    focus() {} setAttribute() {} setPointerCapture() {} getContext() { return context; }
  }
  for (const [, id] of fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').matchAll(/id="([^"]+)"/g)) elements.set(id, new Element(id));
  const controls = ['left', 'right', 'fire'].map(control => { const el = new Element(control); el.dataset.control = control; return el; });
  const document = { hidden: false, getElementById: id => elements.get(id), querySelectorAll: () => controls, addEventListener: (name, fn) => handlers[name] = fn };
  const scope = { document, console, performance: { now: () => now }, matchMedia: () => ({ matches: true }), requestAnimationFrame: fn => raf = fn,
    addEventListener: (name, fn) => handlers['window:' + name] = fn,
    localStorage: { getItem() { if (options.blocked) throw Error('blocked'); return options.corrupt ? '{bad' : null; }, setItem(k, v) { if (options.blocked) throw Error('blocked'); storage.set(k, v); } },
    PangEngine: { ...E, create: (...args) => (current = E.create(...args)) } };
  scope.window = scope; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8'), scope);
  const click = action => elements.get('panel').dispatch('click', { target: { closest: () => ({ dataset: { action } }) } });
  return { elements, handlers, storage, controls, document, click, state: () => current,
    advance(ticks = 1) { for (let i = 0; i < ticks; i++) { now += 1000 / 60; raf(now); } },
    key(code, down = true) { handlers[down ? 'keydown' : 'keyup']({ code, repeat: false, preventDefault() {} }); } };
}
test('actual UI completes ten stages, saves unlocks and presents campaign end', () => {
  const ui = app(); assert.match(ui.elements.get('panel').innerHTML, /모험 시작/); ui.click('ready');
  for (let stage = 1; stage <= 10; stage++) {
    assert.equal(ui.state().stage, stage); assert.equal(ui.state().status, 'ready'); ui.click('play');
    ui.state().bubbles = []; ui.advance(); assert.equal(ui.state().status, 'won');
    const saved = JSON.parse([...ui.storage.values()][0]); assert.equal(saved.easy.unlocked, Math.min(10, stage + 1));
    const score = ui.state().score; ui.advance(20); assert.equal(ui.state().score, score);
    if (stage < 10) ui.click('next');
  }
  assert.match(ui.elements.get('panel').innerHTML, /열 번의 모험, 모두 성공/);
  ui.click('menu'); assert.equal(ui.state().status, 'ready'); assert.doesNotMatch(ui.elements.get('stage-select').innerHTML, /disabled/);
});
test('pause, blur and visibility freeze timers and clear held input; retry is fresh', () => {
  const ui = app(); ui.click('ready'); ui.click('play'); ui.key('ArrowRight'); ui.key('Space');
  ui.elements.get('pause').dispatch('click'); const x = ui.state().player.x, time = ui.state().time;
  ui.advance(100); assert.equal(ui.state().time, time); ui.click('play'); ui.advance();
  assert.equal(ui.state().player.x, x); assert.equal(ui.state().shots.length, 0);
  ui.key('ArrowRight'); ui.handlers['window:blur'](); assert.equal(ui.state().status, 'paused'); ui.click('play'); ui.advance(); assert.equal(ui.state().player.x, x);
  ui.document.hidden = true; ui.handlers.visibilitychange(); assert.equal(ui.state().status, 'paused');
  ui.click('retry'); assert.equal(ui.state().lives, 3); assert.equal(ui.state().time, 150); assert.equal(ui.state().status, 'ready');
  ui.click('play'); ui.state().time = .001; ui.advance(); assert.equal(ui.state().status, 'lost'); ui.click('retry'); assert.equal(ui.state().stage, 1);
});
test('brief keyboard fire and multitouch movement/fire work without stuck pointers', () => {
  const ui = app(); ui.click('ready'); ui.click('play'); ui.key('Space'); ui.key('Space', false); ui.advance(); assert.equal(ui.state().shots.length, 1);
  const beforeTap = ui.state().player.x; ui.key('ArrowRight'); ui.key('ArrowRight', false); ui.advance(); assert.ok(ui.state().player.x > beforeTap);
  const afterTap = ui.state().player.x; ui.advance(); assert.equal(ui.state().player.x, afterTap);
  const x = ui.state().player.x;
  ui.controls[1].dispatch('pointerdown', { pointerId: 1, preventDefault() {} }); ui.controls[2].dispatch('pointerdown', { pointerId: 2, preventDefault() {} });
  ui.advance(3); assert.ok(ui.state().player.x > x);
  ui.controls[1].dispatch('pointercancel', { pointerId: 1 }); ui.controls[2].dispatch('lostpointercapture', { pointerId: 2 });
  const stop = ui.state().player.x; ui.advance(3); assert.equal(ui.state().player.x, stop);
});
test('corrupt or throwing localStorage allows start, win and next stage', () => {
  for (const option of [{ corrupt: true }, { blocked: true }]) { const ui = app(option); ui.click('ready'); ui.click('play'); ui.state().bubbles = []; ui.advance(); assert.equal(ui.state().status, 'won'); ui.click('next'); assert.equal(ui.state().stage, 2); }
});

test('focused controls support Enter hold/release, synthetic activation and lifecycle cleanup', () => {
  const ui = app(); ui.click('ready'); ui.click('play');
  const enter = (index, down = true, repeat = false) => {
    let prevented = false;
    ui.handlers[down ? 'keydown' : 'keyup']({ code: 'Enter', repeat, target: { closest: () => ui.controls[index] }, preventDefault() { prevented = true; } });
    return prevented;
  };
  const initial = ui.state().player.x; assert.equal(enter(1), true); ui.advance(10); assert.ok(ui.state().player.x > initial + 35);
  enter(1, false); const stopped = ui.state().player.x; ui.advance(3); assert.equal(ui.state().player.x, stopped);
  ui.state().weapon = 'double'; ui.state().weaponTime = 10;
  enter(2); ui.advance(21); assert.equal(ui.state().shots.length, 2); enter(2, false);
  ui.state().shots = []; ui.state().cooldown = 0; ui.advance(); assert.equal(ui.state().shots.length, 0);
  ui.controls[2].dispatch('click', { detail: 0 }); ui.advance(); assert.equal(ui.state().shots.length, 1);
  ui.state().shots = []; ui.state().cooldown = 0; ui.advance(); assert.equal(ui.state().shots.length, 0);
  ui.controls[2].dispatch('click', { detail: 1 }); ui.advance(); assert.equal(ui.state().shots.length, 0);
  enter(1); ui.advance(); ui.controls[1].dispatch('blur'); const blurred = ui.state().player.x; ui.advance(); assert.equal(ui.state().player.x, blurred);
  enter(1); ui.handlers['window:blur'](); ui.click('play'); ui.advance(); assert.equal(ui.state().player.x, blurred);
  enter(2); ui.elements.get('pause').dispatch('click'); ui.click('play'); ui.advance(); assert.equal(ui.state().shots.length, 0);
  ui.elements.get('pause').dispatch('click');
  for (const code of ['Enter', 'Space']) {
    let prevented = false; ui.handlers.keydown({ code, repeat: false, target: { closest: () => null }, preventDefault() { prevented = true; } });
    assert.equal(prevented, false, 'menu button native activation stays intact');
  }
});
