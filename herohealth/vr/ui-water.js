// === /herohealth/vr/ui-water.js ===
// Water Gauge UI — PRODUCTION
// ✅ ensureWaterGauge() creates HUD gauge if missing
// ✅ setWaterGauge(pct) updates gauge
// ✅ zoneFrom(pct) -> 'LOW' | 'GREEN' | 'HIGH'

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function zoneFrom(pct){
  pct = clamp(pct,0,100);
  // simple symmetric bands around mid
  if (pct < 45) return 'LOW';
  if (pct > 65) return 'HIGH';
  return 'GREEN';
}

export function ensureWaterGauge(){
  if (!DOC) return null;

  // if already exists, return it
  const existing = DOC.querySelector('.hha-water');
  if (existing) return existing;

  // place inside HUD if exists, else body
  const hud = DOC.querySelector('.hud');
  const wrap = DOC.createElement('div');
  wrap.className = 'hha-water';
  wrap.style.cssText = `
    position:fixed;
    right: calc(12px + env(safe-area-inset-right, 0px));
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    z-index:55;
    width: 180px;
    pointer-events:none;
    font: 800 12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    color: rgba(226,232,240,.95);
  `;

  wrap.innerHTML = `
    <div style="
      background: rgba(2,6,23,.70);
      border:1px solid rgba(148,163,184,.18);
      border-radius: 18px;
      padding:10px 10px 10px 10px;
      box-shadow: 0 22px 70px rgba(0,0,0,.45);
      backdrop-filter: blur(10px);
    ">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
        <div style="font-weight:1000; letter-spacing:.2px;">💧 Water</div>
        <div class="hha-water-zone" style="color:rgba(148,163,184,.95); font-weight:900;">GREEN</div>
      </div>

      <div style="margin-top:8px; height:10px; border-radius:999px; overflow:hidden;
        border:1px solid rgba(148,163,184,.16); background: rgba(2,6,23,.55);">
        <div class="hha-water-bar" style="
          height:100%;
          width:50%;
          border-radius:999px;
          background: linear-gradient(90deg, rgba(34,197,94,.85), rgba(34,211,238,.75));
        "></div>
      </div>

      <div style="margin-top:8px; display:flex; justify-content:space-between; gap:10px; font-weight:900;">
        <div class="hha-water-pct">50%</div>
        <div style="color:rgba(148,163,184,.95); font-weight:800;">LOW • GREEN • HIGH</div>
      </div>
    </div>
  `;

  (hud || DOC.body).appendChild(wrap);
  return wrap;
}

export function setWaterGauge(pct){
  if (!DOC) return;

  pct = clamp(pct,0,100);
  const zone = zoneFrom(pct);

  const wrap = DOC.querySelector('.hha-water') || ensureWaterGauge();
  if (!wrap) return;

  const bar  = wrap.querySelector('.hha-water-bar');
  const zp   = wrap.querySelector('.hha-water-zone');
  const pp   = wrap.querySelector('.hha-water-pct');

  if (bar) bar.style.width = pct.toFixed(0) + '%';
  if (zp)  zp.textContent  = zone;
  if (pp)  pp.textContent  = pct.toFixed(0) + '%';

  // subtle border glow by zone
  const card = wrap.firstElementChild;
  if (card){
    const c =
      (zone === 'GREEN') ? 'rgba(34,197,94,.22)' :
      (zone === 'LOW')   ? 'rgba(34,211,238,.22)' :
                           'rgba(245,158,11,.22)';
    card.style.borderColor = c;
  }
}