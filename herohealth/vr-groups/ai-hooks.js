// === /herohealth/vr-groups/ai-hooks.js ===
// AI Hooks v1.2 (PACK 20/21/22)
// ✅ Play only (run=play). Research/practice => OFF
// ✅ Loads TFJS + model (optional) when ai=1
// ✅ Emits: ai:prediction { riskMiss, accNextPct, recommend, source, features[] }
// ✅ Rolling window (8s) features for ML
// ✅ Difficulty Director (fair & smooth) when dir=1 (play only)

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};
  const DOC = root.document;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; }
  }
  function clamp(v,a,b){ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); }
  function lerp(a,b,t){ return a + (b-a)*t; }

  function aiAllowed(runMode){
    return String(runMode||'play') === 'play';
  }
  function aiEnabledByParams(){
    const run = String(qs('run','play')||'play').toLowerCase();
    if (run !== 'play') return false;
    const a = String(qs('ai','0')||'0').toLowerCase();
    return (a==='1' || a==='true');
  }
  function directorEnabledByParams(){
    const d = String(qs('dir','0')||'0').toLowerCase();
    return (d==='1' || d==='true');
  }
  function getModelUrl(){
    const m = String(qs('model','./ai-model/model.json')||'').trim();
    if (!m || m==='0' || m==='false' || m==='off') return '';
    return m;
  }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }

  // -------- TFJS loader (only when needed) --------
  let _tfReady = null;
  function loadTFJS(){
    if (root.tf) return Promise.resolve(root.tf);
    if (_tfReady) return _tfReady;

    _tfReady = new Promise((resolve,reject)=>{
      const s = DOC.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js';
      s.onload = ()=> resolve(root.tf);
      s.onerror = reject;
      DOC.head.appendChild(s);
    });
    return _tfReady;
  }

  // -------- Model manager --------
  const Model = {
    url: '',
    loaded: false,
    m: null,
    loading: null,
    async load(url){
      if (!url) return null;
      if (this.loaded && this.url===url && this.m) return this.m;
      if (this.loading) return this.loading;

      this.url = url;
      this.loaded = false;

      this.loading = (async ()=>{
        const tf = await loadTFJS();
        // allow relative path
        const m = await tf.loadLayersModel(url);
        // warmup
        const z = tf.zeros([1,10]);
        m.predict(z).dataSync();
        z.dispose();
        this.m = m;
        this.loaded = true;
        this.loading = null;
        return m;
      })().catch((e)=>{
        this.loading = null;
        this.m = null;
        this.loaded = false;
        console.warn('[AIHooks] model load failed', e);
        return null;
      });

      return this.loading;
    },
    predict(features10){
      try{
        const tf = root.tf;
        if (!tf || !this.m) return null;
        const x = tf.tensor2d([features10], [1,10]);
        const y = this.m.predict(x);
        const v = Array.isArray(y) ? y[0].dataSync()[0] : y.dataSync()[0];
        x.dispose(); if (y.dispose) y.dispose();
        return clamp(v, 0, 1);
      }catch(_){
        return null;
      }
    }
  };

  // -------- Rolling window aggregator (8 seconds) --------
  function Ring(n){
    this.n=n; this.a=[]; this.sum={};
  }
  Ring.prototype.push = function(obj){
    this.a.push(obj);
    if (this.a.length > this.n) this.a.shift();
  };
  Ring.prototype.last = function(){ return this.a.length ? this.a[this.a.length-1] : null; };

  // -------- Feature extraction (PACK 21) --------
  function buildFeatures(window8, m){
    // window8 stores per-sec deltas
    const arr = window8.a;
    const T = Math.max(1, arr.length);

    let dMiss=0, dHG=0, dHW=0, dHJ=0, dEG=0, dShots=0, dShotMiss=0;
    for (const d of arr){
      dMiss += (d.dm||0);
      dHG   += (d.dHG||0);
      dHW   += (d.dHW||0);
      dHJ   += (d.dHJ||0);
      dEG   += (d.dEG||0);
      dShots+= (d.dS||0);
      dShotMiss += (d.dSM||0);
    }

    const accPct = Number(m.accuracyGoodPct||0);
    const combo  = Number(m.combo||0);
    const misses = Number(m.misses||0);
    const pressure = Number(m.pressureLevel||0);

    const tLeft = Math.max(0, Number(m.tLeftSec||0));
    const timeNorm = clamp(tLeft / 90, 0, 1);

    const thr = Math.max(1, Number(m.powerThreshold||8));
    const powerPct = clamp(Number(m.powerCharge||0)/thr, 0, 1);

    const goalNeed = Math.max(1, Number(m.goalNeed||1));
    const goalPct  = clamp(Number(m.goalNow||0)/goalNeed, 0, 1);

    // rates in last 8 sec
    const missRate8 = clamp(dMiss / 8, 0, 1);
    const shotMissRate8 = clamp((dShotMiss / Math.max(1, dShots)), 0, 1);

    const comboNorm = clamp(combo/12, 0, 1);
    const accNorm = clamp(accPct/100, 0, 1);
    const missNorm = clamp(misses/18, 0, 1);
    const pressureNorm = clamp(pressure/3, 0, 1);

    // f9 = “speedHint” แต่เราใส่ shotMissRate8 (มีประโยชน์จริงกว่า)
    const features = [
      +accNorm.toFixed(4),              // f0_acc
      +comboNorm.toFixed(4),            // f1_comboNorm
      +missNorm.toFixed(4),             // f2_missRate (cumulative)
      +pressureNorm.toFixed(4),         // f3_pressure
      (Number(m.stormOn||0)?1:0),       // f4_stormOn
      (Number(m.miniOn||0)?1:0),        // f5_miniOn
      +timeNorm.toFixed(4),             // f6_timeLeftNorm
      +goalPct.toFixed(4),              // f7_goalPct
      +powerPct.toFixed(4),             // f8_powerPct
      +shotMissRate8.toFixed(4)         // f9_speedHint (repurposed)
    ];
    return { features, missRate8, shotMissRate8, accPct };
  }

  // -------- Heuristic fallback predictor --------
  function heuristicRisk(missRate8, shotMissRate8, accPct, pressure, stormOn, miniOn){
    // baseline risk grows with missRate + shotMissRate, and drops with acc
    let r = 0.20;
    r += missRate8 * 0.55;
    r += shotMissRate8 * 0.35;
    r -= clamp(accPct/100,0,1) * 0.30;

    if (pressure>=2) r += 0.10;
    if (stormOn) r += 0.06;
    if (miniOn) r += 0.05;

    return clamp(r, 0, 1);
  }

  // -------- Difficulty Director (PACK 22) --------
  function Director(){
    this.on = false;
    this.state = {
      intervalMul: 1.00,  // >1 = spawn ช้าลง, <1 = spawn ถี่ขึ้น
      lifeMul: 1.00,      // >1 = อยู่ได้นานขึ้น
      sizeMul: 1.00,      // >1 = ใหญ่ขึ้น
      wrongAdd: 0.00,
      junkAdd: 0.00
    };
  }
  Director.prototype.apply = function(engine, target){
    if (!engine || typeof engine.setAIModifiers !== 'function') return;

    // smooth (EMA) กันแกว่ง
    const s = this.state;
    const a = 0.18; // smoothing
    s.intervalMul = lerp(s.intervalMul, target.intervalMul, a);
    s.lifeMul     = lerp(s.lifeMul,     target.lifeMul,     a);
    s.sizeMul     = lerp(s.sizeMul,     target.sizeMul,     a);
    s.wrongAdd    = lerp(s.wrongAdd,    target.wrongAdd,    a);
    s.junkAdd     = lerp(s.junkAdd,     target.junkAdd,     a);

    engine.setAIModifiers({
      intervalMul: +clamp(s.intervalMul, 0.82, 1.20).toFixed(4),
      lifeMul:     +clamp(s.lifeMul,     0.85, 1.22).toFixed(4),
      sizeMul:     +clamp(s.sizeMul,     0.90, 1.16).toFixed(4),
      wrongAdd:    +clamp(s.wrongAdd,   -0.06, 0.08).toFixed(4),
      junkAdd:     +clamp(s.junkAdd,    -0.06, 0.08).toFixed(4)
    });
  };
  Director.prototype.decide = function(riskMiss, accPct, pressure, combo, stormOn, miniOn){
    // ยุติธรรม: ถ้าเสี่ยงพลาดสูง → ช่วย; ถ้าคุมอยู่ → ท้าทายเพิ่มเล็กน้อย
    const acc = clamp(accPct/100,0,1);
    const p   = clamp(pressure/3,0,1);

    // difficulty index in [-1..+1]
    let d = 0;
    d += (acc - 0.70) * 0.9;
    d += (combo>=8 ? 0.2 : 0);
    d -= (riskMiss - 0.35) * 1.1;
    d -= p * 0.55;
    if (stormOn) d -= 0.08;
    if (miniOn)  d -= 0.06;
    d = clamp(d, -1, 1);

    if (d <= -0.35){
      // easier
      return { intervalMul:1.14, lifeMul:1.10, sizeMul:1.07, wrongAdd:-0.02, junkAdd:-0.02 };
    }
    if (d >= 0.35){
      // harder
      return { intervalMul:0.92, lifeMul:0.92, sizeMul:0.96, wrongAdd:+0.02, junkAdd:+0.02 };
    }
    // neutral
    return { intervalMul:1.00, lifeMul:1.00, sizeMul:1.00, wrongAdd:0.00, junkAdd:0.00 };
  };

  // -------- Main Hook --------
  function AIHooks(){
    this.enabled = false;
    this.runMode = 'play';
    this.seed = '';
    this.window8 = new Ring(8);
    this.lastM = null;

    this.modelUrl = '';
    this.modelReady = false;

    this.director = new Director();

    this._onMetrics = null;
  }

  AIHooks.prototype.attach = async function(cfg){
    cfg = cfg || {};
    this.runMode = String(cfg.runMode || 'play');
    this.seed = String(cfg.seed || '');
    this.enabled = !!cfg.enabled && aiAllowed(this.runMode) && aiEnabledByParams();

    // director only when play + ai=1 + dir=1
    this.director.on = this.enabled && directorEnabledByParams();

    if (!this.enabled) return;

    // model optional
    this.modelUrl = getModelUrl();
    if (this.modelUrl){
      await Model.load(this.modelUrl);
      this.modelReady = !!Model.m;
    }else{
      this.modelReady = false;
    }

    this._bind();
  };

  AIHooks.prototype._bind = function(){
    if (this._onMetrics) return;

    this._onMetrics = (ev)=>{
      if (!this.enabled) return;
      const m = ev.detail || {};
      if (m.tLeftSec == null) return;

      // compute deltas for rolling window
      if (this.lastM){
        const dm  = (Number(m.misses||0) - Number(this.lastM.misses||0));
        const dHG = (Number(m.nHitGood||0) - Number(this.lastM.nHitGood||0));
        const dHW = (Number(m.nHitWrong||0) - Number(this.lastM.nHitWrong||0));
        const dHJ = (Number(m.nHitJunk||0) - Number(this.lastM.nHitJunk||0));
        const dEG = (Number(m.nExpireGood||0) - Number(this.lastM.nExpireGood||0));
        const dS  = (Number(m.shots||0) - Number(this.lastM.shots||0));
        const dSM = (Number(m.shotsMiss||0) - Number(this.lastM.shotsMiss||0));
        this.window8.push({ dm, dHG, dHW, dHJ, dEG, dS, dSM });
      }else{
        this.window8.push({ dm:0,dHG:0,dHW:0,dHJ:0,dEG:0,dS:0,dSM:0 });
      }

      const { features, missRate8, shotMissRate8, accPct } = buildFeatures(this.window8, m);

      // prediction
      let risk = null;
      let source = 'heuristic';

      if (this.modelReady){
        const v = Model.predict(features);
        if (v != null){
          risk = v;
          source = 'tfjs-model';
        }
      }
      if (risk == null){
        risk = heuristicRisk(
          missRate8,
          shotMissRate8,
          accPct,
          Number(m.pressureLevel||0),
          Number(m.stormOn||0),
          Number(m.miniOn||0)
        );
      }

      // “recommend” -1..+1 : (-) slow down/easier, (+) harder/faster
      let rec = 0;
      rec += (clamp(accPct/100,0,1) - 0.72) * 0.9;
      rec -= (risk - 0.35) * 1.1;
      rec -= clamp(Number(m.pressureLevel||0)/3,0,1) * 0.5;
      if (Number(m.stormOn||0)) rec -= 0.07;
      if (Number(m.miniOn||0))  rec -= 0.05;
      rec = clamp(rec, -1, 1);

      // next acc pct (simple projection)
      const accNextPct = clamp(Math.round(accPct + (rec*6)), 0, 100);

      emit('ai:prediction', {
        riskMiss: +clamp(risk,0,1).toFixed(4),
        accNextPct,
        recommend: +rec.toFixed(4),
        source,
        features
      });

      // Difficulty Director (PACK 22)
      if (this.director.on){
        const E = NS.GameEngine;
        const target = this.director.decide(
          risk, accPct,
          Number(m.pressureLevel||0),
          Number(m.combo||0),
          Number(m.stormOn||0),
          Number(m.miniOn||0)
        );
        this.director.apply(E, target);
      }

      this.lastM = m;
    };

    root.addEventListener('groups:metrics', this._onMetrics, {passive:true});
  };

  // export
  NS.AIHooks = new AIHooks();

})(window);