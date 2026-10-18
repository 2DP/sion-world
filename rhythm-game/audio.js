(function (root) {
  'use strict';
  const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
  function tone(ctx, out, type, midi, start, length, volume, pan = 0) {
    const gain = ctx.createGain();
    const stereo = ctx.createStereoPanner(); stereo.pan.value = pan; gain.connect(stereo); stereo.connect(out);
    const end = start + Math.max(.11, length) + .06;
    const attack = type === 'pad' ? .055 : .004;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, volume), start + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, volume * (type === 'pad' ? .65 : .35)), start + Math.max(attack + .01, length * .45));
    gain.gain.exponentialRampToValueAtTime(.0001, end);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = type === 'pluck' || type === 'stab' ? 1.6 : .6;
    const bright = { bass: 900, pad: 1800, lead: 4800, chip: 5200, pluck: 6500, stab: 4000, arp: 6000, bell: 9000 }[type] || 4000;
    filter.frequency.setValueAtTime(bright, start); filter.frequency.exponentialRampToValueAtTime(bright * (type === 'pad' ? .8 : .35), end); filter.connect(gain);
    const voices = type === 'bell' ? [['sine',1,0,.85],['sine',2,0,.15],['sine',3,0,.035]]
      : type === 'bass' ? [['triangle',1,0,.65],['sine',1,0,.35]]
      : type === 'arp' ? [['triangle',1,0,.8],['sine',2,0,.2]]
      : type === 'chip' ? [['square',1,0,.35],['triangle',2,0,.3]]
      : [['sawtooth',1,-7,.38],['sawtooth',1,7,.38],['sine',1,0,.24]];
    for (const [wave, ratio, detune, level] of voices) {
      const osc = ctx.createOscillator(), mix = ctx.createGain();
      osc.type = wave; osc.frequency.value = frequency(midi) * ratio; osc.detune.value = detune; mix.gain.value = level;
      osc.connect(mix); mix.connect(filter); osc.start(start); osc.stop(end + .01);
    }
  }
  function drum(ctx, out, event, noise) {
    const { type, time, gain: volume, length } = event;
    const g = ctx.createGain(); const stereo = ctx.createStereoPanner(); stereo.pan.value = event.pan || 0; g.connect(stereo); stereo.connect(out);
    g.gain.setValueAtTime(type === 'riser' ? .0001 : volume, time);
    if (type === 'riser') g.gain.exponentialRampToValueAtTime(volume, time + length * .9);
    else if (type === 'clap') {
      for (const offset of [.012,.026]) { g.gain.exponentialRampToValueAtTime(volume * .25, time + offset - .004); g.gain.setValueAtTime(volume, time + offset); }
    }
    g.gain.exponentialRampToValueAtTime(.0001, time + length);
    if (type === 'kick' || type === 'tom') {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(type === 'kick' ? 175 : frequency(event.midi) * 1.5, time);
      osc.frequency.exponentialRampToValueAtTime(type === 'kick' ? 43 : frequency(event.midi), time + Math.min(length * .8,.13));
      osc.connect(g); osc.start(time); osc.stop(time + length);
    } else {
      const source = ctx.createBufferSource(); source.buffer = noise; source.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = type === 'clap' || type === 'snare' ? 'bandpass' : 'highpass';
      filter.frequency.value = { hat: 6800, openhat: 5900, shaker: 7600, snare: 2100, clap: 1500, crash: 4200, riser: 400 }[type] || 3000;
      filter.Q.value = .7;
      if (type === 'riser') filter.frequency.exponentialRampToValueAtTime(7500, time + length);
      source.connect(filter); filter.connect(g); source.start(time); source.stop(time + length);
      if (type === 'snare') { const body = ctx.createOscillator(); const bodyGain = ctx.createGain(); body.frequency.value = 185; bodyGain.gain.value = .4; body.connect(bodyGain); bodyGain.connect(g); body.start(time); body.stop(time + Math.min(.11,length)); }
    }
  }
  async function renderSong(song, Offline = root.OfflineAudioContext || root.webkitOfflineAudioContext) {
    if (!Offline) throw new Error('음악 준비 기능을 사용할 수 없어요. 다른 브라우저로 열어 주세요.');
    const sampleRate = 22050, length = root.Starbeat.duration(song);
    const outputContext = new Offline(2, 1, sampleRate);
    const buffer = outputContext.createBuffer(2, Math.ceil(length * sampleRate), sampleRate);
    const events = root.Starbeat.composition(song), chunkSeconds = 16 * 60 / song.bpm;
    // Render four bars at a time so thousands of inactive filters do not slow down preparation.
    for (let offset = 0; offset < length; offset += chunkSeconds) {
      const chunkEvents = events.filter(event => event.time >= offset && event.time < offset + chunkSeconds);
      if (!chunkEvents.length) continue;
      const tail = Math.max(...chunkEvents.map(event => event.time - offset + event.length + .1)) + 60 / song.bpm * .75;
      const offline = new Offline(2, Math.ceil(tail * sampleRate), sampleRate);
      const master = offline.createGain(); master.gain.value = .72;
      master.connect(offline.destination);
      const synth = offline.createGain(); synth.connect(master);
      // A subtle tempo-synced stereo echo adds space without smearing the drums.
      const delay = offline.createDelay(1), echo = offline.createGain(), echoPan = offline.createStereoPanner();
      delay.delayTime.value = 60 / song.bpm * .75; echo.gain.value = .16; echoPan.pan.value = -.45;
      synth.connect(delay); delay.connect(echo); echo.connect(echoPan); echoPan.connect(master);
      const noise = offline.createBuffer(1, sampleRate * 2, sampleRate);
      const data = noise.getChannelData(0); let seed = 712367;
      for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
      const drums = new Set(['kick','hat','snare','clap','openhat','shaker','crash','riser','tom']);
      for (const original of chunkEvents) {
        const event = { ...original, time: original.time - offset };
        if (drums.has(event.type)) {
          drum(offline, master, event, noise);
          if (event.type === 'kick') { synth.gain.setValueAtTime(.58,event.time); synth.gain.linearRampToValueAtTime(1,event.time + 60 / song.bpm * .38); }
        } else tone(offline, synth, event.type, event.midi, event.time, event.length, event.gain, event.pan || 0);
      }
      const chunk = await offline.startRendering(), first = Math.round(offset * sampleRate);
      for (let c = 0; c < 2; c++) {
        const target = buffer.getChannelData(c), source = chunk.getChannelData(c);
        for (let i = 0; i < source.length && first + i < target.length; i++) target[first + i] += source[i];
      }
    }
    for (let c = 0; c < 2; c++) {
      const samples = buffer.getChannelData(c);
      for (let i = Math.floor((length - .6) * sampleRate); i < samples.length; i++) samples[i] *= Math.max(0, (length - .01 - i / sampleRate) / .59);
    }
    let peak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) { const samples = buffer.getChannelData(c); for (const value of samples) peak = Math.max(peak,Math.abs(value)); }
    const scale = peak > 0 ? Math.min(1.45,.88 / peak) : 1;
    for (let c = 0; c < buffer.numberOfChannels; c++) { const samples = buffer.getChannelData(c); for (let i = 0; i < samples.length; i++) samples[i] *= scale; }
    return buffer;
  }
  class Audio {
    constructor() { this.ctx = null; this.buffer = null; this.bufferId = null; this.source = null; this.position = 0; this.startAt = 0; this.running = false; this.musicVolume = 0.7; this.effectsVolume = 0.5; }
    async unlock() {
      if (!this.ctx) {
        const Context = root.AudioContext || root.webkitAudioContext;
        if (!Context) throw new Error('이 브라우저에서는 음악을 재생할 수 없어요. 최신 브라우저로 열어 주세요.');
        this.ctx = new Context({ latencyHint: 'interactive' });
        this.music = this.ctx.createGain(); this.fx = this.ctx.createGain();
        const limiter = this.ctx.createDynamicsCompressor(); limiter.threshold.value = -8; limiter.ratio.value = 8;
        this.music.connect(limiter); this.fx.connect(limiter); limiter.connect(this.ctx.destination);
        this.volume(this.musicVolume * 100, this.effectsVolume * 100);
      }
      if (this.ctx.state !== 'running') await this.ctx.resume();
      if (this.ctx.state !== 'running') throw new Error('소리가 잠시 멈췄어요. 다시 시작해 주세요.');
    }
    volume(music, effects) {
      this.musicVolume = music / 100; this.effectsVolume = effects / 100;
      if (this.ctx) { this.music.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.02); this.fx.gain.setTargetAtTime(this.effectsVolume, this.ctx.currentTime, 0.02); }
    }
    async prepare(song) {
      if (this.bufferId === song.id && this.buffer) return;
      this.stop(); this.buffer = null; this.bufferId = null;
      this.buffer = await renderSong(song); this.bufferId = song.id;
    }
    play(position = 0, delay = 0) {
      this.stop(); this.position = position; this.startAt = this.ctx.currentTime + delay;
      const source = this.ctx.createBufferSource(); source.buffer = this.buffer; source.connect(this.music);
      // Negative song positions are the silent lead-in before the first note.
      source.start(this.startAt + Math.max(0, -position), Math.max(0, position));
      this.source = source; this.running = true;
    }
    time() { return this.running ? this.position + Math.max(0, this.ctx.currentTime - this.startAt) : this.position; }
    pause() { const position = this.time(); this.stop(); this.position = position; return position; }
    stop() { if (this.source) { try { this.source.stop(); } catch {} this.source.disconnect(); this.source = null; } this.running = false; }
    tick(accent = false) { if (this.ctx?.state === 'running') tone(this.ctx, this.fx, 'bell', accent ? 88 : 81, this.ctx.currentTime, 0.09, 0.16); }
    hit(lane) { if (this.ctx?.state === 'running') tone(this.ctx, this.fx, 'bell', [84, 88, 91, 95][lane], this.ctx.currentTime, 0.075, 0.085); }
  }
  root.Starbeat = Object.assign(root.Starbeat || {}, { Audio, renderSong });
  if (typeof module !== 'undefined') module.exports = { Audio, frequency, renderSong };
})(globalThis);
