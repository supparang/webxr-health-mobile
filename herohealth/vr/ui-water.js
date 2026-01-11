// === /herohealth/vr/ui-water.js ===
// HHA Water UI — PRODUCTION
// ✅ ensureWaterGauge(): creates a compact gauge (if not present)
// ✅ setWaterGauge(pct): updates gauge value + zone label + CSS states
// ✅ zoneFrom(pct): returns GREEN | LOW | HIGH based on thresholds
//
// Notes:
// - Works with your Hydration HTML waterPanel (#water-bar/#water-pct/#water-zone) too.
// - If those DOM nodes exist, we update them directly.
// - If not, we create a small floating gauge overlay (safe for other games).

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function zoneFrom(pct){
  const p = clamp(pct, 0, 100);
  // Tune thresholds as you like
  if (p >= 40 && p <= 70) return 'GREEN';
  if (p < 40) return 'LOW';
  return 'HIGH';
}

function ensureStyle(){
  if (!DOC || DOC.getElementById('hha-water-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
  .hha-water-gauge{
    position:fixed;
    right: calc(12px + env(safe-area-inset-right, 0px));
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    z-index: 88;
    width: 220px;
    max-width: 58vw;
    pointer-events:none;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }
  .hha-water-card{
    border-radius: 16px;
    border: 1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.68);
    box-shadow: 0 18px 70px rgba(0,0,0,.40);
    backdrop-filter: blur(10px);
    padding: 10px 12px;
    color: rgba(229,231,235,.95);
  }
  .hha-water-top{
    display:flex; justify-content:space-between; align-items:baseline; gap:10px;
  }
  .hha-water-title{
    font-weight: 900;
    font-size: 12px;
    letter-spacing: .2px;
    opacity: .95;
  }
  .hha-water-zone{
    font-weight: 900;
    font-size: 12px;
    letter-spacing: .3px;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,.14);
    background: rgba(15,23,42,.55);
  }
  .hha-water-pct{
    margin-top: 8px;
    font-size: 18px;
    font-weight: 900;
    letter-spacing: .2px;
  }
  .hha-water-barwrap{
    margin-top: 8px;
    height: 10px;
    border-radius: 999px;
    overflow:hidden;
    background: rgba(148,163,184,.18);
    border: 1px solid rgba(148,163,184,.12);
  }
  .hha-water-bar{
    height:100%;
    width:50%;
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
    transform-origin: left center;
  }

  /* zone tint */
  .hha-water-gauge[data-zone="GREEN"] .hha-water-zone{
    border-color: rgba(34,197,94,.22);
    background: rgba(34,197,94,.14);
  }
  .hha-water-gauge[data-zone="LOW"] .hha-water-zone{
    border-color: rgba(245,158,11,.22);
    background: rgba(245,158,11,.14);
  }
  .hha-water-gauge[data-zone="HIGH"] .hha-water-zone{
    border-color: rgba(239,68,68,.22);
    background: rgba(239,68,68,.14);
  }`;
  DOC.head.appendChild(st);
}

function findOrCreateGauge(){
  if (!DOC) return null;

  // If Hydration page already has explicit elements, we don't need a floating gauge.
  const hasHydrationPanel =
    DOC.getElementById('water-bar') ||
    DOC.getElementById('water-pct') ||
    DOC.getElementById('water-zone');

  if (hasHydrationPanel) return null;

  let root = DOC.querySelector('.hha-water-gauge');
  if (root) return root;

  ensureStyle();

  root = DOC.createElement('div');
  root.className = 'hha-water-gauge';
  root.setAttribute('data-zone','GREEN');
  root.innerHTML = `
    <div class="hha-water-card">
      <div class="hha-water-top">
        <div class="hha-water-title">Water</div>
        <div class="hha-water-zone" id="__hha_water_zone">GREEN</div>
      </div>
      <div class="hha-water-pct"><span id="__hha_water_pct">50</span>%</div>
      <div class="hha-water-barwrap"><div class="hha-water-bar" id="__hha_water_bar"></div></div>
    </div>
  `;
  DOC.body.appendChild(root);
  return root;
}

export function ensureWaterGauge(){
  // safe no-op if Hydration panel exists
  try{
    findOrCreateGauge();
  }catch(_){}
}

export function setWaterGauge(pct){
  const p = clamp(pct, 0, 100);
  const zone = zoneFrom(p);

  // 1) If Hydration page has explicit elements, update them.
  const bar = DOC?.getElementById('water-bar');
  const pctEl = DOC?.getElementById('water-pct');
  const zoneEl = DOC?.getElementById('water-zone');

  if (bar) bar.style.width = p.toFixed(0) + '%';
  if (pctEl) pctEl.textContent = String(p|0);
  if (zoneEl) zoneEl.textContent = zone;

  // 2) Otherwise update floating gauge (if created).
  const gauge = findOrCreateGauge();
  if (gauge){
    gauge.setAttribute('data-zone', zone);
    const gBar = DOC.getElementById('__hha_water_bar');
    const gPct = DOC.getElementById('__hha_water_pct');
    const gZone = DOC.getElementById('__hha_water_zone');
    if (gBar) gBar.style.width = p.toFixed(0) + '%';
    if (gPct) gPct.textContent = String(p|0);
    if (gZone) gZone.textContent = zone;
  }

  // expose last values for debug/other modules
  try{
    ROOT.__HHA_WATER__ = { pct: p, zone };
  }catch(_){}
}