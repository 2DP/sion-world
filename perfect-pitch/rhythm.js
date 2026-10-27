/* One Web Audio clock drives percussion, count-in, visual beats, and pitch judgment. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PitchRhythm = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function beatEvents(rounds) {
    const events = [];
    for (const r of rounds) for (let beat = 0; beat < r.countIn + r.beats; beat += .5) {
      const time = r.start + beat * r.secondsPerBeat;
      const quarter = Number.isInteger(beat), bar = Math.floor(beat) % 4;
      if (quarter) events.push({ time, kind: bar % 2 === 0 ? 'kick' : 'snare', accent: bar === 0 ? 1 : .7 });
      events.push({ time, kind: 'hat', accent: quarter ? .35 : r.stage === 0 ? .10 : .23 });
    }
    return events.sort((a, b) => a.time - b.time);
  }
  function melodyEvents(round) {
    return round.notes.filter(n => n.midi !== null).map(n => ({
      time: round.start + (round.countIn + n.beat) * round.secondsPerBeat,
      duration: Math.max(.08, n.beats * round.secondsPerBeat - .045), midi: n.midi, kind: 'note'
    }));
  }
  class Track {
    constructor(context, events, options = {}) {
      this.context = context; this.events = events; this.nodes = new Set(); this.timer = null; this.running = false;
      this.interval = options.setInterval || ((fn, ms) => setInterval(fn, ms));
      this.clear = options.clearInterval || (id => clearInterval(id));
      this.master = context.createGain(); this.master.connect(context.destination); this.master.gain.value = .28;
      this.melodyMaster = context.createGain(); this.melodyMaster.connect(context.destination); this.melodyMaster.gain.value = .34;
      this.volume = .28; this.muted = false; this.offset = 0; this.anchor = 0;
      this.noise = context.createBuffer(1, Math.ceil(context.sampleRate * .3), context.sampleRate);
      const data = this.noise.getChannelData(0); let seed = 781;
      for (let i = 0; i < data.length; i++) { seed = (1664525 * seed + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
    }
    setVolume(volume, muted = this.muted) {
      this.volume = Math.min(.6, Math.max(0, Number(volume) || 0)); this.muted = muted;
      this.master.gain.setValueAtTime(muted ? 0 : this.volume, this.context.currentTime);
    }
    position() { return this.running ? Math.max(this.offset, this.offset + this.context.currentTime - this.anchor) : this.offset; }
    start(offset = 0) {
      this.stop(); this.offset = offset; this.anchor = this.context.currentTime + .12; this.running = true;
      this.index = this.events.findIndex(e => e.time >= offset - 1e-7);
      if (this.index < 0) this.index = this.events.length;
      this.pump(); this.timer = this.interval(() => this.pump(), 25);
    }
    pump() {
      if (!this.running) return;
      const horizon = this.context.currentTime + .14;
      while (this.index < this.events.length) {
        const event = this.events[this.index], at = this.anchor + event.time - this.offset;
        if (at > horizon) break;
        // Do not bunch up old percussion hits after a stalled background timer.
        if (at >= this.context.currentTime - .025) this.schedule(event, Math.max(at, this.context.currentTime));
        this.index++;
      }
    }
    schedule(event, at) {
      const ac = this.context, gain = ac.createGain(); let node, filter = null;
      const duration = event.kind === 'note' ? event.duration : event.kind === 'kick' ? .18 : event.kind === 'snare' ? .11 : .035;
      if (event.kind === 'note') {
        node = ac.createOscillator(); node.type = 'sine'; node.frequency.value = 440 * 2 ** ((event.midi - 69) / 12);
      } else {
        // Unpitched noise drums reduce the risk of backing audio being recognized as a sung note.
        node = ac.createBufferSource(); node.buffer = this.noise;
        filter = ac.createBiquadFilter(); filter.type = event.kind === 'kick' ? 'lowpass' : event.kind === 'snare' ? 'bandpass' : 'highpass';
        filter.frequency.value = event.kind === 'kick' ? 170 : event.kind === 'snare' ? 1800 : 6500; filter.Q.value = .55;
      }
      const peak = event.kind === 'note' ? .42 : event.accent * (event.kind === 'kick' ? 2.8 : .7);
      gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(peak, at + .006);
      if (event.kind === 'note') gain.gain.setValueAtTime(peak, at + Math.max(.01, duration - .045));
      gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      if (filter) { node.connect(filter); filter.connect(gain); } else node.connect(gain);
      gain.connect(event.kind === 'note' ? this.melodyMaster : this.master); this.nodes.add(node);
      node.onended = () => { this.nodes.delete(node); node.disconnect(); gain.disconnect(); if (filter) filter.disconnect(); };
      node.start(at); node.stop(at + duration + .015);
    }
    stop() {
      if (this.running) this.offset = this.position(); this.running = false;
      if (this.timer !== null) this.clear(this.timer); this.timer = null;
      for (const node of this.nodes) { try { node.stop(); node.disconnect(); } catch (_) {} }
      this.nodes.clear();
    }
    dispose() { this.stop(); this.master.disconnect(); this.melodyMaster.disconnect(); }
  }
  return { beatEvents, melodyEvents, Track };
});
