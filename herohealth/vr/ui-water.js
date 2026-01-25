// === /herohealth/vr/ui-water.js ===
// Minimal Water UI helpers (Hydration-compatible)
// ✅ ensureWaterGauge(): safe no-op
// ✅ setWaterGauge(pct): updates #water-pct/#water-bar/#water-zone if present
// ✅ zoneFrom(pct): GREEN / LOW / HIGH

'use strict';

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

export function zoneFrom(pct){
  const p = clamp(pct, 0, 100);
  // ปรับ threshold ได้ตามที่ชอบ
  if (p >= 45 && p <= 65) return 'GREEN';
  if (p < 45) return 'LOW';
  return 'HIGH';
}

export function ensureWaterGauge(){
  // เผื่ออนาคตจะมี gauge กลางจอ—ตอนนี้ใช้ panel ใน hydration-vr.html อยู่แล้ว
  return true;
}

export function setWaterGauge(pct){
  try{
    const p = clamp(pct,0,100);
    const bar = document.getElementById('water-bar');
    const pctEl = document.getElementById('water-pct');
    const zoneEl = document.getElementById('water-zone');

    if (bar) bar.style.width = `${Math.round(p)}%`;
    if (pctEl) pctEl.textContent = String(Math.round(p));
    if (zoneEl) zoneEl.textContent = zoneFrom(p);
  }catch(_){}
}
