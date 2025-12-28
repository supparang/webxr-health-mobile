// === /herohealth/vr/ui-water.js ===
// Water Gauge UI (ESM) — PRODUCTION
// ✅ 0–100 (real)
// ✅ zoneFrom: LOW / GREEN / HIGH
// ✅ body class: water-low / water-green / water-high
// ✅ safe clamp + NaN guard

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){
  v = Number(v);
  if (!Number.isFinite(v)) v = a;
  return v < a ? a : (v > b ? b : v);
}

export function zoneFrom(pct){
  pct = clamp(pct, 0, 100);
  if (pct < 45) return 'LOW';
  if (pct > 65) return 'HIGH';
  return 'GREEN';
}

const UI = {
  inited:false,
  elBar:null,
  elPct:null,
  elZone:null
};

export function ensureWaterGauge(){
  if (!DOC) return UI;

  UI.elBar  = DOC.getElementById('water-bar')
            || DOC.querySelector('.hha-water-bar .bar')
            || DOC.querySelector('.hha-water-bar');

  UI.elPct  = DOC.getElementById('water-pct')
            || DOC.querySelector('[data-water-pct]');

  UI.elZone = DOC.getElementById('water-zone')
            || DOC.querySelector('[data-water-zone]');

  UI.inited = true;
  return UI;
}

export function setWaterGauge(pct){
  if (!DOC) return;
  if (!UI.inited) ensureWaterGauge();

  pct = clamp(pct, 0, 100);
  const z = zoneFrom(pct);

  try{
    if (UI.elBar){
      UI.elBar.style.width = pct.toFixed(2) + '%';
      UI.elBar.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
  }catch{}

  try{ if (UI.elPct)  UI.elPct.textContent  = Math.round(pct) + '%'; }catch{}
  try{ if (UI.elZone) UI.elZone.textContent = z; }catch{}

  try{
    DOC.body.classList.remove('water-low','water-green','water-high');
    DOC.body.classList.add(z === 'LOW' ? 'water-low' : (z === 'HIGH' ? 'water-high' : 'water-green'));
  }catch{}
}

export default { ensureWaterGauge, setWaterGauge, zoneFrom };