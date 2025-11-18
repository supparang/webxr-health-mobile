// js/engine.js
'use strict';

/**
 * GameEngine:
 * - emoji เป้า (normal / decoy)
 * - FEVER gauge
 * - Boss 4 ตัว (ทีละตัว มี HP)
 * - HP ผู้เล่น (ขึ้นลงตาม perfect/good/miss/decoy)
 * - โหมด research: HP หมดก็ยังเล่นจนครบเวลา (ไม่ game over)
 *   โหมด normal: HP หมด = จบเกมด้วยเหตุผล 'player-dead'
 */

export class GameEngine {
  constructor(options) {
    this.config   = options.config;
    this.hooks    = options.hooks || {};
    this.renderer = options.renderer;
    this.logger   = options.logger;
    this.mode     = options.mode || 'normal'; // 'normal' | 'research'

    this.state   = 'idle';
    this.targets = new Map();
    this.nextId  = 1;

    // score
    this.score     = 0;
    this.combo     = 0;
    this.maxCombo  = 0;
    this.missCount = 0;

    // perfect / bad
    this.perfectHits = 0;
    this.badHits     = 0;

    // FEVER
    this.feverCharge = 0;   // 0–100
    this.feverActive = false;
    this.feverEndAt  = 0;

    // BOSS
    this.bosses   = (this.config.bosses && this.config.bosses.slice()) || [
      { name: 'Boss 1', hp: 30 },
      { name: 'Boss 2', hp: 40 },
      { name: 'Boss 3', hp: 50 },
      { name: 'Boss 4', hp: 60 }
    ];
    this.bossIndex = 0;
    this.bossHP    = this.bosses[0].hp;
    this.bossMaxHP = this.bossHP;

    // PLAYER HP
    this.playerMaxHP = 100;
    this.playerHP    = this.playerMaxHP;

    this.startTime   = 0;
    this.elapsed     = 0;
    this.lastSpawnAt = 0;
    this._raf        = null;
  }

  _resetBoss() {
    this.bossIndex = 0;
    this.bossHP    = this.bosses[0].hp;
    this.bossMaxHP = this.bossHP;
  }

  _resetPlayerHP() {
    this.playerMaxHP = 100;
    this.playerHP    = this.playerMaxHP;
  }

  reset() {
    this.stopLoop();
    this.state   = 'idle';
    this.targets.clear();

    this.score     = 0;
    this.combo     = 0;
    this.maxCombo  = 0;
    this.missCount = 0;
    this.perfectHits = 0;
    this.badHits     = 0;

    this.feverCharge = 0;
    this.feverActive = false;
    this.feverEndAt  = 0;

    this._resetBoss();
    this._resetPlayerHP();

    this.elapsed   = 0;
    this.lastSpawnAt = 0;

    if (this.renderer && this.renderer.reset) this.renderer.reset();
    this._emitUpdate();
  }

  start(nowMs) {
    this.reset();
    this.state = 'running';
    const now = nowMs ?? performance.now();
    this.startTime   = now;
    this.lastSpawnAt = now;
    this._loop(now);
  }

  stop(endedBy = 'manual') {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.stopLoop();

    const finalState = {
      endedBy,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      missCount: this.missCount,
      elapsedMs: this.elapsed,
      perfectHits: this.perfectHits,
      badHits: this.badHits,
      bossIndex: this.bossIndex,
      playerHP: this.playerHP
    };

    if (this.logger && this.logger.finish) {
      this.logger.finish(finalState);
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

  _currentInterval() {
    const c = this.config;
    const base  = c.spawnIntervalMs;
    const accel = c.speedupFactor || 0;
    const progress = Math.min(1, this.elapsed / c.durationMs);

    const factor  = 1 - accel * progress;
    const clamped = Math.max(0.35, factor);
    return base * clamped;
  }

  _loop(now) {
    if (this.state !== 'running') return;

    this.elapsed = now - this.startTime;
    const c = this.config;

    // ชนะบอสครบแล้ว
    if (this.bossIndex >= this.bosses.length) {
      this._emitUpdate();
      this.stop('boss-cleared');
      return;
    }

    // หมดเวลา
    if (this.elapsed >= c.durationMs) {
      this._emitUpdate();
      this.stop('timeout');
      return;
    }

    // FEVER หมดเวลา
    if (this.feverActive && now >= this.feverEndAt) {
      this.feverActive = false;
      this.feverCharge = Math.min(this.feverCharge, 40);
    }

    const intervalNow = this._currentInterval();

    if (now - this.lastSpawnAt >= intervalNow) {
      if (this.targets.size < c.maxConcurrent) {
        this._spawnOne(now);
        this.lastSpawnAt = now;
      } else {
        this.lastSpawnAt = now;
      }
    }

    this._checkExpiry(now);
    this._emitUpdate();
    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  _spawnOne(now) {
    const c = this.config;
    const id = this.nextId++;
    const isDecoy = Math.random() < c.decoyChance;

    const minDist = c.minDistancePct || 16;
    let x, y;
    let ok = false;

    for (let i = 0; i < 12; i++) {
      const candX = 5 + Math.random() * 90;
      const candY = 10 + Math.random() * 80;
      let tooClose = false;

      for (const t of this.targets.values()) {
        const dx = candX - t.x;
        const dy = candY - t.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < minDist) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        x = candX;
        y = candY;
        ok = true;
        break;
      }
    }

    if (!ok) {
      x = 5 + Math.random() * 90;
      y = 10 + Math.random() * 80;
    }

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
    for (const [id, t] of [...this.targets.entries()]) {
      if (now >= t.expiresAt) {
        if (t.type === 'normal') {
          this.missCount++;
          this.combo = 0;
          this._onBadTiming('expire');
        }
        this.targets.delete(id);

        if (this.renderer && this.renderer.expire) {
          this.renderer.expire(id, { type: t.type, now });
        }
        if (this.logger && this.logger.logExpire) {
          this.logger.logExpire({
            id,
            type: t.type,
            t: now,
            playerHP: this.playerHP
          });
        }
      }
    }
  }

  _applyHpDelta(delta, reason) {
    this.playerHP += delta;
    if (this.playerHP > this.playerMaxHP) this.playerHP = this.playerMaxHP;
    if (this.playerHP < 0) this.playerHP = 0;

    // โหมด normal: HP หมด = จบเกม
    if (this.mode !== 'research' && this.playerHP <= 0 && this.state === 'running') {
      this.stop('player-dead');
    }
  }

  _onPerfect() {
    // perfect = heal เยอะ + fever ขึ้นเยอะ
    this.perfectHits++;
    this._applyHpDelta(+3, 'perfect');
    this.feverCharge = Math.min(100, this.feverCharge + 16);
  }

  _onGoodHit() {
    // good = heal นิดหน่อย + fever ขึ้นน้อยกว่าหน่อย
    this._applyHpDelta(+1, 'good');
    this.feverCharge = Math.min(100, this.feverCharge + 8);
  }

  _onBadTiming(reason) {
    this.badHits++;

    // โทษพื้นฐาน
    let hpDelta = 0;
    if (reason === 'decoy') {
      hpDelta = -5;
    } else {
      // miss / expire
      hpDelta = -2;
    }

    // ช่วง FEVER โทษ HP เบาลง
    if (this.feverActive) {
      hpDelta = Math.round(hpDelta * 0.5); // -2 → -1, -5 → -3
    }

    this._applyHpDelta(hpDelta, reason);

    // FEVER gauge ลง
    this.feverCharge = Math.max(0, this.feverCharge - 20);
    if (reason === 'decoy') {
      this.feverCharge = Math.max(0, this.feverCharge - 10);
    }
    if (this.feverCharge < 30) {
      this.feverActive = false;
    }
  }

  _maybeEnterFever(now) {
    if (!this.feverActive && this.feverCharge >= 100) {
      this.feverActive = true;
      this.feverEndAt  = now + 6000; // 6 วินาที
    }
  }

  _hitBoss(damage) {
    if (this.bossIndex >= this.bosses.length) return;

    this.bossHP -= damage;
    if (this.bossHP < 0) this.bossHP = 0;

    if (this.bossHP <= 0) {
      this.bossIndex++;
      if (this.bossIndex < this.bosses.length) {
        this.bossHP    = this.bosses[this.bossIndex].hp;
        this.bossMaxHP = this.bossHP;
      } else {
        this.stop('boss-cleared');
      }
    }
  }

  hitTarget(id, hitMeta = {}) {
    if (this.state !== 'running') return;
    const now = performance.now();
    const t = this.targets.get(id);
    if (!t) return;

    const hitType = t.type;
    this.targets.delete(id);

    const life  = this.config.targetLifetimeMs || 1;
    const age   = now - t.createdAt;
    const ratio = age / life;

    let quality = 'good';
    if (hitType === 'normal') {
      quality = ratio <= 0.35 ? 'perfect' : 'good';
    } else {
      quality = 'bad';
    }

    let result = 'hit-normal';
    let deltaScore = 0;
    let damage = 0;

    if (hitType === 'normal') {
      if (quality === 'perfect') {
        this._onPerfect();
      } else {
        this._onGoodHit();
      }
      this._maybeEnterFever(now);

      let base = this.config.scorePerHit ?? 10;
      damage = 1;
      if (this.feverActive) {
        base *= 2;
        damage = 2;
      }
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.score += base;
      deltaScore = base;
      this._hitBoss(damage);
    } else {
      // decoy: หักคะแนน+HP+fever
      this.combo = 0;
      const penalty = this.config.penaltyDecoy ?? 5;
      this.score -= penalty;
      if (this.score < 0) this.score = 0;
      deltaScore = -penalty;
      result = 'hit-decoy';
      this._onBadTiming('decoy');
    }

    if (this.renderer && this.renderer.hit) {
      this.renderer.hit(id, {
        type: hitType,
        result,
        now,
        quality,
        fever: this.feverActive,
        deltaScore,
        deltaHP: damage
      });
    }
    if (this.logger && this.logger.logHit) {
      this.logger.logHit({
        id,
        type: hitType,
        result,
        score: this.score,
        combo: this.combo,
        missCount: this.missCount,
        playerHP: this.playerHP,
        t: now,
        extra: {
          quality,
          fever: this.feverActive,
          deltaScore,
          bossIndex: this.bossIndex
        }
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
      activeTargets: this.targets.size,
      perfectHits: this.perfectHits,
      badHits: this.badHits,
      feverCharge: this.feverCharge,
      feverActive: this.feverActive,
      bossIndex: this.bossIndex,
      bossHP: this.bossHP,
      bossMaxHP: this.bossMaxHP,
      bossCount: this.bosses.length,
      playerHP: this.playerHP,
      playerMaxHP: this.playerMaxHP
    };
  }
}
