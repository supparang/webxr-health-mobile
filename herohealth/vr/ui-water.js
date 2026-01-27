// === /herohealth/vr/ui-water.js ===
// Water Gauge Utilities — PRODUCTION (No-dup)
// ✅ Exports: ensureWaterGauge, setWaterGauge, zoneFrom
// ✅ IMPORTANT: Will NOT inject floating gauge if page already has a water panel
//    - detects: [data-hha-water-panel="1"] OR #waterPanel OR .water-panel OR #water-bar/#water-zone

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function pageHasWaterPanel(){
  try{
    if (!DOC) return true;
    return !!(
      DOC.querySelector('[data-hha-water-panel="1"]') ||
      DOC.getElementById('waterPanel') ||
      DOC.querySelector('.water-panel') ||
      DOC.getElementById('water-bar') ||
      DOC.getElementById('water-zone')
    );
  }catch(_){
    return true;
  }
}

// โซนน้ำ: ทำให้ “คุม GREEN ง่ายขึ้น” (กว้างขึ้นเล็กน้อย)
export function zoneFrom(pct){
  const p = clamp(pct,0,100);
  // เดิม 45–65 => ปรับเป็น 42–68 (เล่นง่ายขึ้นนิดนึง)
  if (p >= 42 && p <= 68) return 'GREEN';
  if (p < 42) return 'LOW';
  return 'HIGH';
}

export function ensureWaterGauge(){
  if (!DOC) return;

  // ✅ ถ้าหน้ามี water panel อยู่แล้ว: ไม่ฉีด gauge ลอย
  if (pageHasWaterPanel()) return;

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

  // ถ้ามี panel ของหน้าเกมอยู่แล้ว ก็ไม่ยุ่ง (ใช้ของหน้าเกม)
  if (pageHasWaterPanel()) return;

  const p = clamp(pct,0,100);
  const bar = DOC.getElementById('hha-water-bar');
  const t = DOC.getElementById('hha-water-pct');
  const z = DOC.getElementById('hha-water-zone');

  if (bar) bar.style.width = p.toFixed(0) + '%';
  if (t) t.textContent = String(p|0);

  const zone = zoneFrom(p);
  if (z) z.textContent = zone;
}