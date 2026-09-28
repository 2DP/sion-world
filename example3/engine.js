/* Pure game rules. Also loadable with Node for deterministic tests. */
(function (root) {
  "use strict";
  const DEFAULTS = Object.freeze({
    size: 7, sizeIncrease: 2, hazards: 3, lives: 10, moveInterval: 1 / 6,
    stages: 10, hazardIncrease: 2, hazardSpeedup: .07,
    boosterInterval: 25, boosterDuration: 10, boostDuration: 10,
    rabbitInterval: 30, rabbitItemDuration: 10, rabbitDuration: 30, rabbitMoveInterval: 1,
    squirrelInterval: 35, squirrelItemDuration: 10, squirrelDuration: 30, squirrelMoveInterval: 1, acornDuration: 15,
    shieldInterval: 25, shieldItemDuration: 10, shieldDuration: 10,
    healInterval: 10, healJitter: 0, healDuration: 10,
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
      this.stage = 1;
      this.events = [];
      this.setupStage();
      return this;
    }
    setupStage() {
      const c = this.config;
      this.size = c.size + (this.stage - 1) * c.sizeIncrease;
      this.squirrelItem = null;
      this.squirrel = null;
      this.nextSquirrelAt = this.time + c.squirrelInterval;
      this.shieldItem = null;
      this.shieldUntil = 0;
      this.nextShieldAt = this.time + c.shieldInterval;
      this.rabbitItem = null;
      this.rabbit = null;
      this.nextRabbitAt = this.time + c.rabbitInterval;
      this.booster = null;
      this.boostUntil = 0;
      this.nextBoosterAt = this.time + c.boosterInterval;
      this.hazardInterval = Math.max(.25, c.hazardInterval - (this.stage - 1) * c.hazardSpeedup);
      this.player = { x: Math.floor(this.size / 2), y: Math.floor(this.size / 2) };
      this.visited = new Uint8Array(this.size * this.size);
      this.visited[this.index(this.player)] = 1;
      this.visitedCount = 1;
      this.nextPlayerAt = 0;
      this.nextHazardAt = this.time + this.hazardInterval;
      this.nextBonusAt = this.time + c.bonusInterval;
      this.nextHealAt = this.time + c.healInterval + this.random() * c.healJitter;
      this.heal = null;
      this.invulnerableUntil = 0;
      this.goldUntil = 0;
      this.goldWarned = false;
      this.bonus = null;
      this.plans = null;
      const candidates = [];
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          if (Math.max(Math.abs(x - this.player.x), Math.abs(y - this.player.y)) > 2) candidates.push({ x, y });
        }
      }
      this.hazards = [];
      for (let i = 0; i < c.hazards + (this.stage - 1) * c.hazardIncrease && candidates.length; i++) {
        this.hazards.push(candidates.splice(Math.floor(this.random() * candidates.length), 1)[0]);
      }
      return this;
    }
    nextStage() {
      if (this.status !== "stage-clear" || this.stage >= this.config.stages) return;
      this.stage++;
      this.lives = this.config.lives;
      this.setupStage();
      this.status = "playing";
    }
    index(p) { return p.y * this.size + p.x; }
    inside(p) { return p.x >= 0 && p.y >= 0 && p.x < this.size && p.y < this.size; }
    get boosted() { return this.boostUntil > this.time; }
    pressTargets() {
      return [this.player, ...(this.boosted ? Object.values(DIRECTIONS).map(([dx, dy]) => ({ x: this.player.x + dx, y: this.player.y + dy })) : [])].filter(p => this.inside(p));
    }
    get shielded() { return this.shieldUntil > this.time; }
    get golden() { return this.goldUntil > this.time; }
    disabled(h) { return (h.disabledUntil || 0) > this.time; }
    dangerous(p = this.player) { return this.hazards.some(h => same(h, p) && !this.disabled(h)); }
    emit(type, data = {}) { this.events.push({ type, ...data }); }
    drainEvents() { return this.events.splice(0); }
    pause() { if (this.status === "playing") this.status = "paused"; }
    resume() { if (this.status === "paused") this.status = "playing"; }
    planHazards() {
      const occupied = new Set(this.hazards.map(key));
      const reserved = new Set();
      this.plans = this.hazards.map(h => {
        if (this.disabled(h)) return { ...h };
        const choices = Object.values(DIRECTIONS)
          .map(([dx, dy]) => ({ x: h.x + dx, y: h.y + dy }))
          .filter(p => this.inside(p) && !occupied.has(key(p)) && !same(p, this.bonus) && !same(p, this.heal) && !same(p, this.booster) && !same(p, this.rabbitItem) && !same(p, this.shieldItem) && !same(p, this.squirrelItem));
        let target = choices.length ? choices[Math.floor(this.random() * choices.length)] : { ...h };
        if (reserved.has(key(target))) target = { ...h };
        reserved.add(key(target));
        return target;
      });
    }
    spawnBonus(kind = "bonus") {
      const blocked = new Set(this.hazards.concat(this.plans || [], [this.player, this.bonus, this.heal, this.booster, this.rabbitItem, this.rabbit, this.shieldItem, this.squirrelItem, this.squirrel].filter(Boolean)).map(key));
      const candidates = [];
      for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
        if (!blocked.has(key({ x, y }))) candidates.push({ x, y });
      }
      if (candidates.length) {
        this[kind] = { ...candidates[Math.floor(this.random() * candidates.length)], expires: this.time + (kind === "squirrelItem" ? this.config.squirrelItemDuration : kind === "shieldItem" ? this.config.shieldItemDuration : kind === "heal" ? this.config.healDuration : kind === "rabbitItem" ? this.config.rabbitItemDuration : kind === "booster" ? this.config.boosterDuration : this.config.bonusDuration) };
        this.emit(kind);
      }
      if (kind === "heal") this.nextHealAt = this.time + this.config.healInterval + this.random() * this.config.healJitter;
      else if (kind === "booster") this.nextBoosterAt = this.time + this.config.boosterInterval;
      else if (kind === "rabbitItem") this.nextRabbitAt = this.time + this.config.rabbitInterval;
      else if (kind === "shieldItem") this.nextShieldAt = this.time + this.config.shieldInterval;
      else if (kind === "squirrelItem") this.nextSquirrelAt = this.time + this.config.squirrelInterval;
      else this.nextBonusAt = this.time + this.config.bonusInterval;
    }
    visitTile(target) {
      const index = this.index(target);
      if (this.visited[index]) return;
      this.visited[index] = 1;
      this.visitedCount++;
      const points = this.golden ? this.config.goldTileScore : this.config.tileScore;
      this.score += points;
      this.emit("visit", { ...target, points });
    }
    moveRabbit() {
      const rabbit = this.rabbit;
      if (!rabbit || this.time < rabbit.nextMoveAt) return;
      const choices = Object.values(DIRECTIONS).map(([dx, dy]) => ({ x: rabbit.x + dx, y: rabbit.y + dy })).filter(p => this.inside(p));
      const fresh = choices.filter(p => !this.visited[this.index(p)]);
      const pool = fresh.length ? fresh : choices;
      if (pool.length) {
        Object.assign(rabbit, pool[Math.floor(this.random() * pool.length)]);
        this.visitTile(rabbit);
      }
      rabbit.nextMoveAt = this.time + this.config.rabbitMoveInterval;
    }
    placeAcorn() {
      if (!this.squirrel) return;
      this.hazards.forEach((h, i) => {
        if (!same(h, this.squirrel) || this.disabled(h)) return;
        h.disabledUntil = this.time + this.config.acornDuration;
        if (this.plans) this.plans[i] = { ...h };
        this.emit("acorn", { x: h.x, y: h.y });
      });
    }
    moveSquirrel() {
      const squirrel = this.squirrel;
      if (!squirrel) return;
      this.placeAcorn();
      if (this.time + 1e-9 < squirrel.nextMoveAt) return;
      const choices = Object.values(DIRECTIONS).map(([dx, dy]) => ({ x: squirrel.x + dx, y: squirrel.y + dy })).filter(p => this.inside(p));
      const targets = this.hazards.filter(h => !this.disabled(h));
      // Walk toward a nearby active hazard; wander when all hazards are resting.
      const distance = p => Math.min(...targets.map(h => Math.abs(h.x - p.x) + Math.abs(h.y - p.y)));
      const nearest = targets.length ? Math.min(...choices.map(distance)) : 0;
      const pool = targets.length ? choices.filter(p => distance(p) === nearest) : choices;
      if (pool.length) Object.assign(squirrel, pool[Math.floor(this.random() * pool.length)]);
      squirrel.nextMoveAt = this.time + this.config.squirrelMoveInterval;
      this.placeAcorn();
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
      if (this.squirrel && this.time >= this.squirrel.expires) { this.squirrel = null; this.emit("squirrel-end"); }
      if (this.squirrelItem && this.time >= this.squirrelItem.expires) this.squirrelItem = null;
      if (this.shieldUntil && this.time >= this.shieldUntil) { this.shieldUntil = 0; this.emit("shield-end"); }
      if (this.shieldItem && this.time >= this.shieldItem.expires) this.shieldItem = null;
      if (this.rabbit && this.time >= this.rabbit.expires) { this.rabbit = null; this.emit("rabbit-end"); }
      if (this.rabbitItem && this.time >= this.rabbitItem.expires) this.rabbitItem = null;
      if (this.boostUntil && this.time >= this.boostUntil) { this.boostUntil = 0; this.emit("boost-end"); }
      if (this.booster && this.time >= this.booster.expires) this.booster = null;
      if (this.heal && this.time >= this.heal.expires) this.heal = null;
      this.moveSquirrel();
      if (!this.plans && this.time >= this.nextHazardAt - c.warningTime) this.planHazards();
      if (this.time >= this.nextHazardAt) {
        if (!this.plans) this.planHazards();
        this.hazards = this.plans.map((p, i) => this.disabled(this.hazards[i]) ? { ...this.hazards[i] } : p);
        this.plans = null;
        this.nextHazardAt += this.hazardInterval;
      }
      this.placeAcorn();
      if (!this.golden && !this.bonus && this.time >= this.nextBonusAt) this.spawnBonus();
      if (!this.heal && this.time >= this.nextHealAt) this.spawnBonus("heal");

      if (!this.booster && this.time >= this.nextBoosterAt) this.spawnBonus("booster");
      if (!this.rabbitItem && this.time >= this.nextRabbitAt) this.spawnBonus("rabbitItem");
      if (!this.shieldItem && this.time >= this.nextShieldAt) this.spawnBonus("shieldItem");
      if (!this.squirrelItem && this.time >= this.nextSquirrelAt) this.spawnBonus("squirrelItem");
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
      if (same(this.player, this.heal)) {
        const recovered = Math.min(1, c.lives - this.lives);
        this.lives += recovered;
        this.heal = null;
        this.emit("healed", { recovered });
      }
      if (same(this.player, this.booster)) {
        this.booster = null; this.boostUntil = this.time + c.boostDuration; this.emit("boost");
      }
      if (same(this.player, this.rabbitItem)) {
        this.rabbitItem = null;
        this.rabbit = { ...this.player, expires: this.time + c.rabbitDuration, nextMoveAt: this.time + c.rabbitMoveInterval };
        this.emit("rabbit");
      }
      if (same(this.player, this.shieldItem)) {
        this.shieldItem = null; this.shieldUntil = this.time + c.shieldDuration; this.emit("shield");
      }
      if (same(this.player, this.squirrelItem)) {
        this.squirrelItem = null;
        this.squirrel = { ...this.player, expires: this.time + c.squirrelDuration, nextMoveAt: this.time + c.squirrelMoveInterval };
        this.emit("squirrel"); this.placeAcorn();
      }
      const danger = this.dangerous();
      if (danger && !this.golden && !this.shielded && this.time + 1e-9 >= this.invulnerableUntil) {
        this.lives--;
        this.invulnerableUntil = this.time + c.invulnerability;
        this.emit("hurt");
        if (this.lives <= 0) { this.finish("lost"); return; }
      }
      for (const target of this.pressTargets()) {
        const blocked = same(target, this.player) && danger && !this.golden;
        if (!blocked) this.visitTile(target);
      }
      this.moveRabbit();
      if (this.visitedCount === this.visited.length) this.finish(this.stage < c.stages ? "stage-clear" : "won");
    }
  }
  const api = { Game, DEFAULTS, DIRECTIONS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PastelStep = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
