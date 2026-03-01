// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI (lightweight predictor) — prediction-only (NO adaptive gameplay)
// Exposes: createGoodJunkAI({seed,pid,diff,view})
// PATCH v20260301-AI-GOODJUNK-FULL
'use strict';

// tiny seeded rng (xmur3 + sfc32)
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
  const pid  = String(opts.pid  || 'anon');
  const diff = String(opts.diff || 'normal').toLowerCase();
  const view = String(opts.view || 'mobile').toLowerCase();

  const rng = makeRng(`${seed}|${pid}|${diff}|${view}`);
  const r01 = ()=> rng();

  // internal counters
  let missGoodExpired = 0;
  let missJunkHit = 0;
  let shield = 0;
  let fever = 0;
  let combo = 0;

  // last prediction cache
  let lastPred = {
    hazardRisk: 0.0,
    next5: ['—','—','—','—','—'],
    meta: { model:'heuristic-v1', seed, pid, diff, view }
  };

  // “next watchout” template list (UI only)
  const WATCH = [
    'โฟกัสของดี (🥦🍎) ก่อน',
    'เห็นของเสีย (🍔🍟) อย่าแตะ',
    'เก็บ 🛡️ เพื่อกันพลาด',
    'คุมคอมโบให้ต่อเนื่อง',
    'ช่วงท้ายสปีดขึ้น—ใจเย็น'
  ];

  function predict(){
    // heuristic risk: more misses => higher risk; shield + fever reduce risk a bit; high combo reduces risk
    const miss = missGoodExpired + missJunkHit;
    let risk = 0.18;
    risk += clamp(missGoodExpired,0,99) * 0.045;
    risk += clamp(missJunkHit,0,99) * 0.060;
    risk -= clamp(shield,0,9) * 0.040;
    risk -= clamp(combo,0,12) * 0.010;
    risk -= clamp(fever,0,100) * 0.0012;

    // difficulty tweak
    if(diff==='hard') risk += 0.06;
    if(diff==='easy') risk -= 0.04;

    // view tweak
    if(view==='cvr' || view==='vr') risk += 0.02;

    risk = clamp(risk, 0, 0.99);

    // create next5 hints
    const next5 = [];
    for(let i=0;i<5;i++){
      // bias: when risk high, show more “avoid junk / shield”
      const p = r01();
      if(risk >= 0.65 && p < 0.50) next5.push('ระวังของเสีย + หา 🛡️');
      else if(risk >= 0.50 && p < 0.35) next5.push('ใจเย็น โฟกัสของดี');
      else next5.push(WATCH[(r01()*WATCH.length)|0]);
    }

    lastPred = {
      hazardRisk: +risk,
      next5,
      meta: { model:'heuristic-v1', seed, pid, diff, view, missGoodExpired, missJunkHit, shield, fever, combo }
    };
    return lastPred;
  }

  const api = {
    updateInputs(payload){
      payload = payload || {};
      if(Number.isFinite(payload.missGoodExpired)) missGoodExpired = payload.missGoodExpired|0;
      if(Number.isFinite(payload.missJunkHit)) missJunkHit = payload.missJunkHit|0;
      if(Number.isFinite(payload.shield)) shield = payload.shield|0;
      if(Number.isFinite(payload.fever)) fever = +payload.fever;
      if(Number.isFinite(payload.combo)) combo = payload.combo|0;
      return predict();
    },

    onSpawn(kind, info){
      // no-op (prediction only)
      return null;
    },

    onHit(kind, info){
      // no-op (prediction only)
      return null;
    },

    onExpire(kind, info){
      // no-op (prediction only)
      return null;
    },

    onTick(dt, state){
      // state comes from goodjunk.safe.js
      state = state || {};
      if(Number.isFinite(state.missGoodExpired)) missGoodExpired = state.missGoodExpired|0;
      if(Number.isFinite(state.missJunkHit)) missJunkHit = state.missJunkHit|0;
      if(Number.isFinite(state.shield)) shield = state.shield|0;
      if(Number.isFinite(state.fever)) fever = +state.fever;
      if(Number.isFinite(state.combo)) combo = state.combo|0;
      return predict();
    },

    onEnd(summary){
      // keep small pack
      return {
        meta: lastPred.meta,
        predictionLast: { hazardRisk:lastPred.hazardRisk, next:lastPred.next5?.[0] || '—' }
      };
    },

    getPrediction(){
      return lastPred;
    }
  };

  // initial
  predict();
  return api;
}
