/* Original Web Audio effects: no downloads or background music required. */
(function (root) {
  'use strict';
  const melodies = {
    countdown: [440], start: [523, 659, 784], item: [659, 988],
    'item-bomb': [330, 494, 659], 'item-fire': [523, 784, 1047],
    'item-superfire': [523, 659, 784, 1047], 'item-speed': [784, 988, 1319],
    'item-shield': [659, 880, 1175], shield: [1175, 880, 440],
    kill: [784, 988, 1319], combo: [784, 988, 1175, 1568],
    'stage-clear': [523, 659, 784, 1047], complete: [523, 659, 784, 1047, 1319, 1568],
    defeat: [392, 330, 262, 196], draw: [392, 349, 294], warning: [880, 880]
  };
  function create(makeContext) {
    let context, master, muted = false;
    const voices = new Set(), last = new Map();
    function stop() {
      for (const voice of [...voices]) { try { voice.stop(); } catch (_) {} }
      voices.clear(); last.clear();
    }
    function setMuted(value) {
      muted = !!value;
      if (master) master.gain.value = muted ? 0 : .55;
      if (muted) stop();
    }
    async function unlock() {
      if (muted) return;
      try {
        if (!context || context.state === 'closed') {
          context = makeContext(); master = context.createGain();
          master.gain.value = .55; master.connect(context.destination);
        }
        if (context.state === 'suspended') await context.resume();
      } catch (_) { /* Browser audio may be unavailable; gameplay still works. */ }
    }
    function voice(from, to, when, duration, volume, wave = 'sine') {
      if (voices.size >= 24) return;
      const node = wave === 'noise' ? context.createBufferSource() : context.createOscillator();
      const gain = context.createGain();
      if (wave === 'noise') {
        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
        const samples = buffer.getChannelData(0);
        // Low-passed noise gives the blast a soft, low rumble instead of a sharp click.
        let previous = 0;
        for (let i = 0; i < samples.length; i++) { previous = previous * .8 + (Math.random() * 2 - 1) * .2; samples[i] = previous; }
        node.buffer = buffer;
      } else {
        node.type = wave; node.frequency.setValueAtTime(from, when);
        node.frequency.exponentialRampToValueAtTime(to, when + duration);
      }
      gain.gain.setValueAtTime(.001, when);
      gain.gain.linearRampToValueAtTime(volume, when + .008);
      gain.gain.exponentialRampToValueAtTime(.001, when + duration);
      node.connect(gain); gain.connect(master); voices.add(node);
      node.onended = () => { voices.delete(node); node.disconnect(); gain.disconnect(); };
      node.start(when); node.stop(when + duration + .02);
    }
    function play(type) {
      if (muted || !context || context.state !== 'running') return;
      const now = context.currentTime;
      if (now - (last.get(type) ?? -Infinity) < .09) return;
      last.set(type, now);
      try {
        if (type === 'explode') {
          voice(125, 38, now, .28, .24, 'triangle');
          voice(0, 0, now, .22, .24, 'noise');
        } else if (type === 'place') voice(280, 110, now, .11, .16, 'triangle');
        else if (type === 'block') voice(190, 65, now, .08, .1, 'triangle');
        else if (type === 'death') voice(330, 80, now, .25, .14, 'triangle');
        else {
          const notes = melodies[type];
          if (!notes) return;
          const gap = ['complete', 'stage-clear', 'defeat', 'draw'].includes(type) ? .14 : .085;
          notes.forEach((note, i) => voice(note, note * .99, now + i * gap, .14, type === 'warning' ? .1 : .13));
        }
      } catch (_) { /* A missing audio device must not interrupt a match. */ }
    }
    return { unlock, play, setMuted, stop };
  }
  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BlockBomberAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
