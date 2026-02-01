'use strict';

/**
 * ai-pattern.js
 * - Pattern Generator สำหรับ spawn bias (เล็กน้อย) เพื่อความ “เร้าใจ”
 * - คุมให้ “ยุติธรรม” ไม่เอียงจนเกินไป
 */

const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));

export class AIPatternGen {
  constructor(){
    this.reset();
  }

  reset(){
    this.bias = { normal:0.64, decoy:0.10, bomb:0.08, heal:0.09, shield:0.09 };
  }

  /**
   * updateBiasFromAssist()
   * assist: {struggle, pace, sizeBoost, relax}
   * - struggle สูง → เพิ่ม heal/shield เล็กน้อย ลด bomb เล็กน้อย
   * - combo/skill ดี → เพิ่ม bomb/decoy เล็กน้อย
   */
  updateBiasFromAssist(assist, skill=0.5){
    const s = clamp(assist?.struggle ?? 0.4, 0, 1);
    const k = clamp(skill, 0, 1);

    const healUp = s*0.06;
    const shieldUp = s*0.05;
    const bombUp = k*0.04;
    const decoyUp = k*0.03;

    let normal = 0.64 - (healUp+shieldUp)*0.6;
    let heal = 0.09 + healUp;
    let shield = 0.09 + shieldUp;
    let bomb = 0.08 + bombUp - s*0.04;
    let decoy = 0.10 + decoyUp - s*0.03;

    // normalize
    const sum = normal+heal+shield+bomb+decoy;
    normal/=sum; heal/=sum; shield/=sum; bomb/=sum; decoy/=sum;

    this.bias = { normal, decoy, bomb, heal, shield };
  }

  getWeights(){
    return [
      { v:'normal', w: this.bias.normal },
      { v:'decoy',  w: this.bias.decoy },
      { v:'bomb',   w: this.bias.bomb },
      { v:'heal',   w: this.bias.heal },
      { v:'shield', w: this.bias.shield }
    ];
  }
}