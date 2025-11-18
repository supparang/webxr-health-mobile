// js/engine.js
'use strict';

/**
 * GameEngine: จัดการเวลา spawn / lifetime / score / combo
 * ไม่ผูกกับ DOM โดยตรง — ใช้ผ่าน renderer + logger ที่ส่งเข้ามา
 */

export class GameEngine {
  /**
   * @param {object} options
   *  - config.durationMs
   *  - config.spawnIntervalMs
   *  - config.targetLifetimeMs
   *  - config.decoyChance (0..1)
   *  - config.maxConcurrent
   *  - hooks.onUpdate(state)
   *  - hooks.onEnd(state)
   *  - renderer: { reset(), spawn(target), hit(id, meta), expire(id, meta) }
   *  - logger: { logSpawn(e), logHit(e), logExpire(e), finish() }
   */
  constructor(options) {
    this.config = options.config;
    this.hooks = options.hooks || {};
    this.renderer = options.renderer;
    this.logger = options.logger;

    this.state = 'idle'; // idle | running | ended
    this.targets = new Map();
    this.nextId = 1;

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.missCount = 0;

    this.startTime = 0;
    this.elapsed = 0;
    this.lastSpawnAt = 0;
    this._raf = null;
  }

  reset() {
    this.stopLoop();
    this.state = 'idle';
    this.targets.clear();
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.missCount = 0;
    this.elapsed = 0;
    this.lastSpawnAt = 0;
    if (this.renderer && this.renderer.reset) this.renderer.reset();
    this._emitUpdate();
  }

  start(nowMs) {
    this.reset();
    this.state = 'running';
    const now = nowMs ?? performance.now();
    this.startTime = now;
    this.lastSpawnAt = now;
    this._loop(now);
  }

  stop(endedBy = 'manual') {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.stopLoop();
    if (this.logger && this.logger.finish) {
      this.logger.finish({
        endedBy,
        score: this.score,
        combo: this.combo,
        maxCombo: this.maxCombo,
        missCount: this.missCount,
        elapsedMs: this.elapsed
      });
    }
    if (this.hooks.onEnd) {
      this.hooks.onEnd(this._snapshot());
    }
  }

  stopLoop() {
    if (this._raf != null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  _loop(now) {
    if (this.state !== 'running') return;

    this.elapsed = now - this.startTime;
    const c = this.config;

    // End by time
    if (this.elapsed >= c.durationMs) {
      this._emitUpdate();
      this.stop('timeout');
      return;
    }

    // Spawn target ถ้าเกิน interval และจำนวนในจอไม่เกิน maxConcurrent
    if (now - this.lastSpawnAt >= c.spawnIntervalMs) {
      if (this.targets.size < c.maxConcurrent) {
        this._spawnOne(now);
        this.lastSpawnAt = now;
      } else {
        // แม้เต็ม ก็เลื่อนไปหนึ่ง step เพื่อไม่ให้ loop ค้าง spawn
        this.lastSpawnAt = now;
      }
    }

    // ตรวจหมดอายุ (expire)
    this._checkExpiry(now);

    this._emitUpdate();

    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  _spawnOne(now) {
    const c = this.config;
    const id = this.nextId++;
    const isDecoy = Math.random() < c.decoyChance;

    // Random pos (5–95%) กันขอบ
    const x = 5 + Math.random() * 90;
    const y = 10 + Math.random() * 80;

    const target = {
      id,
      type: isDecoy ? 'decoy' : 'normal',
      createdAt: now,
      expiresAt: now + c.targetLifetimeMs,
      x,
      y
    };
    this.targets.set(id, target);

    if (this.renderer && this.renderer.spawn) {
      this.renderer.spawn(target);
    }
    if (this.logger && this.logger.logSpawn) {
      this.logger.logSpawn({
        id,
        type: target.type,
        x,
        y,
        t: now
      });
    }
  }

  _checkExpiry(now) {
    const c = this.config;
    for (const [id, t] of [...this.targets.entries()]) {
      if (now >= t.expiresAt) {
        // ถ้าเป็น normal แล้วไม่ได้ชก → นับ miss
        if (t.type === 'normal') {
          this.missCount++;
          this.combo = 0;
        }
        this.targets.delete(id);

        if (this.renderer && this.renderer.expire) {
          this.renderer.expire(id, { type: t.type, now });
        }
        if (this.logger && this.logger.logExpire) {
          this.logger.logExpire({ id, type: t.type, t: now });
        }
      }
    }
  }

  /**
   * เรียกเมื่อผู้เล่นชก/แตะเป้า (จาก Renderer/DOM input)
   */
  hitTarget(id, hitMeta = {}) {
    if (this.state !== 'running') return;
    const now = performance.now();
    const t = this.targets.get(id);
    if (!t) return; // เป้าหายไปแล้ว

    const hitType = t.type;
    this.targets.delete(id);

    let result = 'hit-normal';
    if (hitType === 'normal') {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.score += this.config.scorePerHit ?? 10;
    } else {
      // decoy
      this.combo = 0;
      this.score -= this.config.penaltyDecoy ?? 5;
      if (this.score < 0) this.score = 0;
      result = 'hit-decoy';
    }

    if (this.renderer && this.renderer.hit) {
      this.renderer.hit(id, { type: hitType, result, now });
    }
    if (this.logger && this.logger.logHit) {
      this.logger.logHit({
        id,
        type: hitType,
        result,
        score: this.score,
        combo: this.combo,
        t: now,
        extra: hitMeta
      });
    }

    this._emitUpdate();
  }

  _emitUpdate() {
    if (!this.hooks.onUpdate) return;
    this.hooks.onUpdate(this._snapshot());
  }

  _snapshot() {
    return {
      state: this.state,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      missCount: this.missCount,
      elapsedMs: this.elapsed,
      remainingMs: Math.max(0, this.config.durationMs - this.elapsed),
      activeTargets: this.targets.size
    };
  }
}
