// === /herohealth/vr/ui-water.js ===
// HHA Water UI — PRODUCTION (universal, safe overlay)
// ✅ ensureWaterGauge(): injects a tiny gauge if none exists
// ✅ setWaterGauge(pct): updates gauge (and optional DOM hooks)
// ✅ zoneFrom(pct): GREEN / LOW / HIGH
//
// Notes:
// - If your game already has a water panel (like Hydration HTML), you can still call setWaterGauge()
//   and it will update BOTH: (A) injected gauge, (B) your custom DOM if ids exist.
// - IDs supported (optional):
//   - water-bar, water-pct, water-zone, water-tip  (your custom panel)
// - Injected gauge uses: .hha-water-gauge (small, top-center by default)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

export function zoneFrom(pct){
  const p = clamp(pct, 0, 100);
  // Tunable thresholds for "hydration balance"
  if (p >= 45 && p <= 65) return 'GREEN';
  if (p < 45) return 'LOW';
  return 'HIGH';
}

function qs(sel){ return DOC ? DOC.querySelector(sel) : null; }
function byId(id){ return DOC ? DOC.getElementById(id) : null; }

function injectCSSOnce(){
  if (!DOC || DOC.getElementById('hha-water-css')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-water-css';
  st.textContent = `
  .hha-water-gauge{
    position:fixed;
    left:50%;
    top: calc(8px + env(safe-area-inset-top, 0px));
    transform: translateX(-50%);
    z-index: 60;
    pointer-events:none;
    font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
    color: rgba(229,231,235,.92);
    text-shadow: 0 2px 0 rgba(0,0,0,.35);
    opacity: .95;
  }
  .hha-water-gauge .wrap{
    display:flex;
    align-items:center;
    gap:10px;
    padding:8px 10px;
    border-radius: 999px;
    background: rgba(2,6,23,.55);
    border: 1px solid rgba(148,163,184,.16);
    backdrop-filter: blur(10px);
    box-shadow: 0 14px 55px rgba(0,0,0,.35);
  }
  .hha-water-gauge .label{
    font-weight:900;
    font-size:12px;
    letter-spacing:.2px;
    opacity:.95;
    white-space:nowrap;
  }
  .hha-water-gauge .zone{
    font-weight:900;
    font-size:12px;
    padding:4px 8px;
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,.16);
    background: rgba(15,23,42,.55);
    white-space:nowrap;
  }
  .hha-water-gauge .bar{
    width: 140px;
    height: 10px;
    border-radius: 999px;
    overflow:hidden;
    background: rgba(148,163,184,.16);
    border: 1px solid rgba(148,163,184,.10);
  }
  .hha-water-gauge .fill{
    height:100%;
    width: 50%;
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
  }
  .hha-water-gauge .pct{
    font-weight:900;
    font-size:12px;
    opacity:.95;
    min-width: 42px;
    text-align:right;
    white-space:nowrap;
  }

  /* If body has a "no-top-gauge" class, we hide injected gauge */
  body.hha-no-top-gauge .hha-water-gauge{ display:none !important; }

  /* In view-cvr, keep it away from crosshair zone a bit */
  body.view-cvr .hha-water-gauge{
    top: calc(10px + env(safe-area-inset-top, 0px));
  }

  /* On very small height, move to top-left to avoid HUD conflicts */
  @media (max-height: 520px){
    .hha-water-gauge{
      left: calc(10px + env(safe-area-inset-left, 0px));
      transform:none;
    }
    .hha-water-gauge .bar{ width: 120px; }
  }
  `;
  DOC.head.appendChild(st);
}

function createGaugeEl(){
  const el = DOC.createElement('div');
  el.className = 'hha-water-gauge';
  el.innerHTML = `
    <div class="wrap">
      <div class="label">💧 Water</div>
      <div class="zone" data-zone>GREEN</div>
      <div class="bar"><div class="fill" data-fill></div></div>
      <div class="pct"><span data-pct>50</span>%</div>
    </div>
  `;
  DOC.body.appendChild(el);
  return el;
}

function getOrCreateGauge(){
  if (!DOC) return null;
  injectCSSOnce();
  let el = qs('.hha-water-gauge');
  if (el) return el;
  return createGaugeEl();
}

// -------- Public APIs --------
export function ensureWaterGauge(){
  if (!DOC) return null;

  // If the game already has a big water panel UI, we still allow the small gauge,
  // but you can hide it by adding: document.body.classList.add('hha-no-top-gauge')
  // We do not auto-hide, because other games may want it.
  return getOrCreateGauge();
}

export function setWaterGauge(pct, tipText = ''){
  if (!DOC) return;

  const p = clamp(pct, 0, 100);
  const z = zoneFrom(p);

  // (A) Injected gauge
  const g = getOrCreateGauge();
  if (g){
    const fill = g.querySelector('[data-fill]');
    const zp = g.querySelector('[data-zone]');
    const pp = g.querySelector('[data-pct]');
    if (fill) fill.style.width = p.toFixed(0) + '%';
    if (zp) zp.textContent = z;
    if (pp) pp.textContent = String(p|0);

    // small visual cue: tint by zone (subtle, no hard colors)
    try{
      g.style.filter =
        (z === 'GREEN') ? 'saturate(1.05)' :
        (z === 'LOW') ? 'saturate(1.02) brightness(1.02)' :
                        'saturate(1.02) brightness(1.02)';
    }catch(_){}
  }

  // (B) Optional: update your custom panel if IDs exist
  const bar = byId('water-bar');
  const pctEl = byId('water-pct');
  const zoneEl = byId('water-zone');
  const tipEl = byId('water-tip');

  if (bar) bar.style.width = p.toFixed(0) + '%';
  if (pctEl) pctEl.textContent = String(p|0);
  if (zoneEl) zoneEl.textContent = z;
  if (tipEl && typeof tipText === 'string' && tipText.trim()){
    tipEl.textContent = tipText;
  }
}