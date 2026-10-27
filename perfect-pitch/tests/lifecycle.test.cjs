const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../engine.js');
const R = require('../rhythm.js');
function app(options = {}) {
  let time = 0, raf, state, hz = 0, pendingResolve, pendingReject, requests = 0, paints = 0;
  const elements = new Map(), events = {}, windowEvents = {}, storage = new Map(), tracks = [], audioTracks = [], timers = new Map();
  let nextTimer = 0;
  const setTimer = fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimer = id => timers.delete(id);
  const drawing = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), clearRect() { paints++; } }, { get: (o, k) => o[k] || (() => {}) });
  class Element {
    constructor(id) { this.id = id; this.listeners = {}; this.hidden = false; this.disabled = false; this.style = {}; this.textContent = ''; this.innerHTML = ''; this.attributes = {}; this.classList = { toggle() {}, add() {}, remove() {} }; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getContext() { return drawing; }
    getBoundingClientRect() { return { width: 800, height: 440 }; }
  }
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) elements.set(id, new Element(id));
  const mode = new Element('mode'); mode.value = 'practice';
  elements.get('difficulty').value = 'easy'; elements.get('free-octave').checked = true; elements.get('sensitivity').value = '12';
  elements.get('beat-volume').value = '28';
  const document = { hidden: false, getElementById: id => elements.get(id), querySelector: () => mode, querySelectorAll: () => [mode, elements.get('difficulty'), elements.get('free-octave')], addEventListener: (type, fn) => events[type] = fn };
  function media() { const track = { stopped: false, stop() { this.stopped = true; } }; tracks.push(track); return { getTracks: () => [track], getAudioTracks: () => [track] }; }
  class AudioContext {
    constructor() { this.state = 'running'; this.sampleRate = 48000; this.destination = {}; }
    get currentTime() { return time / 1000; }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createAnalyser() { return { fftSize: 4096, getFloatTimeDomainData(buffer) { for (let i = 0; i < buffer.length; i++) buffer[i] = hz ? .2 * Math.sin(2 * Math.PI * hz * i / 48000) : 0; } }; }
    createOscillator() { return { frequency: {}, connect() {}, start() {}, stop() {}, disconnect() {} }; }
    createGain() { return { gain: { value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    createBuffer(channels, length) { const data = new Float32Array(length); return { getChannelData() { return data; } }; }
    createBufferSource() { return { connect() {}, start() {}, stop() {}, disconnect() {} }; }
    createBiquadFilter() { return { frequency: {}, Q: {}, connect() {}, disconnect() {} }; }
  }
  const scope = {
    document, console, AudioContext, Float32Array, performance: { now: () => time }, isSecureContext: options.secure !== false,
    matchMedia: () => ({ matches: false }), ResizeObserver: class { observe() {} }, requestAnimationFrame: fn => raf = fn,
    addEventListener: (type, fn) => windowEvents[type] = fn,
    navigator: { mediaDevices: { getUserMedia() { requests++; if (options.reject) return Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })); if (options.pending) return new Promise((resolve, reject) => { pendingResolve = () => resolve(media()); pendingReject = reject; }); return Promise.resolve(media()); } } },
    localStorage: { getItem() { if (options.blocked) throw new Error('blocked'); return options.saved || null; }, setItem(k, v) { if (options.blocked) throw new Error('blocked'); storage.set(k, v); } },
    PitchFlight: { ...E, create: (...args) => state = E.create(...args) },
    PitchRhythm: { ...R, Track: class extends R.Track { constructor(ac, events) { super(ac, events, { setInterval: setTimer, clearInterval: clearTimer }); audioTracks.push(this); } } }
  };
  scope.window = scope;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8'), scope);
  return {
    elements, document, events, windowEvents, storage, tracks, audioTracks, timers, mode, state: () => state, requests: () => requests, paints: () => paints,
    click: id => elements.get(id).listeners.click(),
    setPitch: value => hz = value,
    advance(seconds, follow = false) { for (let i = 0; i < Math.ceil(seconds / .02); i++) { if (follow) hz = state.target === null ? 0 : E.frequency(state.target); time += 20; for (const fn of timers.values()) fn(); raf(time); } },
    resolve: () => pendingResolve(), reject: error => pendingReject(error),
    changeMode(value) { mode.value = value; mode.listeners.change(); }
  };
}
test('microphone pipeline detects a synthesized voice, crosses a gate, and stops tracks on pause', async () => {
  const ui = app(); await ui.click('start');
  assert.equal(ui.requests(), 1); assert.equal(ui.elements.get('start-panel').hidden, true);
  ui.advance(6, true);
  assert.ok(ui.state().passed >= 1); assert.ok(ui.paints() > 20);
  ui.click('pause'); assert.equal(ui.state().status, 'paused'); assert.ok(ui.tracks.every(t => t.stopped));
  const x = ui.state().gateX; ui.advance(3); assert.equal(ui.state().gateX, x);
  await ui.click('start'); assert.equal(ui.requests(), 2); assert.equal(ui.state().status, 'running');
  ui.windowEvents.blur(); assert.ok(ui.tracks.every(t => t.stopped));
});
test('mic denial and insecure origins offer actionable errors and remain retryable', async () => {
  for (const opts of [{ reject: true }, { secure: false }]) {
    const ui = app(opts); await ui.click('start');
    assert.equal(ui.elements.get('error').hidden, false); assert.equal(ui.elements.get('start').disabled, false);
    assert.equal(ui.elements.get('difficulty').disabled, false);
    await ui.click('start'); assert.equal(ui.elements.get('start').disabled, false);
    await ui.click('demo'); ui.advance(6); assert.ok(ui.state().score > 0);
  }
});
test('a canceled permission request cannot turn the mic on later or replace the demo', async () => {
  const ui = app({ pending: true }); const start = ui.click('start'); await Promise.resolve(); await Promise.resolve();
  assert.equal(ui.requests(), 1); await ui.click('demo'); ui.resolve(); await start;
  assert.ok(ui.tracks.every(t => t.stopped)); assert.equal(ui.elements.get('demo-badge').hidden, false);
  ui.advance(6); assert.ok(ui.state().passed > 0);
});
test('backgrounding a pending mic request cancels and releases its eventual stream', async () => {
  const ui = app({ pending: true }); const start = ui.click('start'); await Promise.resolve(); await Promise.resolve();
  ui.document.hidden = true; ui.events.visibilitychange(); ui.resolve(); await start;
  assert.ok(ui.tracks.every(t => t.stopped)); assert.equal(ui.elements.get('start').disabled, false);
});
test('reference playback freezes the flight and cannot charge the gate from speaker feedback', async () => {
  const ui = app(); await ui.click('start'); ui.setPitch(E.frequency(ui.state().target)); ui.advance(.2);
  await ui.click('listen'); const x = ui.state().gateX; ui.advance(1.4);
  assert.equal(ui.state().gateX, x); assert.equal(ui.state().hold, 0);
  ui.advance(6); assert.ok(ui.state().gateX < x);
});
test('challenge disables tone hints; microphone disconnect pauses and releases the input', async () => {
  const ui = app(); ui.changeMode('challenge'); assert.equal(ui.elements.get('listen').disabled, true);
  await ui.click('start'); ui.tracks[0].onended();
  assert.equal(ui.state().status, 'paused'); assert.equal(ui.tracks[0].stopped, true); assert.match(ui.elements.get('panel-text').textContent, /끊겼/);
});
test('demo completes, saves no record, and failed mic start from its result can be retried', async () => {
  const ui = app({ reject: true }); await ui.click('demo'); ui.advance(100);
  assert.equal(ui.state().status, 'won'); assert.equal(ui.state().passed, 12); assert.equal(ui.storage.size, 0);
  await ui.click('start'); assert.equal(ui.elements.get('start').disabled, false);
  await ui.click('start'); assert.equal(ui.requests(), 2);
});
test('real play completes through analyzer input, persists a record, and releases the microphone', async () => {
  const ui = app(); await ui.click('start');
  ui.advance(100, true);
  assert.equal(ui.state().status, 'won'); assert.equal(ui.state().passed, 12); assert.ok(ui.storage.size > 0); assert.ok(ui.tracks.every(t => t.stopped));
  assert.equal(ui.elements.get('result').hidden, false);
});
test('corrupt or blocked record storage never blocks a round', async () => {
  for (const opts of [{ blocked: true }, { saved: 'not json' }, { saved: '{"practice-easy-free":"bad"}' }]) {
    const ui = app(opts); await ui.click('start'); ui.advance(100, true);
    assert.equal(ui.state().status, 'won'); assert.ok(ui.tracks.every(t => t.stopped));
  }
});
test('beat volume and mute take effect without moving the scoring clock; pause cancels queued drums', async () => {
  const ui = app(); await ui.click('demo'); ui.advance(1);
  const track = ui.audioTracks.at(-1), position = track.position();
  ui.click('beat-toggle'); assert.equal(track.master.gain.value, 0); assert.equal(track.position(), position);
  ui.elements.get('beat-volume').value = '10'; ui.elements.get('beat-volume').listeners.input(); assert.equal(track.master.gain.value, 0);
  ui.click('beat-toggle'); assert.equal(track.master.gain.value, .1);
  assert.equal(ui.timers.size, 1); ui.click('pause'); assert.equal(ui.timers.size, 0); assert.equal(track.nodes.size, 0);
  await ui.click('start'); assert.equal(ui.state().phase, 'countin'); assert.equal(ui.timers.size, 1);
});
test('melody preview includes all note durations, suppresses microphone scoring, and restarts with a count-in', async () => {
  const ui = app(); await ui.click('start'); ui.advance(4, true); await ui.click('listen');
  const preview = ui.audioTracks.at(-1); assert.equal(preview.events.filter(e => e.kind === 'note').length, 3);
  const time = ui.state().elapsed; ui.advance(3, true); assert.equal(ui.state().elapsed, time); assert.equal(ui.state().score, 0);
  ui.advance(3.4, true); assert.equal(ui.state().phase, 'countin'); assert.equal(ui.timers.size, 1);
});
test('the melody shown and heard in the lobby is exactly the one played after enabling the mic', async () => {
  const ui = app(); const notes = ui.state().rounds[0].notes.map(n => n.midi);
  await ui.click('listen'); ui.advance(7); await ui.click('start');
  assert.deepEqual(ui.state().rounds[0].notes.map(n => n.midi), notes);
  assert.equal(ui.state().phase, 'countin'); assert.equal(ui.state().score, 0);
});
