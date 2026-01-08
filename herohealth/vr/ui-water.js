// === /herohealth/vr/ui-water.js ===
// Water Gauge UI — PRODUCTION (shared)
// ✅ ensureWaterGauge(): safe create if missing
// ✅ setWaterGauge(pct, opts): update bar + pct + zone + body attrs
// ✅ zoneFrom(pct): GREEN / LOW / HIGH
// ✅ Non-blocking HUD (pointer-events:none) + safe-area aware

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const clamp = (v,min,max)=> {
  v = Number(v); if (!isFinite(v)) v = 0;
  return v < min ? min : (v > max ? max : v);
};

const DEFAULTS = {
  greenMin: 45,   // ✅ ช่วง GREEN (ปรับได้)
  greenMax: 65,
  mountZ: 70,
  idPanel: 'hha-water-mini',
  idBar:   'hha-water-mini-bar',
  idPct:   'hha-water-mini-pct',
  idZone:  'hha-water-mini-zone',
  idTip:   'hha-water-mini-tip'
};

let LAST = {
  pct: 50,
  zone: 'GREEN',
  tip: ''
};

export function zoneFrom(pct, opts={}){
  const o = Object.assign({}, DEFAULTS, opts||{});
  const p = clamp(pct, 0, 100);
  if (p < o.greenMin) return 'LOW';
  if (p > o.greenMax) return 'HIGH';
  return 'GREEN';
}

function pickEls(){
  // 1) Prefer in-game panel IDs (your hydration html already has these)
  const bar  = DOC.getElementById('water-bar')  || DOC.getElementById(DEFAULTS.idBar);
  const pct  = DOC.getElementById('water-pct')  || DOC.getElementById(DEFAULTS.idPct);
  const zone = DOC.getElementById('water-zone') || DOC.getElementById(DEFAULTS.idZone);
  const tip  = DOC.getElementById('water-tip')  || DOC.getElementById(DEFAULTS.idTip);
  return { bar, pct, zone, tip };
}

function ensureStyle(){
  if (!DOC || DOC.getElementById('hha-water-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
  /* ---- HHA Water Mini (fallback) ---- */
  .hha-water-mini{
    position:fixed;
    right: calc(12px + env(safe-area-inset-right, 0px));
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    width: 220px;
    z-index: 70;
    pointer-events:none;
    border-radius: 16px;
    border: 1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.72);
    backdrop-filter: blur(10px);
    box-shadow: 0 18px 60px rgba(0,0,0,.45);
    padding: 10px 10px;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
    color: rgba(229,231,235,.94);
  }
  .hha-water-mini .row{
    display:flex; align-items:baseline; justify-content:space-between; gap:10px;
  }
  .hha-water-mini .ttl{
    font-weight: 900;
    font-size: 12px;
    letter-spacing: .2px;
    opacity:.92;
  }
  .hha-water-mini .meta{
    font-weight: 900;
    font-size: 16px;
    letter-spacing: .2px;
  }
  .hha-water-mini .meta small{
    font-size: 12px;
    opacity:.75;
    font-weight:800;
  }
  .hha-water-mini .zone{
    font-size: 12px;
    color: rgba(148,163,184,.95);
    margin-top: 2px;
  }
  .hha-water-mini .barWrap{
    margin-top: 8px;
    height: 10px;
    border-radius: 999px;
    background: rgba(148,163,184,.18);
    overflow:hidden;
    border: 1px solid rgba(148,163,184,.12);
  }
  .hha-water-mini .bar{
    height: 100%;
    width: 50%;
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
    transform-origin: left center;
  }
  .hha-water-mini .tip{
    margin-top: 8px;
    font-size: 11px;
    line-height: 1.25;
    color: rgba(229,231,235,.84);
    white-space: pre-line;
  }

  /* Zone tint (optional) */
  body[data-water-zone="LOW"]  .hha-water-mini .bar{ filter: saturate(1.1) hue-rotate(-25deg); }
  body[data-water-zone="HIGH"] .hha-water-mini .bar{ filter: saturate(1.1) hue-rotate(25deg); }
  `;
  DOC.head.appendChild(st);
}

function createFallbackPanel(){
  if (!DOC) return null;
  if (DOC.getElementById(DEFAULTS.idPanel)) return DOC.getElementById(DEFAULTS.idPanel);

  ensureStyle();

  const wrap = DOC.createElement('div');
  wrap.id = DEFAULTS.idPanel;
  wrap.className = 'hha-water-mini';
  wrap.innerHTML = `
    <div class="row">
      <div class="ttl">Water</div>
      <div class="meta"><span id="${DEFAULTS.idPct}">50</span><small>%</small></div>
    </div>
    <div class="zone">Zone <b id="${DEFAULTS.idZone}">GREEN</b></div>
    <div class="barWrap"><div class="bar" id="${DEFAULTS.idBar}"></div></div>
    <div class="tip" id="${DEFAULTS.idTip}">Tip: ยิง 💧 ให้คุมสมดุลน้ำให้อยู่ GREEN</div>
  `;
  DOC.body.appendChild(wrap);
  return wrap;
}

export function ensureWaterGauge(opts={}){
  if (!DOC) return;
  // If main UI exists already, do nothing.
  const hasMain =
    DOC.getElementById('water-bar') ||
    DOC.getElementById('water-pct') ||
    DOC.getElementById('water-zone');
  if (hasMain) return;

  // Otherwise create fallback mini panel.
  createFallbackPanel();
}

export function setWaterGauge(pct, opts={}){
  if (!DOC) return;
  const o = Object.assign({}, DEFAULTS, opts||{});

  const p = clamp(pct, 0, 100);
  const z = zoneFrom(p, o);

  LAST.pct = p;
  LAST.zone = z;

  // Update DOM (either main panel or fallback)
  const { bar, pct: pctEl, zone: zoneEl, tip: tipEl } = pickEls();

  if (bar)  bar.style.width = `${p.toFixed(0)}%`;
  if (pctEl) pctEl.textContent = String(p|0);
  if (zoneEl) zoneEl.textContent = z;

  if (tipEl && LAST.tip) tipEl.textContent = LAST.tip;

  // Global hints for CSS / other modules
  try{
    DOC.body.dataset.waterPct = String(p|0);
    DOC.body.dataset.waterZone = z;
  }catch(_){}

  // Optional emit
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:water', { detail:{ pct:p, zone:z } }));
  }catch(_){}

  return { pct:p, zone:z };
}

export function setWaterTip(text){
  LAST.tip = String(text ?? '');
  if (!DOC) return;
  const tip = DOC.getElementById('water-tip') || DOC.getElementById(DEFAULTS.idTip);
  if (tip) tip.textContent = LAST.tip;
}

export function getWaterState(){
  return Object.assign({}, LAST);
}