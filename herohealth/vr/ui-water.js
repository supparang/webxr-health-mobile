// === /herohealth/vr/ui-water.js ===
// Water UI for HeroHealth (DOM)
// - ensureWaterGauge() binds DOM once
// - setWaterGauge(pct) updates:
//   #water-fill height, #water-bar width, #water-zone text, #water-pct text
//   body class: water-low / water-green / water-high

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

let bound = false;
let elFill = null;
let elBar = null;
let elZone = null;
let elPct = null;

export function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

export function zoneFrom(pct){
  pct = clamp(pct, 0, 100);
  // โซนแบบ HeroHealth: LOW / GREEN / HIGH
  // ปรับได้ง่าย: GREEN แคบ/กว้างตามต้องการ
  if (pct < 40) return 'LOW';
  if (pct > 70) return 'HIGH';
  return 'GREEN';
}

export function ensureWaterGauge(){
  if (!DOC || bound) return;
  bound = true;

  elFill = DOC.getElementById('water-fill');
  elBar  = DOC.getElementById('water-bar');
  elZone = DOC.getElementById('water-zone');
  elPct  = DOC.getElementById('water-pct');
}

export function setWaterGauge(pct){
  ensureWaterGauge();
  pct = clamp(pct, 0, 100);

  const z = zoneFrom(pct);

  try{
    if (elFill) elFill.style.height = pct.toFixed(0) + '%';
    if (elBar)  elBar.style.width  = pct.toFixed(0) + '%';
    if (elZone) elZone.textContent = z;
    if (elPct)  elPct.textContent  = pct.toFixed(0) + '%';
  }catch{}

  // body class for color themes
  try{
    const b = DOC.body;
    if (!b) return;
    b.classList.remove('water-low','water-green','water-high');
    if (z === 'LOW') b.classList.add('water-low');
    else if (z === 'HIGH') b.classList.add('water-high');
    else b.classList.add('water-green');
  }catch{}
}