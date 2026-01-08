// === /herohealth/vr/ui-water.js ===
// Water Gauge UI — PRODUCTION (DOM + lightweight)
// ✅ ensureWaterGauge(): creates hidden gauge if missing (safe for all games)
// ✅ setWaterGauge(pct): updates HUD gauge (and optional #water-bar/#water-pct/#water-zone if present)
// ✅ zoneFrom(pct): returns 'LOW' | 'GREEN' | 'HIGH' (simple thresholds)
//
// Notes:
// - Hydration.safe.js already updates #water-bar etc in its own HUD,
//   but we keep this module generic for re-use across games.

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

// Simple zone thresholds (tweakable)
export function zoneFrom(pct){
  const p = clamp(pct, 0, 100);
  // GREEN band around mid hydration
  if (p >= 40 && p <= 70) return 'GREEN';
  if (p < 40) return 'LOW';
  return 'HIGH';
}

function ensureStyle(){
  if (!DOC || DOC.getElementById('hha-water-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
  .hha-water{
    position: fixed;
    left: calc(10px + env(safe-area-inset-left,0px));
    bottom: calc(10px + env(safe-area-inset-bottom,0px));
    z-index: 60;
    pointer-events:none;
    display:none;
    width: 180px;
    border-radius: 16px;
    border: 1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.60);
    backdrop-filter: blur(10px);
    box-shadow: 0 18px 70px rgba(0,0,0,.42);
    padding: 10px;
    color: #e5e7eb;
    font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
  }
  body.hha-show-water .hha-water{ display:block; }
  .hha-water .top{
    display:flex; align-items:baseline; justify-content:space-between;
    gap:10px;
  }
  .hha-water .ttl{
    font-weight:900;
    font-size: 12px;
    letter-spacing:.2px;
    opacity:.95;
  }
  .hha-water .pct{
    font-weight:900;
    font-size: 16px;
  }
  .hha-water .zone{
    margin-top: 2px;
    font-size: 11px;
    opacity:.85;
  }
  .hha-water .bar{
    margin-top: 8px;
    height: 10px;
    border-radius: 999px;
    overflow:hidden;
    border: 1px solid rgba(148,163,184,.12);
    background: rgba(148,163,184,.16);
  }
  .hha-water .fill{
    height: 100%;
    width: 50%;
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
  }
  .hha-water.low  .fill{ background: linear-gradient(90deg, rgba(34,211,238,.95), rgba(59,130,246,.95)); }
  .hha-water.high .fill{ background: linear-gradient(90deg, rgba(245,158,11,.95), rgba(239,68,68,.95)); }
  `;
  DOC.head.appendChild(st);
}

function ensureEl(){
  if (!DOC) return null;
  let el = DOC.querySelector('.hha-water');
  if (el) return el;

  ensureStyle();

  el = DOC.createElement('div');
  el.className = 'hha-water';
  el.innerHTML = `
    <div class="top">
      <div class="ttl">Water</div>
      <div class="pct"><span class="pctVal">50</span>%</div>
    </div>
    <div class="zone">Zone <b class="zoneVal">GREEN</b></div>
    <div class="bar"><div class="fill"></div></div>
  `;
  DOC.body.appendChild(el);
  return el;
}

// Public: create gauge (hidden by default unless body has class hha-show-water)
export function ensureWaterGauge(){
  const el = ensureEl();
  return !!el;
}

// Public: update gauge + also update optional in-page HUD ids if present
export function setWaterGauge(pct){
  if (!DOC) return;

  const p = clamp(pct, 0, 100);
  const z = zoneFrom(p);

  // update optional hydration HUD if exists
  const bar = DOC.getElementById('water-bar');
  const pctEl = DOC.getElementById('water-pct');
  const zoneEl = DOC.getElementById('water-zone');
  if (bar) bar.style.width = `${p.toFixed(0)}%`;
  if (pctEl) pctEl.textContent = String(p|0);
  if (zoneEl) zoneEl.textContent = z;

  // update generic gauge (if present/created)
  const el = ensureEl();
  if (!el) return;

  el.classList.toggle('low', z==='LOW');
  el.classList.toggle('high', z==='HIGH');
  el.classList.toggle('green', z==='GREEN');

  const fill = el.querySelector('.fill');
  const pv = el.querySelector('.pctVal');
  const zv = el.querySelector('.zoneVal');

  if (fill) fill.style.width = `${p.toFixed(0)}%`;
  if (pv) pv.textContent = String(p|0);
  if (zv) zv.textContent = z;
}