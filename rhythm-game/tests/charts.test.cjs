'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { songs, tutorial, makeChart, duration, composition } = require('../charts.js');
const { Engine } = require('../engine.js');
for (const song of [...songs, tutorial]) for (const difficulty of song.id === 'tutorial' ? ['easy'] : ['easy', 'normal']) {
  test(`${song.id} ${difficulty}: legal, deterministic and completable chart`, () => {
    const chart = makeChart(song, difficulty); assert.deepEqual(chart, makeChart(song, difficulty)); assert.ok(chart.length > 0);
    const last = [-Infinity, -Infinity, -Infinity, -Infinity]; const groups = new Map();
    for (const note of chart) {
      assert.ok(Number.isInteger(note.lane) && note.lane >= 0 && note.lane <= 3);
      assert.ok(note.time >= 0 && note.time / 1000 < duration(song)); assert.ok(note.time - last[note.lane] >= 300); last[note.lane] = note.endTime || note.time; if (note.endTime) assert.ok(note.endTime > note.time && note.endTime < duration(song) * 1000);
      const g = groups.get(note.time) || []; g.push(note.lane); groups.set(note.time, g);
    }
    for (const group of groups.values()) { assert.ok(group.length <= (difficulty === 'easy' ? 1 : 2)); if (group.length === 2) assert.notEqual(group[0] < 2, group[1] < 2); }
    const e = new Engine(chart); const actions = chart.flatMap(n => [{ time: n.time, lane: n.lane, kind: 'hit' }, ...(n.endTime ? [{ time: n.endTime, lane: n.lane, kind: 'release' }] : [])]).sort((a,b) => a.time - b.time); actions.forEach(n => e[n.kind](n.lane, n.time)); assert.equal(e.score, 1000000); assert.equal(e.maxCombo, chart.length);
    const miss = new Engine(chart); miss.update(duration(song) * 1000); assert.equal(miss.processed, chart.length);
  });
}
test('three full arrangements contain melody, bass, chords and drums with valid times', () => {
  for (const song of songs) {
    const music = composition(song); assert.ok(music.length > 500);
    for (const type of ['pad', 'bass', 'kick', 'snare', 'hat']) assert.ok(music.some(e => e.type === type));
    for (const event of music) { assert.ok(event.time >= 0); assert.ok(event.time + event.length <= duration(song)); assert.ok(event.gain > 0 && event.gain < 1); }
    assert.ok(makeChart(song, 'normal').length > makeChart(song, 'easy').length);
  }
});
test('dance arrangements have contrasting sections, fills and stereo instrumentation', () => {
  for (const song of songs) {
    const events = composition(song);
    assert.deepEqual(events, composition(song));
    for (const section of ['intro','verse','build','chorus','break','finale']) assert.ok(events.some(e => e.section === section), song.id + ' ' + section);
    for (const type of ['clap','openhat','crash','riser','tom','arp','stab']) assert.ok(events.some(e => e.type === type), song.id + ' ' + type);
    const chorusBars = new Set(events.filter(e => e.section === 'chorus').map(e => Math.floor((e.time + .000001) / (240 / song.bpm))));
    const breakBars = new Set(events.filter(e => e.section === 'break').map(e => Math.floor((e.time + .000001) / (240 / song.bpm))));
    const density = section => events.filter(e => e.section === section).length;
    assert.ok(density('chorus') / chorusBars.size > density('break') / breakBars.size * 1.5);
    assert.ok(events.some(e => e.pan < 0) && events.some(e => e.pan > 0));
    for (const event of events) assert.ok(Number.isFinite(event.midi) && event.pan >= -1 && event.pan <= 1);
  }
});
