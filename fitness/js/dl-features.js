'use strict';

import { AiCoach } from './ai-coach.js';
import { AiPattern } from './ai-pattern.js';
import { RB_AI } from './ai-predictor.js';

// DlFeatures — orchestrates predictor+coach+pattern (play only)
export const DlFeatures = {
  _lastTipAt: 0,

  maybeCoachTip(mode, snapshot = {}) {
    if (String(mode) === 'research') return;

    const now = performance.now();
    if (now - this._lastTipAt < 1400) return; // rate limit tips
    this._lastTipAt = now;

    // If predictor exists, use it; else fallback
    let tip = '';
    try{
      const api = (window.RB_AI || RB_AI);
      if (api && api.isAssistEnabled && api.isAssistEnabled()){
        const pred = api.predict({
          accPct: snapshot.accPct ?? 0,
          hitMiss: snapshot.miss ?? 0,
          combo: snapshot.combo ?? 0,
          hp: snapshot.youHp ?? 100,
          offsetAbsMean: snapshot.offsetAbsMean ?? 0.09
        });
        tip = pred?.tip || '';
      }
    }catch(_){}

    if (!tip) {
      tip = AiCoach.quickTip(snapshot);
    }

    if (tip) AiCoach.toast(tip);
  },

  pickPattern(seedStr, phase, diff){
    return AiPattern.pick(seedStr, phase, diff);
  }
};