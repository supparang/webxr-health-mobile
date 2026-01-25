// === /herohealth/vr/ui-water.js ===
// Water Gauge UI + Zone helper (HHA)
// ✅ ensureWaterGauge(): mounts small fixed gauge (optional)
// ✅ setWaterGauge(pct): updates gauge (0-100)
// ✅ zoneFrom(pct, prevZone?): returns 'LOW' | 'GREEN' | 'HIGH' with hysteresis

'use strict';

const WIN = window;
const DOC = document;

let mounted = false;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

export function ensureWaterGauge(){
  if (mounted) return;
  mounted = true;

  // ถ้าหน้าเกมมี panel ของตัวเองอยู่แล้ว ก็ไม่จำเป็นต้องสร้างซ้ำ
  // แต่เผื่อบางเกมอยากมีเกจเล็กมุมจอ เราทำแบบ best-effort
  if (DOC.getElementById('hha-water-mini')) return;

  const wrap = DOC.createElement('div');
  wrap.id = 'hha-water-mini';
  wrap.style.cssText = `
    position:fixed; right:12px; bottom:12px; z-index:60;
    width:140px; padding:10px 10px; border-radius:14px;
    background:rgba(2,6,23,.55); border:1px solid rgba(148,163,184,.18);
    backdrop-filter: blur(10px);
    display:none; /* ซ่อนไว้เป็นค่าเริ่มต้น (หน้า hydration มีของตัวเองแล้ว) */
    pointer-events:none;
    color:#e5e7eb; font: 12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial;
  `;
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <b>Water</b><span id="hha-water-mini-pct">50%</span>
    </div>
    <div style="height:10px;border-radius:999px;overflow:hidden;background:rgba(148,163,184,.18);border:1px solid rgba(148,163,184,.12);">
      <div id="hha-water-mini-bar" style="height:100%;width:50%;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));"></div>
    </div>
    <div style="margin-top:6px;opacity:.9">Zone: <b id="hha-water-mini-zone">GREEN</b></div>
  `;
  DOC.body.appendChild(wrap);
}

export function setWaterGauge(pct){
  const p = clamp(pct, 0, 100);
  const bar = DOC.getElementById('hha-water-mini-bar');
  const t = DOC.getElementById('hha-water-mini-pct');
  const z = DOC.getElementById('hha-water-mini-zone');
  if (bar) bar.style.width = p.toFixed(0) + '%';
  if (t) t.textContent = p.toFixed(0) + '%';
  if (z) z.textContent = zoneFrom(p);
}

/**
 * zoneFrom(pct, prevZone?)
 * GREEN กว้างขึ้น + มี hysteresis กันสั่น:
 * - GREEN base: 42..68
 * - ถ้า prevZone เป็น GREEN จะยังถือ GREEN จนกว่าจะหลุดเกิน 40..70
 */
export function zoneFrom(pct, prevZone){
  const p = clamp(pct, 0, 100);

  const GREEN_LO = 42, GREEN_HI = 68;
  const HOLD_LO  = 40, HOLD_HI  = 70; // hysteresis band

  if (String(prevZone||'').toUpperCase() === 'GREEN'){
    if (p >= HOLD_LO && p <= HOLD_HI) return 'GREEN';
    return (p < HOLD_LO) ? 'LOW' : 'HIGH';
  }

  if (p >= GREEN_LO && p <= GREEN_HI) return 'GREEN';
  return (p < GREEN_LO) ? 'LOW' : 'HIGH';
}