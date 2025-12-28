// === /herohealth/vr/ui-water.js ===
// Water Gauge UI (ESM) — PRODUCTION
// ✅ supports "tube" (vertical) 0–100 + zone colors
// ✅ backward compatible with bar (#water-bar) + labels (#water-pct/#water-zone)
// ✅ sets body classes: water-low / water-green / water-high

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

  // classic horizontal bar
  elBar:null,

  // tube mode
  elTube:null,
  elTubeFill:null,

  // labels
  elPct:null,
  elZone:null
};

export function ensureWaterGauge(){
  if (!DOC) return UI;

  UI.elBar  = DOC.getElementById('water-bar')
            || DOC.querySelector('.hha-water-bar .bar')
            || DOC.querySelector('.hha-water-bar');

  UI.elTube     = DOC.getElementById('water-tube');
  UI.elTubeFill = DOC.getElementById('water-tube-fill');

  UI.elPct  = DOC.getElementById('water-pct')  || DOC.querySelector('[data-water-pct]');
  UI.elZone = DOC.getElementById('water-zone') || DOC.querySelector('[data-water-zone]');

  UI.inited = true;
  return UI;
}

function setBodyZoneClass(z){
  try{
    DOC.body.classList.remove('water-low','water-green','water-high');
    DOC.body.classList.add(z === 'LOW' ? 'water-low' : (z === 'HIGH' ? 'water-high' : 'water-green'));
  }catch{}
}

// optional: smooth color hint via CSS variable (0..100)
function setCssPctVar(pct){
  try{ DOC.documentElement.style.setProperty('--waterPct', String(pct)); }catch{}
}

export function setWaterGauge(pct){
  if (!DOC) return;
  if (!UI.inited) ensureWaterGauge();

  pct = clamp(pct, 0, 100);
  const z = zoneFrom(pct);

  // --- tube fill (preferred) ---
  try{
    if (UI.elTubeFill){
      UI.elTubeFill.style.height = pct.toFixed(2) + '%';
      UI.elTubeFill.setAttribute('aria-valuenow', String(Math.round(pct)));
      UI.elTubeFill.setAttribute('data-zone', z);
    }
  }catch{}

  // --- classic bar (fallback) ---
  try{
    if (UI.elBar){
      UI.elBar.style.width = pct.toFixed(2) + '%';
      UI.elBar.setAttribute('aria-valuenow', String(Math.round(pct)));
      UI.elBar.setAttribute('data-zone', z);
    }
  }catch{}

  // labels
  try{ if (UI.elPct)  UI.elPct.textContent  = Math.round(pct) + '%'; }catch{}
  try{ if (UI.elZone) UI.elZone.textContent = z; }catch{}

  setBodyZoneClass(z);
  setCssPctVar(pct);
}

export default { ensureWaterGauge, setWaterGauge, zoneFrom };