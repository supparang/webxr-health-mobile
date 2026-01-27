// === /herohealth/vr/ui-water.js ===
// Water Gauge Utilities — PRODUCTION (NO-DUP + EASIER GREEN)
// ✅ Exports: ensureWaterGauge, setWaterGauge, zoneFrom
// ✅ Avoid duplicate gauge if page already has its own water panel
// ✅ Slightly wider GREEN zone for better play-feel

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

// โซนน้ำ (ปรับให้ง่ายขึ้นนิดนึง)
// เดิม: GREEN 45..65  -> ใหม่: GREEN 42..68 (คุมง่ายขึ้น)
export function zoneFrom(pct){
  const p = clamp(pct,0,100);
  if (p >= 42 && p <= 68) return 'GREEN';
  if (p < 42) return 'LOW';
  return 'HIGH';
}

function pageAlreadyHasWaterPanel(){
  if (!DOC) return false;
  // ถ้าเกมมี panel ของตัวเองอยู่แล้ว ให้ไม่ฉีด gauge ลอยเพิ่ม
  return !!(
    DOC.getElementById('water-bar') ||
    DOC.getElementById('water-zone') ||
    DOC.getElementById('water-pct') ||
    DOC.getElementById('water-panel') ||
    DOC.querySelector('[data-hha-water-panel="1"]')
  );
}

export function ensureWaterGauge(){
  if (!DOC) return;

  // allow explicit disable from page:
  // <script>window.HHA_WATER_GAUGE_DISABLE = 1;</script>
  if (ROOT.HHA_WATER_GAUGE_DISABLE) return;

  // ✅ สำคัญ: ถ้าหน้าเกมมี water panel อยู่แล้ว ไม่ฉีดซ้อน
  if (pageAlreadyHasWaterPanel()) return;

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

  // injected gauge (if exists)
  const bar1 = DOC.getElementById('hha-water-bar');
  const t1   = DOC.getElementById('hha-water-pct');
  const z1   = DOC.getElementById('hha-water-zone');
  if (bar1) bar1.style.width = p.toFixed(0) + '%';
  if (t1) t1.textContent = String(p|0);
  if (z1) z1.textContent = zone;

  // page water panel (if exists)
  const bar2 = DOC.getElementById('water-bar');
  const pct2 = DOC.getElementById('water-pct');
  const z2   = DOC.getElementById('water-zone');
  if (bar2) bar2.style.width = p.toFixed(0) + '%';
  if (pct2) pct2.textContent = String(p|0);
  if (z2) z2.textContent = zone;
}