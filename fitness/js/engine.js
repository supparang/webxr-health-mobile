// js/engine.js
'use strict';

/**
 * GameEngine สำหรับ Shadow Breaker
 * - เป้า DOM (normal / decoy)
 * - FEVER gauge
 * - Boss 4 ตัว (ทีละตัว, HP ตาม config.bosses)
 * - HP ผู้เล่น (normal: HP หมด = จบ, research: เล่นต่อครบเวลา)
 * - Analytics: reaction time, accuracy, hit stats
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

    // score & combo
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
      { name: 'Boss 1', emoji: '👾', hp: 20 },
      { name: 'Boss 2', emoji: '👹', hp: 30 },
      { name: 'Boss 3', emoji: '🐉', hp: 40 },
      { name: 'Boss 4', emoji: '🤖', hp: 50 }
    ];
    this.bossIndex = 0;
    this.bossHP    = this.bosses[0].hp;
    this.bossMaxHP = this.bossHP;

    // PLAYER HP
    this.playerMaxHP = 100;
    this.playerHP    = this.playerMaxHP;

    // time
    this.startTime   = 0;
    this.elapsed     = 0;
    this.lastSpawnAt = 0;
    this._raf        = null;

    // Analytics counters
    this.totalSpawns        = 0;
    this.totalHits          = 0;
    this.normalHits         = 0;
    this.decoyHits          = 0;
    this.expiredMisses      = 0;
    this.sumReactionNormal  = 0;
    this.sumReactionDecoy   = 0;
  }

  // ---------- internal helpers ----------

  _resetBoss() {
    this.bossIndex = 0;
    this.bossHP    = this.bosses[0].hp;
    this.bossMaxHP = this.bossHP;
  }

  _resetPlayerHP() {
    this.playerMaxHP = 100;
    this.playerHP    = this.playerMaxHP;
  }

  _resetAnalytics() {
    this.totalSpawns        = 0;
    this.totalHits          = 0;
    this.normalHits         = 0;
    this.decoyHits          = 0;
    this.expiredMisses      = 0;
    this.sumReactionNormal  = 0;
    this.sumReactionDecoy   = 0;
  }

  /**
   * แบ่ง phase ของบอสไว้ใช้ปรับ pattern:
   * - entry  : ช่วงต้น
   * - rage   : HP <= 40%
   * - finish : HP <= 20%
   */
  _getBossPhase() {
    if (this.bossIndex >= this.bosses.length) return 'cleared';
    const ratio = this.bossMaxHP > 0 ? (this.bossHP / this.bossMaxHP) : 0;
    if (ratio <= 0.2) return 'finish';
    if (ratio <= 0.4) return 'rage';
    return 'entry';
  }

  // ---------- lifecycle ----------

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
    this._resetAnalytics();

    this.elapsed     = 0;
    this.lastSpawnAt = 0;

    if (this.renderer && typeof this.renderer.reset === 'function') {
      this.renderer.reset();
    }
    this._emitUpdate();
  }

  start(nowMs) {
    this.reset();
    this.state = 'running';
    const now = nowMs != null ? nowMs : performance.now();
    this.startTime   = now;
    this.lastSpawnAt = now;
    this._loop(now);
  }

  stop(endedBy = 'manual') {
    if (this.state === 'ended') return;

    this.state = 'ended';
    this.stopLoop();

    const totalSpawns = this.totalSpawns;
    const totalHits   = this.totalHits;
    const accuracy    = totalSpawns ? totalHits / totalSpawns : 0;
    const avgReactionNormal = this.normalHits
      ? (this.sumReactionNormal / this.normalHits)
      : 0;
    const avgReactionDecoy  = this.decoyHits
      ? (this.sumReactionDecoy / this.decoyHits)
      : 0;

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
      playerHP: this.playerHP,
      analytics: {
        totalSpawns,
        totalHits,
        normalHits: this.normalHits,
        decoyHits: this.decoyHits,
        expiredMisses: this.expiredMisses,
        accuracy,
        avgReactionNormal,
        avgReactionDecoy
      }
    };

    if (this.logger && typeof this.logger.finish === 'function') {
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

    // Rage / Finish phase ทำให้ spawn เร็วขึ้นอีก
    const phase = this._getBossPhase();
    let phaseFactor = 1;
    if (phase === 'rage')   phaseFactor = 0.9;
    if (phase === 'finish') phaseFactor = 0.8;

    return base * clamped * phaseFactor;
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

    // spawn เป้า
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
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  _spawnOne(now) {
    const c = this.config;
    const phase = this._getBossPhase();

    let decoyChance = c.decoyChance;
    if (phase === 'rage')   decoyChance += 0.05;
    if (phase === 'finish') decoyChance += 0.10;
    if (decoyChance < 0) decoyChance = 0;
    if (decoyChance > 0.8) decoyChance = 0.8;

    const id = this.nextId++;
    const isDecoy = Math.random() < decoyChance;

    const minDist = c.minDistancePct || 16;
    let x, y;
    let ok = false;

    // พยายามวางให้ห่างเป้าอื่น
    for (let i = 0; i < 12; i++) {
      const candX = 5 + Math.random() * 90;
      const candY = 10 + Math.random() * 80;
      let tooClose = false;

      for (const t of this.targets.values()) {
        const dx = candX - t.x;
        const dy = candY - t.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
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
    this.totalSpawns++;

    if (this.renderer && typeof this.renderer.spawn === 'function') {
      this.renderer.spawn(target);
    }
    if (this.logger && typeof this.logger.logSpawn === 'function') {
      this.logger.logSpawn({
        id,
        type: target.type,
        x,
        y,
        t: now,
        bossIndex: this.bossIndex,
        bossHP: this.bossHP,
        bossPhase: this._getBossPhase()
      });
    }
  }

  _checkExpiry(now) {
    const toDelete = [];

    for (const [id, t] of this.targets.entries()) {
      if (now >= t.expiresAt) {
        if (t.type === 'normal') {
          this.missCount++;
          this.expiredMisses++;
          this.combo = 0;
          this._onBadTiming('expire');
        }
        toDelete.push(id);

        if (this.renderer && typeof this.renderer.expire === 'function') {
          this.renderer.expire(id, { type: t.type, now });
        }
        if (this.logger && typeof this.logger.logExpire === 'function') {
          this.logger.logExpire({
            id,
            type: t.type,
            t: now,
            playerHP: this.playerHP,
            bossIndex: this.bossIndex,
            bossHP: this.bossHP,
            bossPhase: this._getBossPhase()
          });
        }
      }
    }

    for (const id of toDelete) {
      this.targets.delete(id);
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
    this.perfectHits++;
    this._applyHpDelta(+3, 'perfect');
    this.feverCharge = Math.min(100, this.feverCharge + 16);
  }

  _onGoodHit() {
    this._applyHpDelta(+1, 'good');
    this.feverCharge = Math.min(100, this.feverCharge + 8);
  }

  _onBadTiming(reason) {
    this.badHits++;

    let hpDelta = 0;
    if (reason === 'decoy') {
      hpDelta = -5;
    } else {
      // miss / expire
      hpDelta = -2;
    }

    // ช่วง FEVER โทษ HP เบาลง
    if (this.feverActive) {
      hpDelta = Math.round(hpDelta * 0.5);
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

  // ---------- public action: hit target ----------

  hitTarget(id, hitMeta) {
    if (this.state !== 'running') return;

    const now = performance.now();
    const t = this.targets.get(id);
    if (!t) return;

    const hitType = t.type;
    this.targets.delete(id);

    const life  = this.config.targetLifetimeMs || 1;
    const age   = now - t.createdAt;
    const ratio = age / life;
    const reactionMs = age;

    let quality = 'good';
    if (hitType === 'normal') {
      quality = ratio <= 0.35 ? 'perfect' : 'good';
    } else {
      quality = 'bad';
    }

    let result = 'hit-normal';
    let deltaScore = 0;
    let damage = 0;

    this.totalHits++;
    const phase = this._getBossPhase();

    if (hitType === 'normal') {
      this.normalHits++;
      this.sumReactionNormal += reactionMs;

      if (quality === 'perfect') {
        this._onPerfect();
      } else {
        this._onGoodHit();
      }
      this._maybeEnterFever(now);

      let base = this.config.scorePerHit != null ? this.config.scorePerHit : 10;
      damage = 1;
      if (this.feverActive) {
        base  *= 2;
        damage = 2;
      }

      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.score += base;
      deltaScore = base;
      this._hitBoss(damage);
    } else {
      // decoy
      this.decoyHits++;
      this.sumReactionDecoy += reactionMs;

      this.combo = 0;
      const penalty = this.config.penaltyDecoy != null ? this.config.penaltyDecoy : 5;
      this.score -= penalty;
      if (this.score < 0) this.score = 0;
      deltaScore = -penalty;
      result = 'hit-decoy';
      this._onBadTiming('decoy');
    }

    if (this.renderer && typeof this.renderer.hit === 'function') {
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

    if (this.logger && typeof this.logger.logHit === 'function') {
      this.logger.logHit({
        id,
        type: hitType,
        result,
        score: this.score,
        combo: this.combo,
        missCount: this.missCount,
        playerHP: this.playerHP,
        t: now,
        reactionMs,
        bossIndex: this.bossIndex,
        bossHP: this.bossHP,
        bossPhase: phase,
        feverActive: this.feverActive,
        extra: {
          quality,
          from: (hitMeta && hitMeta.source) || 'dom'
        }
      });
    }

    this._emitUpdate();
  }

  // ---------- snapshot / HUD ----------

  _emitUpdate() {
    if (!this.hooks.onUpdate) return;
    this.hooks.onUpdate(this._snapshot());
  }

  _snapshot() {
    const currentBoss = this.bosses[this.bossIndex] || null;

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
      bossName:  currentBoss ? currentBoss.name  : '',
      bossEmoji: currentBoss ? currentBoss.emoji : '',
      bossPhase: this._getBossPhase(),

      playerHP: this.playerHP,
      playerMaxHP: this.playerMaxHP
    };
  }
}
