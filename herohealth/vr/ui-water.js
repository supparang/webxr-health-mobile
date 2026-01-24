// === /herohealth/vr/ui-water.js ===
// Water UI Helpers — PRODUCTION
// Exports: ensureWaterGauge, setWaterGauge, zoneFrom
// ✅ Works even if game already has its own Water panel (will “bridge” to #water-bar/#water-pct/#water-zone if present)
// ✅ Optional floating mini-gauge for other games (auto-inject, non-blocking)
// ✅ Disable floating gauge with: ?nogauge=1 or window.HHA_WATER_GAUGE = 0

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch(_){ return def; }
}
function clamp(v,a,b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

export function zoneFrom(pct){
  const p = clamp(pct, 0, 100);
  // ✅ ปลอดภัย/เข้าใจง่าย: กลางคือ GREEN
  //   LOW  : 0–44
  //   GREEN: 45–65
  //   HIGH : 66–100
  if (p <= 44) return 'LOW';
  if (p >= 66) return 'HIGH';
  return 'GREEN';
}

function shouldShowFloatingGauge(){
  try{
    if (WIN.HHA_WATER_GAUGE === 0) return false;
    const ng = String(qs('nogauge','')).toLowerCase();
    if (ng === '1' || ng === 'true' || ng === 'yes') return false;
    return true;
  }catch(_){
    return true;
  }
}

function injectStyleOnce(){
  if (!DOC || DOC.getElementById('hha-water-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
  /* HHA Floating Water Gauge (optional) */
  #hhaWaterGauge{
    position:fixed;
    right:12px;
    top:12px;
    z-index: 60;
    pointer-events:none;
    display:flex;
    align-items:center;
    gap:10px;
    padding:10px 12px;
    border-radius: 16px;
    border:1px solid rgba(148,163,184,.16);
    background: rgba(2,6,23,.55);
    backdrop-filter: blur(10px);
    box-shadow: 0 18px 70px rgba(0,0,0,.40);
    font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
    color: rgba(229,231,235,.92);
    user-select:none;
  }
  #hhaWaterGauge .wTitle{ font-weight:900; font-size:12px; letter-spacing:.2px; opacity:.95; }
  #hhaWaterGauge .wZone{ font-size:11px; opacity:.92; }
  #hhaWaterGauge .wPct{ font-weight:900; font-size:18px; line-height:1; }
  #hhaWaterGauge .wPct small{ font-size:11px; opacity:.85; font-weight:800; }
  #hhaWaterGauge .wBarWrap{
    width: 120px;
    height: 10px;
    border-radius: 999px;
    overflow:hidden;
    background: rgba(148,163,184,.18);
    border:1px solid rgba(148,163,184,.10);
  }
  #hhaWaterGauge .wBar{
    height:100%;
    width:50%;
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
  }

  /* Safe-area friendly */
  @supports (padding: max(0px)) {
    #hhaWaterGauge{
      top: max(12px, env(safe-area-inset-top, 0px));
      right: max(12px, env(safe-area-inset-right, 0px));
    }
  }
  `;
  DOC.head.appendChild(st);
}

function createGaugeIfNeeded(){
  if (!DOC) return null;
  let el = DOC.getElementById('hhaWaterGauge');
  if (el) return el;

  if (!shouldShowFloatingGauge()) return null;

  injectStyleOnce();

  el = DOC.createElement('div');
  el.id = 'hhaWaterGauge';
  el.setAttribute('aria-hidden','true');
  el.innerHTML = `
    <div>
      <div class="wTitle">Water</div>
      <div class="wZone">Zone <b id="hhaWaterZone">GREEN</b></div>
    </div>
    <div class="wBarWrap"><div class="wBar" id="hhaWaterBar"></div></div>
    <div class="wPct"><span id="hhaWaterPct">50</span><small>%</small></div>
  `;

  DOC.body.appendChild(el);
  return el;
}

/**
 * Ensure floating gauge exists (optional).
 * Safe even if the game has its own water UI.
 */
export function ensureWaterGauge(){
  try{
    if (!DOC) return null;
    // do not block hydration's own panel; floating gauge is just extra
    return createGaugeIfNeeded();
  }catch(_){
    return null;
  }
}

/**
 * Update water gauge (floating + bridge to in-game panel if present)
 * @param {number} pct 0..100
 */
export function setWaterGauge(pct){
  if (!DOC) return;

  const p = clamp(pct, 0, 100);
  const z = zoneFrom(p);

  // 1) Bridge to in-game elements (Hydration already has these)
  const bar2 = DOC.getElementById('water-bar');
  const pct2 = DOC.getElementById('water-pct');
  const zone2 = DOC.getElementById('water-zone');
  if (bar2) bar2.style.width = `${p.toFixed(0)}%`;
  if (pct2) pct2.textContent = String(p|0);
  if (zone2) zone2.textContent = z;

  // 2) Floating gauge (optional)
  const g = createGaugeIfNeeded();
  if (!g) return;

  const bar = DOC.getElementById('hhaWaterBar');
  const pctEl = DOC.getElementById('hhaWaterPct');
  const zoneEl = DOC.getElementById('hhaWaterZone');

  if (bar) bar.style.width = `${p.toFixed(0)}%`;
  if (pctEl) pctEl.textContent = String(p|0);
  if (zoneEl) zoneEl.textContent = z;
}