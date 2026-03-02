// === /herohealth/vr/ai-goodjunk.js ===
// AI GoodJunk — PREDICTION ONLY (research-safe, deterministic by seed)
// PATCH v20260302-AI-PREDICT
'use strict';

function xmur3(str){
  str = String(str||'');
  let h = 1779033703 ^ str.length;
  for(let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= (h >>> 16)) >>> 0;
  };
}
function sfc32(a,b,c,d){
  return function(){
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
function makeRng(seedStr){
  const seed = xmur3(seedStr);
  return sfc32(seed(), seed(), seed(), seed());
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b, v));

export function createGoodJunkAI(opts){
  opts = opts || {};
  const seed = String(opts.seed || Date.now());
  const rng = makeRng('AI-GJ:' + seed);

  // internal state
  let lastPred = { hazardRisk: 0.15, next5: ['เล็งของดี'], t: 0 };
  let emaMiss = 0;       // exp moving average of miss pressure
  let emaAcc  = 0.75;    // acc proxy
  let emaRt   = 650;     // ms proxy
  let tickT   = 0;

  const hintPool = [
    'โฟกัสของดี (GOOD) ก่อน',
    'เห็นของเสียให้หลบ',
    'อย่ารีบยิงมั่ว (ลด shots)',
    'รักษาคอมโบให้ได้',
    'เก็บโล่ไว้กันพลาด',
    'เล็งกลางจอแล้วค่อยยิง'
  ];

  function pickHint(){
    const i = (rng()*hintPool.length)|0;
    return hintPool[i];
  }

  return {
    onSpawn(kind, meta){ /* could log spawn */ },
    onHit(kind, meta){ /* could log hit */ },
    onExpire(kind, meta){ /* could log expire */ },

    onTick(dt, state){
      dt = Number(dt)||0.016;
      tickT += dt;

      const missPressure = (Number(state.missGoodExpired||0) + Number(state.missJunkHit||0)*1.2);
      emaMiss = emaMiss*0.92 + missPressure*0.08;

      const shots = Number(state.shots||0);
      const hits  = Number(state.hits||0);
      const acc   = (shots>0) ? (hits/shots) : 0.75;
      emaAcc = emaAcc*0.92 + acc*0.08;

      // crude RT proxy from combo/shield/fever (you'll replace with real ML later)
      const combo = Number(state.combo||0);
      const fever = Number(state.fever||0);
      emaRt = emaRt*0.95 + (700 - combo*18 - fever*1.2)*0.05;

      // hazard risk heuristic (0..1)
      let risk = 0.10;
      risk += clamp(emaMiss/12, 0, 0.55);
      risk += clamp((0.70 - emaAcc), 0, 0.25);
      risk += clamp((emaRt - 800)/900, 0, 0.18);

      // slight deterministic noise
      risk += (rng()*0.06 - 0.03);
      risk = clamp(risk, 0.02, 0.98);

      // update prediction every ~0.5s
      if(tickT - (lastPred.t||0) >= 0.5){
        const hint = pickHint();
        lastPred = {
          hazardRisk: +risk.toFixed(3),
          next5: [hint],
          t: tickT
        };
      }
      return lastPred;
    },

    getPrediction(){
      return lastPred || null;
    },

    onEnd(summary){
      // return extra ai output (still prediction-only)
      return {
        hazardRiskFinal: lastPred?.hazardRisk ?? null,
        hintFinal: (lastPred?.next5 && lastPred.next5[0]) || null,
        model: 'heuristic-v1 (placeholder for ML/DL)'
      };
    }
  };
}