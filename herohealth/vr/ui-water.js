// === /herohealth/vr/ui-water.js ===
// Water Gauge Utilities — PRODUCTION (NO-DUP gauge)
// ✅ Exports: ensureWaterGauge, setWaterGauge, zoneFrom
// ✅ If page already has water panel (#water-bar/#water-pct/#water-zone) -> do NOT create overlay
// ✅ setWaterGauge updates BOTH overlay + page panel (if present)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

// โซนน้ำ (ปรับให้ง่ายขึ้น: GREEN กว้างขึ้น)
export function zoneFrom(pct){
  const p = clamp(pct,0,100);
  if (p >= 40 && p <= 70) return 'GREEN';
  if (p < 40) return 'LOW';
  return 'HIGH';
}

function pageHasNativePanel(){
  if (!DOC) return false;
  // hydration.safe.js มี panel ของตัวเองอยู่แล้วใน hydration-vr.html
  return !!(
    DOC.getElementById('water-bar') ||
    DOC.getElementById('water-pct') ||
    DOC.getElementById('water-zone')
  );
}

export function ensureWaterGauge(){
  if (!DOC) return;

  // ✅ ถ้าหน้าเกมมี panel อยู่แล้ว -> ไม่สร้าง overlay ซ้ำ
  if (pageHasNativePanel()) return;

  // ✅ overlay already created
  if (DOC.getElementById('hha-water-gauge')) return;

  const wrap = DOC.createElement('div');
  wrap.id = 'hha-water-gauge';
  wrap.style.cssText = [
    'position:fixed',
    'left:12px',
    'bottom:12px',
    'z-index:60',
    'pointer-events:none',
    'width:220px',
    'padding:10px 12px',
    'border-radius:16px',
    'border:1px solid rgba(148,163,184,.18)',
    'background:rgba(2,6,23,.55)',
    'backdrop-filter:blur(10px)',
    'box-shadow:0 18px 70px rgba(0,0,0,.35)',
    'color:#e5e7eb',
    'font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial'
  ].join(';');

  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
      <div style="font-weight:900;font-size:13px;letter-spacing:.2px">Water</div>
      <div style="font-weight:900;font-size:18px">
        <span id="hha-water-pct">50</span><span style="opacity:.8;font-size:12px">%</span>
      </div>
    </div>
    <div style="margin-top:8px;height:10px;border-radius:999px;overflow:hidden;border:1px solid rgba(148,163,184,.14);background:rgba(148,163,184,.16)">
      <div id="hha-water-bar" style="height:100%;width:50%;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95))"></div>
    </div>
    <div style="margin-top:6px;font-size:12px;color:rgba(148,163,184,.95)">
      Zone: <b id="hha-water-zone" style="color:#e5e7eb">GREEN</b>
    </div>
  `;
  DOC.body.appendChild(wrap);
}

export function setWaterGauge(pct){
  if (!DOC) return;
  const p = clamp(pct,0,100);
  const zone = zoneFrom(p);

  // overlay (if exists)
  const barO = DOC.getElementById('hha-water-bar');
  const pctO = DOC.getElementById('hha-water-pct');
  const zoneO = DOC.getElementById('hha-water-zone');
  if (barO) barO.style.width = p.toFixed(0) + '%';
  if (pctO) pctO.textContent = String(p|0);
  if (zoneO) zoneO.textContent = zone;

  // native page panel (if exists)
  const barP = DOC.getElementById('water-bar');
  const pctP = DOC.getElementById('water-pct');
  const zoneP = DOC.getElementById('water-zone');
  if (barP) barP.style.width = p.toFixed(0) + '%';
  if (pctP) pctP.textContent = String(p|0);
  if (zoneP) zoneP.textContent = zone;
}