// === /webxr-health-mobile/herohealth/vr/goodjunk-model.js ===
// GoodJunk Model Runtime — baseline interface for ML/DL later
// This file is the "stable contract" between browser game and any ML/DL export.
// FULL v20260301-MODEL-RUNTIME
'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

// ---- Feature builder (keep deterministic + explainable) ----
export function featurizeGoodJunkTick(s){
  // Keep features numeric + stable order
  // Note: you can extend later; but keep backward-compat with exported models.
  const missGoodExpired = Number(s?.missGoodExpired||0);
  const missJunkHit     = Number(s?.missJunkHit||0);
  const shield          = Number(s?.shield||0);
  const fever           = Number(s?.fever||0);
  const combo           = Number(s?.combo||0);
  const t               = Number(s?.t||0);

  return {
    // time
    t,

    // performance / errors
    missGoodExpired,
    missJunkHit,

    // resources
    shield: clamp(shield, 0, 9),
    fever: clamp(fever, 0, 100),

    // skill proxy
    combo: clamp(combo, 0, 99),

    // context encodings (simple)
    diff_easy: String(s?.diff||'').toLowerCase()==='easy' ? 1 : 0,
    diff_hard: String(s?.diff||'').toLowerCase()==='hard' ? 1 : 0,
    view_cvr:  String(s?.view||'').toLowerCase()==='cvr' ? 1 : 0,
    view_vr:   String(s?.view||'').toLowerCase()==='vr'  ? 1 : 0
  };
}

// ---- Model loader ----
// Strategy:
// 1) Load a JSON model file if exists (exported from train_goodjunk.py)
// 2) Otherwise return a built-in baseline (heuristic-ish linear model)
export async function loadGoodJunkModel(opts){
  opts = opts || {};
  const baseUrl = String(opts.baseUrl || './'); // e.g. '../vr/'
  const variant = String(opts.variant || 'baseline'); // baseline | dl | ...
  const url = `${baseUrl}models/goodjunk-${variant}.json`;

  // try fetch model json
  try{
    const r = await fetch(url, { cache:'no-store' });
    if(r.ok){
      const j = await r.json();
      return buildModelFromJson(j);
    }
  }catch(e){}

  // fallback baseline
  return buildBaselineModel();
}

function buildModelFromJson(j){
  // minimal supported format:
  // { name, type:"linear", bias, weights:{feature:weight,...}, nextHints:[...]}
  const name = String(j?.name || 'goodjunk-json');
  const type = String(j?.type || 'linear');

  if(type === 'linear'){
    const bias = Number(j?.bias || 0);
    const weights = (j && typeof j.weights==='object') ? j.weights : {};
    const nextHints = Array.isArray(j?.nextHints) ? j.nextHints : [];
    return {
      name,
      type,
      predict(x){
        let z = bias;
        for(const k of Object.keys(weights)){
          z += (Number(weights[k])||0) * (Number(x?.[k])||0);
        }
        // sigmoid
        const hazardRisk = 1/(1+Math.exp(-z));
        const next5 = (nextHints && nextHints.length) ? nextHints.slice(0,5) : defaultHints(x, hazardRisk);
        return { hazardRisk: clamp(hazardRisk,0,1), next5 };
      }
    };
  }

  // unknown -> baseline
  return buildBaselineModel();
}

function defaultHints(x, hazardRisk){
  const out = [];
  if((x?.shield||0) <= 0) out.push('🛡️ หาโล่ก่อน');
  if((x?.missJunkHit||0) >= 2) out.push('🍟🍔 เลี่ยงของเสีย');
  if((x?.missGoodExpired||0) >= 2) out.push('⏱ เร็วขึ้น: ของดีหาย');
  if((x?.combo||0) >= 6) out.push('🎯 อย่าโลภ ยิงชัวร์');
  if(!out.length) out.push(hazardRisk>0.55 ? '⚠️ ชะลอจังหวะ' : '✅ คุมจังหวะดีมาก');
  while(out.length<5) out.push('—');
  return out.slice(0,5);
}

function buildBaselineModel(){
  // A simple linear+sigmoid baseline
  // (weights are chosen to be sensible; you will replace with trained export later)
  const weights = {
    missJunkHit: 0.55,
    missGoodExpired: 0.35,
    shield: -0.18,
    combo: 0.06,
    fever: 0.01,
    diff_hard: 0.25,
    view_cvr: 0.12
  };
  const bias = -0.9;

  return {
    name: 'baseline-linear-v1',
    type: 'linear',
    predict(x){
      let z = bias;
      for(const k of Object.keys(weights)){
        z += (weights[k]||0) * (Number(x?.[k])||0);
      }
      const hazardRisk = 1/(1+Math.exp(-z));
      return { hazardRisk: clamp(hazardRisk,0,1), next5: defaultHints(x, hazardRisk) };
    }
  };
}
