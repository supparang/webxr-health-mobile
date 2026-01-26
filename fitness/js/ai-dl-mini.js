// === /fitness/js/ai-dl-mini.js ===
// Mini "Deep Learning": 2-layer MLP (8 -> 12 -> 1) with online SGD
// ✅ Lightweight, no TF.js required
// ✅ Used only in play mode (engine controls)
// NOTE: This is "DL-lite" but genuinely a neural net with hidden layer.

'use strict';

function sigmoid(z) {
  const cz = Math.max(-8, Math.min(8, z));
  return 1 / (1 + Math.exp(-cz));
}

function relu(z) {
  return z > 0 ? z : 0;
}

export class MiniDL {
  constructor(opts = {}) {
    this.cfg = Object.assign({
      inDim: 8,
      hid: 12,
      lr: 0.04,
      l2: 0.0006
    }, opts);

    const { inDim, hid } = this.cfg;

    // weights: W1[hid*inDim], b1[hid], W2[hid], b2[1]
    this.W1 = new Float32Array(hid * inDim);
    this.b1 = new Float32Array(hid);
    this.W2 = new Float32Array(hid);
    this.b2 = 0;

    // init small random
    for (let i = 0; i < this.W1.length; i++) this.W1[i] = (Math.random() - 0.5) * 0.12;
    for (let i = 0; i < this.W2.length; i++) this.W2[i] = (Math.random() - 0.5) * 0.12;
    for (let i = 0; i < this.b1.length; i++) this.b1[i] = (Math.random() - 0.5) * 0.05;
    this.b2 = (Math.random() - 0.5) * 0.05;

    this.lastP = 0.35;
  }

  forward(x) {
    const { inDim, hid } = this.cfg;
    const h = new Float32Array(hid);

    for (let j = 0; j < hid; j++) {
      let z = this.b1[j];
      const base = j * inDim;
      for (let i = 0; i < inDim; i++) z += this.W1[base + i] * x[i];
      h[j] = relu(z);
    }

    let z2 = this.b2;
    for (let j = 0; j < hid; j++) z2 += this.W2[j] * h[j];
    const p = sigmoid(z2);

    this.lastP = p;
    return { p, h };
  }

  trainOne(x, y) {
    // y in {0,1}
    const { inDim, hid, lr, l2 } = this.cfg;

    const { p, h } = this.forward(x);
    const err = (p - y); // dL/dz2 for logistic loss

    // grads W2, b2
    for (let j = 0; j < hid; j++) {
      const g = err * h[j] + l2 * this.W2[j];
      this.W2[j] -= lr * g;
    }
    this.b2 -= lr * err;

    // backprop to hidden (ReLU)
    for (let j = 0; j < hid; j++) {
      const dz1 = (h[j] > 0 ? 1 : 0) * (err * this.W2[j]);
      this.b1[j] -= lr * dz1;

      const base = j * inDim;
      for (let i = 0; i < inDim; i++) {
        const g = dz1 * x[i] + l2 * this.W1[base + i];
        this.W1[base + i] -= lr * g;
      }
    }

    return p;
  }

  predict(x) {
    return this.forward(x).p;
  }

  debug() {
    return {
      p: +this.lastP.toFixed(3),
      lr: this.cfg.lr
    };
  }
}