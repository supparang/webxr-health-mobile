// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge UI — PRODUCTION
// ✅ ensureWaterGauge(): create floating gauge if not present
// ✅ setWaterGauge(pct): update gauge + emits (optional) + sync to DOM safely
// ✅ zoneFrom(pct): GREEN / LOW / HIGH based on balance rules
// ✅ Works with existing DOM panel ids: water-bar, water-pct, water-zone (if present)
// ✅ Adds its own compact gauge overlay (non-blocking) for VR/Mobile

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch(_){ return def; }
}

const CFG = {
  // Zone thresholds
  // GREEN: around mid; LOW below; HIGH above
  mid: 55,
  greenBand: 10,  // GREEN if |pct-mid| <= greenBand
  // Gauge
  showGauge: String(qs('waterGauge','1')) !== '0',
  compact: true
};

export function zoneFrom(pct){
  const p = clamp(pct,0,100);
  const d = Math.abs(p - CFG.mid);
  if (d <= CFG.greenBand) return 'GREEN';
  return (p < CFG.mid) ? 'LOW' : 'HIGH';
}

function id(x){ return DOC ? DOC.getElementById(x) : null; }

function ensureStyle(){
  if (!DOC || DOC.getElementById('hha-water-style')) return;

  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
  .hha-water{
    position:fixed;
    right: calc(12px + env(safe-area-inset-right, 0px));
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    z-index: 70;
    pointer-events: none;
    width: 180px;
    border-radius: 18px;
    border: 1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.68);
    box-shadow: 0 18px 70px rgba(0,0,0,.45);
    backdrop-filter: blur(10px);
    padding: 10px 10px 10px 10px;
    font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
    color: rgba(229,231,235,.95);
  }
  body.view-cvr .hha-water{
    right: calc(12px + env(safe-area-inset-right, 0px));
    bottom: calc(54px + env(safe-area-inset-bottom, 0px));
  }
  .hha-water .top{
    display:flex;
    justify-content:space-between;
    align-items:baseline;
    gap:10px;
    margin-bottom:8px;
  }
  .hha-water .title{
    font-weight: 900;
    font-size: 12px;
    letter-spacing: .2px;
    opacity: .95;
  }
  .hha-water .pct{
    font-weight: 900;
    font-size: 16px;
  }
  .hha-water .zone{
    font-size: 12px;
    color: rgba(148,163,184,.95);
    margin-top: 2px;
  }
  .hha-water .bar{
    height: 10px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(148,163,184,.18);
    border: 1px solid rgba(148,163,184,.12);
  }
  .hha-water .fill{
    height: 100%;
    width: 50%;
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
    transition: width 120ms linear, filter 120ms linear;
  }
  .hha-water.low  .fill{ filter: saturate(1.05) brightness(0.98); }
  .hha-water.high .fill{ filter: saturate(1.05) brightness(1.02); }
  .hha-water.green .fill{ filter: saturate(1.10) brightness(1.05); }
  @media (max-width: 420px){
    .hha-water{ width: 160px; }
  }
  `;
  DOC.head.appendChild(st);
}

function ensureGaugeEl(){
  if (!DOC) return null;
  let el = DOC.getElementById('hhaWaterGauge');
  if (el) return el;

  el = DOC.createElement('div');
  el.id = 'hhaWaterGauge';
  el.className = 'hha-water green';
  el.innerHTML = `
    <div class="top">
      <div>
        <div class="title">Water</div>
        <div class="zone" id="hhaWaterZoneText">GREEN</div>
      </div>
      <div class="pct"><span id="hhaWaterPctText">50</span>%</div>
    </div>
    <div class="bar"><div class="fill" id="hhaWaterFill"></div></div>
  `;

  DOC.body.appendChild(el);
  return el;
}

export function ensureWaterGauge(){
  if (!DOC) return;
  ensureStyle();
  if (!CFG.showGauge) return;

  const el = ensureGaugeEl();
  if (!el) return;

  // Respect pages that already show a big water panel: keep compact overlay anyway but subtle
  // You can disable via ?waterGauge=0
}

export function setWaterGauge(pct){
  if (!DOC) return;

  const p = clamp(pct,0,100);
  const zone = zoneFrom(p);

  // Update page DOM if ids exist (your Hydration HUD already has these)
  const bar = id('water-bar');
  const pctEl = id('water-pct');
  const zoneEl = id('water-zone');

  if (bar) bar.style.width = p.toFixed(0) + '%';
  if (pctEl) pctEl.textContent = String(p|0);
  if (zoneEl) zoneEl.textContent = zone;

  // Update compact gauge overlay
  if (!CFG.showGauge) return;

  ensureStyle();
  const g = ensureGaugeEl();
  if (!g) return;

  const fill = DOC.getElementById('hhaWaterFill');
  const zt = DOC.getElementById('hhaWaterZoneText');
  const pt = DOC.getElementById('hhaWaterPctText');

  if (fill) fill.style.width = p.toFixed(0) + '%';
  if (zt) zt.textContent = zone;
  if (pt) pt.textContent = String(p|0);

  g.classList.remove('low','high','green');
  g.classList.add(zone === 'GREEN' ? 'green' : (zone === 'LOW' ? 'low' : 'high'));
}