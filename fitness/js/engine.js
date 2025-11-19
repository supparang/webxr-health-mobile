// === fitness/js/engine.js (2025-11-19 — mobile hit + FEVER + popup) ===
'use strict';

const DEFAULTS = {
  durationMs: 60000,
  spawnInterval: 750,
  targetLifeMs: 900,

  scoreHit: 10,
  scoreMissPenalty: 0,

  // ปรับให้กว้างขึ้น ตีง่ายขึ้นบนมือถือ
  hitRadius: 90,

  hpMax: 100,
  hpMissPenalty: 4,

  bossCount: 4,
  bossHPPerBoss: 100,
  bossDamagePerHit: 3,

  decoyChance: 0.18,

  // FEVER: เพิ่ม gain ต่อ hit ให้เห็นผลง่ายขึ้น
  feverGainPerHit: 16,
  feverDecayPerSec: 10,
  feverThreshold: 100,
  feverDurationMs: 5000
};

export class GameEngine {
  constructor({ config = {}, hooks = {}, renderer, logger, mode = 'normal' }) {
    this.cfg      = { ...DEFAULTS, ...config };
    this.hooks    = hooks;
    this.renderer = renderer;
    this.logger   = logger || {};
    this.mode     = mode;

    if (this.renderer && typeof this.renderer.setEngine === 'function') {
      this.renderer.setEngine(this);
    }

    this.targets = [];
    this.running = false;
    this.hitRadius = this.cfg.hitRadius;

    this._stats = {
      spawns: 0,
      hitsNormal: 0,
      hitsDecoy: 0,
      misses: 0,
      sumRTNormal: 0,
      cntRTNormal: 0,
      sumRTDecoy: 0,
      cntRTDecoy: 0
    };

    this.state       = null;
    this.startAt     = 0;
    this.nextSpawnAt = 0;
  }

  /* ---------- reset / start / stop ---------- */

  _resetState() {
    this.state = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      missCount: 0,
      perfectHits: 0,

      playerHP: this.cfg.hpMax,

      remainingMs: this.cfg.durationMs,

      feverCharge: 0,
      feverActive: false,
      feverUntil: 0,

      bossIndex: 0,
      bossCount: this.cfg.bossCount,
      bossHP: this.cfg.bossHPPerBoss,
      bossMaxHP: this.cfg.bossHPPerBoss,
      bossName: '',
      bossEmoji: '',

      endedBy: null,
      elapsedMs: 0,

      analytics: null
    };

    this.targets = [];

    this._stats.spawns      = 0;
    this._stats.hitsNormal  = 0;
    this._stats.hitsDecoy   = 0;
    this._stats.misses      = 0;
    this._stats.sumRTNormal = 0;
    this._stats.cntRTNormal = 0;
    this._stats.sumRTDecoy  = 0;
    this._stats.cntRTDecoy  = 0;
  }

  start() {
    this._resetState();
    this.running     = true;
    this.startAt     = performance.now();
    this.nextSpawnAt = this.startAt + 400;

    if (this.renderer && typeof this.renderer.clear === 'function') {
      this.renderer.clear();
    }

    this._loop();
  }

  stop(reason = 'manual') {
    if (!this.running) return;
    this.running = false;

    const now = performance.now();
    this.state.elapsedMs = now - this.startAt;
    this.state.endedBy   = reason;

    this._finalizeAnalytics();

    try { this.hooks.onEnd?.(this.state); } catch (e) {
      console.warn('onEnd error', e);
    }
    try { this.logger.finish?.(this.state); } catch (e) {
      console.warn('logger.finish error', e);
    }
  }

  /* ---------- Touch / hit ---------- */

  registerTouch(x, y) {
    if (!this.running || !this.targets.length) return;

    let best = null;
    let bestDist = Infinity;

    for (const t of this.targets) {
      if (t.hit || t.expired || !t.dom) continue;
      const rect = t.dom.getBoundingClientRect();
      const cx = rect.left + rect.width  / 2;
      const cy = rect.top  + rect.height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= this.hitRadius && dist < bestDist) {
        best = t;
        bestDist = dist;
      }
    }

    if (!best) return;
    this._hitTarget(best);
  }

  _hitTarget(t) {
    if (t.hit || t.expired) return;

    const now = performance.now();
    t.hit   = true;
    t.hitAt = now;

    const isDecoy = !!t.decoy;
    const rt = t.spawnAt ? (now - t.spawnAt) : 0;

    if (isDecoy) {
      this._stats.hitsDecoy++;
      if (rt > 0) {
        this._stats.sumRTDecoy += rt;
        this._stats.cntRTDecoy++;
      }

      this.state.combo = 0;
      this.state.missCount++;
      this.state.playerHP = Math.max(0, this.state.playerHP - this.cfg.hpMissPenalty);
    } else {
      this._stats.hitsNormal++;
      if (rt > 0) {
        this._stats.sumRTNormal += rt;
        this._stats.cntRTNormal++;
      }

      const base      = this.cfg.scoreHit;
      const feverMult = this.state.feverActive ? 2 : 1;
      const gain      = base * feverMult;

      this.state.score += gain;
      this.state.combo++;
      if (this.state.combo > this.state.maxCombo) {
        this.state.maxCombo = this.state.combo;
      }

      this.state.feverCharge = Math.min(
        100,
        this.state.feverCharge + this.cfg.feverGainPerHit
      );

      this.state.bossHP = Math.max(0, this.state.bossHP - this.cfg.bossDamagePerHit);

      if (this.state.bossHP <= 0) {
        if (this.state.bossIndex + 1 >= this.state.bossCount) {
          this._emitHitEffect(t, gain);
          this._updateHUDImmediate();
          this.stop('boss-cleared');
          return;
        } else {
          this.state.bossIndex++;
          this.state.bossHP    = this.cfg.bossHPPerBoss;
          this.state.bossMaxHP = this.cfg.bossHPPerBoss;
        }
      }

      if (!this.state.feverActive && this.state.feverCharge >= this.cfg.feverThreshold) {
        this.state.feverActive = true;
        this.state.feverUntil  = now + this.cfg.feverDurationMs;
      }

      this._emitHitEffect(t, gain);
    }

    if (t.dom) {
      // ❗ ให้ตรงกับ CSS: .target-hit
      t.dom.classList.add('target-hit');
      setTimeout(() => {
        this.renderer?.removeTarget?.(t);
      }, 120);
    }

    try {
      this.logger.logHit?.({
        id: t.id,
        event: 'hit',
        type: isDecoy ? 'decoy' : 'normal',
        result: isDecoy ? 'decoy' : 'hit',
        score: this.state.score,
        combo: this.state.combo,
        missCount: this.state.missCount,
        playerHP: this.state.playerHP,
        reactionMs: rt
      });
    } catch (e) {
      console.warn('logger.logHit error', e);
    }

    this._updateHUDImmediate();
  }

  _emitHitEffect(t, gain) {
    if (!this.renderer || typeof this.renderer.spawnHitEffect !== 'function') return;
    this.renderer.spawnHitEffect(t, {
      score: gain,
      fever: this.state.feverActive
    });
  }

  _updateHUDImmediate() {
    try {
      this.hooks.onUpdate?.(this.state);
    } catch (e) {
      console.warn('onUpdate error', e);
    }
  }

  /* ---------- loop / spawn ---------- */

  _loop() {
    if (!this.running) return;

    const now = performance.now();
    const elapsed   = now - this.startAt;
    const remaining = Math.max(0, this.cfg.durationMs - elapsed);
    this.state.remainingMs = remaining;

    const dtSec = 16 / 1000;
    if (this.state.feverActive) {
      if (now >= this.state.feverUntil) {
        this.state.feverActive = false;
      }
    } else if (this.state.feverCharge > 0) {
      this.state.feverCharge = Math.max(
        0,
        this.state.feverCharge - this.cfg.feverDecayPerSec * dtSec
      );
    }

    if (remaining <= 0) {
      this.stop('timeout');
      return;
    }

    if (now >= this.nextSpawnAt) {
      this._spawnTarget(now);
      this.nextSpawnAt = now + this.cfg.spawnInterval;
    }

    const life = this.cfg.targetLifeMs;
    for (const t of this.targets) {
      if (t.hit || t.expired) continue;
      if (now - t.spawnAt >= life) {
        t.expired = true;
        this.state.missCount++;
        this.state.combo = 0;
        this._stats.misses++;

        if (!t.decoy) {
          this.state.playerHP = Math.max(0, this.state.playerHP - this.cfg.hpMissPenalty);
          if (this.state.playerHP <= 0) {
            this._updateHUDImmediate();
            this.stop('player-dead');
            return;
          }
        }

        if (t.dom) {
          t.dom.classList.add('miss');
          setTimeout(() => {
            this.renderer?.removeTarget?.(t);
          }, 80);
        }

        try {
          this.logger.logExpire?.({
            id: t.id,
            type: t.decoy ? 'decoy' : 'normal',
            result: 'timeout',
            playerHP: this.state.playerHP,
            missCount: this.state.missCount
          });
        } catch (e) {
          console.warn('logger.logExpire error', e);
        }
      }
    }

    this._updateHUDImmediate();
    requestAnimationFrame(() => this._loop());
  }

  _spawnTarget(now) {
    const isDecoy = Math.random() < this.cfg.decoyChance;
    const t = {
      id: 't' + Math.random().toString(36).slice(2),
      x: Math.random(),
      y: Math.random(),
      emoji: isDecoy ? this.cfg.emojiDecoy || '💣' : this.cfg.emojiMain || '⭐',
      decoy: isDecoy,
      spawnAt: now,
      hit: false,
      expired: false,
      dom: null
    };

    this.targets.push(t);
    this._stats.spawns++;

    try {
      this.renderer?.spawnTarget?.(t);
      this.logger.logSpawn?.({
        id: t.id,
        type: isDecoy ? 'decoy' : 'normal'
      });
    } catch (e) {
      console.warn('spawn error', e);
    }
  }

  /* ---------- analytics ---------- */

  _finalizeAnalytics() {
    const totalSpawns = this._stats.spawns;
    const totalHits   = this._stats.hitsNormal + this._stats.hitsDecoy;
    const accuracy    = totalSpawns > 0 ? totalHits / totalSpawns : 0;

    const avgNormal = this._stats.cntRTNormal
      ? this._stats.sumRTNormal / this._stats.cntRTNormal
      : 0;
    const avgDecoy = this._stats.cntRTDecoy
      ? this._stats.sumRTDecoy / this._stats.cntRTDecoy
      : 0;

    this.state.analytics = {
      totalSpawns,
      totalHits,
      normalHits: this._stats.hitsNormal,
      decoyHits:  this._stats.hitsDecoy,
      expiredMisses: this._stats.misses,
      accuracy,
      avgReactionNormal: avgNormal,
      avgReactionDecoy:  avgDecoy
    };
  }
}