// === /herohealth/vr-groups/dl-model.js ===
// Deep Learning Ready runtime for GroupsVR
// ✅ play only (enabled decided by ai-hooks)
// ✅ TFJS optional: if window.tf exists OR load from CDN (when ?tf=1)
// ✅ Load model from URL param: ?model=https://.../model.json  (TFJS format)
// ✅ Fallback: Tiny MLP (JS) + heuristic when TF not available/model not loaded
//
// API:
//   GroupsVR.DLModel.init({ enabled, runMode, seed })
//   GroupsVR.DLModel.ready() -> boolean
//   GroupsVR.DLModel.predict(features) -> { riskMiss, accNext, recommend, source }
//
// features: Float32Array length 10 (see ai-predictor.js)

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};
  const DOC = root.document;

  const nowMs = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; }
  }
  function clamp(v,a,b){ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); }

  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261>>>0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }
  function makeRng(u32){
    let s = (u32>>>0) || 1;
    return ()=>((s = (Math.imul(1664525, s) + 1013904223)>>>0) / 4294967296);
  }

  // ---------- TFJS optional loader ----------
  function loadScript(src){
    return new Promise((resolve,reject)=>{
      try{
        const s = DOC.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = ()=>resolve(true);
        s.onerror = ()=>reject(new Error('script load fail'));
        DOC.head.appendChild(s);
      }catch(e){ reject(e); }
    });
  }

  async function ensureTFJS(){
    if (root.tf && root.tf.loadLayersModel) return true;
    const want = String(qs('tf','0')||'0');
    if (!(want==='1' || want==='true')) return false;

    // CDN (stable enough for GH pages)
    try{
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.21.0/dist/tf.min.js');
      return !!(root.tf && root.tf.loadLayersModel);
    }catch(_){
      return false;
    }
  }

  // ---------- Tiny MLP fallback (JS) ----------
  // NOTE: weights below are placeholders (not trained). Purpose: pipeline works + smooth output.
  // Later: replace with trained weights (exported) or use TFJS model.json via ?model=
  function sigmoid(x){ return 1 / (1 + Math.exp(-x)); }
  function tanh(x){ return Math.tanh(x); }

  function mlpPredict(x10){
    // x10: Float32Array[10]
    // hidden = tanh(W1*x + b1) ; out = sigmoid(W2*h + b2)
    // output: riskMiss (0..1), accNext (0..1), recommend (-1..+1)
    const W1 = [
      // 8 hidden neurons * 10
      [ 0.9,-0.6, 0.3,-0.8, 0.4,-0.2, 0.6,-0.3, 0.2, 0.5],
      [-0.4, 0.7,-0.2, 0.6,-0.5, 0.3,-0.1, 0.4,-0.6,-0.2],
      [ 0.2, 0.1, 0.6,-0.3, 0.7,-0.4, 0.2, 0.3, 0.1,-0.5],
      [ 0.6,-0.2, 0.2, 0.8,-0.6, 0.2,-0.3, 0.5,-0.1, 0.2],
      [-0.7, 0.4, 0.1, 0.3, 0.2, 0.6,-0.5, 0.2, 0.4,-0.3],
      [ 0.3, 0.2,-0.5, 0.2, 0.1,-0.7, 0.8,-0.2, 0.3, 0.4],
      [ 0.1,-0.3, 0.7,-0.2, 0.3, 0.2,-0.6, 0.6,-0.4, 0.1],
      [-0.2, 0.5, 0.2,-0.6, 0.4, 0.1, 0.3,-0.7, 0.6,-0.1]
    ];
    const b1 = [0.05,-0.03,0.02,0.01,-0.02,0.03,0.00,0.04];

    const h = new Array(8);
    for(let i=0;i<8;i++){
      let s = b1[i];
      const wi = W1[i];
      for(let j=0;j<10;j++) s += wi[j] * x10[j];
      h[i] = tanh(s);
    }

    const W2r = [ 0.9,-0.6, 0.4, 0.7,-0.3, 0.2,-0.4, 0.5];
    const W2a = [ 0.6, 0.4, 0.5,-0.2, 0.3,-0.1, 0.2,-0.3];
    const W2d = [-0.5, 0.2,-0.4, 0.6,-0.1, 0.4, 0.2,-0.2];
    const b2r = -0.1, b2a = 0.15, b2d = 0.0;

    let sr=b2r, sa=b2a, sd=b2d;
    for(let i=0;i<8;i++){
      sr += W2r[i]*h[i];
      sa += W2a[i]*h[i];
      sd += W2d[i]*h[i];
    }

    const risk = sigmoid(sr);
    const accN = sigmoid(sa);          // 0..1
    const dir  = clamp(tanh(sd), -1, 1); // -1..+1

    return { riskMiss:risk, accNext:accN, recommend:dir };
  }

  // ---------- Heuristic fallback (fast & meaningful) ----------
  function heuristicPredict(x){
    // x: Float32Array[10]
    // indices defined in ai-predictor.js
    const acc = x[0];      // 0..1
    const combo = x[1];    // 0..1
    const missRate = x[2]; // 0..1
    const pressure = x[3]; // 0..1
    const storm = x[4];    // 0/1
    const mini = x[5];     // 0/1
    const left = x[6];     // 0..1

    let risk = 0.18 + missRate*0.55 + pressure*0.25 + (storm?0.10:0) + (mini?0.08:0);
    risk -= acc*0.25;
    risk -= combo*0.10;
    risk = clamp(risk, 0, 1);

    let accNext = clamp(acc + (combo*0.08) - (missRate*0.12) - (pressure*0.06), 0, 1);

    // recommend: -1 = slow down, +1 = speed up
    let dir = 0.0;
    if (risk > 0.55) dir = -0.75;
    else if (acc > 0.80 && risk < 0.28 && left > 0.25) dir = +0.55;

    return { riskMiss:risk, accNext:accNext, recommend:dir };
  }

  // ---------- Main DLModel ----------
  function DLModel(){
    this.enabled = false;
    this.runMode = 'play';
    this.seed = '0';
    this.rng = makeRng(123);

    this.tfReady = false;
    this.model = null;
    this.modelUrl = '';
    this.lastTryAt = 0;

    this.forceDL = false;   // ?dl=1
  }

  DLModel.prototype.init = async function(cfg){
    cfg = cfg || {};
    const rm = String(cfg.runMode||'play').toLowerCase();
    this.runMode = rm;

    this.enabled = !!cfg.enabled && (rm === 'play');
    if (rm === 'research' || rm === 'practice') this.enabled = false;

    this.seed = String(cfg.seed ?? '0');
    this.rng = makeRng(hashSeed(this.seed + '::dl'));

    this.forceDL = (String(qs('dl','0')||'0') === '1' || String(qs('dl','0')||'0') === 'true');

    this.modelUrl = String(qs('model','')||'');
    this.model = null;
    this.tfReady = false;

    // attempt TFJS only if enabled and requested or modelUrl present
    if (!this.enabled) return false;

    const wantTF = this.forceDL || !!this.modelUrl || (String(qs('tf','0')||'0')==='1');
    if (!wantTF) return false;

    const ok = await ensureTFJS();
    this.tfReady = ok;

    if (ok && this.modelUrl){
      try{
        // TFJS model.json (layers model)
        this.model = await root.tf.loadLayersModel(this.modelUrl);
      }catch(_){
        this.model = null;
      }
    }
    return this.ready();
  };

  DLModel.prototype.ready = function(){
    return !!(this.enabled && this.tfReady && this.model);
  };

  DLModel.prototype.predict = function(features10){
    // features10 is Float32Array length 10
    if (!this.enabled){
      return { riskMiss:0.25, accNext:0.55, recommend:0.0, source:'off' };
    }

    // TFJS model path
    if (this.model && this.tfReady && root.tf && root.tf.tensor){
      try{
        const x = root.tf.tensor([Array.from(features10)], [1, 10]);
        const y = this.model.predict(x);
        const arr = Array.isArray(y) ? y[0].dataSync() : y.dataSync();
        x.dispose && x.dispose();
        y.dispose && y.dispose();

        // expect output [riskMiss, accNext, recommend] (recommend -1..1)
        const risk = clamp(arr[0], 0, 1);
        const accN = clamp(arr[1], 0, 1);
        const dir  = clamp(arr[2], -1, 1);
        return { riskMiss:risk, accNext:accN, recommend:dir, source:'tfjs' };
      }catch(_){
        // fallthrough
      }
    }

    // fallback: tiny-MLP then heuristic smoothing
    const mlp = mlpPredict(features10);
    const heu = heuristicPredict(features10);

    const risk = clamp(mlp.riskMiss*0.65 + heu.riskMiss*0.35, 0, 1);
    const accN = clamp(mlp.accNext*0.60 + heu.accNext*0.40, 0, 1);
    const dir  = clamp(mlp.recommend*0.60 + heu.recommend*0.40, -1, 1);

    return { riskMiss:risk, accNext:accN, recommend:dir, source:'fallback' };
  };

  NS.DLModel = new DLModel();
})(window);