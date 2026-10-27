const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../rhythm.js');
const fs = require('node:fs');
const vm = require('node:vm');
function context() {
  const starts = [], stops = [], gains = [];
  const ac = { currentTime: 10, sampleRate: 48000, destination: {},
    createGain() { const p = { value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }; gains.push(p); return { gain: p, connect() {}, disconnect() {} }; },
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; },
    createBufferSource() { return { connect() {}, disconnect() {}, start(t) { starts.push(t); }, stop(t) { stops.push(t); } }; },
    createBiquadFilter() { return { frequency: {}, Q: {}, connect() {}, disconnect() {} }; },
    createOscillator() { const n = ac.createBufferSource(); n.frequency = {}; return n; }
  };
  return { ac, starts, stops, gains };
}
test('beat scheduling follows each stage tempo exactly with no double hits at stage boundaries', () => {
  const rounds = E.makeRounds('easy'), events = R.beatEvents(rounds);
  for (const r of rounds) {
    const kicks = events.filter(e => e.kind !== 'hat' && e.time >= r.start - 1e-8 && e.time < r.start + r.duration - 1e-8);
    assert.equal(kicks.length, r.countIn + r.beats);
    for (let i = 0; i < kicks.length; i++) assert.ok(Math.abs(kicks[i].time - r.start - i * r.secondsPerBeat) < 1e-8);
  }
});
test('melody preview honors rests, fractional beats and note duration', () => {
  const r = E.makeRounds('easy')[8], events = R.melodyEvents(r);
  assert.equal(events.length, r.notes.filter(n => n.midi !== null).length);
  for (const n of r.notes.filter(n => n.midi !== null)) {
    const event = events.find(e => Math.abs(e.time - (r.start + (4 + n.beat) * r.secondsPerBeat)) < 1e-8);
    assert.equal(event.midi, n.midi); assert.ok(Math.abs(event.duration - (n.beats * r.secondsPerBeat - .045)) < 1e-8);
  }
});
test('audio-clock scheduling uses exact future timestamps and stop removes scheduled sources and timer', () => {
  const { ac, starts, stops } = context(); let timer = null;
  const t = new R.Track(ac, [{ time: 0, kind: 'kick', accent: 1 }, { time: .5, kind: 'snare', accent: 1 }], { setInterval: fn => (timer = fn, 1), clearInterval: () => timer = null });
  t.start(0); assert.deepEqual(starts, [10.12]); assert.equal(t.position(), 0);
  ac.currentTime = 10.5; timer(); assert.ok(Math.abs(starts[1] - 10.62) < 1e-8); assert.ok(Math.abs(t.position() - .38) < 1e-8);
  t.stop(); assert.equal(timer, null); assert.equal(t.nodes.size, 0); assert.ok(stops.filter(t => t === undefined).length >= 2);
  ac.currentTime += 5; assert.ok(Math.abs(t.position() - .38) < 1e-8);
});
test('muting changes only percussion gain and never shifts the transport or mutes melody hints', () => {
  const { ac } = context(); const t = new R.Track(ac, [], { setInterval: () => 1, clearInterval() {} }); t.start();
  const position = t.position(), melodyGain = t.melodyMaster.gain.value;
  t.setVolume(.1, true); assert.equal(t.master.gain.value, 0); assert.equal(t.melodyMaster.gain.value, melodyGain); assert.equal(t.position(), position);
  t.setVolume(.1, false); assert.equal(t.master.gain.value, .1); t.dispose();
});
test('browser timer functions are called without binding them to the Track instance', () => {
  let started = 0, cleared = 0;
  const scope = { setInterval() { assert.ok(!this?.events, 'illegal timer receiver'); started++; return 1; }, clearInterval() { assert.ok(!this?.events, 'illegal timer receiver'); cleared++; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../rhythm.js'), 'utf8'), scope);
  const t = new scope.PitchRhythm.Track(context().ac, []); t.start(); t.stop();
  assert.equal(started, 1); assert.equal(cleared, 1);
});
