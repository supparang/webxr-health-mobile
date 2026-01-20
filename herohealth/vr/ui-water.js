// === /herohealth/vr/ui-water.js ===
// Water Gauge UI — PRODUCTION (LATEST, smooth + safe)
// ✅ ensureWaterGauge(): create widget if missing
// ✅ setWaterGauge(pct): set target 0..100 (smooth render, low DOM thrash)
// ✅ zoneFrom(pct): GREEN / LOW / HIGH (kids-friendly widen with ?kids=1)
// ✅ disable: ?water=0 OR window.HHA_WATER_UI=false
//
// Notes:
// - Designed to NOT collide with your HUD (your HUD z-index ~60; this is 35)
// - This gauge is optional; Hydration also has its own water panel in HUD
// - Smooth rendering helps when engine calls setWaterGauge() every frame

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  const STYLE_ID = 'hha-water-ui-style';
  const ROOT_ID  = 'hha-water-ui';

  // ---- Zone thresholds (shared) ----
  // Default GREEN 40..70
  // Kids-friendly: widen slightly 35..75 when ?kids=1 (or yes/true)
  function zoneFrom(pct){
    pct = clamp(pct,0,100);

    const kidsQ = String(qs('kids','0')).toLowerCase();
    const KIDS = (kidsQ==='1' || kidsQ==='true' || kidsQ==='yes');

    // allow override via window.HHA_WATER_ZONE = { greenMin, greenMax }
    const Z = WIN.HHA_WATER_ZONE || {};
    let greenMin = clamp(parseFloat(Z.greenMin ?? qs('greenMin', KIDS ? 35 : 40)), 0, 100);
    let greenMax = clamp(parseFloat(Z.greenMax ?? qs('greenMax', KIDS ? 75 : 70)), 0, 100);
    if (greenMax < greenMin) { const t=greenMax; greenMax=greenMin; greenMin=t; }

    if (pct < greenMin) return 'LOW';
    if (pct > greenMax) return 'HIGH';
    return 'GREEN';
  }

  function injectStyle(){
    if (DOC.getElementById(STYLE_ID)) return;
    const st = DOC.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      .hha-water-ui{
        position: fixed;
        left: calc(10px + env(safe-area-inset-left, 0px));
        bottom: calc(10px + env(safe-area-inset-bottom, 0px));
        z-index: 35; /* below HUD (yours ~60) */
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
        /* Smooth visual even when pct jumps */
        transition: width 120ms linear;
      }
      .hha-water-ui.low .fill{
        background: linear-gradient(90deg, rgba(34,211,238,.95), rgba(59,130,246,.95));
      }
      .hha-water-ui.high .fill{
        background: linear-gradient(90deg, rgba(245,158,11,.95), rgba(239,68,68,.95));
      }
    `;
    DOC.head.appendChild(st);
  }

  function allowEnabled(){
    const q = String(qs('water','1')).toLowerCase();
    if (q === '0' || q === 'false') return false;
    if (WIN.HHA_WATER_UI === false) return false;
    return true;
  }

  function ensureWaterGauge(){
    if (!allowEnabled()) return null;

    injectStyle();

    let root = DOC.getElementById(ROOT_ID);
    if (root) return root;

    root = DOC.createElement('div');
    root.id = ROOT_ID;
    root.className = 'hha-water-ui';

    root.innerHTML = `
      <div class="row">
        <div class="title">Water Gauge</div>
        <div class="pct"><span id="hhaWaterPct">50</span>%</div>
      </div>
      <div class="row">
        <div class="zone">Zone: <b id="hhaWaterZone">GREEN</b></div>
      </div>
      <div class="bar"><div class="fill" id="hhaWaterFill"></div></div>
    `;

    DOC.body.appendChild(root);
    return root;
  }

  // ---- Smooth render state ----
  const UI = {
    targetPct: 50,
    shownPct: 50,
    lastDrawPctInt: 50,
    running: false,
    raf: 0,
    lastT: 0
  };

  function draw(){
    if (!UI.running) return;
    UI.raf = requestAnimationFrame(draw);

    const t = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (t - (UI.lastT || t)) / 1000));
    UI.lastT = t;

    const root = DOC.getElementById(ROOT_ID) || ensureWaterGauge();
    if (!root) { UI.running = false; return; }

    // Smooth: time-based lerp (fast but not jitter)
    // rate ~ 10..14 per sec
    const rate = 12.0;
    const alpha = 1 - Math.exp(-rate * dt);
    UI.shownPct = UI.shownPct + (UI.targetPct - UI.shownPct) * alpha;

    const shown = clamp(UI.shownPct, 0, 100);
    const shownInt = shown | 0;

    // Reduce DOM writes: update pct text only when int changed
    if (shownInt !== UI.lastDrawPctInt){
      UI.lastDrawPctInt = shownInt;
      const pctEl = DOC.getElementById('hhaWaterPct');
      if (pctEl) pctEl.textContent = String(shownInt);
    }

    const z = zoneFrom(shown);
    const zEl = DOC.getElementById('hhaWaterZone');
    if (zEl && zEl.textContent !== z) zEl.textContent = z;

    const fill = DOC.getElementById('hhaWaterFill');
    if (fill) fill.style.width = shown.toFixed(0) + '%';

    root.classList.remove('low','high','green');
    if (z === 'LOW') root.classList.add('low');
    else if (z === 'HIGH') root.classList.add('high');
    else root.classList.add('green');

    // Stop loop when close enough (idle)
    if (Math.abs(UI.targetPct - UI.shownPct) < 0.15){
      // keep it alive a tiny bit to catch rapid changes
      // but allow engine to restart on next setWaterGauge()
      UI.running = false;
      cancelAnimationFrame(UI.raf);
      UI.raf = 0;
    }
  }

  function startLoop(){
    if (UI.running) return;
    UI.running = true;
    UI.lastT = 0;
    UI.raf = requestAnimationFrame(draw);
  }

  function setWaterGauge(pct){
    if (!allowEnabled()) return;

    pct = clamp(pct,0,100);

    // ensure exists
    const root = DOC.getElementById(ROOT_ID) || ensureWaterGauge();
    if (!root) return;

    // Update target only (smooth draw handles the rest)
    UI.targetPct = pct;

    // If first time, snap shownPct to target to avoid "jump from old page"
    if (!Number.isFinite(UI.shownPct)) UI.shownPct = pct;

    startLoop();
  }

  // ---- Export to window ----
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.zoneFrom = zoneFrom;

  // Optional: expose state for debugging
  WIN.getWaterGaugeState = ()=>({ targetPct:UI.targetPct, shownPct:UI.shownPct, running:UI.running });

})();