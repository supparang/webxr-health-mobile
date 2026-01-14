// === /herohealth/vr/ui-water.js ===
// Water Gauge UI — PRODUCTION (small + safe) — LATEST
// ✅ ensureWaterGauge(): สร้าง widget ถ้ายังไม่มี
// ✅ setWaterGauge(pct): อัปเดตค่า 0..100 + สีตาม zone
// ✅ zoneFrom(pct): GREEN / LOW / HIGH (kids-friendly via ?kids=1)
//
// Notes:
// - ออกแบบให้ "ไม่ชน" HUD ที่คุณทำเอง (คุณมี panel Water อยู่แล้ว)
// - ตัวนี้เป็น gauge เล็กมุมล่างซ้าย (z-index ต่ำกว่า HUD)
// - ปิดได้: ใส่ ?water=0 หรือ window.HHA_WATER_UI=false
// - Kids-friendly: ใส่ ?kids=1 -> GREEN กว้างขึ้น คุมง่ายขึ้น

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function isKids(){
    const k = String(qs('kids','0')).toLowerCase();
    return (k==='1' || k==='true' || k==='yes');
  }

  function zoneFrom(pct){
    pct = clamp(pct,0,100);

    // kids mode -> GREEN กว้างขึ้น คุมง่ายขึ้น
    const lowTh  = isKids() ? 35 : 40;
    const highTh = isKids() ? 75 : 70;

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
        z-index: 35; /* ต่ำกว่า HUD (คุณใช้ ~50-60) */
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
      }
      .hha-water-ui.low .fill{
        background: linear-gradient(90deg, rgba(34,211,238,.95), rgba(59,130,246,.95));
      }
      .hha-water-ui.high .fill{
        background: linear-gradient(90deg, rgba(245,158,11,.95), rgba(239,68,68,.95));
      }
      .hha-water-ui .kidtag{
        font-size: 11px;
        font-weight: 900;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid rgba(34,197,94,.22);
        background: rgba(34,197,94,.12);
        color: rgba(34,197,94,.95);
      }
    `;
    DOC.head.appendChild(st);
  }

  function ensureWaterGauge(){
    // allow disable by query or global flag
    const q = String(qs('water','1')).toLowerCase();
    if (q === '0' || q === 'false' || WIN.HHA_WATER_UI === false) return null;

    injectStyle();

    let root = DOC.getElementById(ROOT_ID);
    if (root) return root;

    root = DOC.createElement('div');
    root.id = ROOT_ID;
    root.className = 'hha-water-ui';

    const kid = isKids();
    root.innerHTML = `
      <div class="row">
        <div class="title">Water Gauge</div>
        ${kid ? `<div class="kidtag">KIDS</div>` : ``}
      </div>
      <div class="row">
        <div class="zone">Zone: <b id="hhaWaterZone">GREEN</b></div>
        <div class="pct"><span id="hhaWaterPct">50</span>%</div>
      </div>
      <div class="bar"><div class="fill" id="hhaWaterFill"></div></div>
    `;

    DOC.body.appendChild(root);
    return root;
  }

  function setWaterGauge(pct){
    pct = clamp(pct,0,100);

    const root = DOC.getElementById(ROOT_ID) || ensureWaterGauge();
    if (!root) return;

    const z = zoneFrom(pct);

    const pctEl = DOC.getElementById('hhaWaterPct');
    const zEl   = DOC.getElementById('hhaWaterZone');
    const fill  = DOC.getElementById('hhaWaterFill');

    if (pctEl) pctEl.textContent = String(pct|0);
    if (zEl) zEl.textContent = z;
    if (fill) fill.style.width = pct.toFixed(0) + '%';

    root.classList.remove('low','high','green');
    if (z === 'LOW') root.classList.add('low');
    else if (z === 'HIGH') root.classList.add('high');
    else root.classList.add('green');
  }

  // Attach to window for non-module usage
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.zoneFrom = zoneFrom;

  // Optional ESM export (safe no-op in classic script)
  // NOTE: This try/catch prevents SyntaxError in classic contexts.
  try{
    // eslint-disable-next-line no-undef
    export { ensureWaterGauge, setWaterGauge, zoneFrom };
  }catch(_){}
})();