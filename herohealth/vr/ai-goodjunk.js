// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI (Prediction-only) — deterministic, research-safe
// PATCH v20260303-AI-PRED-MLP-FALLBACK
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
function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=0; return v<a?a:(v>b?b:v); }
function sigmoid(x){ x = Number(x)||0; if(x<-30) return 0; if(x>30) return 1; return 1/(1+Math.exp(-x)); }
function tanh(x){ x = Number(x)||0; if(Math.tanh) return Math.tanh(x); const e2=Math.exp(2*x); return (e2-1)/(e2+1); }

async function loadWeights(){
  // same folder: /herohealth/vr/goodjunk_weights.json
  // cache bust via v=
  const url = new URL('./goodjunk_weights.json', import.meta.url);
  url.searchParams.set('v', '20260303');
  const res = await fetch(url.toString(), { cache:'no-store' });
  if(!res.ok) throw new Error('weights fetch failed: ' + res.status);
  const json = await res.json();
  return json;
}

function normalizeMinMax(x, minArr, maxArr){
  const out = new Array(x.length);
  for(let i=0;i<x.length;i++){
    const mn = Number(minArr[i] ?? 0);
    const mx = Number(maxArr[i] ?? 1);
    const v  = Number(x[i] ?? 0);
    const den = (mx - mn) || 1;
    out[i] = clamp((v - mn) / den, 0, 1);
  }
  return out;
}

function mlpPredict01(weights, featVec){
  const mlp = weights?.mlp;
  const norm = weights?.normalizer;

  if(!mlp || !norm) throw new Error('bad weights');

  const minArr = norm?.min || [];
  const maxArr = norm?.max || [];
  const x0 = normalizeMinMax(featVec, minArr, maxArr);

  const W1 = mlp.W1 || [];
  const b1 = mlp.b1 || [];
  const W2 = mlp.W2 || [];
  const b2 = Number(mlp.b2 ?? 0);

  // h = tanh(W1*x + b1)
  const h = new Array(W1.length);
  for(let j=0;j<W1.length;j++){
    const row = W1[j] || [];
    let s = Number(b1[j] ?? 0);
    for(let i=0;i<x0.length;i++){
      s += (Number(row[i] ?? 0) * Number(x0[i] ?? 0));
    }
    h[j] = tanh(s);
  }

  // y = sigmoid(W2·h + b2)
  let y = b2;
  for(let j=0;j<h.length;j++){
    y += Number(W2[j] ?? 0) * Number(h[j] ?? 0);
  }
  return clamp(sigmoid(y), 0, 1);
}

function makeExplainHint(r01, state){
  const shield = Number(state?.shield||0);
  const fever  = Number(state?.fever||0);
  const combo  = Number(state?.combo||0);
  const missG  = Number(state?.missGoodExpired||0);
  const missJ  = Number(state?.missJunkHit||0);
  const storm  = !!state?.stormOn;

  if(shield<=0 && r01()<0.30) return 'หา 🛡️ กันพลาด';
  if(storm && r01()<0.35) return 'Storm แล้ว: โฟกัสของดี';
  if(missJ > missG) return 'เลี่ยง 🍔🍟 ก่อน';
  if(missG >= 2) return 'รีบเก็บ “ของดี”';
  if(combo>=4) return 'รักษาคอมโบไว้!';
  if(fever>=85) return 'ใกล้ FEVER ยิงต่อเนื่อง';
  return (r01()<0.5) ? 'โฟกัสของดี' : 'อย่าเสี่ยงของเสีย';
}

export function createGoodJunkAI(opts){
  opts = opts || {};
  const seed = String(opts.seed || Date.now());
  const rng = makeRng('GJAI:' + seed + ':' + String(opts.pid||'anon'));
  const r01 = ()=> rng();

  // ---- weights (lazy async) ----
  let weights = null;
  let weightsState = 'loading'; // loading|ok|fail
  (async ()=>{
    try{
      weights = await loadWeights();
      weightsState = 'ok';
    }catch(e){
      weights = null;
      weightsState = 'fail';
      console.warn('[GJ AI] weights load failed -> fallback heuristic', e);
    }
  })();

  let lastPred = null;

  // internal EMA (used by heuristic fallback)
  let emaMiss = 0;
  let emaAcc  = 0;
  let emaPace = 0;

  function heuristicRisk(state){
    const shots = Number(state?.shots||0);
    const hits  = Number(state?.hits||0);
    const miss  = Number(state?.missGoodExpired||0) + Number(state?.missJunkHit||0);

    const acc = (shots>0) ? (hits/shots) : 1;
    const missRate = (shots>0) ? (miss/shots) : 0;
    const pace = (shots>0) ? Math.min(6, 0.6 + (shots/60)) : 0.6;

    emaAcc  = emaAcc  * 0.92 + acc * 0.08;
    emaMiss = emaMiss * 0.90 + missRate * 0.10;
    emaPace = emaPace * 0.92 + pace * 0.08;

    const shield = Number(state?.shield||0);
    const fever  = Number(state?.fever||0);
    const combo  = Number(state?.combo||0);

    let risk =
      (emaMiss * 1.35) +
      ((1 - emaAcc) * 0.65) +
      (Math.max(0, emaPace - 1.0) * 0.12);

    risk -= Math.min(0.28, shield * 0.06);
    risk -= Math.min(0.12, (fever/100)*0.10);
    risk -= Math.min(0.10, combo*0.015);

    return clamp(risk, 0, 1);
  }

  function mlpRisk(state){
    // Build features: acc, missRate, pace, shield, fever, combo, stormOn
    const shots = Number(state?.shots||0);
    const hits  = Number(state?.hits||0);
    const miss  = Number(state?.missGoodExpired||0) + Number(state?.missJunkHit||0);

    const acc = (shots>0) ? (hits/shots) : 1;
    const missRate = (shots>0) ? (miss/shots) : 0;
    const pace = (shots>0) ? Math.min(6, 0.6 + (shots/60)) : 0.6;

    const shield = Number(state?.shield||0);
    const fever  = Number(state?.fever||0);
    const combo  = Number(state?.combo||0);
    const stormOn = state?.stormOn ? 1 : 0;

    const feat = [acc, missRate, pace, shield, fever, combo, stormOn];
    return mlpPredict01(weights, feat);
  }

  return {
    onSpawn(kind, meta){},
    onHit(kind, meta){},
    onExpire(kind, meta){},

    onTick(dt, state){
      // choose risk source:
      // 1) if weights OK -> MLP
      // 2) else heuristic
      let risk01 = 0;
      let model = 'heuristic-v1';
      try{
        if(weightsState === 'ok' && weights){
          risk01 = mlpRisk(state);
          model = String(weights?.modelName || 'mlp-v1');
        }else{
          risk01 = heuristicRisk(state);
        }
      }catch(e){
        risk01 = heuristicRisk(state);
        model = 'heuristic-v1';
      }

      const hint = makeExplainHint(r01, state);

      lastPred = {
        model,
        weightsState,
        hazardRisk: +clamp(risk01,0,1).toFixed(2),
        next5: [hint]
      };
      return lastPred;
    },

    onEnd(summary){
      return {
        model: lastPred?.model ?? 'unknown',
        weightsState: lastPred?.weightsState ?? 'unknown',
        hazardRisk: lastPred?.hazardRisk ?? null,
        hint: lastPred?.next5?.[0] ?? null
      };
    },

    getPrediction(){
      return lastPred;
    }
  };
}