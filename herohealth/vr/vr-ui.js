// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge — PRODUCTION (universal)
// ✅ ensureWaterGauge(): create HUD widget if missing
// ✅ setWaterGauge(pct): update gauge 0..100 (writes DOM + CSS vars)
// ✅ zoneFrom(pct): returns 'LOW' | 'GREEN' | 'HIGH'
// ✅ Non-blocking UI: pointer-events:none by default
// ✅ Works with: PC/Mobile/Cardboard/cVR (no dependencies)
//
// Optional IDs used by hydration.safe.js extra panel:
// - #water-bar, #water-pct, #water-zone (if present, we update too)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;

  if (WIN.__HHA_UI_WATER__) return;
  WIN.__HHA_UI_WATER__ = true;

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function zoneFrom(pct){
    const p = clamp(pct, 0, 100);
    // tune: GREEN sweet spot ~ 45..65 (mid around 55)
    if (p < 45) return 'LOW';
    if (p > 65) return 'HIGH';
    return 'GREEN';
  }

  function injectStyle(){
    if (DOC.getElementById('hha-water-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-water-style';
    st.textContent = `
    .hha-water{
      position: fixed;
      left: calc(env(safe-area-inset-left, 0px) + 14px);
      bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
      z-index: 60;
      pointer-events: none;
      user-select: none;
      -webkit-user-select:none;
      font: 800 12px/1.1 system-ui,-apple-system,"Segoe UI",sans-serif;
      color: rgba(229,231,235,.95);
      letter-spacing: .2px;
      filter: drop-shadow(0 10px 26px rgba(0,0,0,.45));
    }
    .hha-water .card{
      width: 168px;
      border-radius: 16px;
      border: 1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.70);
      backdrop-filter: blur(10px);
      padding: 10px 10px 9px 10px;
    }
    .hha-water .row{
      display:flex; align-items:center; justify-content:space-between;
      gap: 8px; margin-bottom: 8px;
      opacity: .95;
    }
    .hha-water .title{
      display:flex; align-items:center; gap:6px;
      font-weight: 900;
    }
    .hha-water .title .emoji{ font-size: 14px; }
    .hha-water .zone{
      font-weight: 900;
      padding: 4px 9px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,.18);
      background: rgba(15,23,42,.55);
    }
    .hha-water .bar{
      position: relative;
      height: 10px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,.18);
      background: rgba(15,23,42,.55);
      overflow:hidden;
    }
    .hha-water .fill{
      position:absolute; inset:0;
      width: var(--water-pct, 50%);
      border-radius: 999px;
      background: rgba(34,197,94,.72);
      box-shadow: 0 0 0 1px rgba(34,197,94,.18) inset;
      transition: width 120ms linear, background 160ms linear;
    }
    .hha-water.low .fill{
      background: rgba(251,146,60,.78); /* orange */
      box-shadow: 0 0 0 1px rgba(251,146,60,.18) inset;
    }
    .hha-water.high .fill{
      background: rgba(96,165,250,.78); /* blue */
      box-shadow: 0 0 0 1px rgba(96,165,250,.18) inset;
    }
    .hha-water .nums{
      margin-top: 7px;
      display:flex; align-items:center; justify-content:space-between;
      opacity: .86;
      font-weight: 800;
    }
    .hha-water .nums .pct{
      font-variant-numeric: tabular-nums;
    }

    /* Mobile shrink */
    body.view-mobile .hha-water .card{ width: 148px; padding: 9px 9px 8px; }
    body.view-mobile .hha-water{ left: calc(env(safe-area-inset-left,0px) + 10px); bottom: calc(env(safe-area-inset-bottom,0px) + 10px); }

    /* Cardboard/cVR: keep low profile (avoid center overlays) */
    body.cardboard .hha-water,
    body.view-cvr .hha-water{
      left: calc(env(safe-area-inset-left,0px) + 10px);
      bottom: calc(env(safe-area-inset-bottom,0px) + 10px);
      opacity: .95;
      transform: translateZ(0);
    }

    /* If your app has a big results overlay, it can hide the gauge by adding body.hha-hide-water */
    body.hha-hide-water .hha-water{ display:none !important; }
    `;
    DOC.head.appendChild(st);
  }

  function ensureWaterGauge(){
    injectStyle();

    let root = DOC.querySelector('.hha-water');
    if (root) return root;

    root = DOC.createElement('div');
    root.className = 'hha-water green';
    root.setAttribute('aria-hidden','true');

    root.innerHTML = `
      <div class="card">
        <div class="row">
          <div class="title"><span class="emoji">💧</span><span>WATER</span></div>
          <div class="zone" id="hhaWaterZone">GREEN</div>
        </div>
        <div class="bar"><div class="fill" id="hhaWaterFill"></div></div>
        <div class="nums">
          <div class="pct"><span id="hhaWaterPct">50</span>%</div>
          <div style="opacity:.9">target: GREEN</div>
        </div>
      </div>
    `;
    DOC.body.appendChild(root);
    return root;
  }

  function setWaterGauge(pct){
    const p = clamp(pct, 0, 100);
    const zone = zoneFrom(p);

    const root = ensureWaterGauge();
    if (!root) return;

    // class
    root.classList.remove('low','green','high');
    root.classList.add(zone === 'LOW' ? 'low' : zone === 'HIGH' ? 'high' : 'green');

    // css var width
    root.style.setProperty('--water-pct', p.toFixed(0) + '%');

    // internal ids
    const elPct = DOC.getElementById('hhaWaterPct');
    const elZone = DOC.getElementById('hhaWaterZone');
    const fill = DOC.getElementById('hhaWaterFill');
    if (elPct) elPct.textContent = String(p|0);
    if (elZone) elZone.textContent = zone;
    if (fill) fill.style.width = p.toFixed(0) + '%';

    // optional external panel ids used by hydration.safe.js
    const bar = DOC.getElementById('water-bar');
    const pctEl = DOC.getElementById('water-pct');
    const zoneEl = DOC.getElementById('water-zone');
    if (bar) bar.style.width = p.toFixed(0) + '%';
    if (pctEl) pctEl.textContent = String(p|0);
    if (zoneEl) zoneEl.textContent = zone;
  }

  // expose as module-like globals for non-module pages (optional)
  WIN.HHA_WATER = { ensureWaterGauge, setWaterGauge, zoneFrom };

  // Also export for ES modules (when loaded as module)
  // (This section is safe in classic script too; bundlers ignore)
  try{
    // no-op: kept for compatibility
  }catch(_){}

  // Attach to window for ESM import usage via named export (below)
})();

// Named exports (ESM)
export function ensureWaterGauge(){
  return window.HHA_WATER?.ensureWaterGauge?.();
}
export function setWaterGauge(pct){
  return window.HHA_WATER?.setWaterGauge?.(pct);
}
export function zoneFrom(pct){
  return window.HHA_WATER?.zoneFrom?.(pct) ?? 'GREEN';
}