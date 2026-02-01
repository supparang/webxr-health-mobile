// === /fitness/js/boss-skills.js ===
// Shadow Breaker — Boss Skills (Play-only spice)
// Adds periodic "events" per boss phase:
//  - Phase 2: Decoy Burst (more decoys, slight faster pacing)
//  - Phase 3: Bomb Rain (more bombs, slight slower pacing + guarantees a shield spawn)
// Research mode: disabled (keeps deterministic/clean).
'use strict';

export class BossSkills {
  constructor(opts = {}) {
    this.wrapEl = opts.wrapEl || null;
    this.setFeedback = typeof opts.setFeedback === 'function' ? opts.setFeedback : null;
    this.spawnTargetOfType = typeof opts.spawnTargetOfType === 'function' ? opts.spawnTargetOfType : null;

    this._phase = 1;
    this._active = null;      // { type, untilMs }
    this._nextAt = 0;
    this._lastFlashAt = 0;
  }

  reset(now, state) {
    this._phase = state && state.bossPhase ? state.bossPhase : 1;
    this._active = null;
    this._nextAt = now + 2500; // first event happens a bit later
    this._flashOff();
  }

  stop(now) {
    this._active = null;
    this._nextAt = now + 999999;
    this._flashOff();
  }

  onPhase(now, state) {
    const p = state && state.bossPhase ? state.bossPhase : 1;
    if (p === this._phase) return;
    this._phase = p;
    // schedule next event soon after phase change (but not instantly)
    this._active = null;
    this._nextAt = now + (p === 1 ? 999999 : 2200);
    this._flashOff();
  }

  tick(now, state) {
    if (!state || !state.running) return;

    // play-only
    if (state.mode === 'research') return;

    // auto end active window
    if (this._active && now >= this._active.untilMs) {
      this._active = null;
      this._flashOff();
    }

    // phase 1: keep clean
    if (this._phase === 1) return;

    if (now < this._nextAt) return;

    // trigger event by phase
    if (this._phase === 2) {
      this._triggerDecoyBurst(now, state);
    } else if (this._phase === 3) {
      this._triggerBombRain(now, state);
    }

    // cooldown (fair + not spammy)
    const cd = this._phase === 2 ? 9000 : 10500;
    // if fever is ON, slow event frequency a bit (avoid overwhelm)
    const feverBonus = state.feverOn ? 2500 : 0;
    this._nextAt = now + cd + feverBonus;
  }

  getSpawnWeights(now, state, baseWeights) {
    if (!state || state.mode === 'research') return null;
    if (!this._active || now >= this._active.untilMs) return null;

    const type = this._active.type;
    if (!Array.isArray(baseWeights)) return null;

    // clone
    const w = baseWeights.map(x => ({ v: x.v, w: x.w }));

    if (type === 'decoy') {
      // make decoys more common (but keep normals dominant)
      for (const it of w) {
        if (it.v === 'decoy') it.w = Math.round(it.w * 3.0);
        if (it.v === 'normal') it.w = Math.round(it.w * 0.85);
      }
    } else if (type === 'bomb') {
      // bomb rain but fair: also slightly boost shield
      for (const it of w) {
        if (it.v === 'bomb') it.w = Math.round(it.w * 3.2);
        if (it.v === 'shield') it.w = Math.round(it.w * 1.6);
        if (it.v === 'normal') it.w = Math.round(it.w * 0.85);
      }
    }
    return w;
  }

  getPacingMult(now, state) {
    if (!state || state.mode === 'research') return 1;
    if (!this._active || now >= this._active.untilMs) return 1;

    // small pacing shift: decoy burst = faster, bomb rain = slightly slower
    if (this._active.type === 'decoy') return 0.86;
    if (this._active.type === 'bomb') return 1.12;
    return 1;
  }

  _triggerDecoyBurst(now, state) {
    this._active = { type: 'decoy', untilMs: now + 2600 };
    this._flashOn('decoy');
    if (this.setFeedback) this.setFeedback('บอสปล่อย "เงาลวง" ระวังเป้าปลอม! 👀', 'bad');

    // spawn 2 decoys instantly (if function provided)
    if (this.spawnTargetOfType) {
      this.spawnTargetOfType('decoy', { size: 0.95 * (state && state.diffKey ? 1 : 1) });
      setTimeout(() => {
        if (state && state.running) this.spawnTargetOfType('decoy', { size: 0.9 });
      }, 160);
    }
  }

  _triggerBombRain(now, state) {
    this._active = { type: 'bomb', untilMs: now + 2400 };
    this._flashOn('bomb');
    if (this.setFeedback) this.setFeedback('ฝนระเบิดมาแล้ว! หา 🛡️ ให้ทัน (หรือ FEVER ช่วย) 💥', 'bad');

    // spawn a bomb + a shield immediately for fairness
    if (this.spawnTargetOfType) {
      this.spawnTargetOfType('bomb', { size: 1.0 });
      setTimeout(() => {
        if (state && state.running) this.spawnTargetOfType('shield', { size: 0.9 });
      }, 160);
    }
  }

  _flashOn(kind) {
    if (!this.wrapEl) return;
    const cls = kind === 'bomb' ? 'sb-skill-bomb' : 'sb-skill-decoy';
    this.wrapEl.classList.add(cls);

    // avoid stacking flashes
    const t = performance.now();
    if (t - this._lastFlashAt > 350) {
      this._lastFlashAt = t;
    }
  }

  _flashOff() {
    if (!this.wrapEl) return;
    this.wrapEl.classList.remove('sb-skill-bomb');
    this.wrapEl.classList.remove('sb-skill-decoy');
  }
}