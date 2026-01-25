// === /herohealth/vr-groups/dl-mlp.js ===
// Tiny MLP (DL-lite but real MLP): 6 -> 8 -> 1
// ✅ Deterministic inference, fast
// ✅ Returns {r, explain} where r in [0..1]
// ✅ Explainable: shows top contributing features

(function(){
  'use strict';
  const WIN = window;
  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});

  function sigmoid(x){ return 1 / (1 + Math.exp(-x)); }
  function dot(a,b){
    let s=0;
    for(let i=0;i<a.length;i++) s += (a[i]||0) * (b[i]||0);
    return s;
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // weights container: window.GROUPS_DLW = { b1:[8], W1:[8][6], b2:[1], W2:[1][8] }
  function getW(){
    const w = WIN.GROUPS_DLW;
    if (!w || !Array.isArray(w.b1) || !Array.isArray(w.W1) || !Array.isArray(w.W2)) return null;
    return w;
  }

  // features (6):
  // 0 missRateN, 1 accBad, 2 comboN, 3 leftLow, 4 storm, 5 miniUrg
  function explain(f){
    const names = ['missRate','accBad','comboN','leftLow','storm','miniUrg'];
    const contrib = f.map((v,i)=>({k:names[i], v:Number(v)||0}));
    contrib.sort((a,b)=>Math.abs(b.v)-Math.abs(a.v));
    return contrib.slice(0,3);
  }

  // forward pass
  function predictRisk(f){
    const w = getW();
    if (!w){
      // fallback: logistic neuron (กรณี weights ยังไม่ถูกใส่)
      const W = [ 1.35, 1.10, -0.35, 0.55, 0.65, 0.55 ];
      const b = -0.55;
      return { r: sigmoid(dot(W,f)+b), explain: explain(f) };
    }

    // hidden
    const h = new Array(8);
    for(let j=0;j<8;j++){
      const z = dot(w.W1[j], f) + (w.b1[j]||0);
      h[j] = sigmoid(z);
    }
    const y = dot(w.W2[0], h) + (w.b2[0]||0);
    const r = sigmoid(y);

    return { r, explain: explain(f) };
  }

  NS.DL = NS.DL || {};
  NS.DL.predictRisk = function(f6){
    // normalize safety
    const f = new Array(6);
    for(let i=0;i<6;i++) f[i] = clamp(f6[i], -3, 3);
    return predictRisk(f);
  };

})();