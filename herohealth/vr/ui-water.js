// === /herohealth/vr/ui-water.js ===
// Universal Water Gauge Helper — HHA Standard
// Exports: ensureWaterGauge, setWaterGauge, zoneFrom
// Safe if HUD elements are missing.

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

function zoneFrom(pct){
  const p = clamp(pct, 0, 100);
  // คุณอยากให้ GREEN “คุมยาก/ง่าย” ปรับ threshold ได้ตรงนี้
  // ค่าเริ่ม: GREEN 46–64
  if (p < 46) return 'LOW';
  if (p > 64) return 'HIGH';
  return 'GREEN';
}

function ensureWaterGauge(){
  // optional: create fallback if missing
  if (!DOC) return;

  // ถ้ามีอยู่แล้ว ไม่ทำอะไร
  if (DOC.getElementById('water-bar') || DOC.getElementById('water-pct') || DOC.getElementById('water-zone')) return;

  // fallback panel แบบมินิ (ถ้าเกมไหนไม่มี HUD)
  // จะไม่ไปทับของเดิม เพราะมีเฉพาะเมื่อไม่มี ids นี้จริง ๆ
  const el = DOC.createElement('div');
  el.id = 'hhaWaterFallback';
  el.style.cssText = `
    position:fixed; right:12px; top:12px; z-index:60;
    padding:10px 12px; border-radius:16px;
    background:rgba(2,6,23,.72); border:1px solid rgba(148,163,184,.18);
    color:#e5e7eb; font-family:system-ui; font-size:12px;
    box-shadow:0 18px 70px rgba(0,0,0,.35); backdrop-filter: blur(10px);
    pointer-events:none;
    max-width:240px;
  `;
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
      <div style="font-weight:900">Water</div>
      <div><b id="water-pct">50</b>%</div>
    </div>
    <div style="margin-top:6px;opacity:.9">Zone <b id="water-zone">GREEN</b></div>
    <div style="margin-top:8px;height:8px;border-radius:999px;overflow:hidden;background:rgba(148,163,184,.18);border:1px solid rgba(148,163,184,.12)">
      <div id="water-bar" style="height:100%;width:50%;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95))"></div>
    </div>
  `;
  DOC.body.appendChild(el);
}

function setWaterGauge(pct){
  if (!DOC) return;

  const p = clamp(pct, 0, 100);
  const bar  = DOC.getElementById('water-bar');
  const pctEl = DOC.getElementById('water-pct');
  const zoneEl = DOC.getElementById('water-zone');

  if (bar) bar.style.width = p.toFixed(0) + '%';
  if (pctEl) pctEl.textContent = String(p|0);

  const z = zoneFrom(p);
  if (zoneEl) zoneEl.textContent = z;

  // optional: add class hooks to body for styling/FX
  try{
    DOC.body.classList.toggle('zone-low', z==='LOW');
    DOC.body.classList.toggle('zone-green', z==='GREEN');
    DOC.body.classList.toggle('zone-high', z==='HIGH');
  }catch(_){}
}

export { ensureWaterGauge, setWaterGauge, zoneFrom };