// === /herohealth/vr/ai-goodjunk.js ===
// AI Director + Explainable Coach for GoodJunk (Model-backed)
// v20260302-AI-MODEL
'use strict';

import { predictGoodJunkRisk } from './goodjunk-model.js';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createGoodJunkAI(cfg={}){
  const state = {
    lastHintAt: 0,
    lastOutAt: 0,
    hintCooldownMs: 2200,
    tickMinMs: 900
  };

  return {
    maybeHint(snap){
      const t = Date.now();
      if(t - state.lastOutAt < state.tickMinMs) return null;
      state.lastOutAt = t;

      const pred = predictGoodJunkRisk(snap);
      const risk = clamp(pred.risk, 0, 1);

      // rate-limit hint
      let hint = '—';
      if(t - state.lastHintAt >= state.hintCooldownMs){
        hint = pred.hint || '—';
        state.lastHintAt = t;
      }

      return {
        risk,
        hint,
        director: {
          model: 'baseline-v1',
          x: pred.x
        }
      };
    }
  };
}