(function (root) {
  'use strict';
  const weights = { Perfect: 1, Great: 0.8, Good: 0.5, Miss: 0 };
  function grade(accuracy) { return accuracy >= 97 ? 'S' : accuracy >= 90 ? 'A' : accuracy >= 80 ? 'B' : accuracy >= 65 ? 'C' : 'D'; }
  function judgment(error) {
    const ms = Math.abs(error);
    return ms <= 50 ? 'Perfect' : ms <= 100 ? 'Great' : ms <= 140 ? 'Good' : null;
  }
  class Engine {
    constructor(chart, offset = 0) {
      this.notes = chart.map((note, id) => ({ ...note, id, result: null, error: null })).sort((a, b) => a.time - b.time || a.lane - b.lane);
      this.offset = offset;
      this.held = new Set();
      this.counts = { Perfect: 0, Great: 0, Good: 0, Miss: 0 };
      this.weight = 0; this.processed = 0; this.combo = 0; this.maxCombo = 0;
      this.groupCursor = 0; this.events = [];
      this.groups = [];
      for (const note of this.notes) {
        let group = this.groups[this.groups.length - 1];
        if (!group || group.time !== note.time) this.groups.push(group = { time: note.time, notes: [] });
        group.notes.push(note);
      }
    }
    settle(note, result, error = null) {
      if (note.result) return;
      note.result = result; note.error = error;
      // Integer tenths keep grade boundaries stable after many Great judgments.
      this.counts[result]++; this.processed++; this.weight += weights[result] * 10;
      this.events.push({ lane: note.lane, result, error });
    }
    flushCombo() {
      while (this.groupCursor < this.groups.length) {
        const group = this.groups[this.groupCursor];
        if (group.notes.some(n => !n.result)) break;
        this.combo = group.notes.some(n => n.result === 'Miss') ? 0 : this.combo + group.notes.length;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.groupCursor++;
      }
    }
    update(time) {
      const adjusted = time - this.offset;
      for (const note of this.notes) {
        if (note.holding && !note.result) {
          if (!this.held.has(note.lane)) this.settle(note, 'Miss');
          else if (adjusted >= note.endTime) this.settle(note, note.headResult, note.headError);
          continue;
        }
        if (note.time >= adjusted - 140) break;
        if (!note.result) this.settle(note, 'Miss');
      }
      this.flushCombo();
    }
    hit(lane, time) {
      this.update(time);
      const adjusted = time - this.offset;
      const note = this.notes.find(n => !n.result && !n.holding && n.lane === lane && Math.abs(adjusted - n.time) <= 140);
      if (!note) return null;
      const error = adjusted - note.time;
      const result = judgment(error);
      if (note.endTime > note.time) {
        note.holding = true; note.headResult = result; note.headError = error; this.held.add(lane);
      } else this.settle(note, result, error);
      this.flushCombo();
      return { result, error, lane };
    }
    release(lane, time) {
      this.update(time);
      this.held.delete(lane);
      for (const note of this.notes) if (note.lane === lane && note.holding && !note.result) this.settle(note, 'Miss');
      this.flushCombo();
    }
    drainEvents() { return this.events.splice(0); }
    get score() { return this.notes.length ? Math.round(this.weight * 100000 / this.notes.length) : 0; }
    get accuracy() { return this.processed ? this.weight * 10 / this.processed : 0; }
    result() {
      const accuracy = this.notes.length ? this.weight * 10 / this.notes.length : 0;
      return { score: this.score, accuracy, maxCombo: this.maxCombo, counts: { ...this.counts }, total: this.notes.length,
        grade: grade(accuracy), fullCombo: this.notes.length > 0 && this.processed === this.notes.length && this.counts.Miss === 0,
        allPerfect: this.notes.length > 0 && this.counts.Perfect === this.notes.length };
    }
  }
  const api = { Engine, judgment, grade };
  root.Starbeat = Object.assign(root.Starbeat || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
