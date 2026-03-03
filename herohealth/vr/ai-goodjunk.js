// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI Prediction — Research-safe (NO adaptive difficulty)
// PATCH v20260302-AI-PRED
'use strict';

export function createGoodJunkAI(cfg){
  cfg = cfg || {};
  const seed = String(cfg.seed || Date.now());
  const pid  = String(cfg.pid  || 'anon');
  const diff = String(cfg.diff || 'normal');
  const view = String(cfg.view || 'mobile');

  // tiny deterministic rng (xmur3 + sfc32)
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
  const seedFn = xmur3(`GJAI:${seed}:${pid}:${diff}:${view}`);
  const rng = sfc32(seedFn(), seedFn(), seedFn(), seedFn());
  const r01 = ()=> rng();

  // rolling features
  let tAcc = 0;
  let missGoodExpired = 0;
  let missJunkHit = 0;
  let shield = 0;
  let fever = 0;
  let combo = 0;

  let lastPred = {
    hazardRisk: 0.25,
    next5: ['เล็งกลางจอ', 'เก็บของดี', 'เลี่ยงของเสีย', 'คอมโบสำคัญ', 'อย่าปล่อยของดีหาย']
  };

  function clamp(v,a,b){ v=+v; if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }

  function compute(){
    // heuristic “prediction” (ML hook-ready)
    const base = 0.18 + (diff==='hard'?0.08:diff==='easy'?-0.05:0);
    const riskFromExpired = clamp(missGoodExpired * 0.06, 0, 0.42);
    const riskFromJunkHit = clamp(missJunkHit  * 0.09, 0, 0.55);
    const protect = clamp(shield * 0.06, 0, 0.30);
    const feverBoost = clamp(fever/100 * 0.08, 0, 0.08); // excitement
    const comboProtect = clamp(combo * 0.02, 0, 0.18);

    // tiny deterministic noise so it doesn’t look frozen
    const jitter = (r01()*2-1) * 0.03;

    const hazardRisk = clamp(base + riskFromExpired + riskFromJunkHit - protect - comboProtect + feverBoost + jitter, 0, 1);

    const hints = [];
    if(missGoodExpired > missJunkHit) hints.push('ของดีกำลังหายเร็ว');
    if(missJunkHit > 0) hints.push('ระวังของเสีย');
    if(shield <= 0) hints.push('หาโล่ 🛡️');
    if(combo < 3) hints.push('เร่งคอมโบ');
    if(fever >= 60) hints.push('เข้า FEVER ได้');

    while(hints.length < 5) hints.push(r01() < 0.5 ? 'เล็งกลางจอ' : 'เก็บของดี');

    lastPred = { hazardRisk, next5: hints.slice(0,5) };
    return lastPred;
  }

  return {
    getPrediction(){ return lastPred; },

    onSpawn(kind, meta){ /* hook */ },

    onHit(kind, meta){ /* hook */ },

    onExpire(kind, meta){ /* hook */ },

    onTick(dt, feats){
      // expect feats from game
      if(feats){
        missGoodExpired = feats.missGoodExpired|0;
        missJunkHit = feats.missJunkHit|0;
        shield = feats.shield|0;
        fever  = +feats.fever || 0;
        combo  = feats.combo|0;
      }
      tAcc += Math.max(0, +dt || 0);
      if(tAcc >= 0.35){
        tAcc = 0;
        return compute();
      }
      return lastPred;
    },

    onEnd(summary){
      // attach for research logging
      return {
        model: 'heuristic-v1',
        note: 'prediction only (no adaptive)',
        lastPred
      };
    }
  };
}