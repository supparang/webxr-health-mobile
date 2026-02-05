// === /fitness/js/dl-features.js ===
// DL-lite Features bridge (safe)
// ✅ Works with BOTH:
//    A) ai-predictor.js classic (window.RB_AI only)
//    B) ai-predictor.js module (export const RB_AI)
// ✅ Never crashes engine if predictor missing or not exported
'use strict';

/**
 * Try to obtain predictor API in this order:
 * 1) ESM import { RB_AI } or default from ./ai-predictor.js
 * 2) window.RB_AI fallback
 * 3) stub (no-op)
 */
async function loadPredictor() {
  // 1) ESM import
  try {
    const mod = await import('./ai-predictor.js');
    const api = (mod && (mod.RB_AI || mod.default)) ? (mod.RB_AI || mod.default) : null;
    if (api) return api;
  } catch (_) {
    // ignore, fallback to global
  }

  // 2) global fallback
  try {
    if (typeof window !== 'undefined' && window.RB_AI) return window.RB_AI;
  } catch (_) {}

  // 3) stub
  return {
    getMode() { return 'normal'; },
    isAssistEnabled() { return false; },
    isLocked() { return false; },
    predict() { return { fatigueRisk: 0, skillScore: 0, suggestedDifficulty: 'normal', tip: '' }; }
  };
}

// cache single load
let _P = null;
function predictor() {
  if (!_P) _P = loadPredictor();
  return _P;
}

/**
 * Public API for engine/UI:
 * - getMode(): 'normal' | 'research'
 * - isLocked(): boolean
 * - isAssistEnabled(): boolean  (normal only; gated by ?ai=1)
 * - predict(snapshot): { fatigueRisk, skillScore, suggestedDifficulty, tip }
 */
export const DL = {
  async getMode() {
    const ai = await predictor();
    try { return ai.getMode ? ai.getMode() : 'normal'; } catch { return 'normal'; }
  },
  async isLocked() {
    const ai = await predictor();
    try { return !!(ai.isLocked && ai.isLocked()); } catch { return false; }
  },
  async isAssistEnabled() {
    const ai = await predictor();
    try { return !!(ai.isAssistEnabled && ai.isAssistEnabled()); } catch { return false; }
  },
  async predict(snapshot) {
    const ai = await predictor();
    try {
      if (ai && ai.predict) return ai.predict(snapshot || {});
    } catch (_) {}
    return { fatigueRisk: 0, skillScore: 0, suggestedDifficulty: 'normal', tip: '' };
  }
};

/**
 * Convenience helpers (sync-ish wrappers for engine loops)
 * - These do not throw; they return safe defaults immediately.
 * - For best results, call DL.prewarm() once at boot.
 */
export const DL_SYNC = {
  _ai: null,
  async prewarm() {
    try { this._ai = await predictor(); } catch { this._ai = null; }
    return this._ai;
  },
  getMode() {
    try { return this._ai?.getMode ? this._ai.getMode() : 'normal'; } catch { return 'normal'; }
  },
  isLocked() {
    try { return !!(this._ai?.isLocked && this._ai.isLocked()); } catch { return false; }
  },
  isAssistEnabled() {
    try { return !!(this._ai?.isAssistEnabled && this._ai.isAssistEnabled()); } catch { return false; }
  },
  predict(snapshot) {
    try {
      if (this._ai?.predict) return this._ai.predict(snapshot || {});
    } catch (_) {}
    return { fatigueRisk: 0, skillScore: 0, suggestedDifficulty: 'normal', tip: '' };
  }
};