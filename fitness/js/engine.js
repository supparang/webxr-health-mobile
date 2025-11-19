// === fitness/js/engine.js (2025-11-19 — mobile-accurate hit + full state) ===
'use strict';

const DEFAULTS = {
  durationMs: 60000,       // เวลาเล่นต่อรอบ
  spawnInterval: 750,      // ช่วงเวลาการเกิดเป้า
  targetLifeMs: 900,       // เป้าอยู่ได้นานแค่ไหนก่อนนับ miss
  scoreHit: 10,
  scoreMissPenalty: 0,
  hitRadius: 80,           // รัศมีแตะรอบ ๆ เป้า
  hpMax: 100,
  hpMissPenalty: 4,        // พลาด 1 ครั้ง HP ลดเท่าไร
  bossCount: 4,
  bossHPPerBoss: 100,
  bossDamagePerHit: 3,     // ชกโดน 1 ครั้ง หัก HP บอสเท่าไร
  decoyChance: 0.18,       // โอกาสเจอเป้าหลอก
  feverGainPerHit: 10,
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

    // ตัวเก็บสถิติสำหรับ analytics / CSV
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

    this.state = null;
    this.startAt = 0;
    this.nextSpawnAt = 0;
  }

  /* ---------- Lifecycle ---------- */

  _resetState() {
    this.state = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      missCount: 0,
      perfectHits: 0,        // เผื่อไว้ ถ้าอยากใช้ภายหลัง
      playerHP: this.cfg.hpMax,

      remainingMs: this.cfg.durationMs,

      // FEVER
      feverCharge: 0,
      feverActive: false,
      feverUntil: 0,

      // Boss
      bossIndex: 0,
      bossCount: this.cfg.bossCount,
      bossHP: this.cfg.bossHPPerBoss,
      bossMaxHP: this.cfg.bossHPPerBoss,
      bossName: '',
      bossEmoji: '',

      // ผลจบเกม
      endedBy: null,
      elapsedMs: 0,

      analytics: null
    };

    // รีเซ็ต stat สำหรับ analytics
    this._stats.spawns      = 0;
    this._stats.hitsNormal  = 0;
    this._stats.hitsDecoy   = 0;
    this._stats.misses      = 0;
    this._stats.sumRTNormal = 0;
    this._stats.cntRTNormal = 0;
    this._stats.sumRTDecoy  = 0;
    this._stats.cntRTDecoy  = 0;

    this.targets = [];
  }

  start() {
    this._resetState();
    this.running    = true;
    this.startAt    = performance.now();
    this.nextSpawnAt = this.startAt + 400; // ดีเลย์เล็กน้อยก่อนเป้าแรก

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

    try { this.hooks.onEnd && this.hooks.onEnd(this.state); } catch (e) {
      console.warn('onEnd hook error', e);
    }
    try { this.logger.finish && this.logger.finish(this.state); } catch (e) {
      console.warn('logger.finish error', e);
    }
  }

  /* ---------- Touch / Hit detection ---------- */

  registerTouch(x, y) {
    if (!this.running) return;
    if (!this.targets.length) return;

    // เลือกเป้าที่ใกล้ที่สุดภายในรัศมี
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
    if (!best) return; // แตะไม่โดนเป้าใดเลย

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
      // โดน decoy: combo รีเซ็ต + HP ลดนิดหน่อย
      this.state.combo = 0;
      this.state.missCount++;
      this.state.playerHP = Math.max(0, this.state.playerHP - this.cfg.hpMissPenalty);
    } else {
      this._stats.hitsNormal++;
      if (rt > 0) {
        this._stats.sumRTNormal += rt;
        this._stats.cntRTNormal++;
      }

      const feverMult = this.state.feverActive ? 2 : 1;
      this.state.score += this.cfg.scoreHit * feverMult;
      this.state.combo++;
      if (this.state.combo > this.state.maxCombo) {
        this.state.maxCombo = this.state.combo;
      }

      // เติม FEVER
      this.state.feverCharge = Math.min(
        100,
        this.state.feverCharge + this.cfg.feverGainPerHit
      );

      // หัก HP บอส
      this.state.bossHP = Math.max(0, this.state.bossHP - this.cfg.bossDamagePerHit);

      if (this.state.bossHP <= 0) {
        // บอสตัวนี้ตายแล้ว
        if (this.state.bossIndex + 1 >= this.state.bossCount) {
          this.stop('boss-cleared');
        } else {
          this.state.bossIndex++;
          this.state.bossHP    = this.cfg.bossHPPerBoss;
          this.state.bossMaxHP = this.cfg.bossHPPerBoss;
        }
      }

      // FEVER trigger
      if (!this.state.feverActive && this.state.feverCharge >= this.cfg.feverThreshold) {
        this.state.feverActive = true;
        this.state.feverUntil  = now + this.cfg.feverDurationMs;
      }
    }

    if (t.dom) {
      t.dom.classList.add('hit');
      setTimeout(() => {
        this.renderer && this.renderer.removeTarget && this.renderer.removeTarget(t);
      }, 120);
    }

    try {
      this.logger.logHit && this.logger.logHit({
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
  }

  /* ---------- Spawn & loop ---------- */

  _loop() {
    if (!this.running) return;

    const now = performance.now();
    const elapsed = now - this.startAt;
    const remaining = Math.max(0, this.cfg.durationMs - elapsed);
    this.state.remainingMs = remaining;

    // FEVER decay
    const dtSec = 16 / 1000; // approx 60 FPS
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

    // หมดเวลา
    if (remaining <= 0) {
      this.stop('timeout');
      return;
    }

    // spawn เป้าใหม่
    if (now >= this.nextSpawnAt) {
      this._spawnTarget(now);
      this.nextSpawnAt = now + this.cfg.spawnInterval;
    }

    // เช็คเป้าหมดอายุ → miss
    const life = this.cfg.targetLifeMs;
    for (const t of this.targets) {
      if (t.hit || t.expired) continue;
      if (now - t.spawnAt >= life) {
        t.expired = true;
        this.state.missCount++;
        this.state.combo = 0;
        this._stats.misses++;

        // HP ลดเมื่อพลาดเป้าหลัก (ไม่นับ decoy)
        if (!t.decoy) {
          this.state.playerHP = Math.max(0, this.state.playerHP - this.cfg.hpMissPenalty);
          if (this.state.playerHP <= 0) {
            this.stop('player-dead');
            return;
          }
        }

        if (t.dom) {
          t.dom.classList.add('miss');
          setTimeout(() => {
            this.renderer && this.renderer.removeTarget && this.renderer.removeTarget(t);
          }, 80);
        }

        try {
          this.logger.logExpire && this.logger.logExpire({
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

    // อัปเดต HUD
    try {
      this.hooks.onUpdate && this.hooks.onUpdate(this.state);
    } catch (e) {
      console.warn('onUpdate hook error', e);
    }

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
      this.renderer && this.renderer.spawnTarget && this.renderer.spawnTarget(t);
      this.logger.logSpawn && this.logger.logSpawn({
        id: t.id,
        type: isDecoy ? 'decoy' : 'normal'
      });
    } catch (e) {
      console.warn('spawn error', e);
    }
  }

  /* ---------- Analytics ---------- */

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