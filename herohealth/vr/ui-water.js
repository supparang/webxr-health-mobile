// === /herohealth/vr/ui-water.js ===
// UI Water Gauge — PRODUCTION (LATEST)
// ✅ ensureWaterGauge(): mount minimal gauge (optional; hydration-vr.html มี panel ของตัวเองอยู่แล้วก็ไม่ชนกัน)
// ✅ setWaterGauge(pct): update DOM + CSS vars (smooth)
// ✅ zoneFrom(pct): LOW / GREEN / HIGH (stable thresholds for kids)
// ✅ safe-area aware; works PC/Mobile/cVR/Cardboard
// Notes:
// - Hydration RUN มี water panel (#water-bar/#water-pct/#water-zone) อยู่แล้ว
//   ตัวนี้จะ "ไม่สร้างซ้ำ" ถ้าพบ panel แล้ว
// - ถ้าไม่มี panel ในหน้าอื่น ๆ ก็จะสร้าง overlay เล็ก ๆ ให้เอง

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC) return;

  // -------- helpers --------
  const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

  // Kids-friendly thresholds (stable + forgiving)
  // LOW  : 0..39
  // GREEN: 40..69
  // HIGH : 70..100
  function zoneFrom(pct){
    const p = clamp(pct,0,100);
    if (p < 40) return 'LOW';
    if (p <= 69) return 'GREEN';
    return 'HIGH';
  }

  // If the RUN page already has water panel elements, do not create overlay
  function hasBuiltInPanel(){
    return !!(DOC.getElementById('water-bar') || DOC.getElementById('water-pct') || DOC.getElementById('water-zone'));
  }

  function ensureStyles(){
    if (DOC.getElementById('hha-water-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-water-style';
    st.textContent = `
      :root{
        --hha-water-pct: 50;
        --hha-water-zone: GREEN;
        --hha-water-sat: env(safe-area-inset-top, 0px);
        --hha-water-sab: env(safe-area-inset-bottom, 0px);
        --hha-water-sal: env(safe-area-inset-left, 0px);
        --hha-water-sar: env(safe-area-inset-right, 0px);
      }
      /* optional overlay (only if created) */
      #hha-water{
        position: fixed;
        right: calc(12px + var(--hha-water-sar));
        top: calc(96px + var(--hha-water-sat));
        z-index: 35;
        width: 190px;
        border-radius: 18px;
        border: 1px solid rgba(148,163,184,.16);
        background: rgba(2,6,23,.62);
        box-shadow: 0 18px 70px rgba(0,0,0,.42);
        backdrop-filter: blur(10px);
        padding: 10px;
        pointer-events: none;
      }
      #hha-water .row{
        display:flex; justify-content:space-between; align-items:center;
        gap:10px;
        font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
      }
      #hha-water .title{ font-weight: 950; font-size: 12px; color: rgba(229,231,235,.95); }
      #hha-water .zone{ font-size: 12px; color: rgba(148,163,184,.95); }
      #hha-water .zone b{ color: rgba(229,231,235,.95); font-weight: 950; }
      #hha-water .bar{
        margin-top: 8px;
        height: 12px;
        border-radius: 999px;
        overflow: hidden;
        border: 1px solid rgba(148,163,184,.16);
        background: rgba(15,23,42,.45);
      }
      #hha-water .fill{
        height: 100%;
        width: calc(var(--hha-water-pct) * 1%);
        border-radius: 999px;
        transition: width .12s linear, filter .12s linear;
        background: linear-gradient(90deg,
          rgba(34,197,94,.95),
          rgba(34,211,238,.95)
        );
        filter: saturate(1.02);
      }
      #hha-water .pct{
        margin-top: 6px;
        font-weight: 950;
        font-size: 13px;
        text-align: right;
        color: rgba(229,231,235,.95);
      }

      /* zone tint */
      :root[data-water-zone="LOW"]  #hha-water{ box-shadow: 0 18px 70px rgba(0,0,0,.42), 0 0 16px rgba(245,158,11,.10); }
      :root[data-water-zone="HIGH"] #hha-water{ box-shadow: 0 18px 70px rgba(0,0,0,.42), 0 0 16px rgba(167,139,250,.12); }
      :root[data-water-zone="GREEN"]#hha-water{ box-shadow: 0 18px 70px rgba(0,0,0,.42), 0 0 16px rgba(34,197,94,.10); }
    `;
    DOC.head.appendChild(st);
  }

  function ensureWaterGauge(){
    ensureStyles();

    // If run page already has built-in panel, we don't create overlay
    if (hasBuiltInPanel()) return;

    if (DOC.getElementById('hha-water')) return;
    const box = DOC.createElement('div');
    box.id = 'hha-water';
    box.innerHTML = `
      <div class="row">
        <div class="title">Water</div>
        <div class="zone">Zone: <b id="hha-water-zone">GREEN</b></div>
      </div>
      <div class="bar"><div class="fill" id="hha-water-fill"></div></div>
      <div class="pct"><span id="hha-water-pct">50</span>%</div>
    `;
    DOC.body.appendChild(box);
  }

  function setWaterGauge(pct){
    const p = clamp(pct, 0, 100);
    const zone = zoneFrom(p);

    // drive CSS vars (overlay uses this)
    try{
      DOC.documentElement.style.setProperty('--hha-water-pct', String(p.toFixed(0)));
      DOC.documentElement.dataset.waterZone = zone;
    }catch(_){}

    // built-in panel (hydration-vr.html)
    const bar = DOC.getElementById('water-bar');
    const elPct = DOC.getElementById('water-pct');
    const elZone = DOC.getElementById('water-zone');
    if (bar) bar.style.width = p.toFixed(0) + '%';
    if (elPct) elPct.textContent = String(p|0);
    if (elZone) elZone.textContent = zone;

    // optional overlay
    const oz = DOC.getElementById('hha-water-zone');
    const op = DOC.getElementById('hha-water-pct');
    const of = DOC.getElementById('hha-water-fill');
    if (oz) oz.textContent = zone;
    if (op) op.textContent = String(p|0);
    if (of) of.style.width = p.toFixed(0) + '%';
  }

  // export
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.zoneFrom = zoneFrom;

  // also support ES module style import via named exports pattern used in your engine
  // (hydration.safe.js imports from '../vr/ui-water.js' as module; on GitHub Pages it’s fine if served as module)
  // If you keep this file as classic script, keep the window exports above.
  try{
    // no-op: for compatibility when loaded as <script src=...>
  }catch(_){}

})();