// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge UI — PRODUCTION (Reusable)
// ✅ Works with existing DOM ids (water-bar, water-pct, water-zone, water-tip)
// ✅ Fallback: auto creates a compact widget if not found
// ✅ API:
//    - ensureWaterGauge(opts?)
//    - setWaterGauge(pct, opts?)
//    - zoneFrom(pct, cfg?)
// ✅ Emits: hha:water { pct, zone }
// Notes:
// - No deps, safe for all games.

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function zoneFrom(pct, cfg={}){
  const p = clamp(pct, 0, 100);
  const lowMax  = clamp(cfg.lowMax  ?? 44, 0, 100);
  const highMin = clamp(cfg.highMin ?? 66, 0, 100);

  if (p <= lowMax) return 'LOW';
  if (p >= highMin) return 'HIGH';
  return 'GREEN';
}

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function qs(sel){ try{ return DOC.querySelector(sel); }catch(_){ return null; } }
function byId(id){ try{ return DOC.getElementById(id); }catch(_){ return null; } }

function ensureStyle(){
  if (!DOC || byId('hha-water-style')) return;

  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
  .hha-water-mini{
    position:fixed;
    right:12px;
    bottom:12px;
    z-index:60;
    pointer-events:none;
    padding:10px 12px;
    border-radius:16px;
    border:1px solid rgba(148,163,184,.16);
    background: rgba(2,6,23,.72);
    backdrop-filter: blur(10px);
    box-shadow: 0 18px 70px rgba(0,0,0,.40);
    color: rgba(229,231,235,.92);
    font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
    min-width: 180px;
  }
  .hha-water-mini .row{
    display:flex; justify-content:space-between; align-items:baseline;
    gap:10px;
  }
  .hha-water-mini .k{
    font-size:12px;
    color: rgba(148,163,184,.95);
    letter-spacing:.2px;
  }
  .hha-water-mini .v{
    font-weight:900;
    font-size:16px;
  }
  .hha-water-mini .barWrap{
    margin-top:8px;
    height:10px;
    border-radius:999px;
    background: rgba(148,163,184,.18);
    overflow:hidden;
    border:1px solid rgba(148,163,184,.12);
  }
  .hha-water-mini .bar{
    height:100%;
    width:50%;
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
    transform-origin:left center;
  }
  .hha-water-mini.low .bar{
    background: linear-gradient(90deg, rgba(34,211,238,.95), rgba(59,130,246,.95));
  }
  .hha-water-mini.green .bar{
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
  }
  .hha-water-mini.high .bar{
    background: linear-gradient(90deg, rgba(245,158,11,.95), rgba(239,68,68,.92));
  }`;
  DOC.head.appendChild(st);
}

function ensureFallbackWidget(){
  if (!DOC) return null;
  let wrap = qs('.hha-water-mini');
  if (wrap) return wrap;

  ensureStyle();
  wrap = DOC.createElement('div');
  wrap.className = 'hha-water-mini green';
  wrap.innerHTML = `
    <div class="row">
      <div class="k">Water</div>
      <div class="v"><span class="pct">50</span><span style="font-size:12px;color:rgba(148,163,184,.95)">%</span></div>
    </div>
    <div class="row" style="margin-top:2px">
      <div class="k">Zone</div>
      <div class="v zone" style="font-size:14px">GREEN</div>
    </div>
    <div class="barWrap"><div class="bar"></div></div>
    <div class="k tip" style="margin-top:8px; white-space:pre-line; line-height:1.25; color:rgba(229,231,235,.85)">
      —
    </div>
  `;
  DOC.body.appendChild(wrap);
  return wrap;
}

function resolveDom(){
  // prefer explicit hydration ids
  const bar  = byId('water-bar');
  const pct  = byId('water-pct');
  const zone = byId('water-zone');
  const tip  = byId('water-tip');

  if (bar || pct || zone || tip){
    return { mode:'native', bar, pct, zone, tip, wrap:null };
  }

  // fallback widget
  const wrap = ensureFallbackWidget();
  if (!wrap) return { mode:'none' };

  return {
    mode:'fallback',
    wrap,
    bar:  wrap.querySelector('.bar'),
    pct:  wrap.querySelector('.pct'),
    zone: wrap.querySelector('.zone'),
    tip:  wrap.querySelector('.tip')
  };
}

let __DOM = null;

export function ensureWaterGauge(opts={}){
  if (!DOC) return null;
  if (__DOM && __DOM.mode !== 'none') return __DOM;

  __DOM = resolveDom();

  // optional initial tip text
  if (opts && typeof opts.tip === 'string'){
    try{
      if (__DOM.tip) __DOM.tip.textContent = opts.tip;
    }catch(_){}
  }

  return __DOM;
}

export function setWaterGauge(pct, opts={}){
  if (!DOC) return;

  const dom = ensureWaterGauge();
  if (!dom || dom.mode === 'none') return;

  const p = clamp(pct, 0, 100);
  const cfg = opts.zoneCfg || {};
  const zone = zoneFrom(p, cfg);

  // update text
  try{ if (dom.pct) dom.pct.textContent = String(p|0); }catch(_){}
  try{ if (dom.zone) dom.zone.textContent = String(zone); }catch(_){}

  // update bar width
  try{
    if (dom.mode === 'native'){
      if (dom.bar) dom.bar.style.width = `${(p|0)}%`;
    } else {
      if (dom.bar) dom.bar.style.width = `${(p|0)}%`;
    }
  }catch(_){}

  // update tip (optional)
  if (typeof opts.tip === 'string'){
    try{ if (dom.tip) dom.tip.textContent = String(opts.tip); }catch(_){}
  }

  // update fallback skin class
  if (dom.mode === 'fallback' && dom.wrap){
    try{
      dom.wrap.classList.remove('low','green','high');
      dom.wrap.classList.add(zone.toLowerCase());
    }catch(_){}
  }

  emit('hha:water', { pct: p, zone });
}