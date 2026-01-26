// === /fitness/js/pattern-learner.js ===
// Pattern Learner — Markov-ish next-type suggestion (DL-feel, lightweight)
'use strict';

function key(prev, phase, diff){ return `${prev}|p${phase}|d${diff}`; }

export class PatternLearner {
  constructor(opts = {}) {
    this.cfg = Object.assign({
      maxKeys: 120,
      decay: 0.995
    }, opts);
    this.reset();
  }

  reset() {
    this.map = new Map(); // key -> {counts:{type:score}, total}
    this.lastType = 'normal';
  }

  observe(prevType, nextType, phase, diff) {
    const k = key(prevType, phase, diff);
    let node = this.map.get(k);
    if (!node) {
      node = { counts: Object.create(null), total: 0 };
      this.map.set(k, node);
      // trim
      if (this.map.size > this.cfg.maxKeys) {
        const it = this.map.keys().next().value;
        this.map.delete(it);
      }
    }

    // decay existing
    for (const t in node.counts) node.counts[t] *= this.cfg.decay;

    node.counts[nextType] = (node.counts[nextType] || 0) + 1;
    node.total = Object.values(node.counts).reduce((a,b)=>a+b,0);
    this.lastType = nextType;
  }

  suggest(prevType, phase, diff, fallbackWeights) {
    const k = key(prevType, phase, diff);
    const node = this.map.get(k);
    if (!node || node.total < 3) return null;

    // choose max-prob next (but not too deterministic)
    const entries = Object.entries(node.counts).sort((a,b)=>b[1]-a[1]);
    const top = entries[0];
    const second = entries[1];

    // soft choice: 70/30 between top & second
    if (second && Math.random() < 0.30) return second[0];
    return top[0];
  }
}