// === /herohealth/vr/goodjunk-model.js ===
// GoodJunk Risk Model — PRODUCTION (logreg + z-score scaler + deterministic inference)
// Loads: /herohealth/vr/goodjunk_weights.json
// Exports:
//  - loadGoodJunkModel({weightsUrl})
//  - predictRisk(model, featuresObj) -> { risk01, riskPct, rawLogit, topFactors[] }
// FULL v20260302-GOODJUNK-MODEL
'use strict';

function clamp01(x){
  x = Number(x);
  if(!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : (x > 1 ? 1 : x);
}
function sigmoid(z){
  z = Number(z);
  if(!Number.isFinite(z)) return 0.5;
  // stable-ish
  if(z >= 35) return 1;
  if(z <= -35) return 0;
  return 1 / (1 + Math.exp(-z));
}
function safeNum(x, fb=0){
  x = Number(x);
  return Number.isFinite(x) ? x : fb;
}
function toPct01(x){ return Math.round(clamp01(x) * 100); }

async function fetchJson(url){
  const res = await fetch(url, { cache:'no-store' });
  if(!res.ok) throw new Error(`weights fetch failed: ${res.status}`);
  return await res.json();
}

function buildModel(weightsJson){
  const wj = weightsJson || {};
  const feats = Array.isArray(wj.features) ? wj.features : [];
  const w = Array.isArray(wj.weights) ? wj.weights : [];
  const mean = wj.scaler && Array.isArray(wj.scaler.mean) ? wj.scaler.mean : null;
  const scale = wj.scaler && Array.isArray(wj.scaler.scale) ? wj.scaler.scale : null;

  if(!feats.length || w.length !== feats.length){
    throw new Error('Bad weights: features/weights length mismatch');
  }
  if(!mean || !scale || mean.length !== feats.length || scale.length !== feats.length){
    throw new Error('Bad weights: scaler mean/scale mismatch');
  }

  return {
    schema: String(wj.schema || ''),
    trainedAtIso: String(wj.trainedAtIso || ''),
    notes: String(wj.notes || ''),
    features: feats.slice(),
    bias: safeNum(wj.bias, 0),
    weights: w.slice(),
    scaler: {
      mean: mean.slice(),
      scale: scale.slice()
    }
  };
}

export async function loadGoodJunkModel(opts={}){
  const weightsUrl = String(opts.weightsUrl || './goodjunk_weights.json');
  const j = await fetchJson(weightsUrl);
  return buildModel(j);
}

/**
 * featuresObj keys expected:
 *  miss, hitJunk, accPct, medianRtGoodMs, combo, feverPct, timeLeftSec, bossOn
 */
export function predictRisk(model, featuresObj={}){
  if(!model) return { risk01: 0.5, riskPct: 50, rawLogit: 0, topFactors: [] };

  const feats = model.features;
  const x = [];
  for(let i=0;i<feats.length;i++){
    const k = feats[i];
    // bossOn can be boolean
    let v = featuresObj[k];
    if(k === 'bossOn') v = (v ? 1 : 0);
    x.push(safeNum(v, 0));
  }

  // z-score
  const z = [];
  for(let i=0;i<x.length;i++){
    const mu = safeNum(model.scaler.mean[i], 0);
    const sc = safeNum(model.scaler.scale[i], 1) || 1;
    z.push((x[i] - mu) / sc);
  }

  // logit
  let logit = safeNum(model.bias, 0);
  const contrib = [];
  for(let i=0;i<z.length;i++){
    const c = z[i] * safeNum(model.weights[i], 0);
    logit += c;
    contrib.push({ k: feats[i], c });
  }

  const risk01 = clamp01(sigmoid(logit));
  const riskPct = toPct01(risk01);

  // top factors by absolute contribution
  contrib.sort((a,b)=> Math.abs(b.c) - Math.abs(a.c));
  const top = contrib.slice(0, 4).map(it=>{
    const dir = it.c >= 0 ? '↑' : '↓';
    return { feature: it.k, direction: dir, strength: Math.round(Math.abs(it.c)*100)/100 };
  });

  return { risk01, riskPct, rawLogit: logit, topFactors: top };
}