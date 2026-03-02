// === /herohealth/vr/ai-goodjunk.js ===
// Prediction-only AI (NO adaptive) for GoodJunk
// PATCH v20260302-AI-GOODJUNK
'use strict';

export function createGoodJunkAI(cfg){
  cfg = cfg || {};
  const seed = String(cfg.seed||'');
  const pid  = String(cfg.pid||'anon');
  const diff = String(cfg.diff||'normal');
  const view = String(cfg.view||'mobile');

  // rolling counters (lightweight)
  let tSec = 0;
  let missGoodExpired = 0;
  let missJunkHit = 0;
  let shield = 0;
  let fever = 0;
  let combo = 0;
  let score = 0;
  let shots = 0;
  let hits = 0;

  // last prediction snapshot
  let lastPred = null;

  function clamp(v,a,b){ v=+v||0; return v<a?a:(v>b?b:v); }
  function accPct(){ return shots>0 ? (hits/shots) : 0; }

  function predict(){
    // hazardRisk: higher = more risk (junk/expire)
    const acc = accPct(); // 0..1
    const missRate = clamp((missGoodExpired + missJunkHit) / Math.max(1, (hits + missGoodExpired + missJunkHit)), 0, 1);

    // Heuristic: low acc + high missRate + low shield => higher risk
    let risk =
      (1-acc)*0.55 +
      missRate*0.45 +
      (shield<=0 ? 0.10 : 0.0) -
      (fever>=80 ? 0.05 : 0.0) -
      (combo>=5 ? 0.05 : 0.0);

    // soften by diff
    if(diff==='easy') risk -= 0.05;
    if(diff==='hard') risk += 0.05;

    risk = clamp(risk, 0, 1);

    const next5 = [];
    if(risk > 0.70) next5.push('เลี่ยง JUNK ก่อน');
    else if(risk > 0.45) next5.push('โฟกัสของดีให้ต่อเนื่อง');
    else next5.push('เก็บคอมโบได้เลย');

    if(shield<=0) next5.push('หา 🛡️ ไว้กันพลาด');
    if(missGoodExpired > missJunkHit) next5.push('รีบแตะ GOOD อย่าปล่อยหาย');
    if(acc < 0.55) next5.push('ยิงให้ชัวร์ก่อนเร็ว');

    return {
      model: 'heuristic-v1',
      seed, pid, diff, view,
      hazardRisk: +risk.toFixed(4),
      next5
    };
  }

  return {
    onSpawn(kind, meta){
      // (optional) keep for future
    },
    onHit(kind, meta){
      // (optional) keep for future
    },
    onExpire(kind, meta){
      // (optional) keep for future
    },
    onTick(dt, state){
      tSec += (+dt||0);
      missGoodExpired = +state?.missGoodExpired || missGoodExpired;
      missJunkHit     = +state?.missJunkHit || missJunkHit;
      shield          = +state?.shield || shield;
      fever           = +state?.fever || fever;
      combo           = +state?.combo || combo;
      score           = +state?.score || score;
      shots           = +state?.shots || shots;
      hits            = +state?.hits || hits;

      // update prediction at ~5Hz max
      if(!lastPred || (tSec - (lastPred._tSec||0)) > 0.20){
        lastPred = predict();
        lastPred._tSec = tSec;
      }
      return lastPred;
    },
    getPrediction(){
      return lastPred;
    },
    onEnd(summary){
      // attach a simple analysis (still prediction-only)
      try{
        const acc = summary?.accPct ?? null;
        const med = summary?.medianRtGoodMs ?? null;
        return {
          note: 'prediction-only',
          tip:
            (acc!=null && acc < 55) ? 'ลองลดความรีบ แล้วยิงให้ชัวร์ขึ้น' :
            (med!=null && med > 850) ? 'ลองอ่านเป้าเร็วขึ้นนิดนึง (RT สูง)' :
            'ดีมาก! คุมจังหวะได้แล้ว',
        };
      }catch(e){
        return null;
      }
    }
  };
}