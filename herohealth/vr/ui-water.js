// === /herohealth/vr/ui-water.js ===
// Water Gauge UI (ESM) — PRODUCTION SAFE (LATEST)
// ✅ ensureWaterGauge(): bind elements (supports many DOM patterns)
// ✅ setWaterGauge(pct): robust parse ("50" / "50%" / number), clamp 0–100
// ✅ Horizontal OR Vertical fill (auto-detect via data-water-vertical / .vertical)
// ✅ zoneFrom(pct): LOW / GREEN / HIGH
// ✅ body classes: water-low / water-green / water-high
// ✅ writes: data-water-pct + data-water-zone for easy CSS theming

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function toNum(v){
  if (typeof v === 'number') return v;
  if (typeof v === 'string'){
    const s = v.trim();
    if (!s) return NaN;
    // allow "50%" or " 50.2 % "
    const m = s.match(/^(-?\d+(?:\.\d+)?)\s*%?$/);
    if (m) return Number(m[1]);
    return Number(s);
  }
  return Number(v);
}

function clamp(v, a, b){
  v = toNum(v);
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
  elRoot:null,
  elBar:null,   // fill element
  elPct:null,
  elZone:null
};

function pickRoot(){
  return (
    DOC.getElementById('waterGauge') ||
    DOC.querySelector('[data-water-root]') ||
    DOC.querySelector('.hha-water') ||
    DOC.querySelector('.hha-water-bar') ||
    null
  );
}

function pickBar(){
  // common patterns:
  // 1) #water-bar (fill)
  // 2) .hha-water-bar .bar (fill)
  // 3) [data-water-bar]
  // 4) .hha-water-bar (if itself is the fill)
  return (
    DOC.getElementById('water-bar') ||
    DOC.querySelector('.hha-water-bar .bar') ||
    DOC.querySelector('[data-water-bar]') ||
    DOC.querySelector('.hha-water-bar') ||
    null
  );
}

function isVertical(el){
  try{
    if (!el) return false;
    if (el.getAttribute('data-water-vertical') === '1') return true;
    if (el.classList && el.classList.contains('vertical')) return true;
    // if inside a vertical root
    const root = UI.elRoot || el.closest?.('[data-water-vertical="1"], .vertical');
    return !!root;
  }catch{
    return false;
  }
}

export function ensureWaterGauge(){
  if (!DOC) return UI;

  UI.elRoot = pickRoot();
  UI.elBar  = pickBar();
  UI.elPct  = DOC.getElementById('water-pct')  || DOC.querySelector('[data-water-pct]');
  UI.elZone = DOC.getElementById('water-zone') || DOC.querySelector('[data-water-zone]');

  UI.inited = true;
  return UI;
}

export function setWaterGauge(pct){
  if (!DOC) return;
  if (!UI.inited) ensureWaterGauge();

  pct = clamp(pct, 0, 100);
  const z = zoneFrom(pct);

  // update fill
  try{
    const bar = UI.elBar;
    if (bar){
      const v = pct.toFixed(2) + '%';
      if (isVertical(bar)){
        bar.style.height = v;
        // keep width intact (for layouts that expect fixed width)
      }else{
        bar.style.width = v;
      }
      bar.setAttribute('aria-valuenow', String(Math.round(pct)));
      bar.setAttribute('data-water-pct', String(Math.round(pct)));
      bar.setAttribute('data-water-zone', z);
    }
  }catch{}

  // labels
  try{ if (UI.elPct)  UI.elPct.textContent  = Math.round(pct) + '%'; }catch{}
  try{ if (UI.elZone) UI.elZone.textContent = z; }catch{}

  // root attrs (for CSS)
  try{
    const r = UI.elRoot;
    if (r){
      r.setAttribute('data-water-pct', String(Math.round(pct)));
      r.setAttribute('data-water-zone', z);
    }
  }catch{}

  // body class for theming
  try{
    DOC.body.classList.remove('water-low','water-green','water-high');
    DOC.body.classList.add(z === 'LOW' ? 'water-low' : (z === 'HIGH' ? 'water-high' : 'water-green'));
  }catch{}
}

export { zoneFrom };
export default { ensureWaterGauge, setWaterGauge, zoneFrom };
