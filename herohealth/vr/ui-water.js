// === /herohealth/vr/ui-water.js ===
// Water Gauge UI — PRODUCTION
// ✅ ensureWaterGauge(): create HUD widget if missing
// ✅ setWaterGauge(pct): update fill + zone + label + aria
// ✅ zoneFrom(pct): LOW / GREEN / HIGH
// ✅ No dependencies; never throws

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

/**
 * Zone rule (kid-friendly + stable)
 * - LOW  : pct < 40
 * - GREEN: 40..70
 * - HIGH : > 70
 */
export function zoneFrom(pct){
  const p = clamp(pct, 0, 100);
  if (p < 40) return 'LOW';
  if (p <= 70) return 'GREEN';
  return 'HIGH';
}

function cssSafe(s){
  return String(s||'').replace(/[^a-z0-9_\-]/gi, '');
}

function ensureStyleOnce(){
  if (!DOC) return;
  if (DOC.getElementById('hha-water-style')) return;

  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
  .hha-water{
    position:fixed;
    right: calc(12px + env(safe-area-inset-right, 0px));
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    z-index: 70;
    width: min(280px, 42vw);
    pointer-events:none;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    color: rgba(229,231,235,.96);
    filter: drop-shadow(0 16px 40px rgba(0,0,0,.35));
  }

  .hha-water .card{
    background: rgba(2,6,23,.72);
    border: 1px solid rgba(148,163,184,.18);
    border-radius: 18px;
    backdrop-filter: blur(10px);
    padding: 10px 12px;
    box-shadow: 0 18px 70px rgba(0,0,0,.40);
  }

  .hha-water .top{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap: 10px;
    margin-bottom: 8px;
  }

  .hha-water .title{
    font-weight: 900;
    font-size: 13px;
    letter-spacing: .2px;
    line-height: 1.1;
  }

  .hha-water .zone{
    margin-top: 3px;
    font-size: 12px;
    color: rgba(148,163,184,.95);
    line-height: 1.15;
  }

  .hha-water .pct{
    text-align:right;
    font-weight: 900;
    font-size: 20px;
    line-height: 1;
  }
  .hha-water .pct span{
    font-size: 13px;
    color: rgba(148,163,184,.95);
    font-weight: 800;
    margin-left: 2px;
  }

  .hha-water .barWrap{
    height: 10px;
    border-radius: 999px;
    overflow:hidden;
    background: rgba(148,163,184,.18);
    border: 1px solid rgba(148,163,184,.12);
  }

  .hha-water .bar{
    height:100%;
    width: 50%;
    border-radius: 999px;
    transition: width 120ms linear, filter 120ms linear;
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
  }

  .hha-water .hint{
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.25;
    color: rgba(229,231,235,.85);
    white-space: pre-line;
  }

  /* Zones (light touch; no heavy colors) */
  .hha-water.is-LOW  .bar{ background: linear-gradient(90deg, rgba(245,158,11,.95), rgba(34,211,238,.65)); }
  .hha-water.is-GREEN .bar{ background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95)); }
  .hha-water.is-HIGH .bar{ background: linear-gradient(90deg, rgba(34,211,238,.90), rgba(168,85,247,.85)); }

  /* Reduce clutter in very small screens */
  @media (max-width: 420px){
    .hha-water{ width: min(240px, 46vw); }
    .hha-water .hint{ display:none; }
  }
  `;
  DOC.head.appendChild(st);
}

function buildGauge(){
  if (!DOC) return null;

  ensureStyleOnce();

  const root = DOC.createElement('div');
  root.className = 'hha-water is-GREEN';
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('role', 'status');

  root.innerHTML = `
    <div class="card">
      <div class="top">
        <div>
          <div class="title">Water</div>
          <div class="zone">Zone <b class="zoneVal">GREEN</b></div>
        </div>
        <div class="pct"><span class="pctVal">50</span><span>%</span></div>
      </div>
      <div class="barWrap"><div class="bar"></div></div>
      <div class="hint">Tip: เก็บ 🛡️ ก่อนพายุ แล้ว BLOCK ช่วง End Window</div>
    </div>
  `;

  DOC.body.appendChild(root);
  return root;
}

function findExisting(){
  // Prefer explicit ids if present (your hydration HTML already has its own water panel)
  // But this module provides a standalone gauge for other games or fallback.
  if (!DOC) return null;
  return DOC.querySelector('.hha-water');
}

/**
 * ensureWaterGauge()
 * - Create fallback gauge if none exists.
 * - If your page already has its own water panel, this gauge is optional.
 */
export function ensureWaterGauge(){
  try{
    if (!DOC || !DOC.body) return null;
    const ex = findExisting();
    if (ex) return ex;
    return buildGauge();
  }catch(_){
    return null;
  }
}

/**
 * setWaterGauge(pct, opts?)
 * opts = { tip?: string }
 */
export function setWaterGauge(pct, opts = {}){
  try{
    if (!DOC) return;

    // If your page already has a dedicated panel (water-bar/water-pct/water-zone),
    // hydration.safe.js calls those directly. This function still updates fallback gauge.
    const gauge = findExisting() || ensureWaterGauge();
    if (!gauge) return;

    const p = clamp(pct, 0, 100);
    const z = zoneFrom(p);

    gauge.classList.remove('is-LOW','is-GREEN','is-HIGH');
    gauge.classList.add('is-' + cssSafe(z));

    const bar = gauge.querySelector('.bar');
    const pctVal = gauge.querySelector('.pctVal');
    const zoneVal = gauge.querySelector('.zoneVal');
    const hint = gauge.querySelector('.hint');

    if (bar) bar.style.width = p.toFixed(0) + '%';
    if (pctVal) pctVal.textContent = String(p | 0);
    if (zoneVal) zoneVal.textContent = z;

    if (hint && opts && typeof opts.tip === 'string' && opts.tip.trim()){
      hint.textContent = opts.tip.trim();
    }

    // aria label (help screen readers; harmless)
    gauge.setAttribute('aria-label', `Water ${p|0} percent, zone ${z}`);
  }catch(_){}
}