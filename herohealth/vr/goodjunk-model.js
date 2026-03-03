// === /herohealth/vr/goodjunk-model.js ===
// GoodJunk lightweight model runtime (LogReg) + weights loader
// FULL v20260303-GOODJUNK-MODEL-LOADER
'use strict';

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
function sigmoid(z){ z = clamp(z, -40, 40); return 1 / (1 + Math.exp(-z)); }

export async function loadGoodJunkWeights(url){
  url = String(url || '').trim();
  if(!url) throw new Error('weights url required');

  const res = await fetch(url, { cache:'no-store' });
  if(!res.ok) throw new Error(`weights fetch failed: HTTP ${res.status}`);
  const j = await res.json();

  // minimal validation
  if(!j || typeof j !== 'object') throw new Error('weights invalid');
  if(typeof j.bias !== 'number') j.bias = Number(j.bias || 0) || 0;
  if(!Array.isArray(j.features)) throw new Error('weights.features missing');
  j.features = j.features
    .map(f=>({ name:String(f.name||'').trim(), w:Number(f.w||0)||0 }))
    .filter(f=>!!f.name);

  // optional meta
  j.model = String(j.model || 'logreg');
  j.version = String(j.version || 'v1');
  j.updatedAt = String(j.updatedAt || '');
  j.notes = String(j.notes || '');

  return j;
}

export function makeGoodJunkModel(weights){
  weights = weights || {};
  const bias = Number(weights.bias||0)||0;
  const feats = Array.isArray(weights.features) ? weights.features : [];
  const minmax = (weights.minmax && typeof weights.minmax==='object') ? weights.minmax : null;

  function getVal(x, k){
    let v = Number(x && (x[k] != null ? x[k] : 0));
    if(!Number.isFinite(v)) v = 0;
    // optional normalization if minmax provided
    if(minmax && minmax[k] && typeof minmax[k]==='object'){
      const lo = Number(minmax[k].min);
      const hi = Number(minmax[k].max);
      if(Number.isFinite(lo) && Number.isFinite(hi) && hi > lo){
        v = (v - lo) / (hi - lo);
        v = clamp(v, 0, 1);
      }
    }
    return v;
  }

  return {
    predict(x){
      let z = bias;
      for(const f of feats){
        const v = getVal(x, f.name);
        z += (Number(f.w||0)||0) * v;
      }
      return sigmoid(z);
    }
  };
}