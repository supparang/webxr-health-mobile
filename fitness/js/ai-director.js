// === /fitness/js/ai-director.js — Adaptive Pattern Director (A-41) ===
'use strict';

const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));

function pickWeighted(weights, rng=Math.random){
  const total = weights.reduce((acc, w) => acc + w.w, 0);
  let r = rng() * total;
  for (const item of weights) {
    if (r < item.w) return item.v;
    r -= item.w;
  }
  return weights[weights.length - 1].v;
}

export class AIDirector {
  constructor(opts = {}) {
    this.enabled = !!opts.enabled;
    this.rng = opts.rng || Math.random;

    // stateful windows
    this.challengeUntil = 0;
    this.recoverUntil = 0;

    // for trigger detection
    this._goodStreakMs = 0;
    this._lastTickAt = 0;

    // config
    this.challengeMinMs = opts.challengeMinMs ?? 5500;  // ต้องเล่นดีต่อเนื่องก่อน
    this.challengeLenMs = opts.challengeLenMs ?? 4500;  // burst duration
    this.recoverLenMs = opts.recoverLenMs ?? 5200;      // recovery duration
  }

  setEnabled(v){ this.enabled = !!v; }

  reset(){
    this.challengeUntil = 0;
    this.recoverUntil = 0;
    this._goodStreakMs = 0;
    this._lastTickAt = 0;
  }

  /**
   * Update internal windows based on predictor signals.
   * @param {Object} state game state
   * @param {Object} predictor {focusScore, missRisk}
   * @param {number} now performance.now()
   */
  tick(state, predictor, now){
    if (!this.enabled) return;

    const focus = predictor?.focusScore ?? 60;
    const risk  = predictor?.missRisk ?? 30;
    const hp = clamp(state?.playerHp ?? 1, 0, 1);

    // dt
    const last = this._lastTickAt || now;
    const dt = Math.max(0, now - last);
    this._lastTickAt = now;

    // --- Recovery trigger ---
    // ถ้าเสี่ยงมาก / HP ต่ำ → เข้าหน้าฟื้นตัว
    if (risk >= 65 || hp <= 0.32) {
      this.recoverUntil = Math.max(this.recoverUntil, now + this.recoverLenMs);
      // ตัด streak เพื่อไม่ให้ burst ต่อทันที
      this._goodStreakMs = 0;
    }

    // --- Good streak for Challenge Burst ---
    // เล่นดีต่อเนื่อง: focus สูง + risk ต่ำ + hp โอเค → สะสมเวลา
    const inRecover = now < this.recoverUntil;
    const good = (focus >= 86 && risk <= 26 && hp >= 0.45 && !inRecover);

    if (good) this._goodStreakMs += dt;
    else this._goodStreakMs = Math.max(0, this._goodStreakMs - dt * 0.65);

    // trigger burst
    const inChallenge = now < this.challengeUntil;
    if (!inChallenge && this._goodStreakMs >= this.challengeMinMs) {
      this.challengeUntil = now + this.challengeLenMs;
      this._goodStreakMs = 0;
    }
  }

  getMode(now){
    if (!this.enabled) return 'base';
    if (now < this.recoverUntil) return 'recover';
    if (now < this.challengeUntil) return 'challenge';
    return 'base';
  }

  /**
   * Spawn delay multiplier.
   * @returns {number} multiplier (0.75..1.35)
   */
  spawnDelayMul(state, predictor, now){
    if (!this.enabled) return 1;

    const focus = predictor?.focusScore ?? 60;
    const risk  = predictor?.missRisk ?? 30;
    const hp = clamp(state?.playerHp ?? 1, 0, 1);

    const mode = this.getMode(now);

    if (mode === 'recover') return 1.22;     // ช้าลง
    if (mode === 'challenge') return 0.82;   // เร็วขึ้น

    // base adaptive (นิ่ม ๆ)
    // focus สูง -> เร็วขึ้นนิด, risk สูง/HP ต่ำ -> ช้าลง
    let mul = 1.0;
    mul *= (focus >= 85) ? 0.92 : (focus <= 50 ? 1.05 : 1.0);
    mul *= (risk >= 55) ? 1.08 : (risk <= 25 ? 0.97 : 1.0);
    mul *= (hp <= 0.40) ? 1.06 : 1.0;

    return clamp(mul, 0.80, 1.22);
  }

  /**
   * Lifetime multiplier for targets (TTL).
   * @returns {number} multiplier (0.85..1.30)
   */
  lifetimeMul(state, predictor, now){
    if (!this.enabled) return 1;

    const risk = predictor?.missRisk ?? 30;
    const hp = clamp(state?.playerHp ?? 1, 0, 1);
    const mode = this.getMode(now);

    if (mode === 'recover') return 1.22;      // อยู่ให้นานขึ้น ช่วยให้ทัน
    if (mode === 'challenge') return 0.92;    // เร็วขึ้นนิด

    let mul = 1.0;
    if (risk >= 60 || hp <= 0.35) mul = 1.18;
    else if (risk <= 25 && hp >= 0.60) mul = 0.96;

    return clamp(mul, 0.90, 1.26);
  }

  /**
   * Choose target kind based on mode.
   * kinds: normal/decoy/bomb/heal/shield
   */
  pickKind(state, predictor, now){
    const mode = this.getMode(now);
    const focus = predictor?.focusScore ?? 60;
    const risk  = predictor?.missRisk ?? 30;
    const hp = clamp(state?.playerHp ?? 1, 0, 1);
    const shield = state?.shield ?? 0;

    // weights baseline
    let weights = [
      { v: 'normal', w: 64 },
      { v: 'decoy',  w: 10 },
      { v: 'bomb',   w: 8  },
      { v: 'heal',   w: 9  },
      { v: 'shield', w: 9  }
    ];

    if (!this.enabled) return pickWeighted(weights, this.rng);

    if (mode === 'recover') {
      // ฟื้นตัว: ลด bomb/decoy, เพิ่ม heal/shield, normal เยอะขึ้น
      weights = [
        { v: 'normal', w: 70 },
        { v: 'decoy',  w: 6  },
        { v: 'bomb',   w: 3  },
        { v: 'heal',   w: (hp < 0.55 ? 14 : 10) },
        { v: 'shield', w: (shield <= 0 ? 12 : 8) }
      ];
      return pickWeighted(weights, this.rng);
    }

    if (mode === 'challenge') {
      // โหมดมันส์: เพิ่ม decoy/bomb (แต่ยังให้ heal/shield บ้าง)
      weights = [
        { v: 'normal', w: 56 },
        { v: 'decoy',  w: 16 },
        { v: 'bomb',   w: 14 },
        { v: 'heal',   w: 7  },
        { v: 'shield', w: 7  }
      ];
      // ถ้า HP เริ่มตก ให้ลด bomb ลงหน่อยกันพัง
      if (hp < 0.48) {
        weights = [
          { v: 'normal', w: 58 },
          { v: 'decoy',  w: 15 },
          { v: 'bomb',   w: 10 },
          { v: 'heal',   w: 9  },
          { v: 'shield', w: 8  }
        ];
      }
      return pickWeighted(weights, this.rng);
    }

    // base adaptive
    // เล่นดี: เพิ่ม decoy/bomb
    // เสี่ยง: เพิ่ม heal/shield
    let bombW = 8, decoyW = 10, healW = 9, shieldW = 9, normalW = 64;

    if (focus >= 85 && risk <= 30 && hp >= 0.50) {
      bombW += 3;
      decoyW += 3;
      normalW -= 4;
      healW -= 1;
      shieldW -= 1;
    }

    if (risk >= 55 || hp <= 0.40) {
      bombW -= 3;
      decoyW -= 2;
      healW += 3;
      shieldW += 3;
      normalW += 2;
    }

    if (shield <= 0 && risk >= 45) {
      shieldW += 2;
      normalW -= 1;
    }

    // clamp & normalize-ish
    bombW = Math.max(2, bombW);
    decoyW = Math.max(3, decoyW);
    healW = Math.max(5, healW);
    shieldW = Math.max(5, shieldW);
    normalW = Math.max(45, normalW);

    weights = [
      { v: 'normal', w: normalW },
      { v: 'decoy',  w: decoyW  },
      { v: 'bomb',   w: bombW   },
      { v: 'heal',   w: healW   },
      { v: 'shield', w: shieldW }
    ];

    return pickWeighted(weights, this.rng);
  }
}