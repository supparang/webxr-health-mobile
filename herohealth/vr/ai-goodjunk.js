// === /webxr-health-mobile/herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI — Prediction + Multi-objective Director (spawn/junk/aimAssist)
// FULL v20260302-AI-GJ-DIRECTOR
'use strict';

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }

// deterministic tiny RNG (optional)
function xfnv1a(str){
  let h = 2166136261 >>> 0;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGoodJunkAI(cfg){
  cfg = cfg || {};
  const seed = String(cfg.seed || Date.now());
  const pid  = String(cfg.pid  || 'anon');
  const diff = String(cfg.diff || 'normal');
  const view = String(cfg.view || 'mobile');

  const rnd = mulberry32(xfnv1a(`AI-GJ::${seed}::${pid}::${diff}::${view}`));

  // Director outputs (read by game)
  const director = {
    spawnRateMul: 1.00,
    junkBiasDelta: 0.00,
    lockPx: 52, // aim assist radius for cVR/tap rescue
  };

  // internal smoothing state
  let lastHintAt = 0;
  let emaRisk = 0.25;

  function logistic(x){ return 1 / (1 + Math.exp(-x)); }

  // “risk prediction” (heuristic but DL-ready features)
  function predictRisk(snap){
    // snap: shots, shotsMiss, miss, hitJunk, combo, timeLeftSec, medianRtGoodMs, feverPct, shield, bossOn, bossHp
    const tLeft = clamp(snap.timeLeftSec ?? 0, 0, 999);
    const tAll  = clamp(snap.timeAllSec ?? 80, 20, 300);
    const tFrac = (tAll>0) ? (tLeft / tAll) : 1;

    const shots = clamp(snap.shots ?? 0, 0, 1e9);
    const missAttempt = clamp(snap.shotsMiss ?? 0, 0, 1e9);
    const miss = clamp(snap.miss ?? 0, 0, 1e9);
    const junk = clamp(snap.hitJunk ?? 0, 0, 1e9);

    const combo = clamp(snap.combo ?? 0, 0, 999);
    const rt = clamp(snap.medianRtGoodMs ?? 0, 0, 4000);

    const fever = clamp(snap.feverPct ?? 0, 0, 100);
    const shield = clamp(snap.shield ?? 0, 0, 3);

    const attemptRate = shots>0 ? (missAttempt/shots) : 0;
    const junkRate = shots>0 ? (junk/shots) : 0;

    // weighted features
    let x =
      + 2.2*(attemptRate - 0.22)
      + 1.8*(junkRate - 0.10)
      + 0.035*(rt - 520)
      + 0.18*(miss - 3)
      - 0.12*(combo)
      - 0.018*(fever - 30)
      - 0.25*(shield);

    // boss makes harder
    if(snap.bossOn) x += 0.55;
    if(snap.bossOn && (snap.bossHp ?? 100) > 65) x += 0.25;

    // late game pressure
    if(tFrac < 0.25) x += 0.35;

    const r = clamp(logistic(x), 0, 1);
    // smooth
    emaRisk = clamp(emaRisk*0.72 + r*0.28, 0, 1);
    return emaRisk;
  }

  function updateDirector(snap, risk){
    // Multi-objective:
    // - If risk high: slightly slow spawn + reduce junk + widen lock
    // - If risk low and combo high: speed spawn + a bit more junk + narrow lock
    const combo = clamp(snap.combo ?? 0, 0, 999);
    const fever = clamp(snap.feverPct ?? 0, 0, 100);
    const bossOn = !!snap.bossOn;

    // baseline per difficulty
    const baseSpawn =
      diff==='hard' ? 1.06 :
      diff==='easy' ? 0.96 : 1.00;

    let spawn = baseSpawn;
    let junkBias = 0.00;
    let lockPx = (view==='cvr' || view==='vr') ? 52 : 44; // tap rescue default tighter

    // risk response
    spawn += (0.28 - risk) * 0.22;               // risk↑ => spawn↓
    junkBias += (0.25 - risk) * 0.10;            // risk↑ => junk↓
    lockPx += (risk - 0.30) * 42;                // risk↑ => lock wider

    // combo/fever flow (keep exciting for strong players)
    if(combo >= 8) { spawn += 0.04; lockPx -= 4; }
    if(combo >= 12){ spawn += 0.05; junkBias += 0.02; lockPx -= 6; }
    if(fever >= 60){ lockPx -= 4; }              // fever on = reward precision

    // boss adjustments
    if(bossOn){
      spawn += 0.04;
      lockPx += 2; // small assist only
    }

    // clamp to safe ranges
    director.spawnRateMul = clamp(spawn, 0.90, 1.18);
    director.junkBiasDelta = clamp(junkBias, -0.08, 0.10);
    director.lockPx = Math.round(clamp(lockPx, 32, 78));
  }

  function makeHintText(risk, snap){
    const bossOn = !!snap.bossOn;
    if(bossOn && risk > 0.55) return 'โฟกัสของดีต่อเนื่อง! เลี่ยงของหวาน 🧋🍟';
    if(risk > 0.62) return 'ช้า-แต่ชัวร์: มองก่อนกด (อย่าเผลอโดน junk)';
    if(risk > 0.45) return 'คุมจังหวะ + ล็อกกลางจอให้แม่น';
    if(risk < 0.28) return 'โหดได้! เร่งคอมโบต่อเนื่อง 🚀';
    return 'รักษาคอมโบ + เก็บของดีให้ครบ';
  }

  function maybeHint(snap){
    const t = Date.now();
    // rate-limit hints (avoid spam)
    if(t - lastHintAt < 900) return null;
    lastHintAt = t;

    const risk = predictRisk(snap);
    updateDirector(snap, risk);

    // output
    return {
      risk,
      hint: makeHintText(risk, snap),
      director: { ...director }
    };
  }

  return {
    director,
    maybeHint
  };
}