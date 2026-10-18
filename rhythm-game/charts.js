(function (root) {
  'use strict';
  const songs = [
    { id: 'stroll', title: '별빛 산책', subtitle: '처음 만나는 작은 반짝임', genre: 'SPARKLE DANCE POP', bpm: 96, bars: 32, color: '#bfa3ff', art: 'moon', root: 60, index: 0 },
    { id: 'jump', title: '구름 위 점프', subtitle: '구름을 딛고 조금 더 높이', genre: 'BOUNCY SYNTH', bpm: 120, bars: 48, color: '#8ee7d3', art: 'cloud', root: 62, index: 1 },
    { id: 'festival', title: '은하수 축제', subtitle: '우리의 밤이 가장 빛나는 순간', genre: 'STAR CHIPTUNE', bpm: 140, bars: 56, color: '#ffb4cf', art: 'planet', root: 65, index: 2 },
    { id: 'neon', title: '네온 드라이브', subtitle: '도시의 불빛을 따라 달리는 밤', genre: 'NEON ELECTRO', bpm: 128, bars: 48, color: '#8abfff', art: 'cloud', root: 57, index: 3 },
    { id: 'comet', title: '혜성 익스프레스', subtitle: '별 사이를 가로지르는 짜릿한 여행', genre: 'COSMIC DANCE', bpm: 150, bars: 56, color: '#ffce85', art: 'planet', root: 67, index: 4 }
  ];
  const tutorial = { id: 'tutorial', title: '루미와 첫 연주', subtitle: '판정선에 닿을 때 눌러요', bpm: 96, bars: 8, root: 60, index: -1, color: '#ffe5a0' };
  const paths = [[0, 2, 1, 3, 2, 0, 3, 1], [1, 2, 0, 3, 1, 3, 0, 2], [0, 3, 1, 2, 3, 0, 2, 1]];
  // Two-bar, authored call-and-response hooks. Tuples are beat, semitone, length.
  const hooks = [
    [[0,7,.5],[.75,7,.25],[1,9,.5],[1.75,12,.75],[3,7,.5],[3.5,4,.5],[4,5,.5],[4.75,4,.25],[5,2,.5],[6,4,.5],[6.75,7,.25],[7,0,.8]],
    [[0,0,.4],[.5,4,.4],[1.25,7,.4],[2,12,.65],[3,9,.3],[3.5,7,.3],[4,4,.4],[4.5,7,.4],[5.25,9,.4],[6,7,.3],[6.5,4,.3],[7,2,.7]],
    [[0,12,.3],[.5,7,.3],[1,12,.3],[1.5,14,.3],[2.25,16,.5],[3,14,.3],[3.5,12,.3],[4,9,.3],[4.5,12,.3],[5.25,7,.4],[6,9,.3],[6.5,7,.3],[7,4,.3],[7.5,7,.3]]
  ];
  hooks.push(
    [[0,0,.5],[.75,7,.25],[1.5,10,.5],[2.5,7,.4],[3.25,5,.5],[4,3,.5],[4.75,7,.25],[5.5,12,.5],[6.5,10,.4],[7.25,7,.5]],
    [[0,7,.25],[.5,12,.25],[1,16,.5],[2,14,.25],[2.5,12,.25],[3,9,.5],[4,7,.25],[4.5,9,.25],[5,12,.5],[6,7,.25],[6.5,4,.25],[7,0,.75]]
  );
  const arrangements = [
    [[4,'intro'],[12,'verse'],[16,'build'],[24,'chorus'],[28,'break'],[32,'finale']],
    [[4,'intro'],[12,'verse'],[16,'build'],[24,'chorus'],[28,'break'],[32,'verse'],[36,'build'],[44,'finale'],[48,'outro']],
    [[4,'intro'],[16,'verse'],[20,'build'],[32,'chorus'],[36,'break'],[40,'build'],[52,'finale'],[56,'outro']]
  ];
  function sectionAt(song, bar) { return arrangements[song.index > 2 ? song.index - 2 : song.index].find(([end]) => bar < end)?.[1] || 'outro'; }
  function duration(song) { return song.bars * 4 * 60 / song.bpm + 0.8; }
  function makeChart(song, difficulty) {
    if (song.id === 'tutorial') return [4, 6, 8, 10, 14, 16, 18, 20, 24, 26, 28, 30].map((beat, i) => ({ beat, time: beat * 60000 / song.bpm, lane: i % 4, ...(i >= 8 && i % 2 === 0 ? { endTime: (beat + 1) * 60000 / song.bpm } : {}) }));
    const notes = []; const last = [-Infinity, -Infinity, -Infinity, -Infinity];
    const route = paths[song.index % paths.length]; let step = 0;
    function add(beat, lane) {
      const time = Math.round(beat * 60000 / song.bpm * 1000) / 1000;
      if (time - last[lane] < 300) return;
      notes.push({ beat, time, lane }); last[lane] = time;
    }
    for (let bar = 0; bar < song.bars; bar++) {
      if (bar === 0) continue; // A full bar to hear the beat before the first playable note.
      let beats = difficulty === 'easy' || bar < 2 ? [0, 2] : [0, 1, 2];
      if (difficulty === 'normal' && bar >= 2) {
        if (song.index === 0 && bar % 4 === 3) beats.push(3);
        if (song.index === 1 && bar % 2 === 1) beats.push(3.5);
        if (song.index >= 2) beats.push(bar % 2 ? 3.5 : 3);
      }
      for (const b of beats) {
        const lane = route[(step++ + Math.floor(bar / 8)) % route.length];
        add(bar * 4 + b, lane);
        if (difficulty === 'normal' && bar >= 4 && bar % 4 === 0 && b === 0) add(bar * 4, lane < 2 ? 2 + bar % 2 : bar % 2);
      }
    }
    notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (i % (difficulty === 'easy' ? 8 : 6) !== 2) continue;
      const next = notes.slice(i + 1).find(n => n.lane === note.lane);
      const end = Math.min(note.time + (difficulty === 'easy' ? 1 : 2) * 60000 / song.bpm, next ? next.time - 320 : song.bars * 240000 / song.bpm - 250);
      if (end - note.time >= 350) note.endTime = Math.round(end * 1000) / 1000;
    }
    return notes;
  }
  function composition(song) {
    const events = []; const beatSec = 60 / song.bpm;
    if (song.id === 'tutorial') {
      for (let b = 0; b < 32; b++) events.push({ type: 'bell', time: b * beatSec, length: 0.12, midi: b % 4 ? 79 : 84, gain: 0.16 });
      return events;
    }
    const verseChords = song.id === 'neon' ? [[0,3,7],[-5,-1,2],[-3,0,4],[-7,-3,0]] : [[0,4,7],[-3,0,4],[-7,-3,0],[-5,-1,2]];
    const chorusChords = [[0,4,7],[-5,-1,2],[-3,0,4],[-7,-3,0]];
    for (let bar = 0; bar < song.bars; bar++) {
      const section = sectionAt(song, bar);
      const chorus = section === 'chorus' || section === 'finale';
      const soft = section === 'intro' || section === 'break';
      const chord = (chorus ? chorusChords : verseChords)[bar % 4].map(n => song.root + n);
      const energy = section === 'break' ? .48 : section === 'intro' ? .65 : section === 'outro' ? .72 : chorus ? 1 : .82;
      const add = (type, beat, beats, midi, gain, pan = 0) => events.push({ type, time: (bar * 4 + beat) * beatSec, length: beats * beatSec, midi, gain: gain * energy, pan, section });
      // Sustained harmony underneath offbeat chord stabs and pumping octave bass.
      chord.forEach((midi, i) => add('pad', 0, 3.85, midi, .035, (i - 1) * .45));
      if (!soft) for (const beat of [.5, 1.5, 2.5, 3.5]) chord.forEach((midi, i) => add('stab', beat, .25, midi + 12, chorus ? .065 : .045, (i - 1) * .35));
      const bassPattern = soft ? [[0,0],[2,0],[3.5,7]] : [[0,0],[.75,0],[1.5,7],[2,0],[2.75,12],[3.5,7]];
      for (const [beat, interval] of bassPattern) add('bass', beat, .38, chord[0] - 24 + interval, .22);
      // Four-on-the-floor kick, backbeat clap, offbeat hats and occasional fills.
      const kicks = section === 'break' ? [0,2] : [0,1,2,3];
      for (const beat of kicks) add('kick', beat, .35, 0, .66);
      for (const beat of [1,3]) {
        add('snare', beat, .22, 0, .22);
        if (!soft) add('clap', beat, .25, 0, .17, .12);
      }
      for (let beat = 0; beat < 4; beat += .5) {
        add('hat', beat, .09, 0, beat % 1 ? .13 : .075, beat % 1 ? .3 : -.3);
        if (chorus && beat % 1) add('openhat', beat, .3, 0, .085, -.25);
        if (chorus && song.index > 0) add('shaker', beat + .25, .08, 0, .045, .6);
      }
      if (bar && section !== sectionAt(song, bar - 1)) add('crash', 0, 1.25, 0, .18, -.25);
      if (section === 'build' && sectionAt(song, bar + 1) !== 'build') {
        add('riser', 0, 3.9, 0, .17);
        for (let beat = 2; beat < 4; beat += .25) add('snare', beat, .12, 0, .09 + (beat - 2) * .06);
      } else if (bar % 8 === 7 && !soft) {
        for (const beat of [3.25, 3.5, 3.75]) add('tom', beat, .2, 46 - (beat - 3.25) * 12, .22, (beat - 3.5) * 2);
      }
      // Different phrase endings answer the hook instead of looping a scale.
      const hook = hooks[song.index]; const half = bar % 2;
      for (const [at, pitch, length] of hook) {
        if (Math.floor(at / 4) !== half) continue;
        const beat = at % 4;
        if (soft && beat % 1 !== 0) continue;
        const cadence = bar % 8 === 7 && beat >= 3;
        const midi = song.root + 12 + (cadence ? (beat < 3.5 ? 2 : 0) : pitch);
        add(soft ? 'bell' : song.index === 0 ? 'pluck' : song.index === 1 || song.index === 3 ? 'lead' : 'chip', beat, length, midi, chorus ? .19 : .15);
        if (section === 'finale' && beat % 1 === 0) add('bell', beat, length * .65, midi + 12, .035, .4);
      }
      // Sparkling arpeggios and a higher response become audible at the drop.
      if (chorus || section === 'build') {
        for (let beat = .25; beat < 4; beat += .5) {
          const index = Math.floor(beat * 2);
          add('arp', beat, .2, chord[index % 3] + 12 + (index % 4 === 3 ? 12 : 0), section === 'build' ? .045 : .065, index % 2 ? -.55 : .55);
        }
      }
    }
    return events.sort((a, b) => a.time - b.time);
  }
  const api = { songs, tutorial, duration, makeChart, composition, sectionAt };
  root.Starbeat = Object.assign(root.Starbeat || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
