/* Shared pitch analysis and game rules. No browser or microphone required. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PitchFlight = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const NOTES = ['도', '도♯', '레', '레♯', '미', '파', '파♯', '솔', '솔♯', '라', '라♯', '시'];
  const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const LEVELS = {
    easy: { tolerance: 50, coverage: .55, notes: [60, 62, 64, 67], label: '쉬움' },
    normal: { tolerance: 35, coverage: .65, notes: [60, 62, 64, 65, 67, 69, 71], label: '보통' },
    hard: { tolerance: 22, coverage: .72, notes: Array.from({ length: 12 }, (_, i) => 60 + i), label: '어려움' }
  };
  // Durations are quarter-note beats. Negative durations are rests.
  const PATTERNS = [
    [[1, 1, 2], [1, 1, 1, 1], [2, 1, 1], [1, 1, 1, 1]],
    [[1, .5, .5, 2, 1, 3], [1.5, .5, 1, 1, 2, 2], [1, 1, -.5, .5, 1, 2, 2], [.5, .5, 1, 2, 1, 1, 2]],
    [[.5, .5, 1, -.5, .5, 1, 1.5, .5, 2], [.5, 1.5, .5, .5, 1, -.5, .5, 1, 2], [1, -.5, .5, .5, .5, 1.5, .5, 1, 2], [.5, .5, .5, .5, 1, -.5, .5, 1, 1.5, 1.5]]
  ];
  const TEMPOS = [84, 96, 108];
  // Shared drawing/collision coordinates. Higher pitches always have smaller Y values.
  const FLIGHT = { playerX: 210, radius: 26, baseMidi: 60, baseY: 456, stepY: 27, minY: 88, restY: 536, speed: 230 };
  const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
  const midi = hz => 69 + 12 * Math.log2(hz / 440);
  const noteY = value => FLIGHT.baseY - (value - FLIGHT.baseMidi) * FLIGHT.stepY;
  function voicePosition(hz, freeOctave = true) {
    if (!Number.isFinite(hz) || hz <= 0) return { voiced: false, midi: null, y: FLIGHT.restY };
    const raw = midi(hz), nearest = Math.round(raw);
    // Fold octaves by the detected note, never by the target: changing a gate cannot move the star.
    const displayed = freeOctave ? 60 + ((nearest % 12) + 12) % 12 + (raw - nearest) : raw;
    return { voiced: true, midi: displayed, y: Math.max(FLIGHT.minY, Math.min(FLIGHT.restY, noteY(displayed))) };
  }
  function gapFor(target, difficulty = 'easy') {
    const center = target === null ? FLIGHT.restY : noteY(target);
    const half = FLIGHT.radius + LEVELS[difficulty].tolerance / 100 * FLIGHT.stepY;
    return { center, top: center - half, bottom: center + half, half };
  }
  function fitsGap(state, target = state.target) {
    if (target === null) return !state.hasPitch;
    if (!state.hasPitch) return false;
    const gap = gapFor(target, state.difficulty);
    return state.playerY - FLIGHT.radius >= gap.top - 1e-7 && state.playerY + FLIGHT.radius <= gap.bottom + 1e-7;
  }
  function gateGeometry(state, index = state.noteIndex, elapsed = state.elapsed, round = currentRound(state)) {
    const slot = round.notes[index], start = round.start + (round.countIn + slot.beat) * round.secondsPerBeat;
    const end = start + slot.beats * round.secondsPerBeat;
    const width = Math.max(26, slot.beats * round.secondsPerBeat * FLIGHT.speed - 22);
    const required = Math.max(.001, slot.beats * round.secondsPerBeat - .105) * LEVELS[state.difficulty].coverage;
    const progress = Math.min(1, slot.matchedTime / required);
    const contactX = FLIGHT.playerX + FLIGHT.radius + 4;
    let x = elapsed < start ? contactX + (start - elapsed) * FLIGHT.speed : contactX - progress * (width + FLIGHT.radius * 2 + 24);
    if (slot.result === true && elapsed > end) x -= (elapsed - end) * FLIGHT.speed;
    const opacity = slot.result === false && elapsed > end ? Math.max(0, 1 - (elapsed - end) / .35) : 1;
    return { ...gapFor(slot.midi, state.difficulty), x, width, start, end, progress, opacity, rest: slot.midi === null, target: slot.midi, result: slot.result, active: elapsed >= start && elapsed < end };
  }
  function note(hz) {
    if (!Number.isFinite(hz) || hz <= 0) return null;
    const n = Math.round(midi(hz)), index = ((n % 12) + 12) % 12;
    return { midi: n, name: NOTES[index], letter: LETTERS[index], octave: Math.floor(n / 12) - 1, cents: (midi(hz) - n) * 100 };
  }
  function centsFrom(hz, target, freeOctave = true) {
    if (!Number.isFinite(hz) || hz <= 0 || !Number.isFinite(target)) return Infinity;
    let cents = (midi(hz) - target) * 100;
    if (freeOctave) cents = ((cents + 600) % 1200 + 1200) % 1200 - 600;
    return cents;
  }
  // YIN: downsample high-rate input, reject quiet/aperiodic signals, interpolate the period.
  function detectPitch(input, sampleRate, threshold = 0.012) {
    if (!input || input.length < 1024 || !Number.isFinite(sampleRate) || sampleRate <= 0) return null;
    let sum = 0, square = 0;
    for (let i = 0; i < input.length; i++) { sum += input[i]; square += input[i] * input[i]; }
    const mean = sum / input.length, rms = Math.sqrt(Math.max(0, square / input.length - mean * mean));
    if (rms < threshold) return null;
    const stride = sampleRate > 30000 ? 2 : 1, rate = sampleRate / stride;
    const data = new Float32Array(Math.floor(input.length / stride));
    for (let i = 0; i < data.length; i++) {
      data[i] = ((stride === 2 ? (input[i * 2] + input[i * 2 + 1]) / 2 : input[i]) - mean);
    }
    const maxTau = Math.min(Math.floor(rate / 65), Math.floor(data.length / 2) - 1);
    const minTau = Math.max(2, Math.floor(rate / 1200)), window = data.length - maxTau;
    const diff = new Float32Array(maxTau + 1);
    let running = 0;
    diff[0] = 1;
    for (let tau = 1; tau <= maxTau; tau++) {
      let value = 0;
      for (let j = 0; j < window; j++) { const delta = data[j] - data[j + tau]; value += delta * delta; }
      running += value;
      diff[tau] = running > 0 ? value * tau / running : 1;
    }
    for (let tau = minTau; tau < maxTau; tau++) {
      if (diff[tau] >= 0.14) continue;
      while (tau + 1 < maxTau && diff[tau + 1] < diff[tau]) tau++;
      const left = diff[tau - 1], center = diff[tau], right = diff[tau + 1];
      const denominator = 2 * (2 * center - right - left);
      const period = tau + (denominator ? (right - left) / denominator : 0);
      const hz = rate / period;
      if (hz < 65 || hz > 1200) return null;
      return { frequency: hz, rms, confidence: 1 - center };
    }
    return null;
  }
  function makeRounds(difficulty, random = Math.random) {
    const pool = LEVELS[difficulty].notes;
    let start = 0, previous = -1;
    return Array.from({ length: 12 }, (_, gate) => {
      const stage = Math.floor(gate / 4), bpm = TEMPOS[stage], secondsPerBeat = 60 / bpm;
      let beat = 0;
      const notes = PATTERNS[stage][gate % 4].map((duration, i) => {
        let target = null;
        if (duration > 0) {
          const choices = pool.filter(n => n !== previous);
          target = gate === 0 && i === 0 ? 60 : choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))];
          previous = target;
        }
        const slot = { midi: target, beats: Math.abs(duration), beat, matchedTime: 0, judgedTime: 0, result: null };
        beat += slot.beats;
        return slot;
      });
      const round = { stage, bpm, secondsPerBeat, notes, beats: beat, countIn: 4, start, duration: (4 + beat) * secondsPerBeat };
      start += round.duration;
      return round;
    });
  }
  function create(options = {}, random = Math.random) {
    const difficulty = LEVELS[options.difficulty] ? options.difficulty : 'easy';
    const state = {
      difficulty, mode: options.mode === 'challenge' ? 'challenge' : 'practice', freeOctave: options.freeOctave !== false,
      status: 'running', phase: 'countin', target: 60, gateX: 1050, hold: 0,
      playerY: FLIGHT.restY, voiceMidi: null, hasPitch: false, blocked: false,
      gates: 0, total: 12, passed: 0, lives: 3, score: 0, combo: 0, maxCombo: 0, matched: false, cents: Infinity,
      elapsed: 0, event: null, noteIndex: 0, beat: 0, phraseBeat: 0, rounds: makeRounds(difficulty, random)
    };
    updatePosition(state);
    return state;
  }
  function currentRound(state) { return state.rounds[Math.min(state.gates, state.total - 1)]; }
  function updatePosition(state) {
    const r = currentRound(state);
    state.beat = Math.max(0, (state.elapsed - r.start) / r.secondsPerBeat);
    state.phraseBeat = Math.max(0, state.beat - r.countIn);
    state.phase = state.beat < r.countIn - 1e-7 ? 'countin' : 'singing';
    state.noteIndex = Math.max(0, r.notes.findIndex(n => state.phraseBeat < n.beat + n.beats - 1e-7));
    const n = r.notes[state.noteIndex]; state.target = n.midi;
    state.remaining = Math.max(0, (n.beat + n.beats - state.phraseBeat) * r.secondsPerBeat);
    state.hold = n.judgedTime ? Math.min(1, n.matchedTime / n.judgedTime) : 0;
    state.gateX = gateGeometry(state).x;
    state.blocked = state.phase === 'singing' && n.midi !== null && !fitsGap(state);
  }
  function restartRound(state) {
    if (state.status === 'won' || state.status === 'lost') return;
    const r = currentRound(state);
    for (const n of r.notes) { n.matchedTime = 0; n.judgedTime = 0; n.result = null; }
    state.elapsed = r.start; state.matched = false; state.event = null; state.cents = Infinity;
    state.playerY = FLIGHT.restY; state.voiceMidi = null; state.hasPitch = false; state.blocked = false;
    updatePosition(state);
  }
  function settle(state, success) {
    const r = currentRound(state);
    state.gates++;
    state.event = success ? 'pass' : 'miss';
    if (success) {
      state.passed++; state.combo++; state.maxCombo = Math.max(state.combo, state.maxCombo);
      const precision = r.notes.reduce((sum, n) => sum + Math.min(1, n.matchedTime / Math.max(.001, n.judgedTime)), 0) / r.notes.length;
      state.score += 100 + r.notes.filter(n => n.midi !== null).length * 20 + Math.min(10, state.combo - 1) * 15 + Math.round(precision * 100);
    } else { state.lives--; state.combo = 0; }
    state.hold = 0;
    if (!state.lives) state.status = 'lost';
    else if (state.gates === state.total) state.status = 'won';
    else updatePosition(state);
  }
  function tick(state, dt, hz) {
    state.event = null;
    if (state.status !== 'running' || !Number.isFinite(dt) || dt <= 0) return state;
    dt = Math.min(dt, .25);
    const config = LEVELS[state.difficulty];
    const position = voicePosition(hz, state.freeOctave);
    state.playerY = position.y; state.voiceMidi = position.midi; state.hasPitch = position.voiced;
    while (dt > 1e-8 && state.status === 'running') {
      const r = currentRound(state), n = r.notes[state.noteIndex];
      const countEnd = r.start + r.countIn * r.secondsPerBeat;
      const start = countEnd + n.beat * r.secondsPerBeat, end = start + n.beats * r.secondsPerBeat;
      const boundary = state.phase === 'countin' ? countEnd : end;
      const step = Math.min(dt, Math.max(1e-8, boundary - state.elapsed));
      state.cents = centsFrom(hz, n.midi, state.freeOctave);
      state.matched = state.phase === 'singing' && fitsGap(state, n.midi) && (n.midi === null || Math.abs(state.cents) <= config.tolerance);
      if (state.phase === 'singing') {
        // Small onset/release windows accommodate vocal transitions and microphone latency.
        const judged = Math.max(0, Math.min(state.elapsed + step, end - .04) - Math.max(state.elapsed, start + .065));
        n.judgedTime += judged;
        if (state.matched) n.matchedTime += judged;
      }
      state.elapsed += step; dt -= step;
      if (state.phase === 'singing' && state.elapsed >= end - 1e-7) {
        n.result = n.judgedTime > 0 && n.matchedTime / n.judgedTime >= config.coverage;
        if (state.noteIndex === r.notes.length - 1) {
          settle(state, r.notes.every(slot => slot.result));
          state.matched = false;
          if (state.status !== 'running') break;
        }
      }
      const oldTarget = state.target;
      updatePosition(state);
      if (state.target !== oldTarget || state.phase === 'countin') state.matched = false;
    }
    return state;
  }
  return { NOTES, LETTERS, LEVELS, PATTERNS, TEMPOS, FLIGHT, frequency, midi, note, noteY, voicePosition, gapFor, fitsGap, gateGeometry, centsFrom, detectPitch, makeRounds, currentRound, restartRound, create, tick };
});
