const test = require('node:test');
const assert = require('node:assert/strict');
const Audio = require('../audio.js');
function fixture() {
  const nodes = [], buffers = [], gains = [];
  const context = {
    state: 'suspended', currentTime: 0, sampleRate: 44100, destination: {},
    resume: async () => { context.state = 'running'; },
    createGain() { const events = []; const g = { gain: { value: 0, setValueAtTime: (...v) => events.push(v), linearRampToValueAtTime: (...v) => events.push(v), exponentialRampToValueAtTime: (...v) => events.push(v) }, connect() {}, disconnect() {}, events }; gains.push(g); return g; },
    createBuffer(channels, length) { const data = new Float32Array(length); buffers.push(data); return { getChannelData: () => data }; },
    createOscillator() { return node(false); }, createBufferSource() { return node(true); }
  };
  function node(noise) {
    const n = { noise, stopped: false, frequency: { setValueAtTime: v => { n.from = v; }, exponentialRampToValueAtTime: v => { n.to = v; } }, connect() {}, disconnect() {}, start: t => { n.startAt = t; }, stop: t => { if (t === undefined) { n.stopped = true; n.onended?.(); } } };
    nodes.push(n); return n;
  }
  let created = 0;
  const audio = Audio.create(() => { created++; return context; });
  return { audio, context, nodes, buffers, gains, created: () => created };
}
test('audio starts only after unlock, reuses one context, and creates a real explosion waveform', async () => {
  const f = fixture(); f.audio.play('explode'); assert.equal(f.created(), 0);
  await f.audio.unlock(); await f.audio.unlock(); assert.equal(f.created(), 1);
  f.audio.play('explode'); assert.equal(f.nodes.length, 2);
  assert.ok(f.nodes.some(n => n.noise)); assert.ok(f.nodes.some(n => n.from === 125 && n.to === 38));
  assert.ok(f.buffers[0].some(v => Math.abs(v) > .01));
  assert.ok(f.buffers[0].every(v => Number.isFinite(v) && Math.abs(v) <= 1));
});
test('muting immediately stops scheduled sounds and blocks new ones until unmuted', async () => {
  const f = fixture(); await f.audio.unlock(); f.audio.play('complete');
  assert.equal(f.nodes.length, 6); f.audio.setMuted(true);
  assert.ok(f.nodes.every(n => n.stopped)); assert.equal(f.gains[0].gain.value, 0);
  f.audio.play('place'); assert.equal(f.nodes.length, 6);
  f.audio.setMuted(false); f.audio.play('place'); assert.equal(f.nodes.length, 7);
});
test('victory rises, defeat falls, and repeated explosion events are throttled', async () => {
  const f = fixture(); await f.audio.unlock(); f.audio.play('stage-clear');
  assert.deepEqual(f.nodes.map(n => n.from), [523,659,784,1047]);
  f.audio.stop(); f.audio.play('defeat');
  assert.deepEqual(f.nodes.slice(4).map(n => n.from), [392,330,262,196]);
  f.audio.stop(); f.audio.play('explode'); const count = f.nodes.length;
  f.audio.play('explode'); assert.equal(f.nodes.length, count);
  f.context.currentTime = .1; f.audio.play('explode'); assert.equal(f.nodes.length, count + 2);
});
test('missing audio or denied resume never rejects gameplay initialization', async () => {
  const missing = Audio.create(() => { throw new Error('unavailable'); });
  await missing.unlock(); assert.doesNotThrow(() => missing.play('place'));
  const f = fixture(); f.context.resume = async () => { throw new Error('denied'); };
  await f.audio.unlock(); f.audio.play('place'); assert.equal(f.nodes.length, 0);
});
