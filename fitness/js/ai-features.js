// === /fitness/js/ai-features.js ===
// AI Features bridge for VR Fitness games
// - Uses window.RB_AI (from ai-predictor.js classic script)
// - Works across games by providing getSnapshot() + optional callbacks
//
// Usage (in engine.js):
//   import { createAIFeatures } from './ai-features.js';
//   const ai = createAIFeatures({
//     gameId: 'shadow-breaker',
//     getSnapshot: () => ({ accPct, hp, offsetAbsMean, hitMiss, hitPerfect, hitGreat, hitGood }),
//     onTip: (tip, pred) => setFeedback(tip, 'good'),
//     onSuggestDifficulty: (diffKey, pred) => { /* optional: apply next run */ },
//     onAIPrediction: (pred, snap) => { /* optional log hook */ },
//   });
//   ai.start();
//   ...
//   ai.stop();

'use strict';

function clamp01(v) {
  v = Number(v);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function nowMs() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

function readQueryParam(name, def = '') {
  try {
    const v = new URL(location.href).searchParams.get(name);
    return v == null ? def : v;
  } catch (_) {
    return def;
  }
}

function safeString(v) {
  return (v == null) ? '' : String(v);
}

// ---- default policy ----
// - research mode: NO assist, NO auto adjustments
// - normal mode: assist only if ?ai=1 (ai-predictor enforces too, but we mirror)
function getModeFromRB() {
  try {
    if (window.RB_AI && typeof window.RB_AI.getMode === 'function') {
      return window.RB_AI.getMode(); // 'research' | 'normal'
    }
  } catch (_) {}
  // fallback from query
  const m = (readQueryParam('mode', '') || '').toLowerCase();
  return (m === 'research') ? 'research' : 'normal';
}

function isAssistEnabledFromRB() {
  try {
    if (window.RB_AI && typeof window.RB_AI.isAssistEnabled === 'function') {
      return !!window.RB_AI.isAssistEnabled();
    }
  } catch (_) {}
  // fallback
  const ai = (readQueryParam('ai', '') || '').toLowerCase();
  return ai === '1' || ai === 'true' || ai === 'yes';
}

function isLockedFromRB() {
  try {
    if (window.RB_AI && typeof window.RB_AI.isLocked === 'function') {
      return !!window.RB_AI.isLocked();
    }
  } catch (_) {}
  return getModeFromRB() === 'research';
}

function safePredict(snapshot) {
  try {
    if (!window.RB_AI || typeof window.RB_AI.predict !== 'function') return null;
    return window.RB_AI.predict(snapshot || {});
  } catch (e) {
    console.warn('[AI] predict failed', e);
    return null;
  }
}

/**
 * Create AI features controller.
 *
 * @param {Object} opts
 * @param {string} opts.gameId
 * @param {function():Object} opts.getSnapshot  required
 * @param {function(string,Object):void} [opts.onTip]  (tipText, pred)
 * @param {function(string,Object):void} [opts.onSuggestDifficulty] (diffKey, pred)
 * @param {function(Object,Object):void} [opts.onAIPrediction] (pred, snapshot)
 * @param {number} [opts.pollMs] default 1200
 * @param {number} [opts.tipCooldownMs] default 3500
 * @param {number} [opts.diffCooldownMs] default 12000
 * @param {boolean} [opts.allowAutoDifficulty] default false
 *        - if true: calls onSuggestDifficulty() automatically (only normal mode + ?ai=1)
 *        - if false: only surfaces suggestion via onAIPrediction()
 */
export function createAIFeatures(opts = {}) {
  const gameId = safeString(opts.gameId || 'vrfitness');
  const getSnapshot = opts.getSnapshot;

  const onTip = (typeof opts.onTip === 'function') ? opts.onTip : null;
  const onSuggestDifficulty = (typeof opts.onSuggestDifficulty === 'function') ? opts.onSuggestDifficulty : null;
  const onAIPrediction = (typeof opts.onAIPrediction === 'function') ? opts.onAIPrediction : null;

  const pollMs = Math.max(300, Number(opts.pollMs || 1200));
  const tipCooldownMs = Math.max(800, Number(opts.tipCooldownMs || 3500));
  const diffCooldownMs = Math.max(1500, Number(opts.diffCooldownMs || 12000));
  const allowAutoDifficulty = !!opts.allowAutoDifficulty;

  if (typeof getSnapshot !== 'function') {
    throw new Error('[AI] createAIFeatures requires getSnapshot()');
  }

  let timer = null;
  let lastTipAt = -1;
  let lastDiffAt = -1;
  let lastSuggestedDiff = '';
  let lastPred = null;

  // light hysteresis: avoid rapid flip-flop around thresholds
  function shouldApplyDifficulty(suggested) {
    const t = nowMs();
    if (!suggested) return false;
    if (!onSuggestDifficulty) return false;

    if (t - lastDiffAt < diffCooldownMs) return false;
    if (suggested === lastSuggestedDiff) return false;
    return true;
  }

  function tick() {
    // must exist
    const snap = (() => {
      try { return getSnapshot() || {}; } catch (e) { return {}; }
    })();

    // if RB_AI isn't loaded yet, do nothing (safe)
    const pred = safePredict(snap);
    if (!pred) return;

    lastPred = pred;

    // notify always (useful for logging/UI)
    if (onAIPrediction) {
      try { onAIPrediction(pred, snap); } catch (_) {}
    }

    // policy gate
    const locked = isLockedFromRB();
    const enabled = isAssistEnabledFromRB(); // false in research per predictor

    // tip rate-limit
    const t = nowMs();
    if (!locked && enabled && onTip && pred.tip) {
      if (t - lastTipAt >= tipCooldownMs) {
        lastTipAt = t;
        try { onTip(pred.tip, pred); } catch (_) {}
      }
    }

    // optional auto difficulty
    if (!locked && enabled && allowAutoDifficulty && pred.suggestedDifficulty) {
      const diffKey = String(pred.suggestedDifficulty || '').toLowerCase();
      if (diffKey && shouldApplyDifficulty(diffKey)) {
        lastDiffAt = t;
        lastSuggestedDiff = diffKey;
        try { onSuggestDifficulty(diffKey, pred); } catch (_) {}
      }
    }
  }

  function start() {
    if (timer) return;
    // If predictor not loaded yet, still start polling; it will become active when ready
    timer = setInterval(tick, pollMs);
    // do one immediate tick to warm up
    try { tick(); } catch (_) {}
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function getLastPrediction() {
    return lastPred;
  }

  function getStatus() {
    const mode = getModeFromRB();
    const locked = isLockedFromRB();
    const enabled = isAssistEnabledFromRB();
    return {
      gameId,
      mode,
      locked,
      enabled,
      pollMs,
      allowAutoDifficulty
    };
  }

  return {
    start,
    stop,
    tick,
    getLastPrediction,
    getStatus
  };
}