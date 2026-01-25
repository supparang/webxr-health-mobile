// === js/ai-director.js — AI Difficulty Director (Pack A) ===
// Prediction-lite: EMA + streak + accuracy + rt trend → ปรับ spawn/ttl/size/weights แบบ "นุ่ม"
// NOTE: ใน research mode แนะนำให้ disable หรือ constrain ให้นิ่ง (engine ส่ง allowAdaptive=false ได้)

'use strict';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// weights baseline (รวม ~100)
const BASE_WEIGHTS = {
  normal: 64,
  decoy: 10,
  bomb: 8,
  heal: 9,
  shield: 9
};

export class AIDirector {
  constructor() {
    this.reset();
  }

  reset() {
    // performance traces
    this.emaAcc = 0.78;         // 0..1
    this.emaRt = 420;           // ms
    this.emaMissRate = 0.15;    // 0..1
    this.streak = 0;            // hit streak for "hype"
    this.hype = 0;              // 0..1
    this.lastUpdateAt = performance.now();
  }

  // call per hit/timeout
  observeEvent(ev) {
    // ev: {type:'hit'|'timeout', targetType, rtMs, isRealMiss, scoreDelta}
    const a = 0.14; // EMA alpha

    if (ev.type === 'hit') {
      this.streak = Math.min(25, this.streak + 1);
      // approx accuracy ↑
      this.emaAcc = lerp(this.emaAcc, 1.0, a);
      if (typeof ev.rtMs === 'number' && isFinite(ev.rtMs)) {
        this.emaRt = lerp(this.emaRt, clamp(ev.rtMs, 120, 1800), a);
      }
      // miss rate ↓
      this.emaMissRate = lerp(this.emaMissRate, 0.0, a * 0.8);
    } else if (ev.type === 'timeout') {
      this.streak = Math.max(0, this.streak - 3);
      // accuracy ↓ only when real miss
      if (ev.isRealMiss) {
        this.emaAcc = lerp(this.emaAcc, 0.0, a * 0.55);
        this.emaMissRate = lerp(this.emaMissRate, 1.0, a * 0.45);
      } else {
        // skip-types don't punish much
        this.emaMissRate = lerp(this.emaMissRate, this.emaMissRate, a * 0.2);
      }
    }

    // hype: grows with streak, decays with misses
    const streakBoost = clamp((this.streak - 4) / 14, 0, 1);
    const calmPenalty = clamp((this.emaMissRate - 0.12) / 0.22, 0, 1);
    const targetHype = clamp(streakBoost * (1 - calmPenalty), 0, 1);
    this.hype = lerp(this.hype, targetHype, 0.18);
  }

  /**
   * คำนวณ output สำหรับ engine ใช้ปรับ spawn/ttl/size/weights
   * @param {Object} ctx
   *  - diffKey, bossPhase, feverOn, allowAdaptive (bool)
   */
  compute(ctx) {
    const allow = ctx && ctx.allowAdaptive !== false;

    // skill estimate: good acc + low rt + low miss
    const acc = clamp(this.emaAcc, 0, 1);
    const rtN = clamp((680 - this.emaRt) / 520, -1, 1); // faster => positive
    const missN = clamp(1 - (this.emaMissRate / 0.45), 0, 1);
    let skill = clamp(0.50 * acc + 0.30 * (0.5 + 0.5 * rtN) + 0.20 * missN, 0, 1);

    // phase factor (late phase is already hard)
    const phase = (ctx && ctx.bossPhase) || 1;
    const phaseHard = phase === 1 ? 0.0 : phase === 2 ? 0.08 : 0.14;

    // if fever on, don't over-punish
    const feverSoft = (ctx && ctx.feverOn) ? -0.05 : 0.0;

    // desired intensity 0..1
    let intensity = clamp(skill + phaseHard + feverSoft, 0, 1);

    // research mode or disabled: keep near baseline
    if (!allow) intensity = 0.50;

    // spawn faster with higher intensity
    const spawnIntervalMul = clamp(lerp(1.10, 0.78, intensity), 0.72, 1.18);

    // TTL slightly shorter with intensity (but not too brutal)
    const ttlMul = clamp(lerp(1.06, 0.86, intensity), 0.82, 1.10);

    // size smaller with intensity
    const sizeMul = clamp(lerp(1.08, 0.88, intensity), 0.85, 1.15);

    // weights: more bombs/decoys on higher intensity; more heal/shield on lower intensity
    const w = { ...BASE_WEIGHTS };
    const t = intensity;

    // push challenge
    w.decoy = Math.round(lerp(8, 14, t));
    w.bomb  = Math.round(lerp(6, 12, t));

    // assist when struggling
    w.heal  = Math.round(lerp(12, 7, t));
    w.shield= Math.round(lerp(12, 7, t));

    // keep normal as remainder-ish but stable
    const sumOther = w.decoy + w.bomb + w.heal + w.shield;
    w.normal = Math.max(45, 100 - sumOther);

    // "surprise burst": short spike when hype high
    const hype = this.hype;
    const burst = allow && hype > 0.78 ? clamp((hype - 0.78) / 0.22, 0, 1) : 0;

    return {
      intensity,
      spawnIntervalMul,
      ttlMul,
      sizeMul,
      weights: w,
      burst // 0..1
    };
  }
}