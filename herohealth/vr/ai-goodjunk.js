// === /webxr-health-mobile/herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI — PRODUCTION (Prediction + Director + Coach, rate-limited, kid-safe)
// Uses tiny model if available; fallback to heuristics.
// FULL v20260302-AI-GOODJUNK-PTEDICT-DIRECTOR-COACH
'use strict';

import { predictRisk, DEFAULT_WEIGHTS } from './goodjunk-model.js';

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }
function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

// deterministic rng
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for (let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= (h >>> 16);
    return h >>> 0;
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
  const f = xmur3(String(seedStr||'seed'));
  return sfc32(f(), f(), f(), f());
}

function pick(rng, arr){
  return arr[Math.floor(rng()*arr.length)];
}

const HINTS = {
  calm: [
    'ใจเย็น ๆ แล้วเล็งกลางจอ',
    'มองก่อนกดยิง 1 จังหวะ',
    'หายใจลึก ๆ แล้วค่อยยิง'
  ],
  avoidJunk: [
    'ระวังของหวาน/น้ำอัดลม!',
    'เจอ 🍟🍩 อย่าแตะนะ',
    'เลี่ยง “JUNK” ก่อนยิง'
  ],
  buildCombo: [
    'เก็บ GOOD ต่อเนื่องให้ได้คอมโบ!',
    'ลองยิง GOOD รัว ๆ แบบนิ่ง ๆ',
    'คอมโบสูง = คะแนนพุ่ง!'
  ],
  useShield: [
    'มีโล่แล้ว! ใช้กันพลาดได้',
    'เห็น 🛡️ รีบเก็บไว้ก่อน',
    'โล่ช่วยเซฟตอน JUNK โผล่'
  ],
  lowTime: [
    'ใกล้หมดเวลา! โฟกัส GOOD',
    'เหลือไม่กี่วิ! ยิงแบบชัวร์',
    'รีบแต่ไม่ลน เลือก GOOD'
  ]
};

function heuristicRisk(snap){
  const shots = Math.max(0, Number(snap.shots||0));
  const miss  = Math.max(0, Number(snap.miss||0));
  const hitJunk = Math.max(0, Number(snap.hitJunk||snap.hitsJunk||0));
  const combo = Math.max(0, Number(snap.combo||0));
  const rt = Number(snap.medianRtGoodMs||0);

  const missRate = shots>0 ? miss/shots : 0;
  const junkRate = shots>0 ? hitJunk/shots : 0;

  let risk = 0.15 + missRate*0.9 + junkRate*0.6;
  if(rt>0 && rt<750) risk -= 0.10;
  if(combo>=10) risk -= 0.10;
  return clamp(risk, 0, 1);
}

export function createGoodJunkAI(opts = {}){
  const seed = String(opts.seed || Date.now());
  const pid  = String(opts.pid || 'anon');
  const diff = String(opts.diff || 'normal');
  const view = String(opts.view || 'mobile');

  // allow custom weights from localStorage (optional)
  let weights = DEFAULT_WEIGHTS;
  try{
    const raw = localStorage.getItem('HHA_GJ_MODEL_W') || '';
    if(raw){
      const j = JSON.parse(raw);
      if(j && typeof j === 'object') weights = Object.assign({}, DEFAULT_WEIGHTS, j);
    }
  }catch(_){}

  const rng = makeRng(`${seed}::${pid}::${diff}::${view}`);

  const st = {
    lastHintAt: 0,
    lastRisk: 0,
    lastHint: '',
    // director knobs (read by game if you want)
    director: { junkBiasDelta: 0, spawnRateMul: 1 }
  };

  function chooseHint(snap, risk){
    const timeLeft = Number(snap.timeLeftSec||0);
    const timeAll  = Math.max(1, Number(snap.timeAllSec||80));
    const timeLeftNorm = timeLeft / timeAll;

    const shield = Number(snap.shield||0);
    const combo = Number(snap.combo||0);
    const hitJunk = Number(snap.hitJunk||snap.hitsJunk||0);
    const shots = Number(snap.shots||0);
    const junkRate = shots>0 ? (hitJunk/shots) : 0;

    if(timeLeftNorm <= 0.10) return pick(rng, HINTS.lowTime);
    if(shield <= 0 && risk >= 0.55) return pick(rng, HINTS.useShield);
    if(junkRate >= 0.22) return pick(rng, HINTS.avoidJunk);
    if(combo < 6 && risk <= 0.55) return pick(rng, HINTS.buildCombo);
    return pick(rng, HINTS.calm);
  }

  // Director: “ยุติธรรมแต่เดือด” (ปรับเล็กน้อย ไม่สวิง)
  function updateDirector(snap, risk){
    const miss = Number(snap.miss||0);
    const shots = Math.max(1, Number(snap.shots||1));
    const missRate = miss/shots;

    // Base: hard > normal > easy
    let spawnMul = (diff==='hard') ? 1.08 : (diff==='easy') ? 0.92 : 1.00;
    let junkDelta = (diff==='hard') ? +0.02 : (diff==='easy') ? -0.03 : 0.00;

    // If kid is struggling, ease junk slightly (still challenging)
    if(missRate > 0.35 && shots > 12){
      junkDelta -= 0.03;
      spawnMul *= 0.98;
    }

    // If kid is crushing it, spice it up a bit
    if(risk < 0.28 && shots > 14){
      junkDelta += 0.03;
      spawnMul *= 1.03;
    }

    // Clamp deltas (gentle)
    st.director.junkBiasDelta = clamp(junkDelta, -0.08, +0.08);
    st.director.spawnRateMul  = clamp(spawnMul, 0.88, 1.15);
  }

  // Main API used by goodjunk.safe.js
  function maybeHint(snap = {}){
    const t = nowMs();

    // Predict risk
    let out;
    try{
      out = predictRisk(Object.assign({}, snap, { diff }), weights);
    }catch(_){
      out = { risk: heuristicRisk(snap), z: 0, x: {} };
    }

    const risk = clamp(out.risk, 0, 1);
    st.lastRisk = risk;

    // Update director knobs every call
    updateDirector(snap, risk);

    // Rate limit hint: at most once per ~2.3s (kid-friendly)
    const coolMs = 2300;
    if(t - st.lastHintAt < coolMs){
      return { risk, hint: st.lastHint, top: [], director: st.director, x: out.x };
    }

    // Show hint when risk is meaningful OR on low-time OR after miss spikes
    const miss = Number(snap.miss||0);
    const shots = Math.max(1, Number(snap.shots||1));
    const missRate = miss/shots;
    const timeLeft = Number(snap.timeLeftSec||0);

    const shouldHint = (risk >= 0.45) || (timeLeft <= 6) || (missRate >= 0.30 && shots > 10);

    if(!shouldHint){
      st.lastHint = '';
      return { risk, hint: '', top: [], director: st.director, x: out.x };
    }

    const hint = chooseHint(snap, risk);
    st.lastHintAt = t;
    st.lastHint = hint;

    return { risk, hint, top: [], director: st.director, x: out.x };
  }

  return {
    maybeHint,
    get director(){ return st.director; },
    get weights(){ return weights; }
  };
}