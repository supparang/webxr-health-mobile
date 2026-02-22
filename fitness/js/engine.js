// === /fitness/js/engine.js ===
// Shadow Breaker engine (PATCH: AI import compatibility + expire/miss/layout fixes)
'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { DLFeatures } from './dl-features.js';
// ❌ ลบบรรทัดนี้ออก
// import { AIPredictor } from './ai-predictor.js';

// ✅ ใช้ global/classic script bridge แทน (รองรับไฟล์ ai-predictor.js แบบ window.RB_AI)
function getAIHandle(){
  try {
    if (window.RB_AI && typeof window.RB_AI.predict === 'function') return window.RB_AI;
  } catch {}
  // fallback object กันพัง
  return {
    getMode(){ return 'normal'; },
    isAssistEnabled(){ return false; },
    isLocked(){ return false; },
    predict(){ return { fatigueRisk:0, skillScore:0, suggestedDifficulty:'normal', tip:'' }; }
  };
}