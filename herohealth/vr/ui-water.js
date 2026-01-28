// === /herohealth/vr/ui-water.js ===
// Water Gauge Utilities — PRODUCTION (UPDATED)
// ✅ ensureWaterGauge() will NOT create if page already has built-in water panel
// ✅ Supports thresholds via window.HHA_WATER_ZONE = { greenMin, greenMax }
// ✅ Exports: ensureWaterGauge, setWaterGauge, zoneFrom

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function getThresholds(){
  // Optional override:
  // window.HHA_WATER_ZONE = { greenMin: 42, greenMax: 68 }
  const z = ROOT.HHA_WATER_ZONE || {};
  const greenMin = clamp(z.greenMin ?? 45, 0, 100);
  const greenMax = clamp(z.greenMax ?? 65, 0, 100);
  const lo = Math.min(greenMin, greenMax);
  const hi = Math.max(greenMin, greenMax);
  return { greenMin: lo, greenMax: hi };
}

// Zone
export function zoneFrom(pct){
  const p = clamp(pct,0,100);
  const { greenMin, greenMax } = getThresholds();
  if (p >= greenMin && p <= greenMax) return 'GREEN';
  if (p < greenMin) return 'LOW';
  return 'HIGH';
}

function hasBuiltInPanel(){
  if (!DOC) return false;
  // hydration.safe.js uses these ids for its own panel
  return !!(DOC.getElementById('water-bar') || DOC.getElementById('water-pct') || DOC.getElementById('water-zone'));
}

export function ensureWaterGauge(){
  if (!DOC) return;

  // ✅ Prevent double gauge if page already has panel
  if (hasBuiltInPanel()) return;

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

  // 1) If we have the utility gauge, update it
  const bar = DOC.getElementById('hha-water-bar');
  const t = DOC.getElementById('hha-water-pct');
  const z = DOC.getElementById('hha-water-zone');

  if (bar) bar.style.width = p.toFixed(0) + '%';
  if (t) t.textContent = String(p|0);
  if (z) z.textContent = zone;

  // 2) If page has built-in panel ids, update them too (safe no-op)
  const bar2 = DOC.getElementById('water-bar');
  const pct2 = DOC.getElementById('water-pct');
  const zone2 = DOC.getElementById('water-zone');
  if (bar2) bar2.style.width = p.toFixed(0) + '%';
  if (pct2) pct2.textContent = String(p|0);
  if (zone2) zone2.textContent = zone;
}