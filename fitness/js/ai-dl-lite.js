// === /fitness/js/ai-dl-lite.js ===
// DL-lite Predictor (lightweight heuristic as a stand-in for ML/DL)
// ✅ safe: no deps, no heavy compute
// ✅ API: export class DLitePredictor { update(), predict() }

'use strict';

export class DLitePredictor {
  constructor() {
    this.reset();
  }

  reset() {
    this.buf = [];
    this.last = {
      risk: 0.25,        // 0..1  (ยิ่งสูงยิ่งเสี่ยงพลาด/ตาย)
      fatigue: 0.20,     // 0..1
      focus: 0.70        // 0..1
    };
  }

  /**
   * update model with latest signals
   * @param {Object} s
   *  s = { rtMs, grade, missDelta, hp, combo, feverOn, tSec }
   */
  update(s) {
    const rt = Number(s?.rtMs || 0);
    const miss = Number(s?.missDelta || 0);
    const hp = Number(s?.hp ?? 1);
    const combo = Number(s?.combo || 0);
    const feverOn = !!s?.feverOn;

    // เก็บ window สั้น ๆ
    this.buf.push({ rt, miss, hp, combo, feverOn });
    if (this.buf.length > 18) this.buf.shift();

    // คำนวณค่าเฉลี่ย
    let rtAvg = 0, missSum = 0, comboAvg = 0;
    for (const x of this.buf) {
      rtAvg += x.rt;
      missSum += x.miss;
      comboAvg += x.combo;
    }
    rtAvg /= Math.max(1, this.buf.length);
    comboAvg /= Math.max(1, this.buf.length);

    // ฟีเจอร์ง่าย ๆ (แทน ML)
    const rtScore = clamp01((rtAvg - 220) / 520);     // ช้าขึ้น = เสี่ยงขึ้น
    const missScore = clamp01(missSum / 5);           // miss สะสมในหน้าต่าง
    const lowHpScore = clamp01((0.45 - hp) / 0.45);   // hp ต่ำ = เสี่ยง
    const comboScore = clamp01(1 - (comboAvg / 10));  // combo ต่ำ = เสี่ยง
    const feverBonus = feverOn ? -0.10 : 0;

    // pseudo “logit”
    let risk = 0.10 + 0.30*rtScore + 0.25*missScore + 0.30*lowHpScore + 0.15*comboScore + feverBonus;
    risk = clamp01(risk);

    // อนุมาน fatigue/focus
    const fatigue = clamp01(0.25*rtScore + 0.35*missScore + 0.40*lowHpScore);
    const focus = clamp01(1 - (0.50*rtScore + 0.30*missScore + 0.20*comboScore));

    this.last = { risk, fatigue, focus };
  }

  predict() {
    return this.last;
  }
}

function clamp01(v){ return Math.max(0, Math.min(1, Number(v)||0)); }