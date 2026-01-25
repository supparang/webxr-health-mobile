// === /herohealth/vr/ui-water.js ===
// Water Gauge helpers — PRODUCTION
// ✅ Exports: ensureWaterGauge, setWaterGauge, zoneFrom
// ✅ Works with hydration-vr.html elements: #water-bar #water-pct #water-zone

'use strict';

const DOC = (typeof window !== 'undefined') ? window.document : null;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

// Zone thresholds (ปรับได้ง่าย)
export function zoneFrom(pct){
  const p = clamp(pct, 0, 100);

  // GREEN ช่วงกลาง “พอจับได้” สำหรับเด็ก ป.5
  // ถ้ายังรู้สึกยาก: ขยาย GREEN เป็น 42–68
  const GREEN_LO = 45;
  const GREEN_HI = 65;

  if (p < GREEN_LO) return 'LOW';
  if (p > GREEN_HI) return 'HIGH';
  return 'GREEN';
}

function gid(id){
  try{ return DOC?.getElementById(id) || null; }catch(_){ return null; }
}

let cached = null;

export function ensureWaterGauge(){
  if (!DOC) return;
  if (cached) return cached;

  const bar = gid('water-bar');
  const pct = gid('water-pct');
  const zone = gid('water-zone');

  cached = { bar, pct, zone };

  // ตั้งค่า default ให้เห็นชัด
  try{
    if (bar && !bar.style.width) bar.style.width = '50%';
    if (pct && !pct.textContent) pct.textContent = '50';
    if (zone && !zone.textContent) zone.textContent = 'GREEN';
  }catch(_){}

  return cached;
}

export function setWaterGauge(pctValue){
  if (!DOC) return;

  const ui = ensureWaterGauge() || {};
  const p = clamp(pctValue, 0, 100);
  const z = zoneFrom(p);

  try{
    if (ui.bar) ui.bar.style.width = p.toFixed(0) + '%';
    if (ui.pct) ui.pct.textContent = String(p|0);
    if (ui.zone) ui.zone.textContent = z;
  }catch(_){}
}