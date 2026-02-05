// === /fitness/js/dl-features.js ===
// DL-lite feature extractor (for explainable predictor)
// ✅ No hard import of RB_AI (works with global bridge)
'use strict';

function clamp01(v){ return Math.max(0, Math.min(1, Number(v)||0)); }

export function buildFeatures(state) {
  const totalTrials = (state.totalHits || 0) + (state.miss || 0);
  const accPct = totalTrials ? ((state.totalHits || 0) / totalTrials) * 100 : 0;

  const judged = totalTrials || 1;
  const missRate = clamp01((state.miss || 0) / judged);

  return {
    accPct,
    missRate,
    combo: state.combo || 0,
    maxCombo: state.maxCombo || 0,
    hp: Math.round((state.playerHp || 0) * 100),
    bossHp: Math.round((state.bossHp || 0) * 100),
    bossPhase: state.bossPhase || 1,
    clearedBosses: state.clearedBosses || 0,
    avgRtNormalMs: state.rtNormalCount ? (state.rtNormalSum / state.rtNormalCount) : null,
    avgRtDecoyMs: state.rtDecoyCount ? (state.rtDecoySum / state.rtDecoyCount) : null,

    // optional AI flags (best-effort)
    aiMode: (window.RB_AI && typeof window.RB_AI.getMode === 'function') ? window.RB_AI.getMode() : 'normal',
    aiEnabled: (window.RB_AI && typeof window.RB_AI.isAssistEnabled === 'function') ? window.RB_AI.isAssistEnabled() : false
  };
}