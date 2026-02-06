// === /fitness/js/dl-features.js ===
// PATCH F: Robust AI wiring (never crash boot)
// ✅ Uses ESM import (RB_AI export) + fallback to window.RB_AI
'use strict';

let RB_AI = null;
try {
  const mod = await import('./ai-predictor.js');
  RB_AI = (mod && mod.RB_AI) ? mod.RB_AI : (window.RB_AI || null);
} catch {
  RB_AI = window.RB_AI || null;
}

export const DLFeatures = {
  hasAI() {
    return !!(RB_AI && typeof RB_AI.predict === 'function');
  },

  isAssistEnabled() {
    try {
      return !!(RB_AI && RB_AI.isAssistEnabled && RB_AI.isAssistEnabled());
    } catch {
      return false;
    }
  },

  predict(snapshot) {
    try {
      if (!RB_AI || !RB_AI.predict) return null;
      return RB_AI.predict(snapshot || {});
    } catch {
      return null;
    }
  },

  tip(snapshot) {
    const p = this.predict(snapshot);
    return p && p.tip ? String(p.tip) : '';
  }
};