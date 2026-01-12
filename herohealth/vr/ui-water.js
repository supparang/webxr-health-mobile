// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge — PRODUCTION (safe, HUD-friendly)
// ✅ ensureWaterGauge(): creates minimal corner gauge if not present
// ✅ setWaterGauge(pct, opts?): updates UI + body classes
// ✅ zoneFrom(pct): returns 'LOW'|'GREEN'|'HIGH'
// Works standalone; if your game already has a water panel, this is harmless.

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

const ID_ROOT = 'hha-watergauge';
const ID_BAR  = 'hha-watergauge-bar';
const ID_TXT  = 'hha-watergauge-txt';
const ID_ZONE = 'hha-watergauge-zone';

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

export function zoneFrom(pct){
  pct = clamp(pct, 0, 100);
  // tuned for hydration game mid around 55
  if (pct < 42) return 'LOW';
  if (pct > 72) return 'HIGH';
  return 'GREEN';
}

function injectStyleOnce(){
  if (!DOC || DOC.getElementById('hha-watergauge-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-watergauge-style';
  st.textContent = `
    /* HHA WaterGauge (corner) */
    #${ID_ROOT}{
      position:fixed;
      left: calc(12px + env(safe-area-inset-left, 0px));
      bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      z-index: 46; /* lower than vr-ui (95) & most HUD (50) */
      pointer-events:none;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: rgba(229,231,235,.92);
      background: rgba(2,6,23,.55);
      border: 1px solid rgba(148,163,184,.18);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      box-shadow: 0 18px 60px rgba(0,0,0,.35);
      padding: 10px 10px;
      min-width: 170px;
    }
    #${ID_ROOT} .row{
      display:flex;
      align-items:baseline;
      justify-content:space-between;
      gap:10px;
      margin-bottom:8px;
      letter-spacing:.2px;
    }
    #${ID_ROOT} .k{
      font-size:12px;
      color: rgba(148,163,184,.95);
      font-weight:800;
    }
    #${ID_ROOT} .v{
      font-size:16px;
      font-weight:900;
      white-space:nowrap;
    }
    #${ID_ROOT} .barWrap{
      height: 10px;
      border-radius: 999px;
      overflow:hidden;
      background: rgba(148,163,184,.18);
      border: 1px solid rgba(148,163,184,.12);
    }
    #${ID_BAR}{
      height:100%;
      width:50%;
      background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
      transform-origin:left center;
    }

    /* zone tint hooks (optional) */
    body.hha-zone-low  #${ID_BAR}{ background: linear-gradient(90deg, rgba(34,211,238,.95), rgba(59,130,246,.95)); }
    body.hha-zone-green #${ID_BAR}{ background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95)); }
    body.hha-zone-high #${ID_BAR}{ background: linear-gradient(90deg, rgba(245,158,11,.95), rgba(249,115,22,.95)); }
  `;
  DOC.head.appendChild(st);
}

function buildGauge(){
  if (!DOC) return null;
  injectStyleOnce();

  const root = DOC.createElement('div');
  root.id = ID_ROOT;

  const row = DOC.createElement('div');
  row.className = 'row';

  const left = DOC.createElement('div');
  left.className = 'k';
  left.textContent = 'Water';

  const right = DOC.createElement('div');
  right.className = 'v';
  right.innerHTML = `<span id="${ID_TXT}">50</span><span style="font-size:12px;opacity:.85">%</span> • <span id="${ID_ZONE}">GREEN</span>`;

  row.appendChild(left);
  row.appendChild(right);

  const barWrap = DOC.createElement('div');
  barWrap.className = 'barWrap';

  const bar = DOC.createElement('div');
  bar.id = ID_BAR;

  barWrap.appendChild(bar);

  root.appendChild(row);
  root.appendChild(barWrap);

  return root;
}

export function ensureWaterGauge(){
  if (!DOC) return null;

  // If your hydration HUD already has its own panel (#water-bar etc.), we still
  // allow this corner gauge — but you can opt out by setting window.HHA_WATERGAUGE_DISABLED = true.
  if (WIN.HHA_WATERGAUGE_DISABLED) return null;

  let el = DOC.getElementById(ID_ROOT);
  if (el) return el;

  el = buildGauge();
  if (!el) return null;

  DOC.body.appendChild(el);
  return el;
}

export function setWaterGauge(pct, opts = {}){
  if (!DOC) return;

  pct = clamp(pct, 0, 100);
  const zone = String(opts.zone || zoneFrom(pct));

  // ensure exists (safe)
  const root = ensureWaterGauge();

  // update corner gauge if present
  if (root){
    const bar = DOC.getElementById(ID_BAR);
    const txt = DOC.getElementById(ID_TXT);
    const zEl = DOC.getElementById(ID_ZONE);
    if (bar) bar.style.width = pct.toFixed(0) + '%';
    if (txt) txt.textContent = String(pct|0);
    if (zEl) zEl.textContent = zone;
  }

  // body classes for theming elsewhere
  try{
    DOC.body.classList.remove('hha-zone-low','hha-zone-green','hha-zone-high');
    if (zone === 'LOW') DOC.body.classList.add('hha-zone-low');
    else if (zone === 'HIGH') DOC.body.classList.add('hha-zone-high');
    else DOC.body.classList.add('hha-zone-green');
  }catch(_){}
}