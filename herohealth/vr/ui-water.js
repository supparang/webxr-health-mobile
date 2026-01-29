// === /herohealth/vr/ui-water.js ===
// Water Gauge Utilities — PRODUCTION (Adaptive Anchor)
// ✅ Exports: ensureWaterGauge, setWaterGauge, zoneFrom
// ✅ Avoid duplicate gauges
// ✅ Adaptive placement by device/body class
// ✅ Optional override: window.HHA_WATER_GAUGE_CONFIG
//    { anchor:'bl'|'tl'|'tr'|'br', width:220, offsetX:12, offsetY:12 }

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function zoneFrom(pct){
  const p = clamp(pct,0,100);
  if (p >= 45 && p <= 65) return 'GREEN';
  if (p < 45) return 'LOW';
  return 'HIGH';
}

function safeInset(){
  // use CSS env() in style; here just return 0 fallback for numeric offset calc
  return { t:0, r:0, b:0, l:0 };
}

function getAnchor(){
  const cfg = ROOT.HHA_WATER_GAUGE_CONFIG || {};
  if (cfg.anchor) return String(cfg.anchor).toLowerCase();

  // auto by body class + viewport
  try{
    const b = DOC?.body;
    const w = Math.max(1, ROOT.innerWidth || 0);

    if (b?.classList?.contains('cardboard')) return 'tr';
    if (b?.classList?.contains('view-cvr')) return 'tl';
    if (w <= 520) return 'bl';
  }catch(_){}
  return 'bl';
}

function applyAnchorStyle(el){
  const cfg = ROOT.HHA_WATER_GAUGE_CONFIG || {};
  const anchor = getAnchor();
  const w = clamp(cfg.width ?? 220, 160, 320);
  const ox = clamp(cfg.offsetX ?? 12, 0, 48);
  const oy = clamp(cfg.offsetY ?? 12, 0, 48);

  // safe-area via CSS env()
  // anchor: bl/tl/tr/br
  const s = safeInset();
  let pos = [];

  pos.push(`width:${w}px`);
  pos.push('position:fixed');
  pos.push('z-index:60');
  pos.push('pointer-events:none');

  if (anchor === 'tl'){
    pos.push(`left:calc(${ox}px + env(safe-area-inset-left, ${s.l}px))`);
    pos.push(`top:calc(${oy}px + env(safe-area-inset-top, ${s.t}px))`);
    pos.push('right:auto'); pos.push('bottom:auto');
  } else if (anchor === 'tr'){
    pos.push(`right:calc(${ox}px + env(safe-area-inset-right, ${s.r}px))`);
    pos.push(`top:calc(${oy}px + env(safe-area-inset-top, ${s.t}px))`);
    pos.push('left:auto'); pos.push('bottom:auto');
  } else if (anchor === 'br'){
    pos.push(`right:calc(${ox}px + env(safe-area-inset-right, ${s.r}px))`);
    pos.push(`bottom:calc(${oy}px + env(safe-area-inset-bottom, ${s.b}px))`);
    pos.push('left:auto'); pos.push('top:auto');
  } else {
    // bl
    pos.push(`left:calc(${ox}px + env(safe-area-inset-left, ${s.l}px))`);
    pos.push(`bottom:calc(${oy}px + env(safe-area-inset-bottom, ${s.b}px))`);
    pos.push('right:auto'); pos.push('top:auto');
  }

  el.style.cssText = [
    pos.join(';'),
    'padding:10px 12px',
    'border-radius:16px',
    'border:1px solid rgba(148,163,184,.18)',
    'background:rgba(2,6,23,.55)',
    'backdrop-filter:blur(10px)',
    'box-shadow:0 18px 70px rgba(0,0,0,.35)',
    'color:#e5e7eb',
    'font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial'
  ].join(';');
}

export function ensureWaterGauge(){
  if (!DOC) return;

  // ✅ if already exists, just re-anchor (in case view changed)
  let wrap = DOC.getElementById('hha-water-gauge');
  if (wrap){
    applyAnchorStyle(wrap);
    return;
  }

  wrap = DOC.createElement('div');
  wrap.id = 'hha-water-gauge';
  applyAnchorStyle(wrap);

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

  // keep position adaptive if device changes
  const wrap = DOC.getElementById('hha-water-gauge');
  if (wrap) applyAnchorStyle(wrap);

  const bar = DOC.getElementById('hha-water-bar');
  const t = DOC.getElementById('hha-water-pct');
  const z = DOC.getElementById('hha-water-zone');

  if (bar) bar.style.width = p.toFixed(0) + '%';
  if (t) t.textContent = String(p|0);

  const zone = zoneFrom(p);
  if (z) z.textContent = zone;
}