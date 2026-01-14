// === /herohealth/vr/ui-water.js ===
// Water Gauge UI — PRODUCTION (small + safe) — PATCHED
// ✅ ensureWaterGauge(): สร้าง widget ถ้ายังไม่มี
// ✅ setWaterGauge(pct): อัปเดตค่า 0..100 + สีตาม zone
// ✅ zoneFrom(pct): GREEN / LOW / HIGH (kids-friendly optional)
// ✅ NEW: smoothing (EMA) to avoid "jumping" gauge on fast updates
//
// Controls:
// - Disable: ?water=0 OR window.HHA_WATER_UI=false
// - Kids: ?kids=1  (wider GREEN zone)
// - Smooth: ?waterSmooth=0 to disable smoothing (default: 1)
// - Smooth strength: ?waterSmoothK=0.18 (0.05..0.45)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  const kidsQ = String(qs('kids','0')).toLowerCase();
  const KIDS = (kidsQ==='1' || kidsQ==='true' || kidsQ==='yes');

  const smoothQ = String(qs('waterSmooth','1')).toLowerCase();
  const SMOOTH_ON = !(smoothQ==='0' || smoothQ==='false' || smoothQ==='off');

  const smoothK = clamp(parseFloat(qs('waterSmoothK', '0.18')), 0.05, 0.45);

  // Wider GREEN zone for kids (less "falling out" stress)
  function zoneFrom(pct){
    pct = clamp(pct,0,100);
    const lowTh  = KIDS ? 45 : 40;
    const highTh = KIDS ? 75 : 70;
    if (pct < lowTh) return 'LOW';
    if (pct > highTh) return 'HIGH';
    return 'GREEN';
  }

  const STYLE_ID = 'hha-water-ui-style';
  const ROOT_ID  = 'hha-water-ui';

  function injectStyle(){
    if (DOC.getElementById(STYLE_ID)) return;
    const st = DOC.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      .hha-water-ui{
        position: fixed;
        left: calc(10px + env(safe-area-inset-left, 0px));
        bottom: calc(10px + env(safe-area-inset-bottom, 0px));
        z-index: 35; /* ต่ำกว่า HUD */
        pointer-events: none;
        display: grid;
        gap: 6px;
        width: 170px;
        padding: 10px 10px;
        border-radius: 16px;
        border: 1px solid rgba(148,163,184,.14);
        background: rgba(2,6,23,.55);
        backdrop-filter: blur(10px);
        box-shadow: 0 18px 60px rgba(0,0,0,.35);
        font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
        color: rgba(229,231,235,.92);
      }
      .hha-water-ui[hidden]{ display:none !important; }
      .hha-water-ui .row{
        display:flex; align-items:baseline; justify-content:space-between;
        gap: 10px;
      }
      .hha-water-ui .title{
        font-weight: 900;
        letter-spacing: .2px;
        font-size: 12px;
        opacity: .95;
      }
      .hha-water-ui .pct{
        font-weight: 900;
        font-size: 16px;
      }
      .hha-water-ui .zone{
        font-size: 12px;
        color: rgba(148,163,184,.95);
      }
      .hha-water-ui .bar{
        height: 10px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(148,163,184,.18);
        border: 1px solid rgba(148,163,184,.10);
      }
      .hha-water-ui .fill{
        height: 100%;
        width: 50%;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
        transform-origin: left center;
        will-change: width;
      }
      .hha-water-ui.low .fill{
        background: linear-gradient(90deg, rgba(34,211,238,.95), rgba(59,130,246,.95));
      }
      .hha-water-ui.high .fill{
        background: linear-gradient(90deg, rgba(245,158,11,.95), rgba(239,68,68,.95));
      }
      .hha-water-ui .hint{
        font-size: 11px;
        opacity: .8;
        color: rgba(148,163,184,.95);
      }
    `;
    DOC.head.appendChild(st);
  }

  function ensureWaterGauge(){
    const q = String(qs('water','1')).toLowerCase();
    if (q === '0' || q === 'false' || WIN.HHA_WATER_UI === false) return null;

    injectStyle();

    let root = DOC.getElementById(ROOT_ID);
    if (root) return root;

    root = DOC.createElement('div');
    root.id = ROOT_ID;
    root.className = 'hha-water-ui';

    const hint = KIDS ? 'Kids: GREEN กว้างขึ้น' : '';

    root.innerHTML = `
      <div class="row">
        <div class="title">Water Gauge</div>
        <div class="pct"><span id="hhaWaterPct">50</span>%</div>
      </div>
      <div class="row">
        <div class="zone">Zone: <b id="hhaWaterZone">GREEN</b></div>
      </div>
      <div class="bar"><div class="fill" id="hhaWaterFill"></div></div>
      ${hint ? `<div class="hint">${hint}</div>` : ``}
    `;

    DOC.body.appendChild(root);
    return root;
  }

  // ---- smoothing state ----
  const SM = { init:false, shown:50 };

  function setWaterGauge(pct){
    pct = clamp(pct,0,100);

    const root = DOC.getElementById(ROOT_ID) || ensureWaterGauge();
    if (!root) return;

    // smoothing: make UI "flow" (does not change game logic)
    let show = pct;
    if (SMOOTH_ON){
      if (!SM.init){ SM.init = true; SM.shown = pct; }
      SM.shown = (1 - smoothK) * SM.shown + smoothK * pct;
      show = SM.shown;
    }

    const z = zoneFrom(show);

    const pctEl = DOC.getElementById('hhaWaterPct');
    const zEl   = DOC.getElementById('hhaWaterZone');
    const fill  = DOC.getElementById('hhaWaterFill');

    if (pctEl) pctEl.textContent = String(Math.round(show));
    if (zEl) zEl.textContent = z;
    if (fill) fill.style.width = clamp(show,0,100).toFixed(0) + '%';

    root.classList.remove('low','high','green');
    if (z === 'LOW') root.classList.add('low');
    else if (z === 'HIGH') root.classList.add('high');
    else root.classList.add('green');
  }

  // expose globally (non-module safe)
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.zoneFrom = zoneFrom;

})();