// === /herohealth/vr/ui-water.js ===
// Water Gauge Utilities — PRODUCTION (PATCH: no-dup + adaptive placement)
// ✅ Exports: ensureWaterGauge, setWaterGauge, zoneFrom
// ✅ No duplicate if page already has #water-bar panel (hydration-vr.html)
// ✅ Adaptive placement by device/view

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function zoneFrom(pct){
  const p = clamp(pct,0,100);
  // ✅ wider GREEN (easier)
  if (p >= 42 && p <= 68) return 'GREEN';
  if (p < 42) return 'LOW';
  return 'HIGH';
}

function isMobile(){
  try{ return matchMedia('(max-width: 700px)').matches; }catch(_){ return false; }
}
function hasInternalHydrationPanel(){
  return !!DOC.getElementById('water-bar') || !!DOC.getElementById('water-panel');
}
function getViewClass(){
  const b = DOC.body;
  if (!b) return '';
  if (b.classList.contains('cardboard')) return 'cardboard';
  if (b.classList.contains('view-cvr')) return 'cvr';
  return isMobile() ? 'mobile' : 'pc';
}
function applyPlacement(wrap){
  if (!wrap) return;
  const v = getViewClass();
  const sat = 'env(safe-area-inset-top, 0px)';
  const sab = 'env(safe-area-inset-bottom, 0px)';
  const sal = 'env(safe-area-inset-left, 0px)';
  const sar = 'env(safe-area-inset-right, 0px)';

  // default bottom-left
  let left = `calc(12px + ${sal})`, right = 'auto', top = 'auto', bottom = `calc(12px + ${sab})`;

  // cVR / Cardboard: push to top-left to avoid crosshair zone / thumbs
  if (v === 'cvr' || v === 'cardboard'){
    top = `calc(12px + ${sat})`;
    bottom = 'auto';
  }

  // mobile: bottom-right usually less conflict with left HUD stacks
  if (v === 'mobile'){
    right = `calc(12px + ${sar})`;
    left = 'auto';
    bottom = `calc(12px + ${sab})`;
    top = 'auto';
  }

  wrap.style.left = left;
  wrap.style.right = right;
  wrap.style.top = top;
  wrap.style.bottom = bottom;
}

export function ensureWaterGauge(){
  if (!DOC) return;

  // ✅ If hydration page already has its own water panel, do NOT inject overlay.
  if (hasInternalHydrationPanel()) return;

  if (DOC.getElementById('hha-water-gauge')) return;

  const wrap = DOC.createElement('div');
  wrap.id = 'hha-water-gauge';
  wrap.style.cssText = [
    'position:fixed',
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
  applyPlacement(wrap);

  // Re-apply on resize/orientation (safe)
  try{
    let raf=0;
    const onR = ()=>{ cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>applyPlacement(wrap)); };
    addEventListener('resize', onR, {passive:true});
    addEventListener('orientationchange', onR, {passive:true});
  }catch(_){}
}

export function setWaterGauge(pct){
  if (!DOC) return;
  const p = clamp(pct,0,100);
  const bar = DOC.getElementById('hha-water-bar');
  const t = DOC.getElementById('hha-water-pct');
  const z = DOC.getElementById('hha-water-zone');

  if (bar) bar.style.width = p.toFixed(0) + '%';
  if (t) t.textContent = String(p|0);

  const zone = zoneFrom(p);
  if (z) z.textContent = zone;
}