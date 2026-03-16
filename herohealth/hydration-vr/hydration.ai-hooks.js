// === /herohealth/hydration-vr/hydration.ai-hooks.js ===
// Hydration AI Hooks
// PATCH v20260315-HYD-AI-HOOKS

import { createHydrationFeatureExtractor } from './hydration.features.js?v=20260315';

function clamp(v, a, b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

function xmur3(str){
  str = String(str || '');
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
    a>>>=0; b>>>=0; c>>>=0; d>>>=0;
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

function seeded(seed){
  const s = xmur3(seed);
  return sfc32(s(), s(), s(), s());
}

export function createHydrationAIHooks(opts = {}){
  const mode = String(opts.mode || 'off').toLowerCase(); // off | play | research
  const sampleMs = Math.max(250, Number(opts.sampleMs || 500));
  const predictor = opts.predictor || null;
  const coach = opts.coach || null;
  const director = opts.director || null;
  const seed = String(opts.seed || 'hydration-ai');
  const rng = seeded(seed);

  const features = createHydrationFeatureExtractor({
    windowSec: Number(opts.windowSec || 12),
    sampleHz: Number(opts.sampleHz || 2)
  });

  const featureRows = [];
  const predictionRows = [];
  const coachRows = [];
  const directorRows = [];

  let lastSampleTs = 0;
  let lastPrediction = null;

  function aiEnabled(){
    return mode === 'play' || mode === 'research';
  }

  function deterministicNoise(scale = 0){
    if(mode !== 'research') return 0;
    return (rng() * 2 - 1) * scale;
  }

  function ingestState(snapshot){
    features.ingestState(snapshot);
  }

  function ingestEvent(evt){
    features.ingestEvent(evt);
  }

  function maybeStep(snapshot){
    const ts = Number(snapshot?.ts || 0);
    if(!aiEnabled()) return null;
    if(ts - lastSampleTs < sampleMs) return lastPrediction;
    lastSampleTs = ts;

    const fv = features.extract({ ts });
    featureRows.push({ ...fv });

    let pred = null;
    if(predictor && typeof predictor.predict === 'function'){
      pred = predictor.predict(fv, {
        mode,
        noise: deterministicNoise(0.01)
      });
      predictionRows.push({
        ts,
        ...pred
      });
      lastPrediction = pred;
    }

    if(coach && typeof coach.decide === 'function'){
      const coachOut = coach.decide({
        features: fv,
        prediction: pred,
        mode
      });
      if(coachOut){
        coachRows.push({
          ts,
          ...coachOut
        });
      }
    }

    if(director && typeof director.decide === 'function'){
      const action = director.decide({
        features: fv,
        prediction: pred,
        mode
      });
      if(action){
        directorRows.push({
          ts,
          ...action
        });
      }
    }

    return pred;
  }

  function exportDataset(){
    return {
      mode,
      seed,
      featureRows,
      predictionRows,
      coachRows,
      directorRows,
      featureState: features.exportState()
    };
  }

  return {
    mode,
    seed,
    aiEnabled,
    ingestState,
    ingestEvent,
    maybeStep,
    exportDataset,
    getLastPrediction: ()=> lastPrediction
  };
}