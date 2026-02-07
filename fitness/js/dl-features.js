// === /fitness/js/dl-features.js ===
// DL-lite features bridge (safe for Research; AI only in Play when ?ai=1)
// ✅ FIX: ai-predictor.js is Classic (no exports) => import side-effect then read window.RB_AI
// Export helpers used by engine.

'use strict';

// Load predictor as side-effect module (it sets window.RB_AI)
async function loadPredictor(){
  try{
    await import('./ai-predictor.js'); // classic IIFE runs, sets window.RB_AI
  }catch(e){
    // ignore; engine must not crash if AI missing
    console.warn('[dl-features] ai-predictor load failed', e);
  }
  return (typeof window !== 'undefined') ? (window.RB_AI || null) : null;
}

let _AI_PROMISE = null;
export function getAI(){
  if(!_AI_PROMISE) _AI_PROMISE = loadPredictor();
  return _AI_PROMISE;
}

export async function isAssistEnabled(){
  const ai = await getAI();
  try{ return !!ai?.isAssistEnabled?.(); }catch{ return false; }
}

export async function predict(snapshot){
  const ai = await getAI();
  try{ return ai?.predict?.(snapshot || {}) || null; }catch{ return null; }
}

export async function getMode(){
  const ai = await getAI();
  try{ return ai?.getMode?.() || 'normal'; }catch{ return 'normal'; }
}

export async function isLocked(){
  const ai = await getAI();
  try{ return !!ai?.isLocked?.(); }catch{ return false; }
}