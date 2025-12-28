// === /herohealth/vr/ui-water.js ===
// Water Gauge UI (ESM) — PRODUCTION
// ✅ 0–100 real gauge
// ✅ zone colors (LOW/GREEN/HIGH)
// ✅ supports multiple HUD copies via data-* (for cardboard stereo)

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

function setTextAll(sel, text){
  try{
    const nodes = DOC.querySelectorAll(sel);
    nodes.forEach(n => { try{ n.textContent = String(text); }catch{} });
  }catch{}
}

function setStyleAll(sel, fn){
  try{
    const nodes = DOC.querySelectorAll(sel);
    nodes.forEach(n => { try{ fn(n); }catch{} });
  }catch{}
}

const UI = {
  inited:false,
  elBar:null,
  elPct:null,
  elZone:null
};

export function ensureWaterGauge(){
  if (!DOC) return UI;

  // legacy single HUD ids (mono)
  UI.elBar  = DOC.getElementById('water-bar')  || DOC.querySelector('.hha-water-bar .bar') || DOC.querySelector('.hha-water-bar');
  UI.elPct  = DOC.getElementById('water-pct');
  UI.elZone = DOC.getElementById('water-zone');

  UI.inited = true;
  return UI;
}

export function setWaterGauge(pct){
  if (!DOC) return;
  if (!UI.inited) ensureWaterGauge();

  pct = clamp(pct, 0, 100);
  const z = zoneFrom(pct);

  // CSS vars (for fancy gradients if needed)
  try{
    DOC.documentElement.style.setProperty('--water', String(pct));
  }catch{}

  // bar width (mono id + data-water-bar copies)
  const w = pct.toFixed(2) + '%';

  try{
    if (UI.elBar){
      UI.elBar.style.width = w;
      UI.elBar.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
  }catch{}

  setStyleAll('[data-water-bar]', (el)=>{
    el.style.width = w;
    el.setAttribute('aria-valuenow', String(Math.round(pct)));
  });

  // labels (mono ids + data copies)
  try{ if (UI.elPct)  UI.elPct.textContent  = Math.round(pct) + '%'; }catch{}
  try{ if (UI.elZone) UI.elZone.textContent = z; }catch{}

  setTextAll('[data-water-pct]',  Math.round(pct) + '%');
  setTextAll('[data-water-zone]', z);

  // theming class
  try{
    DOC.body.classList.remove('water-low','water-green','water-high');
    DOC.body.classList.add(z === 'LOW' ? 'water-low' : (z === 'HIGH' ? 'water-high' : 'water-green'));
  }catch{}
}

export default { ensureWaterGauge, setWaterGauge, zoneFrom };
