// === engine.js (2025-11-19 — Boss Phase Update + Low HP Mode) ===
'use strict';

const DEFAULTS = {
  durationMs: 60000,
  spawnInterval: 750,
  targetLifeMs: 900,

  scoreHit: 10,
  scoreMissPenalty: 0,
  hitRadius: 90,

  hpMax: 100,
  hpMissPenalty: 4,

  bossCount: 4,
  bossHPPerBoss: 100,
  bossDamagePerHit: 3,

  decoyChance: 0.18,

  feverGainPerHit: 16,
  feverDecayPerSec: 10,
  feverThreshold: 100,
  feverDurationMs: 5000
};

export class GameEngine {
  constructor({ config = {}, hooks = {}, renderer, logger, mode = 'normal' }) {
    this.cfg = { ...DEFAULTS, ...config };
    this.hooks = hooks;
    this.renderer = renderer;
    this.logger = logger || {};
    this.mode = mode;

    if (this.renderer?.setEngine) this.renderer.setEngine(this);

    this.targets = [];
    this.running = false;

    this.hitRadius = this.cfg.hitRadius;

    this._stats = this._makeStats();
    this.state = null;
  }

  _makeStats() {
    return {
      spawns: 0,
      hitsNormal: 0,
      hitsDecoy: 0,
      misses: 0,
      sumRTNormal: 0,
      cntRTNormal: 0,
      sumRTDecoy: 0,
      cntRTDecoy: 0
    };
  }

  /* ----------------------------------------------
   * Reset
   * ----------------------------------------------
   */
  _resetState() {
    const bossList = this.cfg.bosses || [];

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
      bossName: bossList[0]?.name || '',
      bossEmoji: bossList[0]?.emoji || '',

      endedBy: null,
      elapsedMs: 0,
      analytics: null
    };

    this.targets = [];
    this._stats = this._makeStats();
  }

  /* ----------------------------------------------
   * Start / Stop
   * ----------------------------------------------
   */
  start() {
    this._resetState();
    this.running = true;
    this.startAt = performance.now();
    this.nextSpawnAt = this.startAt + 300;

    this.renderer?.clear?.();
    this._loop();
  }

  stop(reason = 'manual') {
    if (!this.running) return;
    this.running = false;

    this.state.endedBy = reason;
    this.state.elapsedMs = performance.now() - this.startAt;

    this._finalizeAnalytics();
    this.hooks.onEnd?.(this.state);
    this.logger.finish?.(this.state);
  }

  /* ----------------------------------------------
   * HIT SYSTEM
   * ----------------------------------------------
   */
  registerTouch(x, y) {
    if (!this.running) return;

    let nearest = null;
    let nearestDist = Infinity;

    for (const t of this.targets) {
      if (t.hit || t.expired || !t.dom) continue;

      const r = t.dom.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      const d = Math.hypot(x - cx, y - cy);
      if (d <= this.hitRadius && d < nearestDist) {
        nearest = t;
        nearestDist = d;
      }
    }

    if (nearest) this._hitTarget(nearest);
  }

  _hitTarget(t) {
    if (t.hit || t.expired) return;
    const now = performance.now();

    t.hit = true;
    const rt = t.spawnAt ? now - t.spawnAt : 0;
    const isDecoy = !!t.decoy;

    /* --- Decoy case --- */
    if (isDecoy) {
      this._stats.hitsDecoy++;
      this.state.combo = 0;
      this.state.missCount++;
      this.state.playerHP = Math.max(0, this.state.playerHP - this.cfg.hpMissPenalty);
    } else {
      /* --- Normal target hit --- */
      this._stats.hitsNormal++;

      const base = this.cfg.scoreHit;
      const feverMult = this.state.feverActive ? 2 : 1;
      const gain = base * feverMult;

      this.state.score += gain;
      this.state.combo++;
      this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);

      // FEVER
      this.state.feverCharge = Math.min(100, this.state.feverCharge + this.cfg.feverGainPerHit);
      if (!this.state.feverActive && this.state.feverCharge >= 100) {
        this.state.feverActive = true;
        this.state.feverUntil = now + this.cfg.feverDurationMs;
      }

      // Boss damage
      this.state.bossHP = Math.max(0, this.state.bossHP - this.cfg.bossDamagePerHit);

      // Boss killed?
      if (this.state.bossHP <= 0) {
        if (this.state.bossIndex + 1 >= this.state.bossCount) {
          // บอสตัวสุดท้ายตาย → จบเกม
          this._emitHitEffect(t, gain);
          this._updateHUDImmediate();
          this.stop('boss-cleared');
          return;
        } else {
          // ไปบอสตัวใหม่
          this.state.bossIndex++;
          this.state.bossHP = this.cfg.bossHPPerBoss;
          this.state.bossMaxHP = this.cfg.bossHPPerBoss;

          const bl = this.cfg.bosses || [];
          const meta = bl[this.state.bossIndex];
          if (meta) {
            this.state.bossName = meta.name;
            this.state.bossEmoji = meta.emoji;
          }
        }
      }

      // FX popup + score
      this._emitHitEffect(t, gain);
    }

    // DOM effect
    if (t.dom) t.dom.classList.add('target-hit');
    setTimeout(() => this.renderer?.removeTarget?.(t), 110);

    this.hooks.onUpdate?.(this.state);

    this.logger.logHit?.({
      id: t.id,
      type: isDecoy ? 'decoy' : 'normal',
      score: this.state.score,
      combo: this.state.combo,
      missCount: this.state.missCount,
      playerHP: this.state.playerHP,
      reactionMs: rt
    });
  }

  /* ----------------------------------------------
   * MAIN LOOP
   * ----------------------------------------------
   */
  _loop() {
    if (!this.running) return;

    const now = performance.now();
    const el = now - this.startAt;
    const rem = Math.max(0, this.cfg.durationMs - el);
    this.state.remainingMs = rem;

    // FEVER decay
    if (this.state.feverActive) {
      if (now >= this.state.feverUntil) this.state.feverActive = false;
    } else if (this.state.feverCharge > 0) {
      this.state.feverCharge = Math.max(
        0,
        this.state.feverCharge - this.cfg.feverDecayPerSec * (16 / 1000)
      );
    }

    if (rem <= 0) {
      this.stop('timeout');
      return;
    }

    // Spawn
    if (now >= this.nextSpawnAt) {
      this._spawnTarget(now);
      this.nextSpawnAt = now + this.cfg.spawnInterval;
    }

    // Expire
    for (const t of this.targets) {
      if (t.hit || t.expired) continue;

      if (now - t.spawnAt >= this.cfg.targetLifeMs) {
        t.expired = true;
        this.state.combo = 0;
        this.state.missCount++;
        this._stats.misses++;

        if (!t.decoy) {
          this.state.playerHP = Math.max(0, this.state.playerHP - this.cfg.hpMissPenalty);
          if (this.state.playerHP <= 0) {
            this.hooks.onUpdate?.(this.state);
            this.stop('player-dead');
            return;
          }
        }

        if (t.dom) {
          t.dom.classList.add('miss');
          setTimeout(() => this.renderer?.removeTarget?.(t), 90);
        }
      }
    }

    this.hooks.onUpdate?.(this.state);
    requestAnimationFrame(() => this._loop());
  }

  /* ----------------------------------------------
   * SPAWN TARGET
   * ----------------------------------------------
   */
  _spawnTarget(now) {
    const bosses = this.cfg.bosses || [];
    const bMeta = bosses[this.state.bossIndex];

    const isLow = this.state.bossHP <= this.state.bossMaxHP * 0.3;
    const isDecoy = isLow ? false : Math.random() < this.cfg.decoyChance;

    let emoji;
    if (isLow) {
      emoji = bMeta?.emoji || '🥊';
    } else {
      emoji = isDecoy
        ? this.cfg.emojiDecoy
        : this.cfg.emojiMain;
    }

    const t = {
      id: 't' + Math.random().toString(36).slice(2),
      x: Math.random(),
      y: Math.random(),
      emoji,
      decoy: isDecoy,
      spawnAt: now,
      hit: false,
      expired: false,
      dom: null
    };

    this.targets.push(t);
    this._stats.spawns++;

    this.renderer?.spawnTarget?.(t);
    this.logger.logSpawn?.({
      id: t.id,
      type: isDecoy ? 'decoy' : 'normal'
    });
  }

  /* ----------------------------------------------
   * Analytics
   * ----------------------------------------------
   */
  _finalizeAnalytics() {
    const st = this._stats;
    const totalSpawns = st.spawns;
    const totalHits = st.hitsNormal + st.hitsDecoy;

    const accuracy = totalSpawns > 0 ? totalHits / totalSpawns : 0;

    const avgN = st.cntRTNormal ? st.sumRTNormal / st.cntRTNormal : 0;
    const avgD = st.cntRTDecoy ? st.sumRTDecoy / st.cntRTDecoy : 0;

    this.state.analytics = {
      totalSpawns,
      totalHits,
      normalHits: st.hitsNormal,
      decoyHits: st.hitsDecoy,
      expiredMisses: st.misses,
      accuracy,
      avgReactionNormal: avgN,
      avgReactionDecoy: avgD
    };
  }

  _emitHitEffect(t, gain) {
    this.renderer?.spawnHitEffect?.(t, {
      score: gain,
      fever: this.state.feverActive
    });
  }

  _updateHUDImmediate() {
    this.hooks.onUpdate?.(this.state);
  }
}
