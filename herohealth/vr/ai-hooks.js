// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PACK 14 (PRODUCTION)
// ✅ Play: AI ON by default (override ?ai=0)
// ✅ Research/Practice: AI OFF (hard lock)
// ✅ Predict: baseline (logistic-like) now; DL-ready via TFJS if present (?model=...)
// ✅ Explainable micro-tips (rate-limited)
// ✅ Emits: hha:ai {p, band, explain, source}  + can emit hha:coach tips
//
// Usage:
//   const ai = HHA_AI.create({ game:'groups', runMode, seed, featureKeys? });
//   ai.onSec(featuresObj, ctx); -> returns {p, band, explain}
//   ai.destroy()

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC) return;

  function clamp(v,a,b){ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); }
  function qs(k,d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }
  function emit(name, detail){ try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } }

  function hashSeed(str){
    str = String(str ?? '');
    let h=2166136261>>>0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h,16777619);
    }
    return h>>>0;
  }
  function makeRng(seedU32){
    let s=(seedU32>>>0)||1;
    return function(){
      s=(Math.imul(1664525,s)+1013904223)>>>0;
      return s/4294967296;
    };
  }

  function sigmoid(x){ x=Number(x)||0; return 1/(1+Math.exp(-x)); }

  // -------- Baseline model (no dependencies) --------
  // Purpose: good-enough "risk" predictor while DL model not plugged yet.
  function baselinePredictP(f){
    // Expect: misses, combo, accuracyGoodPct, pressureLevel, stormOn, miniOn, timeLeft
    const misses   = clamp(f.misses ?? 0, 0, 99);
    const combo    = clamp(f.combo ?? 0, 0, 99);
    const acc      = clamp(f.accuracyGoodPct ?? f.accuracy ?? 0, 0, 100);
    const pressure = clamp(f.pressureLevel ?? 0, 0, 3);
    const storm    = (f.stormOn ? 1 : 0);
    const mini     = (f.miniOn ? 1 : 0);
    const left     = clamp(f.timeLeft ?? f.leftSec ?? 0, 0, 180);

    // risk rises with misses/pressure/storm/late-game; lowers with combo/accuracy
    const z =
      0.65*(misses/10) +
      0.75*(pressure/3) +
      0.35*storm +
      0.22*mini +
      0.18*clamp((40-left)/40, 0, 1.2) +
      0.35*clamp((100-acc)/60, 0, 1.5) +
      0.25*clamp(1-combo/10, 0, 1.5);

    // center
    const p = sigmoid((z*1.7) - 1.25);
    return clamp(p, 0, 1);
  }

  function bandFromP(p){
    if(p>=0.72) return 'high';
    if(p>=0.48) return 'mid';
    return 'low';
  }

  function explainFromFeatures(f, p){
    // Small, human-readable drivers (not “true SHAP”, but good explainable coach)
    const out=[];
    const misses=clamp(f.misses??0,0,99);
    const combo=clamp(f.combo??0,0,99);
    const acc=clamp(f.accuracyGoodPct??f.accuracy??0,0,100);
    const pressure=clamp(f.pressureLevel??0,0,3);
    const storm=!!f.stormOn;
    const mini=!!f.miniOn;

    if(misses>=8) out.push('พลาดสะสมสูง');
    if(pressure>=2) out.push('แรงกดดันสูง');
    if(acc<=70) out.push('ความแม่นต่ำ');
    if(combo<=2) out.push('คอมโบตก');
    if(storm) out.push('อยู่ช่วงพายุ');
    if(mini) out.push('กำลังทำ MINI');

    // keep concise
    return { p, band: bandFromP(p), drivers: out.slice(0,3) };
  }

  // -------- TFJS DL-ready (optional) --------
  async function tryLoadTfjsModel(url){
    // needs window.tf present (user can include tfjs)
    if(!root.tf || !root.tf.loadLayersModel) return null;
    try{
      const model = await root.tf.loadLayersModel(url);
      return model;
    }catch(_){
      return null;
    }
  }

  async function dlPredictP(model, seq3d){
    // seq3d: [1,T,F]
    if(!root.tf || !model) return null;
    try{
      const x = root.tf.tensor(seq3d);
      const y = model.predict(x);
      const v = await y.data();
      x.dispose(); y.dispose();
      const p = Number(v && v[0]);
      return isFinite(p) ? clamp(p,0,1) : null;
    }catch(_){
      return null;
    }
  }

  // -------- Controller --------
  function create(cfg){
    cfg = cfg || {};
    const runMode = String(cfg.runMode||'play').toLowerCase();
    const seed = String(cfg.seed ?? '0');
    const game = String(cfg.game || 'hha');
    const rng  = makeRng(hashSeed(seed+'::ai::'+game));

    // HARD LOCK
    const hardOff = (runMode==='research' || runMode==='practice');

    // default: play ON, override ?ai=0
    const qAi = String(qs('ai', '')).toLowerCase();
    const enabled = (!hardOff) && (qAi!== '0' && qAi!=='off' && qAi!=='false');

    const sourceModelUrl = qs('model', null); // optional tfjs model url
    let tfModel = null;
    let tfReady = false;

    let lastP = null;
    let lastBand = 'low';
    let lastTipAt = 0;

    // tip rate-limit & novelty gating
    const TIP_GAP_MS = clamp(cfg.tipGapMs ?? 4200, 2500, 9000);
    const BAND_UP_ONLY = true;

    async function init(){
      if(!enabled) return;
      if(sourceModelUrl){
        tfModel = await tryLoadTfjsModel(sourceModelUrl);
        tfReady = !!tfModel;
      }
    }

    function maybeCoachTip(explain, ctx){
      // ctx should provide emitCoach(text,mood)
      const now = (root.performance && performance.now) ? performance.now() : Date.now();
      if(now - lastTipAt < TIP_GAP_MS) return;

      const band = explain.band;
      const bandUp = (band==='high' && lastBand!=='high') || (band==='mid' && lastBand==='low');
      if(BAND_UP_ONLY && !bandUp) return;

      lastTipAt = now;

      const drv = (explain.drivers||[]).join(' + ');
      if(!drv) return;

      let mood='neutral';
      let msg='';
      if(band==='high'){
        mood='fever';
        msg = `ระวัง! ความเสี่ยงพลาดสูง (${drv}) 👉 ช้าลงนิด เล็งก่อนยิง`;
      }else if(band==='mid'){
        mood='neutral';
        msg = `เริ่มเสี่ยงพลาด (${drv}) 👉 โฟกัส “หมู่ที่ถูก” ก่อน`;
      }else{
        mood='happy';
        msg = `ดีเลย! คุมเกมได้ 👍`;
      }
      if(ctx && typeof ctx.emitCoach === 'function'){
        ctx.emitCoach(msg, mood);
      }else{
        emit('hha:coach', { text: msg, mood });
      }
    }

    // featuresObj: plain object
    // ctx: { seq?: [[...],[...]] , seqLen?: , emitCoach?: fn }
    async function onSec(featuresObj, ctx){
      if(!enabled){
        return { enabled:false, p:null, band:'off', explain:null, source:'off' };
      }

      let p = null;
      let source = 'baseline';

      // If TF model available and caller provides seq (for DL)
      if(tfReady && tfModel && ctx && Array.isArray(ctx.seq)){
        const seq3d = [ctx.seq]; // [1,T,F]
        const pp = await dlPredictP(tfModel, seq3d);
        if(pp!=null){ p=pp; source='tfjs'; }
      }

      if(p==null){
        p = baselinePredictP(featuresObj);
        source = 'baseline';
      }

      const band = bandFromP(p);
      const explain = explainFromFeatures(featuresObj, p);

      // emit
      emit('hha:ai', { p, band, explain, source });

      // coach tip
      maybeCoachTip(explain, ctx);

      lastP = p;
      lastBand = band;

      return { enabled:true, p, band, explain, source };
    }

    function destroy(){
      try{ if(tfModel && tfModel.dispose) tfModel.dispose(); }catch(_){}
      tfModel=null;
      tfReady=false;
    }

    return { init, onSec, destroy, enabled, runMode, seed };
  }

  root.HHA_AI = { create };

})(typeof window!=='undefined' ? window : globalThis);