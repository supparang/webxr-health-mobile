// === /herohealth/ai/ml-goodjunk.js ===
// Loads a model JSON + produces prediction from estimator state.

'use strict';
import { predict } from './model-runtime.js';
import { clamp } from './skill-estimator.js';

export async function loadJSON(url){
  const res = await fetch(url, { cache:'no-store' });
  if(!res.ok) throw new Error('load model failed: ' + res.status);
  return await res.json();
}

// Feature builder: must match model.features ordering
export function buildFeatures(estState, bossActive){
  const s = estState || {};
  const x = [
    clamp(s.emaAcc ?? 0.65, 0, 1),
    clamp(s.emaCombo ?? 0.25, 0, 1),
    clamp(s.emaJunkRate ?? 0.10, 0, 1),
    clamp(s.emaExpireRate ?? 0.08, 0, 1),
    clamp(s.emaMissStreak ?? 0.00, 0, 1),
    bossActive ? 1 : 0
  ];
  return x;
}

export function predictRisk(model, estState, bossActive){
  const x = buildFeatures(estState, bossActive);
  const y = predict(model, x);
  if(y == null) return null;
  return clamp(y, 0, 1);
}