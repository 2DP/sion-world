const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
function signal(hz, rate = 48000, amplitude = .2, harmonics = false) {
  return Float32Array.from({ length: 4096 }, (_, i) => { const p = 2 * Math.PI * hz * i / rate; return amplitude * (Math.sin(p) + (harmonics ? .7 * Math.sin(p * 2) + .4 * Math.sin(p * 3) : 0)) + .015; });
}
function run(s, seconds, pitch = s => s.target === null ? null : E.frequency(s.target)) {
  for (let i = 0; i < Math.ceil(seconds / .01) && s.status === 'running'; i++) E.tick(s, .01, pitch(s));
}
test('YIN recognizes vocal-range sine waves and harmonics at common sample rates', () => {
  for (const rate of [44100, 48000]) for (const hz of [65.41, 82.41, 130.81, 220, 261.63, 329.63, 440, 523.25, 880, 1046.5]) for (const harmonics of [false, true]) {
    const p = E.detectPitch(signal(hz, rate, .15, harmonics), rate); assert.ok(p); assert.ok(Math.abs(1200 * Math.log2(p.frequency / hz)) < 8);
  }
});
test('silence, DC, weak signals, and broadband drum-like noise do not count as pitched singing', () => {
  let seed = 42; const noise = Float32Array.from({ length: 4096 }, () => { seed = (1664525 * seed + 1013904223) >>> 0; return (seed / 2 ** 32 - .5) * .5; });
  for (const buffer of [new Float32Array(4096), new Float32Array(4096).fill(.2), signal(440, 48000, .002), noise]) assert.equal(E.detectPitch(buffer, 48000), null);
});
test('octave freedom preserves note class while exact mode and rests reject unrelated pitches', () => {
  assert.ok(Math.abs(E.centsFrom(130.8128, 60, true)) < 1); assert.ok(Math.abs(E.centsFrom(523.2511, 60, true)) < 1);
  assert.ok(Math.abs(E.centsFrom(130.8128, 60, false) + 1200) < 1); assert.equal(E.centsFrom(261.63, null), Infinity);
  for (const hz of [0, NaN, Infinity, -1, null]) assert.equal(E.centsFrom(hz, 60), Infinity);
});
test('stages add more notes, fractional durations and rests, with exact bar lengths and increasing tempos', () => {
  const rounds = E.makeRounds('normal', () => .4); assert.equal(rounds.length, 12);
  for (let stage = 0; stage < 3; stage++) for (const r of rounds.slice(stage * 4, stage * 4 + 4)) {
    assert.equal(r.notes.reduce((sum, n) => sum + n.beats, 0), stage ? 8 : 4);
    assert.equal(r.bpm, [84, 96, 108][stage]); assert.equal(r.countIn, 4);
    const count = r.notes.filter(n => n.midi !== null).length;
    assert.ok(stage === 0 ? count >= 3 && count <= 4 : stage === 1 ? count >= 6 && count <= 7 : count >= 8);
    assert.ok(r.notes.every((n, i) => !i || n.midi === null || n.midi !== r.notes[i - 1].midi));
  }
  assert.ok(rounds.slice(4).some(r => r.notes.some(n => n.beats === .5)));
  assert.ok(rounds.slice(8).every(r => r.notes.some(n => n.midi === null)));
  for (let i = 1; i < 12; i++) assert.ok(Math.abs(rounds[i].start - rounds[i - 1].start - rounds[i - 1].duration) < 1e-8);
});
test('count-in does not judge singing, then each note changes at its scheduled beat', () => {
  const s = E.create(); const r = s.rounds[0]; run(s, 2); assert.equal(s.phase, 'countin'); assert.equal(r.notes[0].judgedTime, 0);
  run(s, 1); assert.equal(s.phase, 'singing'); assert.equal(s.noteIndex, 0);
  run(s, .7); assert.equal(s.noteIndex, 1); assert.equal(r.notes[0].result, true);
});
test('holding just one note cannot pass a multi-note melody', () => {
  const s = E.create({}, () => .8); run(s, 40, () => E.frequency(60));
  assert.equal(s.status, 'lost'); assert.equal(s.passed, 0); assert.equal(s.score, 0); assert.equal(s.lives, 0);
});
test('wrong notes, silence, and short blips cannot earn a complete melody', () => {
  for (const pitch of [() => null, s => E.frequency((s.target || 60) + 1), s => s.elapsed % .5 < .03 ? E.frequency(s.target || 60) : null]) {
    const s = E.create(); run(s, 30, pitch); assert.equal(s.status, 'lost'); assert.equal(s.score, 0);
  }
});
test('all three difficulties allow a complete synchronized 12-melody performance', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const s = E.create({ difficulty }); run(s, 120);
    assert.equal(s.status, 'won'); assert.equal(s.passed, 12); assert.equal(s.lives, 3); assert.equal(s.maxCombo, 12);
    assert.ok(s.rounds.every(r => r.notes.every(n => n.result === true)));
    const score = s.score, elapsed = s.elapsed; E.tick(s, .1, 440); assert.equal(s.elapsed, elapsed); assert.equal(s.score, score);
  }
});
test('singing through a rest fails that melody even when every pitched note is correct', () => {
  const s = E.create(); s.gates = 8; E.restartRound(s); const end = E.currentRound(s).start + E.currentRound(s).duration;
  while (s.elapsed < end - 1e-6) E.tick(s, .01, E.frequency(s.target === null ? 60 : s.target));
  assert.equal(s.lives, 2); assert.equal(s.rounds[8].notes.find(n => n.midi === null).result, false);
});
test('pause freezes the score; resuming resets only the current phrase and supplies a new count-in', () => {
  const s = E.create(); run(s, 8); assert.equal(s.passed, 1); const score = s.score;
  s.status = 'paused'; const time = s.elapsed; E.tick(s, .25, 440); assert.equal(s.elapsed, time);
  E.restartRound(s); assert.equal(s.phase, 'countin'); assert.equal(s.elapsed, s.rounds[1].start); assert.equal(s.score, score);
  assert.ok(s.rounds[0].notes.every(n => n.result)); assert.ok(s.rounds[1].notes.every(n => n.result === null));
});
test('invalid time deltas do not affect gameplay', () => {
  const s = E.create(); for (const dt of [0, -1, NaN, Infinity]) E.tick(s, dt, 440); assert.equal(s.elapsed, 0);
});
