// === /herohealth/vr/ui-water.js ===
// Water UI — PRODUCTION (robust + compatible)
// ✅ ensureWaterGauge(): safe inject minimal gauge if missing (optional use)
// ✅ setWaterGauge(pct, opts?): updates UI (#water-bar/#water-pct/#water-zone/#water-tip + optional injected gauge)
// ✅ zoneFrom(pct): LOW / GREEN / HIGH
// ✅ emits: hha:water {pct, zone}
//
// Notes:
// - Hydration page already has its own Water panel. This module will just update it if present.
// - If a page doesn't include the panel, ensureWaterGauge() can inject a small corner gauge.
//
'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; }
}
function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
}
function getEl(id){
  try{ return DOC.getElementById(id); }catch(_){ return null; }
}

const CFG = {
  // threshold can be tuned; default gives GREEN as a mid band
  greenMin: 40,
  greenMax: 70,

  // for injected gauge only
  injectedId: 'hha-water-mini',
  injectedBarId: 'hha-water-mini-bar',
  injectedTxtId: 'hha-water-mini-txt',
  injectedZoneId:'hha-water-mini-zone'
};

// Allow overrides via global config if desired
(function loadConfig(){
  try{
    const g = ROOT.HHA_WATER_CONFIG;
    if (g && typeof g === 'object'){
      if (Number.isFinite(g.greenMin)) CFG.greenMin = clamp(g.greenMin, 0, 100);
      if (Number.isFinite(g.greenMax)) CFG.greenMax = clamp(g.greenMax, 0, 100);
    }
  }catch(_){}
})();

export function zoneFrom(pct){
  pct = clamp(pct, 0, 100);
  if (pct < CFG.greenMin) return 'LOW';
  if (pct > CFG.greenMax) return 'HIGH';
  return 'GREEN';
}

function defaultTip(zone){
  // Simple, kid-friendly tips (hydration-themed)
  if (zone === 'GREEN') return 'ดีมาก! คุมให้อยู่ GREEN ต่อไป แล้วลากคอมโบยาว ๆ ✅';
  if (zone === 'LOW')   return 'LOW: ยิง 💧 เพิ่มเพื่อดันกลับเข้า GREEN';
  if (zone === 'HIGH')  return 'HIGH: ระวังน้ำ “สูงเกิน” ยิง 💧 อย่างพอดีเพื่อกลับเข้า GREEN';
  return '—';
}

// Inject a minimal corner gauge (only if main UI not present)
export function ensureWaterGauge(){
  if (!DOC || !DOC.body) return null;

  // If page already has water panel (your hydration uses #water-bar/#water-pct/#water-zone), skip inject
  if (getEl('water-bar') || getEl('water-pct') || getEl('water-zone')) return null;

  // If already injected, return it
  const exists = DOC.getElementById(CFG.injectedId);
  if (exists) return exists;

  // Inject CSS once
  if (!DOC.getElementById('hha-water-mini-style')){
    const st = DOC.createElement('style');
    st.id = 'hha-water-mini-style';
    st.textContent = `
      #${CFG.injectedId}{
        position:fixed;
        right:12px;
        top:12px;
        z-index:96;
        width:170px;
        padding:10px 10px;
        border-radius:16px;
        background:rgba(2,6,23,.72);
        border:1px solid rgba(148,163,184,.18);
        box-shadow: 0 18px 70px rgba(0,0,0,.45);
        backdrop-filter: blur(10px);
        font: 800 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial;
        color: rgba(229,231,235,.92);
        pointer-events:none;
      }
      #${CFG.injectedId} .row{ display:flex; justify-content:space-between; align-items:baseline; gap:10px; }
      #${CFG.injectedId} .muted{ font-weight:700; color:rgba(148,163,184,.95); }
      #${CFG.injectedId} .big{ font-size:18px; font-weight:900; }
      #${CFG.injectedId} .bar{
        margin-top:8px;
        height:10px;
        border-radius:999px;
        background:rgba(148,163,184,.18);
        overflow:hidden;
        border:1px solid rgba(148,163,184,.12);
      }
      #${CFG.injectedId} .bar > div{
        height:100%;
        width:50%;
        background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
      }
    `;
    DOC.head.appendChild(st);
  }

  // Create node
  const box = DOC.createElement('div');
  box.id = CFG.injectedId;
  box.innerHTML = `
    <div class="row">
      <div class="muted">Water</div>
      <div class="big"><span id="${CFG.injectedTxtId}">50</span><span class="muted">%</span></div>
    </div>
    <div class="row" style="margin-top:4px">
      <div class="muted">Zone</div>
      <div><b id="${CFG.injectedZoneId}">GREEN</b></div>
    </div>
    <div class="bar"><div id="${CFG.injectedBarId}"></div></div>
  `;
  DOC.body.appendChild(box);
  return box;
}

export function setWaterGauge(pct, opts = {}){
  pct = clamp(pct, 0, 100);
  const zone = String(opts.zone || zoneFrom(pct));
  const tip  = String(opts.tip || defaultTip(zone));

  // Update Hydration page elements if present
  const bar = getEl('water-bar');
  const txt = getEl('water-pct');
  const zEl = getEl('water-zone');
  const tipEl = getEl('water-tip');

  if (bar) bar.style.width = pct.toFixed(0) + '%';
  if (txt) txt.textContent = String(pct|0);
  if (zEl) zEl.textContent = zone;
  if (tipEl && (opts.setTip !== false)) tipEl.textContent = tip;

  // Update injected mini gauge if present (or inject if asked)
  if (opts.ensure === true) ensureWaterGauge();

  const ibar = getEl(CFG.injectedBarId);
  const itxt = getEl(CFG.injectedTxtId);
  const izon = getEl(CFG.injectedZoneId);

  if (ibar) ibar.style.width = pct.toFixed(0) + '%';
  if (itxt) itxt.textContent = String(pct|0);
  if (izon) izon.textContent = zone;

  emit('hha:water', { pct, zone, tip });
  return { pct, zone, tip };
}