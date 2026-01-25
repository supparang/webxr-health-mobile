// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge — PRODUCTION
// ✅ ensureWaterGauge(): creates minimal gauge if missing
// ✅ setWaterGauge(pct): updates gauge + exposes CSS vars
// ✅ zoneFrom(pct): GREEN / LOW / HIGH
//
// Notes:
// - Safe with your custom HUD (won't steal pointer-events)
// - If you already have your own Water panel (like hydration-vr.html),
//   this still works as a "global gauge" (optional). You can hide via CSS if needed.

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function zoneFrom(pct){
  // Stable thresholds (tweak if needed)
  const p = clamp(pct, 0, 100);
  // GREEN zone around mid
  if (p >= 45 && p <= 65) return 'GREEN';
  if (p < 45) return 'LOW';
  return 'HIGH';
}

export function ensureWaterGauge(){
  if (!DOC) return null;
  if (DOC.getElementById('hha-water-gauge')) return DOC.getElementById('hha-water-gauge');

  // Styles (inject once)
  if (!DOC.getElementById('hha-water-style')){
    const st = DOC.createElement('style');
    st.id = 'hha-water-style';
    st.textContent = `
    :root{
      --hha-water-pct: 50;
      --hha-water-zone: "GREEN";
    }
    /* Minimal gauge (top-center) — pointer-events none */
    #hha-water-gauge{
      position:fixed;
      left:50%;
      top: calc(10px + env(safe-area-inset-top, 0px));
      transform: translateX(-50%);
      z-index: 80;
      pointer-events:none;
      width: min(440px, calc(100vw - 24px));
      padding: 10px 12px;
      border-radius: 16px;
      border: 1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.62);
      backdrop-filter: blur(10px);
      box-shadow: 0 18px 70px rgba(0,0,0,.40);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
      color: rgba(229,231,235,.92);
      display: grid;
      gap: 8px;
    }
    #hha-water-gauge .row{
      display:flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      line-height:1.1;
    }
    #hha-water-gauge .title{
      font-weight:900;
      letter-spacing:.2px;
      font-size: 13px;
      opacity:.95;
    }
    #hha-water-gauge .pct{
      font-weight:900;
      font-size: 18px;
    }
    #hha-water-gauge .zone{
      font-weight:900;
      font-size: 12px;
      opacity:.92;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,.14);
      background: rgba(15,23,42,.55);
    }
    #hha-water-gauge .bar{
      height: 10px;
      border-radius: 999px;
      background: rgba(148,163,184,.18);
      border: 1px solid rgba(148,163,184,.10);
      overflow:hidden;
    }
    #hha-water-gauge .fill{
      height:100%;
      width: calc(var(--hha-water-pct) * 1%);
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
      transform-origin: left center;
    }

    /* Zone tint (optional) */
    body.hha-zone-GREEN #hha-water-gauge .zone{ border-color: rgba(34,197,94,.25); background: rgba(34,197,94,.12); }
    body.hha-zone-LOW   #hha-water-gauge .zone{ border-color: rgba(245,158,11,.25); background: rgba(245,158,11,.12); }
    body.hha-zone-HIGH  #hha-water-gauge .zone{ border-color: rgba(239,68,68,.25); background: rgba(239,68,68,.12); }

    /* If you want to disable this gauge because you already show Water panel:
       add in your page CSS: body.hide-water-gauge #hha-water-gauge{ display:none; }
    */
    `;
    DOC.head.appendChild(st);
  }

  // DOM
  const wrap = DOC.createElement('div');
  wrap.id = 'hha-water-gauge';
  wrap.setAttribute('aria-hidden','true');
  wrap.innerHTML = `
    <div class="row">
      <div class="title">Water Gauge</div>
      <div style="display:flex; gap:8px; align-items:baseline;">
        <div class="zone" id="hha-water-zone">GREEN</div>
        <div class="pct"><span id="hha-water-pct">50</span><span style="font-size:12px;opacity:.75">%</span></div>
      </div>
    </div>
    <div class="bar"><div class="fill" id="hha-water-fill"></div></div>
  `;

  DOC.body.appendChild(wrap);
  return wrap;
}

export function setWaterGauge(pct){
  if (!DOC) return;
  const p = clamp(pct, 0, 100);
  const zone = zoneFrom(p);

  // expose CSS vars
  try{
    DOC.documentElement.style.setProperty('--hha-water-pct', String(p.toFixed(0)));
    DOC.documentElement.style.setProperty('--hha-water-zone', `"${zone}"`);
  }catch(_){}

  // body zone classes (handy for fx/tint)
  try{
    DOC.body.classList.remove('hha-zone-GREEN','hha-zone-LOW','hha-zone-HIGH');
    DOC.body.classList.add('hha-zone-'+zone);
  }catch(_){}

  // update gauge if present
  const pctEl = DOC.getElementById('hha-water-pct');
  if (pctEl) pctEl.textContent = String(p|0);
  const zEl = DOC.getElementById('hha-water-zone');
  if (zEl) zEl.textContent = zone;

  const fill = DOC.getElementById('hha-water-fill');
  if (fill) fill.style.width = (p.toFixed(0)+'%');
}