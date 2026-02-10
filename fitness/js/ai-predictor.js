// === /fitness/js/ai-predictor.js ===
// Shadow Breaker — AI Predictor (PATCH D)
// ✅ Provides named export: AIPredictor  (fix import crash)
// ✅ Also exposes window.RB_AI for legacy/optional consumers
'use strict';

export class AIPredictor {
  constructor(){
    this.enabled = true; // play only (engine will keep it harmless)
    this._last = null;
  }

  isEnabled(){ return !!this.enabled; }

  // snapshot: { t, score, combo, miss, fever, youHp, bossHp, phase, diff, lastHitDtMs? ... }
  predict(snapshot){
    // "DL-lite" placeholder (deterministic-ish heuristic)
    // You can replace internals later with real ML/DL.
    const s = snapshot || {};
    const fatigue = this._estimateFatigue(s);
    const risk = this._estimateRisk(s);
    const paceMul = this._paceMul(fatigue, risk);

    const tip = this._tip(s, fatigue, risk);

    this._last = { fatigue, risk, paceMul, tip };
    return this._last;
  }

  _estimateFatigue(s){
    // higher miss + low combo + low hp -> fatigue up
    const m = Number(s.miss||0);
    const c = Number(s.combo||0);
    const hp = Number(s.youHp||100);
    let f = 0;
    f += Math.min(1, m/18) * 0.55;
    f += (c<=2 ? 0.22 : 0.05);
    f += (hp<55 ? 0.25 : 0.05);
    return Math.max(0, Math.min(1, f));
  }

  _estimateRisk(s){
    const boss = Number(s.bossHp||100);
    const fever = Number(s.fever||0);
    let r = 0.15;
    if(boss<30) r += 0.25; // bossface soon -> risk/tempo
    if(fever>=95) r += 0.10; // fever moment
    return Math.max(0, Math.min(1, r));
  }

  _paceMul(fatigue, risk){
    // lower fatigue => speed up a bit; higher fatigue => slow down
    let mul = 1.0;
    mul *= (1.08 - fatigue*0.22);
    mul *= (0.96 + risk*0.10);
    return Math.max(0.80, Math.min(1.18, mul));
  }

  _tip(s, fatigue, risk){
    if(Number(s.shield||0) <= 0 && fatigue>0.55) return 'เก็บ Shield/Heal ก่อน แล้วค่อยไล่คอมโบ';
    if(Number(s.combo||0) <= 2) return 'โฟกัสเป้า “ปกติ” ให้ติดคอมโบก่อน';
    if(Number(s.bossHp||100) < 30) return 'บอสใกล้หมด! เตรียมตี Boss Face ให้ทัน';
    if(risk>0.30) return 'ตอนนี้จังหวะเร็วขึ้น—เล็งให้ชัวร์ อย่าหลง Decoy';
    return 'รักษาคอมโบไว้ แล้วค่อยเก็บ FEVER';
  }
}

// optional legacy global
try{
  window.RB_AI = window.RB_AI || new AIPredictor();
}catch(_){}