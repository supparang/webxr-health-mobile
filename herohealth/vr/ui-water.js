// === /herohealth/vr/ui-water.js ===
// Water UI helper — PRODUCTION
// Provides:
//   ensureWaterGauge()  -> optional: ensures body water-zone classes exist
//   setWaterGauge(pct)  -> updates body classes + (optional) any extra UI hooks
//   zoneFrom(pct)       -> LOW / GREEN / HIGH
//
// Note: ตัวนี้ “แสดงผล” อย่างเดียว (ไม่คุมตรรกะน้ำ)

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

export function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function zoneFrom(pct){
  const p = clamp(pct, 0, 100);
  // ปรับ threshold ให้เด็กเข้าใจง่าย: GREEN โซนค่อนข้างกว้าง
  if (p < 40) return 'LOW';
  if (p > 70) return 'HIGH';
  return 'GREEN';
}

export function ensureWaterGauge(){
  if (!DOC) return;
  // ตั้งคลาสเริ่มต้นกันไว้
  DOC.body.classList.add('water-green');
}

export function setWaterGauge(pct){
  if (!DOC) return;
  const p = clamp(pct, 0, 100);
  const z = zoneFrom(p);

  DOC.body.classList.remove('water-low','water-green','water-high');
  if (z === 'LOW') DOC.body.classList.add('water-low');
  else if (z === 'HIGH') DOC.body.classList.add('water-high');
  else DOC.body.classList.add('water-green');

  // (optional) หากอยากใส่ effect เพิ่มทีหลัง ให้ hook ตรงนี้ได้
  return z;
}