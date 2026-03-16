// === /herohealth/hydration-vr/hydration.model-runtime.js ===
// Hydration Runtime Model
// PATCH v20260315-HYD-MODEL-RUNTIME

function sigmoid(x){
  const z = Number(x || 0);
  if(z >= 0){
    const ez = Math.exp(-z);
    return 1 / (1 + ez);
  }
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

function clamp(v, a, b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

function safeNum(v){
  v = Number(v);
  return Number.isFinite(v) ? v : 0;
}

export function createHydrationRuntimeModel(modelSpec = {}){
  const version = String(modelSpec?.version || 'runtime-logreg-v1');
  const label = String(modelSpec?.label || 'assistance_needed');
  const intercept = safeNum(modelSpec?.intercept || 0);
  const threshold = clamp(modelSpec?.threshold ?? 0.5, 0, 1);

  // expected format:
  // {
  //   numericWeights: { waterPct: -0.25, missRateRecent: 0.8, ... },
  //   categoricalWeights: { "phase=storm": 0.12, "phase=boss1": 0.20 }
  // }
  const numericWeights = modelSpec?.numericWeights || {};
  const categoricalWeights = modelSpec?.categoricalWeights || {};

  function score(features = {}){
    let s = intercept;

    for(const [key, w] of Object.entries(numericWeights)){
      s += safeNum(features[key]) * safeNum(w);
    }

    for(const [key, w] of Object.entries(categoricalWeights)){
      const [field, rawVal] = String(key).split('=');
      if(String(features[field] ?? '') === rawVal){
        s += safeNum(w);
      }
    }

    return s;
  }

  function predict(features = {}){
    const logit = score(features);
    const prob = sigmoid(logit);
    const pred = prob >= threshold ? 1 : 0;

    return {
      label,
      pred,
      prob: +prob.toFixed(6),
      threshold,
      version,
      source: 'runtime-logreg'
    };
  }

  return {
    version,
    label,
    threshold,
    score,
    predict
  };
}