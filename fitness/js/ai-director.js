// === /fitness/js/ai-director.js ===
// AI Director: uses predictor to adjust spawn pacing & item mix fairly.
// ✅ Play mode only (engine decides).
// ✅ Rate-limited micro-tips (AI Coach).
// ✅ Never makes it impossible: caps adjustments.

'use strict';

import { AIPredictor } from './ai-predictor.js';

export class AIDirector {
  constructor(opts = {}) {
    this.cfg = Object.assign({
      // fairness caps
      minDelayMul: 0.82,
      maxDelayMul: 1.18,
      minTtlMul: 0.85,
      maxTtlMul: 1.15,

      // mixing caps
      maxBombW: 12,
      minBombW: 4,
      maxDecoyW: 14,
      minDecoyW: 6,

      // coach
      tipCooldownMs: 2200,
      tipChance: 0.32,
      dangerTipChance: 0.55
    }, opts);

    this.predictor = new AIPredictor();
    this.lastTipAt = 0;
    this.lastP = 0.35;
  }

  observeResolvedEvent(info) {
    this.predictor.observe(info);
    this.lastP = this.predictor.predict();
  }

  /**
   * Compute spawn delay multiplier (lower = faster/harder)
   * If player is struggling (pMiss high) => slow down a bit.
   * If player is strong (pMiss low) => speed up a bit.
   */
  spawnDelayMul() {
    const p = this.lastP;
    // map p 0..1 => mul ~ 0.90..1.10 (then clamp)
    let mul = 1.0 + (p - 0.45) * 0.35;
    mul = Math.max(this.cfg.minDelayMul, Math.min(this.cfg.maxDelayMul, mul));
    return mul;
  }

  ttlMul() {
    const p = this.lastP;
    // struggling => longer TTL
    let mul = 1.0 + (p - 0.45) * 0.30;
    mul = Math.max(this.cfg.minTtlMul, Math.min(this.cfg.maxTtlMul, mul));
    return mul;
  }

  /**
   * Return weights for pickWeighted
   * Base: normal 64 decoy 10 bomb 8 heal 9 shield 9
   * If struggling => more heal/shield, slightly less bomb/decoy
   * If strong => slightly more bomb/decoy, less heal/shield
   */
  weights() {
    const p = this.lastP;

    let normal = 64;
    let decoy  = 10;
    let bomb   = 8;
    let heal   = 9;
    let shield = 9;

    if (p >= 0.62) {
      // help player
      heal += 3;
      shield += 3;
      bomb -= 2;
      decoy -= 2;
      normal += 1;
    } else if (p <= 0.30) {
      // challenge player
      bomb += 2;
      decoy += 2;
      heal -= 2;
      shield -= 2;
      normal -= 0;
    }

    // clamp fairness
    bomb = Math.max(this.cfg.minBombW, Math.min(this.cfg.maxBombW, bomb));
    decoy = Math.max(this.cfg.minDecoyW, Math.min(this.cfg.maxDecoyW, decoy));
    heal = Math.max(5, Math.min(14, heal));
    shield = Math.max(5, Math.min(14, shield));
    normal = Math.max(52, Math.min(74, normal));

    return [
      { v: 'normal', w: normal },
      { v: 'decoy',  w: decoy },
      { v: 'bomb',   w: bomb },
      { v: 'heal',   w: heal },
      { v: 'shield', w: shield }
    ];
  }

  /**
   * Micro tip (AI Coach) — rate-limited
   * @param {Object} ctx { now, lastGrade, feverOn, playerHp, missDelta, hitType }
   */
  maybeTip(ctx) {
    const now = ctx?.now || performance.now();
    if (now - this.lastTipAt < this.cfg.tipCooldownMs) return null;

    const p = this.lastP;
    const struggling = p >= 0.62 || (ctx && ctx.playerHp != null && ctx.playerHp <= 0.34);

    const r = Math.random();
    if (!struggling && r > this.cfg.tipChance) return null;
    if (struggling && r > this.cfg.dangerTipChance) return null;

    this.lastTipAt = now;

    // tips
    if (ctx && ctx.hitType === 'bomb') return 'ทริค: ถ้าเห็น 💣 หรือ 🫥 ให้ “เว้นจังหวะ” ไม่ต้องตีทุกอันนะ!';
    if (ctx && ctx.missDelta > 0) return 'ทริค: มอง “กลางจอ” แล้วใช้สายตากวาดเร็ว ๆ จะลด Miss ได้เยอะ 👀';
    if (ctx && ctx.feverOn) return 'FEVER ON! ตอนนี้คะแนน ×1.5 รีบเก็บเป้าจริงต่อเนื่อง!';
    if (struggling) return 'ตั้งหลักก่อน: โฟกัสเป้าจริง 🥊 แล้วค่อยเพิ่มความเร็วทีละนิด';
    return 'สายโปร! ลองคุมจังหวะให้ PERFECT ติด ๆ กัน จะได้ FEVER ไว';
  }

  debug() {
    return this.predictor.debugSnapshot();
  }
}