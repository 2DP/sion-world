'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const { Audio } = require('../audio.js');
function fake() {
  const sources = []; const audio = new Audio(); audio.buffer = {}; audio.music = {};
  audio.ctx = { currentTime: 10, createBufferSource() { const s = { connect() {}, disconnect() {}, start(...args) { this.args = args; }, stop() { this.stopped = true; } }; sources.push(s); return s; } };
  return { audio, sources };
}
test('count-in schedules audio at zero while the song clock includes its silent lead-in', () => {
  const { audio, sources } = fake(); audio.play(-2.5); assert.deepEqual(sources[0].args, [12.5, 0]); assert.equal(audio.time(), -2.5);
  audio.ctx.currentTime = 12.5; assert.equal(audio.time(), 0); audio.ctx.currentTime = 15; assert.equal(audio.time(), 2.5);
});
test('pause freezes clock and resume countdown neither advances nor replays finished audio', () => {
  const { audio, sources } = fake(); audio.play(0); audio.ctx.currentTime = 22; assert.equal(audio.pause(), 12); assert.equal(sources[0].stopped, true);
  audio.ctx.currentTime = 40; assert.equal(audio.time(), 12); audio.play(12, 3); assert.deepEqual(sources[1].args, [43, 12]);
  audio.ctx.currentTime = 42; assert.equal(audio.time(), 12); audio.ctx.currentTime = 44; assert.equal(audio.time(), 13);
});
test('restarting and pausing during a resumed count stop the scheduled source', () => {
  const { audio, sources } = fake(); audio.play(-2); audio.ctx.currentTime = 11; const p = audio.pause(); assert.equal(p, -1);
  audio.play(p, 3); audio.ctx.currentTime = 12; assert.equal(audio.pause(), -1); assert.equal(sources[1].stopped, true);
  audio.play(-2); assert.equal(audio.position, -2); audio.stop(); assert.equal(sources[2].stopped, true);
});
