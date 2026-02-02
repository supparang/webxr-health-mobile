// === /fitness/js/ai-features.js ===
// Bridge helpers for AI in Shadow Breaker
// ✅ Works with classic ai-predictor.js that exposes window.RB_AI
// ✅ No imports

'use strict';

function readQueryFlag(key) {
  try {
    const v = new URL(location.href).searchParams.get(key);
    return v === '1' || v === 'true' || v === 'yes';
  } catch (_) {
    return false;
  }
}
function readQueryMode() {
  try {
    const m = (new URL(location.href).searchParams.get('mode') || '').toLowerCase();
    if (m === 'research') return 'research';
    return 'normal';
  } catch (_) {
    return 'normal';
  }
}

export const AI = {
  getMode(){ return readQueryMode(); },
  isResearch(){ return readQueryMode() === 'research'; },

  // allow AI only in normal mode, and require ?ai=1
  isAssistEnabled(){
    if (this.isResearch()) return false;
    return readQueryFlag('ai');
  },

  predict(snapshot){
    const api = window.RB_AI;
    if (!api || typeof api.predict !== 'function') return null;
    try { return api.predict(snapshot || {}); } catch { return null; }
  }
};