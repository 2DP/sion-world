/* Pure game rules. Also loadable with Node for deterministic tests. */
(function (root) {
  "use strict";
  const DEFAULTS = Object.freeze({
    size: 25, hazards: 12, lives: 10, moveInterval: 1 / 6,
    hazardInterval: 1, warningTime: .2, bonusInterval: 15,
    bonusDuration: 3, goldDuration: 5, invulnerability: 1,
    tileScore: 10, goldTileScore: 20, bonusScore: 100, lifeScore: 100
  });
  const DIRECTIONS = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });
  const same = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;
  const key = p => p.x + "," + p.y;

  class Game {
    constructor(options = {}) {
      this.config = { ...DEFAULTS, ...options };
      this.random = options.random || Math.random;
      this.reset(false);
    }
    reset(start = true) {
      const c = this.config;
      this.status = start ? "playing" : "ready";
      this.time = 0;
      this.lives = c.lives;
      this.score = 0;
      this.player = { x: Math.floor(c.size / 2), y: Math.floor(c.size / 2) };
      this.visited = new Uint8Array(c.size * c.size);
      this.visited[this.index(this.player)] = 1;
      this.visitedCount = 1;
      this.nextPlayerAt = 0;
      this.nextHazardAt = c.hazardInterval;
      this.nextBonusAt = c.bonusInterval;
      this.invulnerableUntil = 0;
      this.goldUntil = 0;
      this.goldWarned = false;
      this.bonus = null;
      this.plans = null;
      this.events = [];
      const candidates = [];
      for (let y = 0; y < c.size; y++) {
        for (let x = 0; x < c.size; x++) {
          if (Math.max(Math.abs(x - this.player.x), Math.abs(y - this.player.y)) > 2) candidates.push({ x, y });
        }
      }
      this.hazards = [];
      for (let i = 0; i < c.hazards && candidates.length; i++) {
        this.hazards.push(candidates.splice(Math.floor(this.random() * candidates.length), 1)[0]);
      }
      return this;
    }
    index(p) { return p.y * this.config.size + p.x; }
    inside(p) { return p.x >= 0 && p.y >= 0 && p.x < this.config.size && p.y < this.config.size; }
    get golden() { return this.goldUntil > this.time; }
    dangerous(p = this.player) { return this.hazards.some(h => same(h, p)); }
    emit(type, data = {}) { this.events.push({ type, ...data }); }
    drainEvents() { return this.events.splice(0); }
    pause() { if (this.status === "playing") this.status = "paused"; }
    resume() { if (this.status === "paused") this.status = "playing"; }
    planHazards() {
      const occupied = new Set(this.hazards.map(key));
      const reserved = new Set();
      this.plans = this.hazards.map(h => {
        const choices = Object.values(DIRECTIONS)
          .map(([dx, dy]) => ({ x: h.x + dx, y: h.y + dy }))
          .filter(p => this.inside(p) && !occupied.has(key(p)) && !same(p, this.bonus));
        let target = choices.length ? choices[Math.floor(this.random() * choices.length)] : { ...h };
        if (reserved.has(key(target))) target = { ...h };
        reserved.add(key(target));
        return target;
      });
    }
    spawnBonus() {
      const blocked = new Set(this.hazards.concat(this.plans || [], [this.player]).map(key));
      const candidates = [];
      for (let y = 0; y < this.config.size; y++) for (let x = 0; x < this.config.size; x++) {
        if (!blocked.has(key({ x, y }))) candidates.push({ x, y });
      }
      if (candidates.length) {
        this.bonus = { ...candidates[Math.floor(this.random() * candidates.length)], expires: this.time + this.config.bonusDuration };
        this.emit("bonus");
      }
      this.nextBonusAt = this.time + this.config.bonusInterval;
    }
    finish(status) {
      if (status === "won") this.score += this.lives * this.config.lifeScore;
      this.status = status;
      this.emit(status);
    }
    update(dt, direction = null) {
      if (this.status !== "playing") return;
      if (!Number.isFinite(dt) || dt < 0) return;
      const c = this.config;
      this.time += dt;
      if (this.goldUntil && this.time >= this.goldUntil) {
        this.goldUntil = 0;
        this.nextBonusAt = this.time + c.bonusInterval;
        if (this.dangerous()) this.invulnerableUntil = Math.max(this.invulnerableUntil, this.time + c.invulnerability);
        this.emit("gold-end");
      }
      if (this.golden && this.goldUntil - this.time <= 1 && !this.goldWarned) {
        this.goldWarned = true;
        this.emit("gold-warning");
      }
      if (this.bonus && this.time >= this.bonus.expires) {
        this.bonus = null;
        this.emit("bonus-expired");
      }
      if (!this.plans && this.time >= this.nextHazardAt - c.warningTime) this.planHazards();
      if (this.time >= this.nextHazardAt) {
        if (!this.plans) this.planHazards();
        this.hazards = this.plans;
        this.plans = null;
        this.nextHazardAt += c.hazardInterval;
      }
      if (!this.golden && !this.bonus && this.time >= this.nextBonusAt) this.spawnBonus();

      const vector = DIRECTIONS[direction];
      if (vector && this.time + 1e-9 >= this.nextPlayerAt) {
        const target = { x: this.player.x + vector[0], y: this.player.y + vector[1] };
        if (this.inside(target)) {
          this.player = target;
          this.emit("move", { ...target, direction });
        }
        this.nextPlayerAt = this.time + c.moveInterval;
      }
      if (same(this.player, this.bonus)) {
        this.bonus = null;
        this.score += c.bonusScore;
        this.goldUntil = this.time + c.goldDuration;
        this.goldWarned = false;
        this.emit("gold");
      }
      const danger = this.dangerous();
      if (danger && !this.golden && this.time + 1e-9 >= this.invulnerableUntil) {
        this.lives--;
        this.invulnerableUntil = this.time + c.invulnerability;
        this.emit("hurt");
        if (this.lives <= 0) { this.finish("lost"); return; }
      }
      const index = this.index(this.player);
      if ((!danger || this.golden) && !this.visited[index]) {
        this.visited[index] = 1;
        this.visitedCount++;
        const points = this.golden ? c.goldTileScore : c.tileScore;
        this.score += points;
        this.emit("visit", { ...this.player, points });
      }
      if (this.visitedCount === this.visited.length) this.finish("won");
    }
  }
  const api = { Game, DEFAULTS, DIRECTIONS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PastelStep = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
