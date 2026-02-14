// === /herohealth/ai/model-runtime.js ===
// Minimal in-browser model runtime (no deps).
// Supports:
// 1) logistic: y = sigmoid(b + Σ w_i x_i)
// 2) mlp: 1 hidden layer: h = relu(W1 x + b1), y = sigmoid(W2 h + b2)

'use strict';

function sigmoid(z){ return 1/(1+Math.exp(-z)); }
function relu(z){ return z>0 ? z : 0; }

export function predict(model, x){
  // x: number[]
  if(!model || !Array.isArray(x)) return null;

  if(model.type === 'logistic'){
    const w = model.w || [];
    let z = Number(model.b || 0);
    for(let i=0;i<w.length;i++) z += (w[i]||0) * (x[i]||0);
    return sigmoid(z);
  }

  if(model.type === 'mlp1'){
    const W1 = model.W1 || []; // [H][D]
    const b1 = model.b1 || []; // [H]
    const W2 = model.W2 || []; // [H]
    const b2 = Number(model.b2 || 0);

    const H = W1.length;
    const h = new Array(H).fill(0);
    for(let j=0;j<H;j++){
      let z = Number(b1[j] || 0);
      const row = W1[j] || [];
      for(let i=0;i<row.length;i++) z += (row[i]||0) * (x[i]||0);
      h[j] = relu(z);
    }

    let z2 = b2;
    for(let j=0;j<H;j++) z2 += (W2[j]||0) * h[j];
    return sigmoid(z2);
  }

  return null;
}