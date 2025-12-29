// === /herohealth/vr/ui-water.js ===
// Water Gauge UI helper (shared)
// Exports: ensureWaterGauge(), setWaterGauge(pct), zoneFrom(pct)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

export function zoneFrom(pct){
  pct = Number(pct)||0;
  // GREEN sweetspot (tuneable)
  if (pct >= 45 && pct <= 65) return 'GREEN';
  if (pct < 45) return 'LOW';
  return 'HIGH';
}

export function ensureWaterGauge(){
  // Optional: just ensures ids exist; if not, no crash.
  return {
    fill: DOC.getElementById('water-fill'),
    bar: DOC.getElementById('water-bar'),
    pct: DOC.getElementById('water-pct'),
    zone: DOC.getElementById('water-zone')
  };
}

export function setWaterGauge(pct){
  pct = Math.max(0, Math.min(100, Number(pct)||0));

  const elFill = DOC.getElementById('water-fill');
  const elBar  = DOC.getElementById('water-bar');
  const elPct  = DOC.getElementById('water-pct');
  const elZone = DOC.getElementById('water-zone');

  const z = zoneFrom(pct);

  if (elFill) elFill.style.height = pct.toFixed(0) + '%';
  if (elBar)  elBar.style.width   = pct.toFixed(0) + '%';
  if (elPct)  elPct.textContent   = pct.toFixed(0) + '%';
  if (elZone) elZone.textContent  = z;

  // body classes for theme
  const b = DOC.body;
  if (!b) return;
  b.classList.remove('water-low','water-green','water-high');
  if (z === 'LOW') b.classList.add('water-low');
  else if (z === 'HIGH') b.classList.add('water-high');
  else b.classList.add('water-green');
}