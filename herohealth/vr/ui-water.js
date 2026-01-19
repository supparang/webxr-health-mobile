// === /herohealth/vr/ui-water.js ===
// Water Gauge UI — PRODUCTION (LATEST / smooth + anti-stuck)
// ✅ ensureWaterGauge(): create widget if missing
// ✅ setWaterGauge(pct, opts?): update 0..100 (supports float)
// ✅ zoneFrom(pct): GREEN / LOW / HIGH
// ✅ Smooth animation (default ON): easing to target to avoid "jump / stuck feel"
// ✅ Anti-stuck DOM update: forces bar repaint even if same integer
//
// URL / Flags:
// - Disable: ?water=0  OR window.HHA_WATER_UI=false
// - Smooth control: ?waterSmooth=1/0   (default 1)
// - Smooth speed: ?waterEase=0.18      (0.06..0.35)
// - Display decimals: ?waterDec=0/1    (default 0 for kids)
// - Zones: ?waterLow=40&waterHigh=70  (default 40/70)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // ---- zone thresholds (configurable) ----
  const LOW_T  = clamp(parseFloat(qs('waterLow','40')), 1, 99);
  const HIGH_T = clamp(parseFloat(qs('waterHigh','70')), 1, 99);

  function zoneFrom(pct){
    pct = clamp(pct,0,100);
    if (pct < LOW_T) return 'LOW';
    if (pct > HIGH_T) return 'HIGH';
    return 'GREEN';
  }

  // ---- smooth settings ----
  const smoothQ = String(qs('waterSmooth','1')).toLowerCase();
  const SMOOTH = !(smoothQ==='0' || smoothQ==='false' || smoothQ==='off');

  const ease = clamp(parseFloat(qs('waterEase','0.18')), 0.06, 0.35); // bigger = faster follow
  const showDecQ = String(qs('waterDec','0')).toLowerCase();
  const SHOW_DEC = (showDecQ==='1' || showDecQ==='true' || showDecQ==='yes');

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
        z-index: 35; /* below HUD */
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
    `;
    DOC.head.appendChild(st);
  }

  function ensureWaterGauge(){
    // allow disable
    const q = String(qs('water','1')).toLowerCase();
    if (q === '0' || q === 'false' || WIN.HHA_WATER_UI === false) return null;

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

  // ---- smooth state ----
  const SM = {
    cur: 50,
    tgt: 50,
    raf: 0,
    lastPaintAt: 0
  };

  function paint(pct){
    pct = clamp(pct,0,100);
    const root = DOC.getElementById(ROOT_ID) || ensureWaterGauge();
    if (!root) return;

    const z = zoneFrom(pct);

    const pctEl = DOC.getElementById('hhaWaterPct');
    const zEl   = DOC.getElementById('hhaWaterZone');
    const fill  = DOC.getElementById('hhaWaterFill');

    if (pctEl){
      pctEl.textContent = SHOW_DEC ? pct.toFixed(1) : String(Math.round(pct));
    }
    if (zEl) zEl.textContent = z;

    // Anti-stuck: force set width even if visually similar
    if (fill){
      fill.style.width = pct.toFixed(2) + '%';
      // force repaint occasionally
      const t = performance.now();
      if (t - SM.lastPaintAt > 900){
        SM.lastPaintAt = t;
        // tiny nudge (doesn't change display, but triggers layout)
        fill.style.transform = 'translateZ(0)';
      }
    }

    root.classList.remove('low','high','green');
    if (z === 'LOW') root.classList.add('low');
    else if (z === 'HIGH') root.classList.add('high');
    else root.classList.add('green');
  }

  function step(){
    SM.raf = 0;
    const d = SM.tgt - SM.cur;

    // snap when close => avoids endless micro jitter
    if (Math.abs(d) < 0.08){
      SM.cur = SM.tgt;
      paint(SM.cur);
      return;
    }

    // ease follow
    SM.cur = SM.cur + d * ease;
    paint(SM.cur);

    SM.raf = requestAnimationFrame(step);
  }

  function setWaterGauge(pct, opts){
    pct = clamp(pct,0,100);

    // allow per-call override
    const smooth = (opts && typeof opts.smooth === 'boolean') ? opts.smooth : SMOOTH;

    SM.tgt = pct;

    if (!smooth){
      SM.cur = pct;
      if (SM.raf){ cancelAnimationFrame(SM.raf); SM.raf = 0; }
      paint(SM.cur);
      return;
    }

    if (!SM.raf){
      SM.raf = requestAnimationFrame(step);
    }
  }

  // Expose
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.zoneFrom = zoneFrom;

  // Optional ESM export shim (safe no-op in script mode)
  try{
    // eslint-disable-next-line no-undef
    export { ensureWaterGauge, setWaterGauge, zoneFrom };
  }catch(_){}
})();