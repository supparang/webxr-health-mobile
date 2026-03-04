// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI (Prediction only, research-safe)
// PATCH v20260304-AI-PRED-EXPLAIN
//
// Outputs:
// - hazardRisk: 0..1
// - next5: array tips (index 0 shown in HUD)
// - topFactors: [ {key,label,score} ... ]  (explainable)
// - onEnd(summary) returns { hazardRisk, topFactors, note }
//
// No adaptive difficulty. No networking. Deterministic given seed/pid.

'use strict';

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }

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
function sigmoid(x){ return 1/(1+Math.exp(-x)); }

// Tiny EWMA tracker (stable, no history storage)
function ewma(prev, x, a){
  if(!Number.isFinite(prev)) return x;
  return prev*(1-a) + x*a;
}

export function createGoodJunkAI(opts={}){
  const seed = String(opts.seed ?? Date.now());
  const pid  = String(opts.pid ?? 'anon');
  const diff = String(opts.diff ?? 'normal');
  const view = String(opts.view ?? 'mobile');

  const rng = makeRng(`GJAI|${seed}|${pid}|${diff}|${view}`);
  const r01 = ()=> rng();

  // State for prediction
  let risk = 0.22;                 // baseline
  let ewAcc = 0.75;
  let ewMissRate = 0.10;
  let ewJunkHitRate = 0.05;
  let ewGoodExpireRate = 0.05;
  let ewShield = 0.0;
  let ewCombo = 0.0;

  let lastPred = null;

  function calcRisk(features){
    const shots = Math.max(1, Number(features.shots||0));
    const hits  = clamp(Number(features.hits||0), 0, shots);
    const acc   = hits/shots;

    const missGoodExpired = Math.max(0, Number(features.missGoodExpired||0));
    const missJunkHit     = Math.max(0, Number(features.missJunkHit||0));
    const missTotal       = missGoodExpired + missJunkHit;

    const missRate = missTotal / Math.max(1, shots);
    const junkRate = missJunkHit / Math.max(1, shots);
    const goodExpRate = missGoodExpired / Math.max(1, shots);

    const shield = Math.max(0, Number(features.shield||0));
    const fever  = clamp(Number(features.fever||0), 0, 100);
    const combo  = Math.max(0, Number(features.combo||0));

    // update EWMA
    ewAcc = ewma(ewAcc, acc, 0.08);
    ewMissRate = ewma(ewMissRate, missRate, 0.10);
    ewJunkHitRate = ewma(ewJunkHitRate, junkRate, 0.12);
    ewGoodExpireRate = ewma(ewGoodExpireRate, goodExpRate, 0.12);
    ewShield = ewma(ewShield, clamp(shield/4, 0, 1), 0.10);
    ewCombo  = ewma(ewCombo, clamp(combo/8, 0, 1), 0.10);

    // “ML-ish” linear model (hand-tuned weights, deterministic)
    // Higher risk when: miss grows, junk hits, low shield, low acc, low combo.
    // Fever reduces risk a bit (player in flow).
    let x =
      -0.95
      + (1.8 * ewMissRate)
      + (1.4 * ewJunkHitRate)
      + (1.1 * ewGoodExpireRate)
      + (0.9 * (1 - ewAcc))
      + (0.6 * (1 - ewShield))
      + (0.5 * (1 - ewCombo))
      - (0.35 * (fever/100));

    // diff scaling (prediction only)
    if(diff==='easy') x -= 0.15;
    if(diff==='hard') x += 0.15;

    let out = sigmoid(x);
    out = clamp(out, 0, 1);

    // smooth
    risk = ewma(risk, out, 0.18);

    // explainable top factors
    const factors = [
      { key:'missRate', label:'MISS ต่อช็อตสูง', score: 1.8*ewMissRate },
      { key:'junkHit',  label:'โดนของเสียบ่อย', score: 1.4*ewJunkHitRate },
      { key:'goodExp',  label:'ของดีหลุดมือ', score: 1.1*ewGoodExpireRate },
      { key:'lowAcc',   label:'ความแม่นต่ำ', score: 0.9*(1-ewAcc) },
      { key:'lowShield',label:'โล่น้อย', score: 0.6*(1-ewShield) },
      { key:'lowCombo', label:'คอมโบไม่ต่อ', score: 0.5*(1-ewCombo) },
    ].sort((a,b)=> b.score - a.score);

    const top2 = factors.slice(0,2);

    // tips pool (deterministic shuffle-ish)
    const tips = [];
    // priority tips based on top factors
    for(const f of top2){
      if(f.key==='junkHit') tips.push('เห็น 🍟🍔🍕 ให้ “หยุด” ครึ่งวิ ก่อนแตะ');
      if(f.key==='goodExp') tips.push('เร่งแตะ “ของดี” ที่อยู่ใกล้หมดเวลา');
      if(f.key==='lowShield') tips.push('เก็บ 🛡️ ก่อน แล้วค่อยเสี่ยงโบนัส');
      if(f.key==='lowAcc') tips.push('โฟกัสเป้าเดียว อย่าไล่หลายอันพร้อมกัน');
      if(f.key==='lowCombo') tips.push('ต่อคอมโบ 3–5 จะทำให้เกม “นิ่ง” ขึ้น');
      if(f.key==='missRate') tips.push('ช้า = MISS: เลือกยิงเฉพาะของดีที่ชัด ๆ');
    }
    // add some generic tips
    const generic = [
      'ถ้ามี 🛡️ แล้ว กล้าเสี่ยงโบนัสได้',
      'ตอน Storm เป้าเยอะ: เลือกของดีใหญ่ก่อน',
      'Boss: แตกโล่ 🛡️ ก่อน แล้วค่อยยิง 🎯',
      'FEVER ใกล้เต็ม: รักษาคอมโบไว้',
    ];
    // deterministic add 1-2 generic
    if(r01() < 0.7) tips.push(generic[(r01()*generic.length)|0]);
    if(r01() < 0.35) tips.push(generic[(r01()*generic.length)|0]);

    // clean + unique
    const uniq = [];
    const seen = new Set();
    for(const t of tips){
      const s = String(t||'').trim();
      if(!s) continue;
      if(seen.has(s)) continue;
      seen.add(s);
      uniq.push(s);
    }

    return {
      hazardRisk: risk,
      next5: uniq.slice(0,5),
      topFactors: top2
    };
  }

  return {
    onSpawn(kind){ /* optional hook */ },
    onHit(kind){ /* optional hook */ },
    onExpire(kind){ /* optional hook */ },

    onTick(dt, features){
      const pred = calcRisk(features || {});
      lastPred = pred;
      return pred;
    },

    getPrediction(){
      return lastPred;
    },

    onEnd(summary){
      // Provide explainable “Top 2” like you requested
      const pred = lastPred || { hazardRisk: risk, topFactors: [] };
      const tf = (pred.topFactors || []).slice(0,2);

      let msg = 'ปัจจัยเสี่ยงหลัก: ';
      if(tf.length){
        msg += tf.map(x=>x.label).join(' + ');
      }else{
        msg += '—';
      }

      return {
        hazardRisk: clamp(pred.hazardRisk ?? risk, 0, 1),
        topFactors: tf,
        note: msg,
        modelTag: 'GJAI-PRED-v20260304'
      };
    }
  };
}