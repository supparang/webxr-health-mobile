// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI — Prediction + ML/DL hooks (research-safe, deterministic)
// Provides:
//  - onSpawn(kind, meta)
//  - onHit(kind, meta)
//  - onExpire(kind, meta)
//  - onTick(dt, state) => { hazardRisk, nextWatchout, next5, meta, stats }
//  - onEnd(summary)
//  - getPrediction()
//  - updateInputs(partial)
//
// Notes:
// - This v1 uses a deterministic, explainable predictor (not adaptive difficulty).
// - ML/DL is supported via optional injected model (predict(features)->risk).
//
// FULL v20260301-AI-GOODJUNK-PREDICTOR-MLHOOKS
'use strict';

function clamp(v, a, b){ v = Number(v); if(!Number.isFinite(v)) v = a; return Math.max(a, Math.min(b, v)); }

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
  // Inputs are from game tick: { missGoodExpired, missJunkHit, shield, fever, combo }
  const missGood = Number(st?.missGoodExpired||0);
  const missJunk = Number(st?.missJunkHit||0);
  const shield   = Number(st?.shield||0);
  const fever    = Number(st?.fever||0);
  const combo    = Number(st?.combo||0);

  // Derived
  const missTotal = missGood + missJunk;

  return {
    missGoodExpired: missGood,
    missJunkHit: missJunk,
    missTotal,
    shield,
    fever,
    combo,
    // Normalized
    nMiss: clamp(missTotal/10, 0, 1),
    nJunk: clamp(missJunk/8, 0, 1),
    nGood: clamp(missGood/8, 0, 1),
    nShield: clamp(shield/6, 0, 1),
    nFever: clamp(fever/100, 0, 1),
    nCombo: clamp(combo/10, 0, 1),
  };
}

// ---------- explainable predictor (baseline) ----------
function explainableRisk(feat){
  // Intuition:
  // - More junk hits and expired good => higher risk
  // - Low shield => higher risk
  // - High combo + high fever => lower risk
  // This is NOT difficulty adaptation. Just predictive signal for HUD/coaching.
  const junk = feat.nJunk;
  const good = feat.nGood;
  const shield = feat.nShield;
  const fever = feat.nFever;
  const combo = feat.nCombo;

  // Weighted sum
  let r =
    0.45*junk +
    0.28*good +
    0.22*(1 - shield) +
    0.10*(1 - fever) +
    0.06*(1 - combo);

  // Slight non-linearity: punish if both miss types are high
  r += 0.12 * clamp((feat.nJunk*feat.nGood)*2.2, 0, 1);

  return clamp(r, 0, 1);
}

// ---------- watchout text ----------
function watchoutFrom(feat){
  if(feat.shield <= 0 && feat.missJunkHit >= 2) return 'หา 🛡️ ก่อน—กัน JUNK';
  if(feat.missGoodExpired >= 2) return 'เร่งเก็บของดี—อย่าปล่อยหาย';
  if(feat.combo <= 1 && feat.missTotal >= 3) return 'ชะลอมือ—เล็งก่อนแตะ';
  if(feat.fever >= 85) return 'FEVER ใกล้เต็ม—เน้นของดี';
  return 'โฟกัสของดี + เลี่ยงของเสีย';
}

// ---------- optional ML/DL model wrapper ----------
function safePredictModel(model, feat){
  // model can be:
  // - function(feat)->risk
  // - object with predict(feat)->risk
  try{
    if(!model) return null;
    if(typeof model === 'function') return clamp(model(feat), 0, 1);
    if(typeof model.predict === 'function') return clamp(model.predict(feat), 0, 1);
  }catch(e){}
  return null;
}

export function createGoodJunkAI(opts){
  opts = opts || {};
  const seed = String(opts.seed || Date.now());
  const pid  = String(opts.pid || 'anon');
  const diff = String(opts.diff || 'normal');
  const view = String(opts.view || 'mobile');

  // Deterministic rng for “next5 hint”
  // (Not the same as game spawn RNG; it’s a stable forecast channel for UI hints only.)
  const rng = makeRng(`GJ_AI:${seed}:${pid}:${diff}:${view}`);

  // Internal state
  let lastPred = null;
  let inputs = {
    missGoodExpired: 0,
    missJunkHit: 0,
    shield: 0,
    fever: 0,
    combo: 0
  };

  // Basic stats (for research logging / debugging)
  const stats = {
    spawns: 0,
    hits: 0,
    expires: 0,
    lastEvent: '',
    lastTs: Date.now()
  };

  // Optional ML/DL model injection
  // You can inject later: createGoodJunkAI({ model: yourModel })
  const model = opts.model || null;

  function getNext5(){
    // Just a stable “attention cue”, not tied to actual spawns.
    // Keeps UI from being blank; also deterministic for research.
    const pool = ['GOOD','JUNK','BONUS','SHIELD'];
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

  function onSpawn(kind, meta){
    stats.spawns++;
    stats.lastEvent = `spawn:${String(kind||'')}`;
    stats.lastTs = Date.now();
    // no adaptive behavior
  }

  function onHit(kind, meta){
    stats.hits++;
    stats.lastEvent = `hit:${String(kind||'')}`;
    stats.lastTs = Date.now();
    // if blocked junk, do nothing special; predictor reads shield/miss from game tick anyway
  }

  function onExpire(kind, meta){
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
    // Merge tick state into inputs (authoritative from game)
    updateInputs(st);

    const feat = buildFeatures(inputs);

    // 1) Model risk (if available)
    const mRisk = safePredictModel(model, feat);

    // 2) Explainable fallback
    const eRisk = explainableRisk(feat);

    // Choose model if exists, else fallback
    const hazardRisk = (mRisk == null) ? eRisk : mRisk;

    const next5 = getNext5();
    const nextWatchout = watchoutFrom(feat);

    lastPred = {
      hazardRisk,
      nextWatchout,
      next5,
      // small meta only (keep it light)
      meta: {
        src: (mRisk == null) ? 'explainable' : 'model',
        pid, diff, view
      },
      stats: {
        spawns: stats.spawns,
        hits: stats.hits,
        expires: stats.expires
      }
    };

    return lastPred;
  }

  function onEnd(summary){
    // return a small AI pack for end summary (no huge arrays)
    try{
      return {
        predictionLast: lastPred || null,
        meta: { pid, diff, view, seed },
        stats: { ...stats }
      };
    }catch(e){
      return null;
    }
  }

  function getPrediction(){
    return lastPred;
  }

  return {
    onSpawn,
    onHit,
    onExpire,
    onTick,
    onEnd,
    getPrediction,
    updateInputs
  };
}
