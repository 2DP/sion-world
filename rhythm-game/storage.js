(function (root) {
  'use strict';
  const KEY = 'sion-starbeat-v1';
  const defaults = { music: 70, effects: 50, speed: 1.8, offset: 0, visual: 0, reduced: false };
  const clamp = (v, min, max, fallback) => typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  function settings(raw = {}, reduced = false) {
    if (!raw || typeof raw !== 'object') raw = {};
    return { music: clamp(raw.music, 0, 100, 70), effects: clamp(raw.effects, 0, 100, 50), speed: [1.3, 1.8, 2.4].includes(raw.speed) ? raw.speed : 1.8,
      offset: clamp(raw.offset, -250, 250, 0), visual: clamp(raw.visual, -250, 250, 0), reduced: typeof raw.reduced === 'boolean' ? raw.reduced : reduced };
  }
  class Store {
    constructor(storage, reduced = false) {
      this.storage = storage; this.available = true;
      this.data = { version: 1, settings: settings({}, reduced), records: {}, tutorial: false };
      try {
        const raw = JSON.parse(storage.getItem(KEY) || 'null');
        if (raw && raw.version === 1) {
          this.data.settings = settings(raw.settings, reduced); this.data.tutorial = raw.tutorial === true;
          for (const [key, value] of Object.entries(raw.records || {})) {
            if (!/^(stroll|jump|festival|neon|comet)-(easy|normal)(-holds)?$/.test(key) || !value || typeof value !== 'object') continue;
            this.data.records[key] = { score: clamp(value.score, 0, 1000000, 0), accuracy: clamp(value.accuracy, 0, 100, 0), maxCombo: clamp(value.maxCombo, 0, 10000, 0), fullCombo: value.fullCombo === true, allPerfect: value.allPerfect === true };
          }
        }
      } catch { this.available = false; }
    }
    save() { try { this.storage.setItem(KEY, JSON.stringify(this.data)); this.available = true; } catch { this.available = false; } return this.available; }
    record(key, result) {
      const previous = this.data.records[key] || { score: 0, accuracy: 0, maxCombo: 0, fullCombo: false, allPerfect: false };
      this.data.records[key] = { score: Math.max(previous.score, result.score), accuracy: Math.max(previous.accuracy, result.accuracy), maxCombo: Math.max(previous.maxCombo, result.maxCombo), fullCombo: previous.fullCombo || result.fullCombo, allPerfect: previous.allPerfect || result.allPerfect };
      this.save(); return previous;
    }
  }
  const api = { Store, defaults, sanitizeSettings: settings };
  root.Starbeat = Object.assign(root.Starbeat || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
