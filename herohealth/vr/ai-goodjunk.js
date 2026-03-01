// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI — Multi-Head Prediction (A+B+C) + ML/DL hooks (research-safe, deterministic)
// Heads:
//  A) pMissNext5s (0..1) : probability of a miss in next ~5s
//  B) riskType: 'junk'|'slow'|'mixed'|'ok' + riskBreakdown
//  C) predGrade: 'S'|'A'|'B'|'C'|'D' (approx) + predScoreFinal (optional)
// Core outputs returned by onTick():
//  { hazardRisk, pMissNext5s, riskType, riskBreakdown, predGrade, nextWatchout, next5, meta, stats }
// ML/DL:
//  opts.model can be:
//   - function(features)-> {hazardRisk?, pMissNext5s?, riskType?, predGrade?, ...}
//   - object with predict(features)-> same shape
//
// FULL v20260301-AI-GOODJUNK-ABC-MULTIHEAD
'use strict';

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
function sigmoid(x){ x = Number(x)||0; return 1/(1+Math.exp(-x)); }

// ---------- deterministic RNG (xmur3 + sfc32) ----------
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

// ---------- feature builder ----------
function buildFeatures(st){
  // st comes from game tick: { missGoodExpired, missJunkHit, shield, fever, combo, shots?, hits?, tLeft?, plannedSec?, score? }
  const missGood = Number(st?.missGoodExpired||0);
  const missJunk = Number(st?.missJunkHit||0);
  const shield   = Number(st?.shield||0);
  const fever    = Number(st?.fever||0);
  const combo    = Number(st?.combo||0);

  const shots = Number(st?.shots||0);
  const hits  = Number(st?.hits||0);
  const score = Number(st?.score||0);

  const tLeft = Number(st?.tLeft||0);
  const plannedSec = Number(st?.plannedSec||0);
  const playedSec = Math.max(1, plannedSec - tLeft);

  const missTotal = missGood + missJunk;
  const accPct = shots>0 ? (hits/shots)*100 : 0;

  return {
    // raw
    missGoodExpired: missGood,
    missJunkHit: missJunk,
    missTotal,
    shield, fever, combo,
    shots, hits, accPct,
    score,
    tLeft, plannedSec, playedSec,

    // normalized
    nMiss: clamp(missTotal/10, 0, 1),
    nJunk: clamp(missJunk/8, 0, 1),
    nGood: clamp(missGood/8, 0, 1),
    nShield: clamp(shield/6, 0, 1),
    nFever: clamp(fever/100, 0, 1),
    nCombo: clamp(combo/10, 0, 1),
    nAcc: clamp(accPct/100, 0, 1),
    nSps: clamp((score/playedSec)/20, 0, 1), // rough scale
    phase: (plannedSec>0) ? clamp(playedSec/plannedSec, 0, 1) : 0
  };
}

// ---------- baseline explainable heads ----------
function baseHazardRisk(f){
  // 0..1: general hazard now
  let r =
    0.45*f.nJunk +
    0.28*f.nGood +
    0.22*(1 - f.nShield) +
    0.10*(1 - f.nFever) +
    0.06*(1 - f.nCombo);

  r += 0.12 * clamp((f.nJunk*f.nGood)*2.2, 0, 1);
  return clamp(r, 0, 1);
}

function basePMissNext5s(f){
  // A) probability of a miss within next ~5 seconds
  // logistic-ish on key signals: recent misses, low shield, low combo, low acc
  const x =
    1.25*(f.nMiss) +
    0.85*(f.nJunk) +
    0.55*(f.nGood) +
    0.75*(1 - f.nShield) +
    0.45*(1 - f.nCombo) +
    0.55*(1 - f.nAcc) +
    0.20*(f.phase); // later phase slightly more chaotic
  // shift so early game doesn't always look risky
  return clamp(sigmoid(1.8*(x - 1.15)), 0, 1);
}

function baseRiskType(f){
  // B) classify main risk driver
  const junkRisk = 0.65*f.nJunk + 0.25*(1 - f.nShield) + 0.15*(1 - f.nAcc);
  const slowRisk = 0.65*f.nGood + 0.20*(1 - f.nCombo) + 0.15*(1 - f.nAcc);

  let type = 'ok';
  const hi = Math.max(junkRisk, slowRisk);
  if(hi >= 0.55){
    if(Math.abs(junkRisk - slowRisk) <= 0.12) type = 'mixed';
    else type = (junkRisk > slowRisk) ? 'junk' : 'slow';
  }

  return {
    riskType: type,
    riskBreakdown: {
      junkRisk: clamp(junkRisk, 0, 1),
      slowRisk: clamp(slowRisk, 0, 1)
    }
  };
}

function gradeFromPred(f){
  // C) predicted grade (approx) based on current pace + penalties
  // rough score-per-sec + miss penalty and acc
  const sps = (f.score / Math.max(1, f.playedSec));
  const pen = f.missTotal * 6;
  const x = sps*10 - pen*0.4 + (f.accPct-70)*0.15; // nudge by acc
  if(x >= 70) return 'S';
  if(x >= 55) return 'A';
  if(x >= 40) return 'B';
  if(x >= 28) return 'C';
  return 'D';
}

function watchoutText(f, heads){
  const rt = heads?.riskType || 'ok';
  if(rt === 'junk') return 'เสี่ยงโดน JUNK—หา 🛡️ และเลี่ยง 🍔🍟';
  if(rt === 'slow') return 'ช้าไปของดีหาย—เร่งเก็บ GOOD ให้ไวขึ้น';
  if(rt === 'mixed') return 'พลาดได้ทั้งสองแบบ—ชะลอเล็ง + หาโล่';
  if(f.fever >= 85) return 'FEVER ใกล้เต็ม—เน้นของดีต่อเนื่อง';
  return 'โฟกัสของดี + เลี่ยงของเสีย';
}

// ---------- ML/DL model wrapper ----------
function safePredictModel(model, features){
  // model output shape may partially fill heads
  try{
    if(!model) return null;
    const out =
      (typeof model === 'function') ? model(features) :
      (typeof model.predict === 'function') ? model.predict(features) :
      null;
    if(!out || typeof out !== 'object') return null;
    return out;
  }catch(e){
    return null;
  }
}

export function createGoodJunkAI(opts){
  opts = opts || {};
  const seed = String(opts.seed || Date.now());
  const pid  = String(opts.pid || 'anon');
  const diff = String(opts.diff || 'normal');
  const view = String(opts.view || 'mobile');

  // Deterministic rng for UI hints only
  const rng = makeRng(`GJ_AI:${seed}:${pid}:${diff}:${view}`);

  // Internal state
  let lastPred = null;
  let inputs = {
    missGoodExpired: 0,
    missJunkHit: 0,
    shield: 0,
    fever: 0,
    combo: 0,
    // optional extras (if provided by game)
    shots: 0,
    hits: 0,
    score: 0,
    tLeft: 0,
    plannedSec: 0
  };

  const stats = { spawns: 0, hits: 0, expires: 0, lastEvent: '', lastTs: Date.now() };

  // Optional ML/DL model injection
  const model = opts.model || null;

  function getNext5(){
    const out = [];
    for(let i=0;i<5;i++){
      const p = rng();
      if(p < 0.58) out.push('GOOD');
      else if(p < 0.82) out.push('JUNK');
      else if(p < 0.94) out.push('BONUS');
      else out.push('SHIELD');
    }
    return out;
  }

  function onSpawn(kind){
    stats.spawns++;
    stats.lastEvent = `spawn:${String(kind||'')}`;
    stats.lastTs = Date.now();
  }
  function onHit(kind){
    stats.hits++;
    stats.lastEvent = `hit:${String(kind||'')}`;
    stats.lastTs = Date.now();
  }
  function onExpire(kind){
    stats.expires++;
    stats.lastEvent = `expire:${String(kind||'')}`;
    stats.lastTs = Date.now();
  }

  function updateInputs(partial){
    try{
      partial = partial || {};
      for(const k of Object.keys(inputs)){
        if(partial[k] != null) inputs[k] = Number(partial[k]) || 0;
      }
    }catch(e){}
  }

  function onTick(dt, st){
    updateInputs(st);

    const f = buildFeatures(inputs);

    // Baseline heads
    const hazardRisk = baseHazardRisk(f);
    const pMissNext5s = basePMissNext5s(f);
    const B = baseRiskType(f);
    const predGrade = gradeFromPred(f);

    // Model override (optional)
    const m = safePredictModel(model, f);
    const useModel = !!m;

    const out = {
      hazardRisk: (m && m.hazardRisk!=null) ? clamp(m.hazardRisk,0,1) : hazardRisk,
      pMissNext5s: (m && m.pMissNext5s!=null) ? clamp(m.pMissNext5s,0,1) : pMissNext5s,
      riskType: (m && m.riskType) ? String(m.riskType) : B.riskType,
      riskBreakdown: (m && m.riskBreakdown && typeof m.riskBreakdown==='object')
        ? {
            junkRisk: clamp(m.riskBreakdown.junkRisk ?? B.riskBreakdown.junkRisk, 0, 1),
            slowRisk: clamp(m.riskBreakdown.slowRisk ?? B.riskBreakdown.slowRisk, 0, 1),
          }
        : B.riskBreakdown,
      predGrade: (m && m.predGrade) ? String(m.predGrade) : predGrade,

      next5: getNext5(),
      nextWatchout: '',
      meta: {
        src: useModel ? 'model' : 'explainable',
        pid, diff, view
      },
      stats: {
        spawns: stats.spawns,
        hits: stats.hits,
        expires: stats.expires
      }
    };

    out.nextWatchout = (m && m.nextWatchout) ? String(m.nextWatchout) : watchoutText(f, out);

    lastPred = out;
    return out;
  }

  function onEnd(summary){
    try{
      return { predictionLast: lastPred || null, meta:{ pid,diff,view,seed }, stats:{...stats} };
    }catch(e){ return null; }
  }

  function getPrediction(){ return lastPred; }

  return { onSpawn, onHit, onExpire, onTick, onEnd, getPrediction, updateInputs };
}
