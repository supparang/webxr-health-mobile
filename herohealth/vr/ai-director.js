// === /fitness/js/ai-director.js — PACK A: Predictive Difficulty Director + Pattern ===
'use strict';

/**
 * AI Director (PACK A)
 * - เก็บ skill model แบบเรียลไทม์ (EMA RT, accuracy, bombRate, comboBreak)
 * - ปรับ spawn interval / weight ของเป้า / size multiplier แบบ smooth
 * - สร้าง pattern สั้น ๆ ให้รู้สึกว่ามี “แผน” (ไม่สุ่มล้วน)
 */

export class AIDirector {
  constructor(opts = {}) {
    this.cfg = Object.assign({
      // smoothing
      emaAlpha: 0.12,           // EMA speed
      minDelayMul: 0.72,
      maxDelayMul: 1.28,
      minSizeMul: 0.86,
      maxSizeMul: 1.18,

      // pattern
      patternCooldownMs: 6500,  // เว้นช่วงก่อนจะสร้าง pattern ใหม่
      patternMaxLen: 6,

      // coaching
      tipEveryMs: 4200,

      // clamps (กันกระชาก)
      adjustRate: 0.08
    }, opts);

    this.reset();
  }

  reset() {
    this.skill = {
      // real-time estimates
      emaRt: 420,         // ms
      emaRtAbsDev: 90,    // ms
      hits: 0,
      misses: 0,
      bombsHit: 0,
      decoysHit: 0,
      comboBreaks: 0,
      lastCombo: 0,
      feverHits: 0,
      feverActiveMs: 0
    };

    this.tuning = {
      delayMul: 1.0,   // <1 = faster spawn
      sizeMul: 1.0,    // <1 = smaller targets
      bombMul: 1.0,    // >1 = more bombs
      decoyMul: 1.0,   // >1 = more decoys
      healMul: 1.0,
      shieldMul: 1.0
    };

    this.pattern = null;        // { steps:[{kind, extraDelay}], idx }
    this.nextPatternAt = performance.now() + 4000;
    this.lastTipAt = 0;
    this.lastAdjustAt = performance.now();
  }

  // เรียกทุก hit/timeout (จาก engine)
  onEvent(e) {
    if (!e) return;

    // combo break detection
    if (typeof e.comboAfter === 'number') {
      if (this.skill.lastCombo > 0 && e.comboAfter === 0) this.skill.comboBreaks++;
      this.skill.lastCombo = e.comboAfter;
    }

    if (e.type === 'hit') {
      this.skill.hits++;
      if (e.targetType === 'bomb') this.skill.bombsHit++;
      if (e.targetType === 'decoy') this.skill.decoysHit++;
      if (typeof e.rtMs === 'number' && e.rtMs > 0) {
        // EMA RT
        const a = this.cfg.emaAlpha;
        const prev = this.skill.emaRt;
        const rt = e.rtMs;
        this.skill.emaRt = prev + a * (rt - prev);

        // EMA abs deviation (stability)
        const dev = Math.abs(rt - this.skill.emaRt);
        this.skill.emaRtAbsDev = this.skill.emaRtAbsDev + a * (dev - this.skill.emaRtAbsDev);
      }

      if (e.feverOn) this.skill.feverHits++;
    }

    if (e.type === 'timeout') {
      // real miss เฉพาะ normal/bossface ถูกนับจาก engine แล้ว
      if (e.isRealMiss) this.skill.misses++;
    }

    if (typeof e.feverActiveMs === 'number') {
      this.skill.feverActiveMs = e.feverActiveMs;
    }
  }

  // ===== derived metrics =====
  accuracyPct() {
    const t = this.skill.hits + this.skill.misses;
    return t > 0 ? (this.skill.hits / t) * 100 : 100;
  }

  bombRatePct() {
    const h = this.skill.hits || 0;
    return h > 0 ? (this.skill.bombsHit / h) * 100 : 0;
  }

  stabilityScore() {
    // ต่ำ = สม่ำเสมอ (ดี), สูง = ไม่นิ่ง
    // normalize: 60..220
    const d = this.skill.emaRtAbsDev;
    const cl = Math.max(60, Math.min(220, d));
    return 1 - (cl - 60) / (220 - 60); // 0..1 (1 ดี)
  }

  // ===== main adjust loop =====
  tick(now, state) {
    if (!state || !state.running) return;

    const dt = now - this.lastAdjustAt;
    if (dt < 450) return;
    this.lastAdjustAt = now;

    // เป้าหมายของเกม: ให้ผู้เล่นอยู่ใน “flow zone”
    // - accuracy: 78..92
    // - EMA RT: อยู่ในช่วงเหมาะกับ diff/phase
    // - bomb rate: ไม่สูงเกินไป

    const acc = this.accuracyPct();
    const rt = this.skill.emaRt;
    const stab = this.stabilityScore();
    const bombRate = this.bombRatePct();

    // baseline “ความยาก” ต่อ phase (phase 3 ควรเร็วขึ้น)
    const phaseBias =
      state.bossPhase === 1 ? 0.00 :
      state.bossPhase === 2 ? 0.06 : 0.12;

    // want faster when: acc สูง + rt ต่ำ + stability ดี
    const perf =
      (acc - 82) / 20 +         // -? .. +?
      (420 - rt) / 280 +        // rt ต่ำ => บวก
      (stab - 0.55);            // นิ่ง => บวก

    // want easier when: bomb rate สูง + combo break สูง
    const comboPenalty = Math.min(1, this.skill.comboBreaks / 8);
    const bombPenalty = Math.min(1, bombRate / 18);

    let targetDelayMul = 1.0 - (0.18 * perf) - phaseBias + (0.16 * bombPenalty) + (0.12 * comboPenalty);

    // size: ถ้า perf ดี => เล็กลงนิด, ถ้า miss เยอะ => ใหญ่ขึ้นนิด
    let targetSizeMul = 1.0 - (0.10 * perf) + (0.10 * comboPenalty);

    // bombs/decoys: ถ้าผู้เล่นเก่ง => เพิ่ม decoy/bomb เล็กน้อย
    let targetBombMul = 1.0 + (0.22 * Math.max(0, perf)) - (0.35 * bombPenalty);
    let targetDecoyMul = 1.0 + (0.20 * Math.max(0, perf));

    // heal/shield: ถ้าผู้เล่นกำลังจะตาย หรือ bomb penalty สูง => เพิ่มช่วย
    const lowHp = state.playerHp <= 0.34;
    let targetHealMul = 1.0 + (lowHp ? 0.55 : 0) + (bombPenalty * 0.25);
    let targetShieldMul = 1.0 + (lowHp ? 0.45 : 0) + (bombPenalty * 0.30);

    // clamp
    targetDelayMul = this._clamp(targetDelayMul, this.cfg.minDelayMul, this.cfg.maxDelayMul);
    targetSizeMul  = this._clamp(targetSizeMul,  this.cfg.minSizeMul,  this.cfg.maxSizeMul);

    // smooth apply (avoid jerk)
    const r = this.cfg.adjustRate;
    this.tuning.delayMul  = this._lerp(this.tuning.delayMul,  targetDelayMul, r);
    this.tuning.sizeMul   = this._lerp(this.tuning.sizeMul,   targetSizeMul,  r);
    this.tuning.bombMul   = this._lerp(this.tuning.bombMul,   targetBombMul,  r);
    this.tuning.decoyMul  = this._lerp(this.tuning.decoyMul,  targetDecoyMul, r);
    this.tuning.healMul   = this._lerp(this.tuning.healMul,   targetHealMul,  r);
    this.tuning.shieldMul = this._lerp(this.tuning.shieldMul, targetShieldMul,r);

    // pattern scheduling
    if (!this.pattern && now >= this.nextPatternAt) {
      this.pattern = this._makePattern(state);
      this.nextPatternAt = now + this.cfg.patternCooldownMs + Math.random() * 2200;
    }
  }

  // ===== apply to spawn =====
  getSpawnDelay(cfg) {
    const base = this._rand(cfg.spawnIntervalMin, cfg.spawnIntervalMax);
    const d = base * this.tuning.delayMul;
    return Math.max(220, Math.round(d));
  }

  getSizeMul() {
    return this.tuning.sizeMul;
  }

  // เลือกชนิดเป้าถัดไป (ถ้ามี pattern ให้ใช้ก่อน)
  nextKind(state) {
    if (this.pattern && this.pattern.steps && this.pattern.idx < this.pattern.steps.length) {
      const step = this.pattern.steps[this.pattern.idx++];
      if (this.pattern.idx >= this.pattern.steps.length) this.pattern = null;
      return step.kind;
    }

    // default weighted (ถูกคูณด้วย tuning)
    const wNormal = 64;
    const wDecoy  = 10 * this.tuning.decoyMul;
    const wBomb   = 8  * this.tuning.bombMul;
    const wHeal   = 9  * this.tuning.healMul;
    const wShield = 9  * this.tuning.shieldMul;

    return this._pickWeighted([
      { v: 'normal', w: wNormal },
      { v: 'decoy',  w: wDecoy },
      { v: 'bomb',   w: wBomb },
      { v: 'heal',   w: wHeal },
      { v: 'shield', w: wShield }
    ]);
  }

  // ใช้สำหรับ coach (สรุปสถานะ)
  snapshotForCoach(state) {
    return {
      acc: +this.accuracyPct().toFixed(1),
      emaRt: Math.round(this.skill.emaRt),
      stab: +this.stabilityScore().toFixed(2),
      bombRate: +this.bombRatePct().toFixed(1),
      delayMul: +this.tuning.delayMul.toFixed(2),
      sizeMul: +this.tuning.sizeMul.toFixed(2),
      phase: state ? state.bossPhase : 1
    };
  }

  // ===== internal pattern =====
  _makePattern(state) {
    // pattern สั้น ๆ ให้เหมือนบอส “มีแผน”
    // phase สูงขึ้น => ซับซ้อนขึ้น
    const p = state.bossPhase || 1;
    const len = Math.min(this.cfg.patternMaxLen, p === 1 ? 4 : p === 2 ? 5 : 6);

    const patterns = [
      // 1) fake-out: normal → decoy → normal
      ['normal','decoy','normal','normal','shield','normal'],
      // 2) trap: normal → bomb → heal
      ['normal','bomb','heal','normal','decoy','normal'],
      // 3) feint: decoy → normal → bomb → normal
      ['decoy','normal','bomb','normal','shield','normal'],
      // 4) pressure: normal x2 → bomb → normal → heal
      ['normal','normal','bomb','normal','heal','normal']
    ];

    // เลือก pattern แบบสุ่ม แต่ phase 3 ให้หนักขึ้น (เลือก trap/pressure บ่อย)
    const pick = (p === 3)
      ? this._pickWeighted([{v:1,w:1},{v:3,w:2},{v:4,w:3},{v:2,w:2}])
      : this._pickWeighted([{v:1,w:2},{v:2,w:2},{v:3,w:1.5},{v:4,w:1.8}]);

    const base = patterns[Math.max(0, pick - 1)] || patterns[0];
    const steps = base.slice(0, len).map(k => ({ kind: k }));

    return { steps, idx: 0 };
  }

  _pickWeighted(weights) {
    const total = weights.reduce((acc, w) => acc + w.w, 0);
    let r = Math.random() * total;
    for (const item of weights) {
      if (r < item.w) return item.v;
      r -= item.w;
    }
    return weights[weights.length - 1].v;
  }

  _rand(min, max) { return min + Math.random() * (max - min); }
  _clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  _lerp(a, b, t) { return a + (b - a) * t; }
}