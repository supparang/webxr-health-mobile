// === /herohealth/vr/ui-water.js ===
// Water Gauge UI — PRODUCTION (Minimal + Compatible)
// Export: ensureWaterGauge(), setWaterGauge(pct), zoneFrom(pct)
// ✅ Works with Hydration HUD (water-bar / water-pct / water-zone) if present
// ✅ Also injects a tiny gauge (optional) for games that don't have panel
// ✅ Sets CSS vars: --hha-water-pct, --hha-water-zone
// ✅ No dependencies

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

export function zoneFrom(pct){
  const p = clamp(pct, 0, 100);

  // ✅ GREEN band (tunable): 45–65
  if (p >= 45 && p <= 65) return 'GREEN';
  if (p < 45) return 'LOW';
  return 'HIGH';
}

function setCssVars(pct){
  try{
    const p = clamp(pct,0,100);
    const z = zoneFrom(p);
    DOC?.documentElement?.style?.setProperty('--hha-water-pct', String(p));
    DOC?.documentElement?.style?.setProperty('--hha-water-zone', z);
  }catch(_){}
}

function patchExistingPanel(pct){
  // If hydration page already has these, update them.
  try{
    const p = clamp(pct,0,100);
    const z = zoneFrom(p);

    const bar = DOC.getElementById('water-bar');
    const tPct = DOC.getElementById('water-pct');
    const tZone = DOC.getElementById('water-zone');

    if (bar) bar.style.width = `${p.toFixed(0)}%`;
    if (tPct) tPct.textContent = String(p|0);
    if (tZone) tZone.textContent = z;
  }catch(_){}
}

function injectMiniGauge(){
  if (!DOC) return;
  if (DOC.getElementById('hha-water-mini')) return;

  const st = DOC.createElement('style');
  st.id = 'hha-water-mini-style';
  st.textContent = `
  #hha-water-mini{
    position:fixed;
    right:12px;
    bottom:12px;
    z-index:60;
    width:180px;
    border-radius:16px;
    padding:10px 10px 12px 10px;
    background:rgba(2,6,23,.62);
    border:1px solid rgba(148,163,184,.18);
    box-shadow:0 16px 60px rgba(0,0,0,.35);
    backdrop-filter: blur(10px);
    pointer-events:none;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
    color:rgba(229,231,235,.92);
    display:none; /* show only when panel missing */
  }
  #hha-water-mini .row{
    display:flex; justify-content:space-between; align-items:baseline;
    gap:10px;
  }
  #hha-water-mini .k{ font-size:12px; opacity:.85; }
  #hha-water-mini .v{ font-size:18px; font-weight:900; }
  #hha-water-mini .bar{
    margin-top:8px;
    height:10px;
    border-radius:999px;
    background:rgba(148,163,184,.18);
    overflow:hidden;
    border:1px solid rgba(148,163,184,.12);
  }
  #hha-water-mini .fill{
    height:100%;
    width:50%;
    background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
  }
  #hha-water-mini.low  .fill{ background:linear-gradient(90deg, rgba(245,158,11,.95), rgba(34,211,238,.95)); }
  #hha-water-mini.high .fill{ background:linear-gradient(90deg, rgba(239,68,68,.95), rgba(245,158,11,.95)); }
  `;
  DOC.head.appendChild(st);

  const el = DOC.createElement('div');
  el.id = 'hha-water-mini';
  el.innerHTML = `
    <div class="row">
      <div class="k">Water</div>
      <div class="v"><span id="hha-water-mini-pct">50</span><span style="font-size:12px;opacity:.85">%</span></div>
    </div>
    <div class="row" style="margin-top:2px">
      <div class="k">Zone</div>
      <div class="v" style="font-size:14px"><span id="hha-water-mini-zone">GREEN</span></div>
    </div>
    <div class="bar"><div class="fill" id="hha-water-mini-bar"></div></div>
  `;
  DOC.body.appendChild(el);
}

function showMiniGaugeIfNeeded(){
  // show mini only if the hydration panel doesn't exist
  try{
    const hasPanel = !!DOC.getElementById('water-bar') || !!DOC.getElementById('water-pct') || !!DOC.getElementById('water-zone');
    const mini = DOC.getElementById('hha-water-mini');
    if (!mini) return;
    mini.style.display = hasPanel ? 'none' : 'block';
  }catch(_){}
}

export function ensureWaterGauge(){
  try{
    injectMiniGauge();
    showMiniGaugeIfNeeded();
  }catch(_){}
}

export function setWaterGauge(pct){
  const p = clamp(pct, 0, 100);
  const z = zoneFrom(p);

  setCssVars(p);
  patchExistingPanel(p);

  // mini gauge (only when needed)
  try{
    const mini = DOC.getElementById('hha-water-mini');
    if (mini){
      mini.classList.toggle('low', z==='LOW');
      mini.classList.toggle('high', z==='HIGH');

      const tPct = DOC.getElementById('hha-water-mini-pct');
      const tZone = DOC.getElementById('hha-water-mini-zone');
      const bar  = DOC.getElementById('hha-water-mini-bar');

      if (tPct) tPct.textContent = String(p|0);
      if (tZone) tZone.textContent = z;
      if (bar) bar.style.width = `${p.toFixed(0)}%`;
    }
  }catch(_){}
}