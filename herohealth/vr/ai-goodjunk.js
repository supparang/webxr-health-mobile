// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI (Prediction-only, Explainable) — PRODUCTION SAFE
// PATCH v20260304-AI-PRED-EXPLAIN-TOP2
//
// ✅ NO adaptive difficulty (research-safe)
// ✅ Outputs: hazardRisk (0..1), factors(top), next5 hint
// ✅ Uses simple weighted model (acts like tiny "ML") + deterministic noise (seed)
// ✅ Can be replaced later with real ML/DL weights (json) withoutเปลี่ยน interface
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
const clamp=(v,a,b)=>Math.max(a, Math.min(b, v));
const sigmoid=(x)=> 1/(1+Math.exp(-x));

export function createGoodJunkAI(opts={}){
  const seed = String(opts.seed || Date.now());
  const pid  = String(opts.pid  || 'anon');
  const diff = String(opts.diff || 'normal').toLowerCase();
  const view = String(opts.view || 'mobile').toLowerCase();

  const rng = makeRng(`${seed}|${pid}|AI-GJ`);
  const r01 = ()=> rng();

  // rolling window state
  const st = {
    t: 0,
    lastPred: null,
    nSpawn: 0,
    nHitGood: 0,
    nHitJunk: 0,
    nExpireGood: 0,
    // short windows (approx 8s)
    w: [],
  };

  function pushWin(kind){
    const t = st.t;
    st.w.push({ t, kind });
    // keep last ~10s
    const cutoff = t - 10;
    while(st.w.length && st.w[0].t < cutoff) st.w.shift();
  }

  function rates10(){
    const span = 10;
    const cutoff = st.t - span;
    let spawn=0, good=0, junk=0, exp=0;
    for(const e of st.w){
      if(e.t < cutoff) continue;
      if(e.kind==='spawn') spawn++;
      else if(e.kind==='hitGood') good++;
      else if(e.kind==='hitJunk') junk++;
      else if(e.kind==='expGood') exp++;
    }
    return { spawn, good, junk, exp };
  }

  // "model weights" (ปรับได้ภายหลัง/แทนด้วยไฟล์ weights ของ ML/DL)
  const W = (function(){
    // base shift
    let b = -1.35;
    // spawn pressure, junk mistakes, good misses, low shield, low fever(combo), cVR penalty
    let wSpawn = 0.035;
    let wJunk  = 0.22;
    let wExp   = 0.18;
    let wShieldLow = 0.26;
    let wFeverLow  = 0.08;
    let wView = (view==='cvr' || view==='vr') ? 0.12 : 0.0;

    if(diff==='easy'){
      b = -1.55;
      wSpawn *= 0.85;
      wJunk  *= 0.90;
      wExp   *= 0.90;
    }else if(diff==='hard'){
      b = -1.10;
      wSpawn *= 1.15;
      wJunk  *= 1.10;
      wExp   *= 1.10;
    }
    return { b, wSpawn, wJunk, wExp, wShieldLow, wFeverLow, wView };
  })();

  function buildExplain({ spawn, junk, exp, shield, fever, combo }){
    const factors = [];

    // normalize-ish
    const spawnP = clamp(spawn/18, 0, 1);
    const junkP  = clamp(junk/4, 0, 1);
    const expP   = clamp(exp/4, 0, 1);
    const shieldLow = clamp((2 - shield)/2, 0, 1);
    const feverLow  = clamp((35 - fever)/35, 0, 1);
    const comboLow  = clamp((3 - combo)/3, 0, 1);

    factors.push({ k:'spawnPressure', score: spawnP, label:'เป้าออกถี่ (ต้องเลือกยิงเร็วขึ้น)' });
    factors.push({ k:'junkMistake', score: junkP, label:'โดนของเสียบ่อย (ต้องเลี่ยง 🍔🍟)' });
    factors.push({ k:'goodMiss', score: expP, label:'ของดีหลุด/หมดเวลา (ต้องโฟกัสของดี)' });
    factors.push({ k:'lowShield', score: shieldLow, label:'โล่น้อย (เสี่ยงโดนของเสีย)' });
    factors.push({ k:'lowFever', score: feverLow, label:'FEVER ต่ำ (คอมโบยังไม่ติด)' });
    factors.push({ k:'lowCombo', score: comboLow, label:'คอมโบหลุดง่าย (ยิงต่อเนื่องให้ติด 3+)' });

    factors.sort((a,b)=> b.score - a.score);
    const top2 = factors.slice(0,2);

    // next hint
    let hint = 'โฟกัส “ของดี” ก่อน แล้วค่อยเสี่ยง';
    if(top2[0]?.k==='junkMistake') hint = 'เห็น 🍔🍟 ให้ “ปล่อยผ่าน” ก่อน';
    else if(top2[0]?.k==='goodMiss') hint = 'ล็อกเป้า “ของดี” ให้ไว (อย่าปล่อยให้หมดเวลา)';
    else if(top2[0]?.k==='lowShield') hint = 'หา 🛡️ เติมก่อน แล้วค่อยบวกหนัก';
    else if(top2[0]?.k==='spawnPressure') hint = 'เลือกยิงเฉพาะเป้าที่ใกล้กลาง/เห็นชัด';

    return { top2, hint };
  }

  function predict(features){
    const { missGoodExpired=0, missJunkHit=0, shield=0, fever=0, combo=0, shots=0, hits=0 } = features || {};
    const r = rates10();

    // normalize to 0..1
    const spawnP = clamp(r.spawn/18, 0, 1);
    const junkP  = clamp(r.junk/4, 0, 1);
    const expP   = clamp(r.exp/4, 0, 1);
    const shieldLow = clamp((2 - (shield||0))/2, 0, 1);
    const feverLow  = clamp((35 - (fever||0))/35, 0, 1);

    // tiny deterministic noise for "human-like" stability (still reproducible by seed)
    const noise = (r01()*2 - 1) * 0.04;

    const z =
      W.b
      + W.wSpawn * (spawnP*10)
      + W.wJunk  * (junkP*6)
      + W.wExp   * (expP*6)
      + W.wShieldLow * (shieldLow*4)
      + W.wFeverLow  * (feverLow*3)
      + W.wView;

    const hazardRisk = clamp(sigmoid(z + noise), 0, 1);

    const ex = buildExplain({
      spawn: r.spawn,
      junk: r.junk,
      exp: r.exp,
      shield: shield||0,
      fever: fever||0,
      combo: combo||0
    });

    const next5 = [
      `${ex.hint}`,
      `Top: ${ex.top2.map(x=>x.label).join(' / ')}`,
      `acc≈${shots>0 ? Math.round((hits/shots)*100) : 0}% | shield=${shield||0}`,
      `missGood=${missGoodExpired|0} missJunk=${missJunkHit|0}`,
      diff==='hard' ? 'โหมด HARD: เน้น “ไม่พลาดของดี” ก่อน' : 'เก็บคอมโบให้ติด 3+'
    ];

    return {
      hazardRisk,
      next5,
      topFactors: ex.top2
    };
  }

  return {
    onSpawn(kind){
      st.nSpawn++;
      pushWin('spawn');
      // no-op
    },
    onHit(kind, meta={}){
      if(kind==='good') { st.nHitGood++; pushWin('hitGood'); }
      if(kind==='junk' && !meta.blocked) { st.nHitJunk++; pushWin('hitJunk'); }
    },
    onExpire(kind){
      if(kind==='good'){ st.nExpireGood++; pushWin('expGood'); }
    },
    onTick(dt, features){
      st.t += Math.max(0, Number(dt)||0);
      const p = predict(features || {});
      st.lastPred = p;
      return p;
    },
    onEnd(summary){
      // สรุป explainable factors สั้นๆ (ไว้โชว์ในรายงาน/Telemetry)
      const p = st.lastPred || null;
      return {
        aiVersion: 'GJ_AI_PRED_2026-03-04',
        hazardRiskLast: p ? +p.hazardRisk : null,
        topFactors: p ? p.topFactors : null
      };
    },
    getPrediction(){
      return st.lastPred || null;
    }
  };
}