// === /fitness/js/ai-coach.js ===
// Explainable micro-tips (rate-limited)

'use strict';

export class AICoach {
  constructor() {
    this.lastTip = '';
    this.cooldownMs = 1600;
    this.lastAt = 0;
  }

  maybeTip(pred, snap) {
    const now = performance.now();
    if (now - this.lastAt < this.cooldownMs) return '';

    const tip = String(pred?.tip || '').trim();
    if (!tip) return '';

    // avoid repeating the exact same tip too frequently
    if (tip === this.lastTip && (now - this.lastAt) < 4000) return '';

    this.lastTip = tip;
    this.lastAt = now;
    return tip;
  }
}