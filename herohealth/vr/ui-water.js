// === /herohealth/vr/ui-water.js ===
// Water Gauge UI (ESM) — PRODUCTION
// ✅ ensureWaterGauge(): bind elements
// ✅ setWaterGauge(pct): clamp + update bar + tube + labels + body class
// ✅ zoneFrom(pct): LOW / GREEN / HIGH
// ✅ guards NaN and weird values

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){
  v = Number(v);
  if (!Number.isFinite(v)) v = a;
  return v < a ? a : (v > b ? b : v);
}

function zoneFrom(pct){
  pct = clamp(pct, 0, 100);
  if (pct < 45) return 'LOW';
  if (pct > 65) return 'HIGH';
  return 'GREEN';
}

const UI = {
  inited:false,
  elBar:null,   // horizontal fill (width %)
  elFillV:null, // vertical fill (height %)
  elPct:null,
  elZone:null
};

export function ensureWaterGauge(){
  if (!DOC) return UI;

  UI.elBar   = DOC.getElementById('water-bar')
            || DOC.querySelector('.hha-water-bar .bar')
            || DOC.querySelector('.hha-water-bar');

  UI.elFillV = DOC.getElementById('water-fill')
            || DOC.querySelector('[data-water-fill]');

  UI.elPct   = DOC.getElementById('water-pct')
            || DOC.querySelector('[data-water-pct]');

  UI.elZone  = DOC.getElementById('water-zone')
            || DOC.querySelector('[data-water-zone]');

  UI.inited = true;
  return UI;
}

export function setWaterGauge(pct){
  if (!DOC) return;
  if (!UI.inited) ensureWaterGauge();

  pct = clamp(pct, 0, 100);
  const z = zoneFrom(pct);

  // horizontal bar
  try{
    if (UI.elBar){
      UI.elBar.style.width = pct.toFixed(2) + '%';
      UI.elBar.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
  }catch{}

  // vertical tube
  try{
    if (UI.elFillV){
      UI.elFillV.style.height = pct.toFixed(2) + '%';
      UI.elFillV.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
  }catch{}

  // labels
  try{ if (UI.elPct)  UI.elPct.textContent  = Math.round(pct) + '%'; }catch{}
  try{ if (UI.elZone) UI.elZone.textContent = z; }catch{}

  // body class
  try{
    DOC.body.classList.remove('water-low','water-green','water-high');
    DOC.body.classList.add(z === 'LOW' ? 'water-low' : (z === 'HIGH' ? 'water-high' : 'water-green'));
  }catch{}
}

export { zoneFrom };
export default { ensureWaterGauge, setWaterGauge, zoneFrom };