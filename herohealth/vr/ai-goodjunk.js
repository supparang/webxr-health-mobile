// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI (Prediction-only) — deterministic, research-safe
// PATCH v20260303-AI-PRED-HEURISTIC
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
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createGoodJunkAI(opts){
  opts = opts || {};
  const seed = String(opts.seed || Date.now());
  const rng = makeRng('GJAI:' + seed + ':' + String(opts.pid||'anon'));
  const r01 = ()=> rng();

  let lastPred = null;

  // internal stats (prediction-only; do NOT change game params)
  let emaMiss = 0;   // exp moving avg
  let emaAcc  = 0;
  let emaPace = 0;

  function pickHint(state){
    // explainable hints: "what to watch next"
    const shield = Number(state?.shield||0);
    const fever  = Number(state?.fever||0);
    const combo  = Number(state?.combo||0);
    const missG  = Number(state?.missGoodExpired||0);
    const missJ  = Number(state?.missJunkHit||0);

    if(shield<=0 && (r01()<0.25)) return 'หา 🛡️ กันพลาด';
    if(missJ > missG) return 'เลี่ยง 🍔🍟 ก่อน';
    if(missG >= 2) return 'รีบเก็บ “ของดี”';
    if(combo>=4) return 'รักษาคอมโบไว้!';
    if(fever>=85) return 'ใกล้ FEVER แล้ว ยิงต่อเนื่อง';
    return (r01()<0.5) ? 'โฟกัสของดี' : 'อย่าเสี่ยงของเสีย';
  }

  return {
    onSpawn(kind, meta){
      // optional hook
    },
    onHit(kind, meta){
      // optional hook
    },
    onExpire(kind, meta){
      // optional hook
    },
    onTick(dt, state){
      dt = clamp(dt, 0.001, 0.1);
      const shots = Number(state?.shots||0);
      const hits  = Number(state?.hits||0);
      const miss  = Number(state?.missGoodExpired||0) + Number(state?.missJunkHit||0);

      const acc = (shots>0) ? (hits/shots) : 1;
      const missRate = (shots>0) ? (miss/shots) : 0;

      // pace proxy: shots per second (rough)
      const pace = (shots>0) ? Math.min(6, 0.6 + (shots/60)) : 0.6;

      // EMA smoothing
      emaAcc  = emaAcc  * 0.92 + acc * 0.08;
      emaMiss = emaMiss * 0.90 + missRate * 0.10;
      emaPace = emaPace * 0.92 + pace * 0.08;

      // risk model (heuristic but stable + explainable)
      const shield = Number(state?.shield||0);
      const fever  = Number(state?.fever||0);
      const combo  = Number(state?.combo||0);

      // baseline risk increases with miss, decreases with shield/acc, increases with pace
      let risk =
        (emaMiss * 1.35) +
        ((1 - emaAcc) * 0.65) +
        (Math.max(0, emaPace - 1.0) * 0.12);

      // shield reduces risk
      risk -= Math.min(0.28, shield * 0.06);

      // fever/combo slightly reduce “hazard risk” (player in control)
      risk -= Math.min(0.12, (fever/100)*0.10);
      risk -= Math.min(0.10, combo*0.015);

      risk = clamp(risk, 0, 1);

      const hint = pickHint(state);
      lastPred = {
        hazardRisk: +risk.toFixed(2),
        next5: [hint]
      };
      return lastPred;
    },
    onEnd(summary){
      // attach final snapshot (prediction-only)
      return {
        model: 'heuristic-v1',
        hazardRisk: lastPred?.hazardRisk ?? null,
        hint: lastPred?.next5?.[0] ?? null
      };
    },
    getPrediction(){
      return lastPred;
    }
  };
}