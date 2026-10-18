const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../engine.js');

function app(options = {}) {
  const elements = new Map(), handlers = {}, windowHandlers = {}, storage = new Map();
  let state, raf, time = 0, focused, paints = 0;
  const context = new Proxy({ fillRect() { paints++; } }, { get: (object, key) => object[key] || (() => {}), set: (object, key, value) => (object[key] = value, true) });
  class Element {
    constructor(id, tag = 'div') { this.id = id; this.tag = tag; this.listeners = {}; this.dataset = {}; this.attributes = {}; this.width = 600; this.height = 600; this.textContent = ''; this.hidden = false; this.disabled = false; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    dispatch(name, data = {}) { for (const fn of this.listeners[name] || []) fn({ target: this, preventDefault() {}, ...data }); }
    setAttribute(name, value) { this.attributes[name] = value; }
    getContext() { return context; }
    focus() { focused = this; }
    closest(selector) { return selector.split(',').map(s => s.trim()).includes(this.tag) ? this : null; }
    setPointerCapture() {}
  }
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  for (const [, tag, id] of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"/g)) elements.set(id, new Element(id, tag));
  elements.get('mode').value = 'classic'; elements.get('difficulty').value = 'normal';
  const directions = ['up', 'left', 'right', 'down'].map(direction => {
    const button = new Element(direction, 'button'); button.dataset.direction = direction; return button;
  });
  const document = { hidden: false, getElementById: id => elements.get(id), querySelectorAll: () => directions, addEventListener: (name, fn) => handlers[name] = fn };
  const scope = {
    document, console, requestAnimationFrame: fn => raf = fn,
    addEventListener: (name, fn) => windowHandlers[name] = fn,
    localStorage: {
      getItem() { if (options.blocked) throw Error('blocked'); return options.saved || null; },
      setItem(key, value) { if (options.blocked) throw Error('blocked'); storage.set(key, value); }
    },
    SnakeEngine: { ...E, create: (...args) => state = E.create(...args) }
  };
  scope.window = scope;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8'), scope);
  return {
    elements, handlers, windowHandlers, storage, document, directions, state: () => state, focused: () => focused, paints: () => paints,
    click: id => elements.get(id).dispatch('click'),
    advance(ms) { time += ms; raf(time); },
    key(code, target = elements.get('board'), repeat = false) {
      let prevented = false;
      handlers.keydown({ code, target, repeat, preventDefault() { prevented = true; } }); return prevented;
    }
  };
}

test('start, eat, record, wall loss, retry and new game update the actual UI', () => {
  const ui = app(); assert.equal(ui.state().status, 'ready'); assert.equal(ui.elements.get('overlay').hidden, false);
  ui.click('primary'); assert.equal(ui.state().status, 'playing'); assert.equal(ui.elements.get('overlay').hidden, true);
  assert.equal(ui.elements.get('mode').disabled, true); ui.advance(0);
  for (let i = 0; i < 5; i++) ui.advance(145);
  assert.equal(ui.state().score, 10); assert.equal(ui.elements.get('score').textContent, '010');
  assert.equal(JSON.parse([...ui.storage.values()][0]).records['classic:normal'], 10);
  ui.state().snake = [{ x: 19, y: 10 }]; ui.advance(145);
  assert.equal(ui.state().status, 'lost'); assert.match(ui.elements.get('overlay-title').textContent, /최고 기록/);
  ui.advance(2000); assert.equal(ui.state().score, 10);
  ui.click('primary'); assert.equal(ui.state().status, 'playing'); assert.equal(ui.state().score, 0); assert.equal(ui.state().snake.length, 4);
  ui.click('restart'); assert.equal(ui.state().status, 'ready'); assert.equal(ui.elements.get('best').textContent, '010');
});

test('animation redraws between grid moves and freezes its exact pose during pause', () => {
  const ui = app(); ui.click('primary'); ui.advance(0); ui.advance(145);
  const logicalHead = { ...ui.state().snake[0] }, paints = ui.paints();
  ui.advance(16);
  assert.ok(ui.paints() > paints); assert.deepEqual(ui.state().snake[0], logicalHead);
  assert.ok(E.pose(ui.state()).snake[0].x > 7 && E.pose(ui.state()).snake[0].x < 8);
  const pose = E.pose(ui.state()); ui.click('pause'); const pausedPaints = ui.paints();
  ui.advance(10000); assert.equal(ui.paints(), pausedPaints); assert.deepEqual(E.pose(ui.state()), pose);
  ui.click('primary'); ui.advance(10000); assert.deepEqual(E.pose(ui.state()), pose);
  ui.advance(16); assert.ok(E.pose(ui.state()).snake[0].x > pose.snake[0].x);
});

test('pause, blur and backgrounding freeze the round and clear queued input', () => {
  const ui = app(); ui.click('primary'); ui.advance(0); ui.key('ArrowUp');
  ui.click('pause'); assert.equal(ui.state().status, 'paused'); assert.equal(ui.state().queue.length, 0);
  const before = JSON.stringify(ui.state().snake); ui.advance(10000); assert.equal(JSON.stringify(ui.state().snake), before);
  ui.click('primary'); ui.advance(10000); assert.equal(JSON.stringify(ui.state().snake), before);
  ui.advance(145); assert.equal(ui.state().direction, 'right');
  ui.windowHandlers.blur(); assert.equal(ui.state().status, 'paused');
  ui.click('primary'); ui.document.hidden = true; ui.handlers.visibilitychange(); assert.equal(ui.state().status, 'paused');
  ui.document.hidden = false; ui.handlers.visibilitychange(); assert.equal(ui.state().status, 'paused');
});

test('keyboard shortcuts preserve native button and select behavior', () => {
  const ui = app();
  assert.equal(ui.key('Space', ui.elements.get('primary')), false); assert.equal(ui.state().status, 'ready');
  ui.key('Space'); assert.equal(ui.state().status, 'playing');
  ui.key('Space', undefined, true); assert.equal(ui.state().status, 'playing');
  ui.key('KeyP'); assert.equal(ui.state().status, 'paused');
  ui.key('KeyP'); assert.equal(ui.state().status, 'playing');
  assert.equal(ui.key('ArrowUp', ui.elements.get('mode')), false); assert.equal(ui.state().queue.length, 0);
  ui.key('KeyW'); ui.key('KeyA'); assert.deepEqual(ui.state().queue, ['up', 'left']);
  ui.key('Escape'); assert.equal(ui.state().status, 'paused');
});

test('touch buttons, accessible click, swipe, cancellation and secondary pointers work', () => {
  const ui = app(); ui.click('primary');
  ui.directions[0].dispatch('pointerdown', { button: 0 }); assert.deepEqual(ui.state().queue, ['up']);
  ui.directions[0].dispatch('click', { detail: 1 }); assert.equal(ui.state().queue.length, 1);
  ui.directions[1].dispatch('click', { detail: 0 }); assert.deepEqual(ui.state().queue, ['up', 'left']);
  ui.click('restart'); ui.click('primary');
  const board = ui.elements.get('board');
  board.dispatch('pointerdown', { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
  board.dispatch('pointermove', { pointerId: 2, clientX: 100, clientY: 40 }); assert.equal(ui.state().queue.length, 0);
  board.dispatch('pointermove', { pointerId: 1, clientX: 100, clientY: 70 }); assert.deepEqual(ui.state().queue, ['up']);
  board.dispatch('pointercancel', { pointerId: 1 });
  board.dispatch('pointermove', { pointerId: 1, clientX: 50, clientY: 70 }); assert.equal(ui.state().queue.length, 1);
});

test('mode and difficulty select fresh games with separate persisted records', () => {
  const ui = app({ saved: JSON.stringify({ records: { 'classic:normal': 80, 'wrap:easy': 120 } }) });
  assert.equal(ui.elements.get('best').textContent, '080');
  ui.elements.get('mode').value = 'wrap'; ui.elements.get('mode').dispatch('change');
  ui.elements.get('difficulty').value = 'easy'; ui.elements.get('difficulty').dispatch('change');
  assert.equal(ui.state().mode, 'wrap'); assert.equal(ui.state().difficulty, 'easy');
  assert.equal(ui.elements.get('best').textContent, '120'); assert.match(ui.elements.get('mode-note').textContent, /반대편/);
});

test('blocked, corrupt and malformed storage never prevents playing or recording scores', () => {
  for (const options of [{ blocked: true }, { saved: '{oops' }, { saved: 'null' }, { saved: JSON.stringify({ records: { 'classic:normal': -10 }, sound: 'yes' }) }]) {
    const ui = app(options); assert.equal(ui.elements.get('best').textContent, '000');
    ui.click('primary'); ui.advance(0); ui.state().food = { x: 8, y: 10 }; ui.advance(145);
    assert.equal(ui.state().score, 10); assert.equal(ui.elements.get('best').textContent, '010');
    ui.click('sound'); assert.equal(ui.elements.get('sound').attributes['aria-pressed'], 'true');
  }
});

test('winning shows completion and replay resets the board', () => {
  const ui = app(); ui.click('primary'); ui.advance(0);
  Object.assign(ui.state(), { size: 2, snake: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], food: { x: 1, y: 0 } });
  ui.advance(145); assert.equal(ui.state().status, 'won'); assert.match(ui.elements.get('overlay-title').textContent, /가득/);
  ui.click('primary'); assert.equal(ui.state().size, 20); assert.equal(ui.state().score, 0);
});
