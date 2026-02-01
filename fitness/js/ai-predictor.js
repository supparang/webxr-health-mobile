'use strict';

/**
 * ai-predictor.js
 * - DL-lite predictor แบบ heuristic แต่โครงสร้างเหมือน “model inference”
 * - เน้น explainable + ไม่หนักเครื่อง + ไม่พึ่ง backend
 */

const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));

export class AIPredictor {
  constructor(){
    this.reset();
  }

  reset(){
    this.lastScore = null;
    this.level = 0;
    this.streakBad = 0;
    this.streakGood = 0;
  }

  /**
   * predict()
   * @param {number[]} vec from buildFeatureVector()
   * @returns {{risk:number, focus:string, pace:number, sizeBoost:number, hint:string}}
   */
  predict(vec){
    // vec = [acc, surv, spd, combo, hp, fever, phase, diff, tleft]
    if(!Array.isArray(vec) || vec.length < 9){
      return { risk:0.2, focus:'normal', pace:1.0, sizeBoost:0.0, hint:'ตั้งหลักแล้วเริ่มใหม่' };
    }

    const [acc, surv, spd, combo, hp, fever, phase, diff, tleft] = vec;

    // risk: 0..1
    let risk =
      (1-acc)*0.55 +
      (1-surv)*0.30 +
      (1-spd)*0.25 +
      (1-hp)*0.22 +
      (phase)*0.10 +
      (diff-0.5)*0.06 -
      combo*0.18 -
      fever*0.08;

    risk = clamp(risk, 0, 1);

    // focus selection
    let focus = 'normal';
    if(hp < 0.55) focus = 'heal';
    else if(risk > 0.72) focus = 'safe';
    else if(combo > 0.6 && acc > 0.78) focus = 'speed';
    else focus = 'normal';

    // pacing & sizeBoost (for Play mode only)
    const pace = clamp(1.12 - risk*0.30 + combo*0.08, 0.78, 1.22);
    const sizeBoost = clamp(risk*0.16, 0, 0.18);

    // hints
    let hint = 'ดีมาก! รักษาจังหวะต่อ';
    if(risk > 0.78) hint = 'อย่าเสี่ยงกับ Bomb/Decoy — หา Heal/Shield ก่อน';
    else if(hp < 0.55) hint = 'HP ต่ำ — โฟกัส Heal/Shield';
    else if(acc < 0.75) hint = 'เล็งให้ชัดขึ้นก่อน — ตี Normal ให้แม่น';
    else if(spd < 0.6) hint = 'ชกสั้น ๆ เร็วขึ้นอีกนิด';
    else if(combo < 0.3) hint = 'เริ่มคอมโบใหม่ — เลือกเป้าง่ายก่อน';

    return { risk, focus, pace, sizeBoost, hint };
  }
}