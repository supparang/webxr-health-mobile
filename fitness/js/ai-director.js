// === js/ai-director.js — AI Director (Prediction hooks + ML/DL placeholders) ===
'use strict';

/**
 * แนวคิด: ทำให้เกม “สนุก-ท้าทาย-เร้าใจ” แบบฉลาดขึ้น
 * - AI Prediction: คาดการณ์ความเร็วตอบสนอง / fatigue จากสถิติช่วงล่าสุด
 * - ML (เบื้องต้น): ปรับพารามิเตอร์เกมด้วยกติกา + rolling window (เหมาะ production)
 * - DL (placeholder): จุดเสียบโมเดลภายนอกในอนาคต (ไม่เปิดใช้ default)
 */

export class AIDirector {
  constructor() {
    this.enabled = true;

    // rolling window (ล่าสุด N ครั้ง)
    this.windowN = 18;
    this.rtHistory = [];
    this.hitHistory = []; // 1=hit,0=miss

    // prediction state
    this.pred = {
      rt_p50: null,
      rt_p80: null,
      fatigue: 0,         // 0..1
      skill: 0.5          // 0..1
    };
  }

  reset() {
    this.rtHistory.length = 0;
    this.hitHistory.length = 0;
    this.pred = { rt_p50: null, rt_p80: null, fatigue: 0, skill: 0.5 };
  }

  /**
   * update จาก event ล่าสุด
   * @param {Object} e {type:'hit'|'timeout', rt_ms, isRealMiss}
   */
  update(e) {
    if (!this.enabled || !e) return;

    if (e.type === 'hit' && typeof e.rt_ms === 'number') {
      this.rtHistory.push(e.rt_ms);
      this.hitHistory.push(1);
    } else if (e.type === 'timeout' && e.isRealMiss) {
      this.hitHistory.push(0);
    }

    // trim
    while (this.rtHistory.length > this.windowN) this.rtHistory.shift();
    while (this.hitHistory.length > this.windowN) this.hitHistory.shift();

    this._recomputePrediction();
  }

  _recomputePrediction() {
    const rts = this.rtHistory.slice().sort((a,b)=>a-b);
    if (rts.length) {
      const p = (q)=>{
        const i = Math.max(0, Math.min(rts.length-1, Math.round((rts.length-1)*q)));
        return rts[i];
      };
      this.pred.rt_p50 = p(0.5);
      this.pred.rt_p80 = p(0.8);
    }

    // skill ~ accuracy ใน window (hit ratio)
    if (this.hitHistory.length) {
      const acc = this.hitHistory.reduce((a,b)=>a+b,0) / this.hitHistory.length;
      this.pred.skill = Math.max(0, Math.min(1, acc));
    }

    // fatigue heuristic: rt_p80 สูง + acc ลด => fatigue สูง
    const rt80 = this.pred.rt_p80 || 0;
    const fatigueFromRT = rt80 ? Math.max(0, Math.min(1, (rt80 - 420) / 500)) : 0;
    const fatigueFromAcc = 1 - this.pred.skill;
    this.pred.fatigue = Math.max(0, Math.min(1, 0.6*fatigueFromRT + 0.4*fatigueFromAcc));
  }

  /**
   * ML-style difficulty tuning (เบา ๆ ใช้งานจริงได้)
   * คืนค่า { spawnMul, ttlMul, sizeMul, bombW, decoyW }
   */
  proposeTuning() {
    if (!this.enabled) {
      return { spawnMul: 1, ttlMul: 1, sizeMul: 1, bombW: 1, decoyW: 1 };
    }

    const { skill, fatigue, rt_p50 } = this.pred;

    // เร้าใจ: ถ้า skill สูง => spawn ไวขึ้น/เป้าเล็กลงเล็กน้อย
    const spawnMul = 1 - 0.10 * (skill - 0.5);   // skill 1 => 0.95, skill 0 => 1.05
    const sizeMul  = 1 - 0.08 * (skill - 0.5);   // skill 1 => 0.96

    // ถ้า fatigue สูง => ช่วยให้ไม่หัวร้อน: TTL ยาวขึ้นนิด + ลด bomb/decoy
    const ttlMul = 1 + 0.18 * fatigue;           // fatigue 1 => 1.18
    const bombW  = 1 - 0.25 * fatigue;           // fatigue 1 => 0.75
    const decoyW = 1 - 0.20 * fatigue;           // fatigue 1 => 0.80

    // ถ้า median RT ช้ามาก ให้ช่วยเล็กน้อย
    const rtAssist = rt_p50 && rt_p50 > 520 ? 0.06 : 0;

    return {
      spawnMul: Math.max(0.88, Math.min(1.12, spawnMul + rtAssist)),
      ttlMul:   Math.max(0.90, Math.min(1.25, ttlMul)),
      sizeMul:  Math.max(0.92, Math.min(1.10, sizeMul)),
      bombW:    Math.max(0.60, Math.min(1.20, bombW)),
      decoyW:   Math.max(0.60, Math.min(1.20, decoyW)),
    };
  }

  /**
   * DL hook (placeholder)
   * - หากวันหนึ่งมีโมเดล TensorFlow.js / ONNX runtime
   * - เอา features -> model -> policy -> tuning
   */
  async proposeTuningFromDL(/*features*/) {
    return null; // default ปิดไว้
  }
}