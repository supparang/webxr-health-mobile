// === /fitness/js/pattern-director.js ===
// AI Pattern Director — adaptive difficulty + spawn mix (PLAY only)
// ✅ research: keep disabled to remain deterministic
'use strict';

export class PatternDirector {
  constructor(opts = {}) {
    this.cfg = Object.assign({
      updateEveryMs: 2200,
      calmWhenHighFatigue: true,
      maxSpawnBoost: 0.22,   // +22% faster spawn
      maxTtlCut: 0.14,       // -14% lifetime (harder)
      maxBombBoost: 0.35,    // increase bomb weight
      maxDecoyBoost: 0.30,
      maxHealBoost: 0.35,    // help player when struggling
      maxShieldBoost: 0.35
    }, opts);

    this.reset();
  }

  reset(){
    this.lastUpdateAt = 0;
    this.level = 0.0;       // -1..+1 (easy..hard)
    this.mix = { normal:64, decoy:10, bomb:8, heal:9, shield:9 };
    this.spawnBoost = 0.0;  // 0..maxSpawnBoost
    this.ttlCut = 0.0;      // 0..maxTtlCut
  }

  _clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  // predictor: {risk,label,rtAvg,slope,missRate}
  update(now, state, predictor){
    if (!state || !predictor) return;
    if (!this.lastUpdateAt) this.lastUpdateAt = now;
    if (now - this.lastUpdateAt < this.cfg.updateEveryMs) return;
    this.lastUpdateAt = now;

    const p = predictor.predict();
    const phase = state.bossPhase || 1;

    // performance signals
    const missRate = p.missRate || 0;
    const rtAvg = p.rtAvg || 0;
    const slope = p.slope || 0;
    const combo = state.combo || 0;

    // compute difficulty desire (-1..+1)
    // - struggling: high fatigue OR high miss OR slow
    // - doing well: low miss, fast RT, stable slope, good combo
    let desire = 0;
    if (p.label === 'HIGH') desire -= 0.55;
    else if (p.label === 'MID') desire -= 0.22;

    if (missRate > 0.25) desire -= 0.35;
    if (rtAvg > 560) desire -= 0.22;
    if (slope > 7) desire -= 0.18;

    if (missRate < 0.12) desire += 0.25;
    if (rtAvg && rtAvg < 380) desire += 0.18;
    if (slope < 2) desire += 0.10;
    if (combo >= 4) desire += 0.12;

    // phase makes it naturally harder; we keep adapt gentle
    if (phase >= 3) desire *= 0.85;

    // smooth
    this.level = this._clamp(this.level * 0.72 + desire * 0.28, -1, 1);

    // convert to knobs
    // harder -> faster spawn + shorter ttl + more bomb/decoy
    // easier -> more heal/shield, slower spawn, longer ttl
    const hard = this._clamp((this.level + 1) / 2, 0, 1); // 0..1
    const easy = 1 - hard;

    this.spawnBoost = this.cfg.maxSpawnBoost * (hard * 0.85);
    this.ttlCut = this.cfg.maxTtlCut * (hard * 0.85);

    // base weights
    const base = { normal:64, decoy:10, bomb:8, heal:9, shield:9 };

    const bombUp = this.cfg.maxBombBoost * hard;
    const decoyUp = this.cfg.maxDecoyBoost * hard;
    const healUp = this.cfg.maxHealBoost * easy;
    const shieldUp = this.cfg.maxShieldBoost * easy;

    // apply deltas (keep sum roughly stable)
    let bomb = base.bomb * (1 + bombUp);
    let decoy = base.decoy * (1 + decoyUp);
    let heal = base.heal * (1 + healUp);
    let shield = base.shield * (1 + shieldUp);

    // normal gets the remainder-ish (bounded)
    let other = bomb + decoy + heal + shield;
    let normal = Math.max(38, 100 - other); // keep normal meaningful

    // normalize to ~100 weights
    const sum = normal + bomb + decoy + heal + shield;
    const scale = 100 / sum;

    this.mix = {
      normal: Math.round(normal * scale),
      decoy: Math.round(decoy * scale),
      bomb: Math.round(bomb * scale),
      heal: Math.round(heal * scale),
      shield: Math.round(shield * scale)
    };

    // final tiny rebalance (sum to 100)
    let s2 = this.mix.normal + this.mix.decoy + this.mix.bomb + this.mix.heal + this.mix.shield;
    this.mix.normal += (100 - s2);
  }

  // patch DIFF_CONFIG-derived timing
  applyTiming(cfg){
    if (!cfg) return cfg;
    const out = Object.assign({}, cfg);

    // faster spawn = smaller interval
    const boost = this.spawnBoost || 0;
    out.spawnIntervalMin = Math.max(320, Math.round(cfg.spawnIntervalMin * (1 - boost)));
    out.spawnIntervalMax = Math.max(out.spawnIntervalMin + 60, Math.round(cfg.spawnIntervalMax * (1 - boost)));

    // ttl cut
    const cut = this.ttlCut || 0;
    out.targetLifetime = Math.max(520, Math.round(cfg.targetLifetime * (1 - cut)));

    return out;
  }

  // spawn weights
  weights(){
    return this.mix || { normal:64, decoy:10, bomb:8, heal:9, shield:9 };
  }

  uiLabel(){
    const v = this.level;
    if (v > 0.45) return 'AI: CHALLENGE';
    if (v < -0.45) return 'AI: SUPPORT';
    return 'AI: BALANCE';
  }
}