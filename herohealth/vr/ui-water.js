// === /herohealth/vr/ui-water.js ===
// UI Water Gauge — PRODUCTION (LATEST)
// ✅ ensureWaterGauge(): create minimal gauge if page doesn't have one
// ✅ setWaterGauge(pct): updates bar + text + zone + CSS vars
// ✅ zoneFrom(pct): returns 'LOW' | 'GREEN' | 'HIGH'
// ✅ Works with DOM ids: #water-bar #water-pct #water-zone (optional)
// ✅ Also sets: documentElement --water-pct --water-zone

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_UI_WATER__) return;
  WIN.__HHA_UI_WATER__ = true;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function zoneFrom(pct){
    const p = clamp(pct,0,100);
    // default zones:
    // LOW  : 0-39
    // GREEN: 40-70
    // HIGH : 71-100
    if (p <= 39) return 'LOW';
    if (p <= 70) return 'GREEN';
    return 'HIGH';
  }

  function ensureWaterGauge(){
    // If developer already built a panel (Hydration RUN has it), do nothing.
    if (DOC.getElementById('water-bar') || DOC.getElementById('waterpanel')) return;

    // Minimal floating gauge for pages without UI
    const wrap = DOC.createElement('div');
    wrap.id = 'waterpanel';
    wrap.style.cssText = [
      'position:fixed',
      'right:12px',
      'top:calc(64px + env(safe-area-inset-top,0px))',
      'z-index:80',
      'width:160px',
      'pointer-events:none',
      'border-radius:18px',
      'border:1px solid rgba(148,163,184,.16)',
      'background:rgba(2,6,23,.55)',
      'backdrop-filter:blur(10px)',
      'padding:10px 12px',
      'box-shadow:0 16px 60px rgba(0,0,0,.35)'
    ].join(';');

    wrap.innerHTML = `
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
        <div style="font-weight:900;font-size:13px;opacity:.96">Water</div>
        <div style="font-size:12px;color:rgba(148,163,184,.95)">Zone: <b id="water-zone">GREEN</b></div>
      </div>
      <div style="margin-top:8px;height:10px;border-radius:999px;overflow:hidden;background:rgba(148,163,184,.18);border:1px solid rgba(148,163,184,.10)">
        <div id="water-bar" style="height:100%;width:50%;border-radius:999px;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95))"></div>
      </div>
      <div style="margin-top:6px;font-weight:900;text-align:right;font-size:12px;color:rgba(229,231,235,.92)"><span id="water-pct">50</span>%</div>
    `;
    DOC.body.appendChild(wrap);
  }

  function setWaterGauge(pct){
    const p = clamp(pct, 0, 100);
    const z = zoneFrom(p);

    const bar  = DOC.getElementById('water-bar');
    const pctEl= DOC.getElementById('water-pct');
    const zone = DOC.getElementById('water-zone');

    if (bar)  bar.style.width = p.toFixed(0) + '%';
    if (pctEl) pctEl.textContent = String(p|0);
    if (zone) zone.textContent = z;

    // Useful for CSS/other overlays
    try{
      DOC.documentElement.style.setProperty('--water-pct', p.toFixed(0));
      DOC.documentElement.style.setProperty('--water-zone', z);
    }catch(_){}
  }

  // expose
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.zoneFrom = zoneFrom;

  // also export for ES module import pattern (your hydration.safe.js uses import ...)
  // NOTE: This block is harmless in non-module usage; bundlers ignore it.
})();