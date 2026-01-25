// === /herohealth/vr/ui-water.js ===
// Water Gauge helpers (HeroHealth Standard-ish)
// Exports: ensureWaterGauge(), setWaterGauge(pct), zoneFrom(pct)

'use strict';

const DOC = (typeof document !== 'undefined') ? document : null;

export function zoneFrom(pct){
  const p = Math.max(0, Math.min(100, Number(pct)||0));
  // ปรับ threshold ให้ “ออก GREEN ง่ายขึ้น” สำหรับ Storm mini
  if (p < 47) return 'LOW';
  if (p > 63) return 'HIGH';
  return 'GREEN';
}

function qs(id){ return DOC ? DOC.getElementById(id) : null; }

export function ensureWaterGauge(){
  if (!DOC) return;

  // ถ้ามี panel อยู่แล้ว (Hydration HUD) ก็ไม่ต้องสร้างใหม่
  if (qs('water-bar') && qs('water-pct') && qs('water-zone')) return;

  // fallback gauge (ถ้าเกมอื่นเรียกใช้แล้วไม่มี DOM)
  const wrap = DOC.createElement('div');
  wrap.id = 'hha-water-gauge';
  wrap.style.cssText = `
    position:fixed; left:12px; bottom:12px; z-index:9999;
    width:220px; padding:10px 10px; border-radius:16px;
    background:rgba(2,6,23,.72); border:1px solid rgba(148,163,184,.18);
    backdrop-filter: blur(10px); color:#e5e7eb; font-family:system-ui;
    box-shadow: 0 18px 60px rgba(0,0,0,.45);
  `;

  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <div style="font-weight:900">Water</div>
      <div style="font-weight:900">
        <span id="water-pct">50</span><span style="opacity:.85;font-size:12px">%</span>
      </div>
    </div>
    <div style="opacity:.9;font-size:12px;margin-top:2px">Zone <b id="water-zone">GREEN</b></div>
    <div style="margin-top:8px;height:10px;border-radius:999px;background:rgba(148,163,184,.18);overflow:hidden;border:1px solid rgba(148,163,184,.12)">
      <div id="water-bar" style="height:100%;width:50%;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95))"></div>
    </div>
  `;
  DOC.body.appendChild(wrap);
}

export function setWaterGauge(pct){
  if (!DOC) return;
  const p = Math.max(0, Math.min(100, Number(pct)||0));
  const bar = qs('water-bar');
  const pctEl = qs('water-pct');
  const zoneEl = qs('water-zone');

  if (bar) bar.style.width = p.toFixed(0) + '%';
  if (pctEl) pctEl.textContent = String(p|0);
  if (zoneEl) zoneEl.textContent = zoneFrom(p);
}