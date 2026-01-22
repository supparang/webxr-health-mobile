// === ShadowBreaker ML Model (Production) ===
// Logistic Regression inference in JS + feature normalization + optional online calibration
// - Load weights from URL (?model=...) or default ./sb-model.json
// - Exposes: window.SBML = { load(), predict(), hasModel(), modelInfo() }
// - Predicts 3 heads: frustration / fatigue / boredom (0..1)

(function(){
  'use strict';

  const WIN = window;

  function clamp01(x){ x = +x; if(!Number.isFinite(x)) return 0; return Math.max(0, Math.min(1, x)); }
  function sigmoid(z){ return 1/(1+Math.exp(-z)); }
  function safeNum(x, d=0){ x=+x; return Number.isFinite(x)?x:d; }

  // --- Default small hand-tuned weights (works even if no json loaded) ---
  // NOTE: You can replace by offline-trained weights via sb-model.json
  const DEFAULT_MODEL = {
    name: 'sb-logreg-default',
    version: '0.1',
    // feature order matters (must match extractFeatures output keys)
    features: [
      'rtEmaMs','accEma','missEma','combo','comboEma','streakMiss','streakHit',
      'elapsedMin','bossActive','fever',
      'spawnMs','lifeMs','waveChance','lockPx',
      'deltaAcc','deltaRt'
    ],
    norm: { // mean/std for z-score (rough defaults)
      rtEmaMs:   { mean: 650, std: 220 },
      accEma:    { mean: 0.78, std: 0.15 },
      missEma:   { mean: 0.22, std: 0.15 },
      combo:     { mean: 3.5, std: 3.0 },
      comboEma:  { mean: 3.0, std: 2.8 },
      streakMiss:{ mean: 1.0, std: 1.3 },
      streakHit: { mean: 2.0, std: 2.0 },
      elapsedMin:{ mean: 1.5, std: 1.2 },
      bossActive:{ mean: 0.2, std: 0.4 },
      fever:     { mean: 0.15, std: 0.35 },
      spawnMs:   { mean: 700, std: 180 },
      lifeMs:    { mean: 2300, std: 420 },
      waveChance:{ mean: 0.10, std: 0.10 },
      lockPx:    { mean: 28, std: 10 },
      deltaAcc:  { mean: 0.0, std: 0.08 },
      deltaRt:   { mean: 0.0, std: 0.20 }
    },
    heads: {
      frustration: {
        bias: -0.35,
        w: [
          +0.90,  -1.25, +1.40, -0.15, -0.10, +1.10, -0.30,
          +0.25,  +0.15, -0.10,
          +0.30,  +0.25, +0.15, +0.20,
          -0.40,  +0.35
        ]
      },
      fatigue: {
        bias: -0.20,
        w: [
          +1.10,  -0.35, +0.40, -0.10, -0.05, +0.35, -0.15,
          +0.95,  +0.10, +0.25,
          +0.20,  +0.45, +0.10, +0.15,
          -0.20,  +0.60
        ]
      },
      boredom: {
        bias: -0.55,
        w: [
          -0.60,  +1.35, -1.20, +0.55, +0.40, -0.40, +0.85,
          -0.10,  -0.15, +0.15,
          -0.30,  -0.25, +0.55, -0.10,
          +0.65,  -0.40
        ]
      }
    }
  };

  let _model = DEFAULT_MODEL;
  let _loaded = false;
  let _lastF = null;
  let _cal = { // online calibration (optional)
    enabled: true,
    a: { frustration:1, fatigue:1, boredom:1 },
    b: { frustration:0, fatigue:0, boredom:0 }
  };

  function zscore(key, v){
    const n = _model.norm && _model.norm[key];
    if(!n || !Number.isFinite(n.mean) || !Number.isFinite(n.std) || n.std<=0) return v;
    return (v - n.mean) / n.std;
  }

  function vecFromFeatures(obj){
    const feats = _model.features || [];
    const v = new Array(feats.length);
    for(let i=0;i<feats.length;i++){
      const k = feats[i];
      v[i] = zscore(k, safeNum(obj[k], 0));
    }
    return v;
  }

  function dot(w, x){
    let s=0;
    for(let i=0;i<w.length && i<x.length;i++) s += w[i]*x[i];
    return s;
  }

  function headPredict(headName, x){
    const h = _model.heads && _model.heads[headName];
    if(!h) return 0;
    const z = safeNum(h.bias, 0) + dot(h.w||[], x);
    let p = sigmoid(z);

    // optional calibration: p' = sigmoid(a*logit(p) + b)
    if(_cal.enabled){
      const a = safeNum(_cal.a[headName], 1);
      const b = safeNum(_cal.b[headName], 0);
      const eps=1e-6;
      const pp = Math.max(eps, Math.min(1-eps, p));
      const logit = Math.log(pp/(1-pp));
      p = sigmoid(a*logit + b);
    }
    return clamp01(p);
  }

  function predict(featuresObj){
    const x = vecFromFeatures(featuresObj||{});
    const p = {
      frustration: headPredict('frustration', x),
      fatigue:     headPredict('fatigue', x),
      boredom:     headPredict('boredom', x),
    };
    _lastF = featuresObj ? { ...featuresObj } : null;
    return p;
  }

  function modelInfo(){
    return { name:_model.name||'unknown', version:_model.version||'?', loaded:_loaded, features:(_model.features||[]).length };
  }

  async function load(url){
    const u = (url||'').trim() || (new URL(location.href).searchParams.get('model')||'').trim() || './sb-model.json';
    try{
      const res = await fetch(u, { cache:'no-store' });
      if(!res.ok) throw new Error('HTTP '+res.status);
      const json = await res.json();
      // basic validation
      if(!json || !Array.isArray(json.features) || !json.heads) throw new Error('Bad model schema');
      _model = json;
      _loaded = true;
      return true;
    }catch(err){
      console.warn('[SBML] load failed, using default weights:', err);
      _model = DEFAULT_MODEL;
      _loaded = false;
      return false;
    }
  }

  function hasModel(){ return !!_model && !!_model.heads; }

  // expose
  WIN.SBML = {
    load,
    predict,
    hasModel,
    modelInfo,
    _debugLastFeatures: ()=>_lastF,
    _setCalibration: (cal)=>{ if(cal && typeof cal==='object'){ _cal = { ..._cal, ...cal }; } }
  };
})();