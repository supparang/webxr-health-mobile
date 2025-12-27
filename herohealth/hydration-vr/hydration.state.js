// === /herohealth/hydration-vr/hydration.state.js ===
// Shared helpers for Hydration (rank, zones, ids) — PATCHED
// ✅ Fix: removed duplicate zoneFromPct() declaration
// ✅ Keep alias zoneFromPctAlias
// ✅ Keep rankFromScore mapping: SSS, SS, S, A, B, C

'use strict';

export function clamp01(v){
  v = Number(v) || 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// zone mapping (single source)
export function zoneFromPct(pct){
  pct = Number(pct)||0;
  if (pct < 35) return 'LOW';
  if (pct > 70) return 'HIGH';
  return 'BALANCED';
}
export const zoneFromPctAlias = zoneFromPct;

export function makeSessionId(){
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random()*1e9).toString(36);
  return `HHA-${t}-${r}`;
}

// Grade mapping: SSS, SS, S, A, B, C
export function rankFromScore(scoreFinal, misses, comboMax){
  scoreFinal = Number(scoreFinal)||0;
  misses = Number(misses)||0;
  comboMax = Number(comboMax)||0;

  // soft normalize
  const bonusCombo = Math.min(400, comboMax * 12);
  const penalty = misses * 120;

  const eff = scoreFinal + bonusCombo - penalty;

  if (eff >= 3200 && misses <= 2) return 'SSS';
  if (eff >= 2600 && misses <= 4) return 'SS';
  if (eff >= 2100 && misses <= 6) return 'S';
  if (eff >= 1500) return 'A';
  if (eff >= 900)  return 'B';
  return 'C';
}
