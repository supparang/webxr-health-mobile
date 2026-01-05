// === /herohealth/vr/ui-water.js ===
// Water UI helpers — PRODUCTION (minimal + safe)
// Used by Hydration SAFE and can be reused by other games.

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

export function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

export function zoneFrom(pct){
  const p = clamp(pct, 0, 100);
  // GREEN is "balanced" band; tune if you want stricter
  if (p >= 40 && p <= 70) return 'GREEN';
  return (p < 40) ? 'LOW' : 'HIGH';
}

// Optional: if you later want a floating gauge overlay across games.
// For now: "ensure" is a safe no-op (Hydration has its own panel already).
export function ensureWaterGauge(){
  try{
    if (!DOC) return;
    // If you want a global tiny overlay later, add here.
  }catch(_){}
}

// Best-effort sync (Hydration already updates its own DOM too; this is safe)
export function setWaterGauge(pct){
  try{
    if (!DOC) return;
    const p = clamp(pct, 0, 100);
    const bar = DOC.getElementById('water-bar');
    const pctEl = DOC.getElementById('water-pct');
    const zoneEl = DOC.getElementById('water-zone');
    if (bar) bar.style.width = p.toFixed(0) + '%';
    if (pctEl) pctEl.textContent = String(p|0);
    if (zoneEl) zoneEl.textContent = zoneFrom(p);
  }catch(_){}
}