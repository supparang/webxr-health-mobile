// === /herohealth/vr/ui-water.js ===
// HHA Water UI — PRODUCTION (Shared)
// ✅ ensureWaterGauge(): inject minimal DOM gauge if not present
// ✅ setWaterGauge(pct): update gauge + emits hha:water
// ✅ zoneFrom(pct): GREEN / LOW / HIGH (tunable thresholds)
// ✅ Safe for any game (Hydration/Plate/GoodJunk/Groups can reuse)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

// --- thresholds (feel free to tune) ---
// GREEN is the "balanced" zone
// LOW  : too low hydration
// HIGH : too high hydration
const TH = {
  greenMin: 42,
  greenMax: 68
};

export function zoneFrom(pct){
  pct = clamp(pct, 0, 100);
  if (pct < TH.greenMin) return 'LOW';
  if (pct > TH.greenMax) return 'HIGH';
  return 'GREEN';
}

// -------------------- DOM Gauge (optional overlay) --------------------
// NOTE: In your Hydration HTML you already have water panel (#water-bar/#water-zone/#water-pct)
// This module provides a small fixed gauge too (if you want), but it will NOT conflict.
// It only injects if not present and you can disable by setting window.HHA_WATERUI.disable = true

function qs(sel, root=DOC){ try{ return root.querySelector(sel); }catch(_){ return null; } }

function ensureHost(){
  if (!DOC) return null;
  let host = DOC.querySelector('.hha-water-ui');
  if (host) return host;

  const cfg = ROOT.HHA_WATERUI || {};
  if (cfg.disable) return null;

  host = DOC.createElement('div');
  host.className = 'hha-water-ui';
  host.innerHTML = `
    <div class="hha-water-card" role="status" aria-label="Water gauge">
      <div class="hha-water-top">
        <div class="hha-water-title">Water</div>
        <div class="hha-water-zone">GREEN</div>
      </div>
      <div class="hha-water-bar">
        <div class="hha-water-fill"></div>
      </div>
      <div class="hha-water-bottom">
        <div class="hha-water-pct">50%</div>
        <div class="hha-water-hint">คุมให้อยู่ GREEN</div>
      </div>
    </div>
  `;

  DOC.body.appendChild(host);
  injectStyleOnce();
  return host;
}

function injectStyleOnce(){
  if (DOC.getElementById('hha-water-ui-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-water-ui-style';
  st.textContent = `
  .hha-water-ui{
    position:fixed;
    left:12px;
    bottom:12px;
    z-index:60;
    pointer-events:none;
    font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
  }
  .hha-water-card{
    width: 180px;
    border-radius: 16px;
    border: 1px solid rgba(148,163,184,.16);
    background: rgba(2,6,23,.62);
    box-shadow: 0 18px 70px rgba(0,0,0,.40);
    backdrop-filter: blur(10px);
    padding: 10px 10px;
    color: rgba(229,231,235,.92);
  }
  .hha-water-top{
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:10px;
    margin-bottom:8px;
  }
  .hha-water-title{
    font-weight:900;
    font-size:12px;
    letter-spacing:.2px;
    opacity:.92;
  }
  .hha-water-zone{
    font-weight:900;
    font-size:11px;
    padding:4px 8px;
    border-radius:999px;
    border:1px solid rgba(148,163,184,.14);
    background: rgba(15,23,42,.55);
  }
  .hha-water-bar{
    height:10px;
    border-radius:999px;
    overflow:hidden;
    background: rgba(148,163,184,.16);
    border:1px solid rgba(148,163,184,.10);
  }
  .hha-water-fill{
    height:100%;
    width:50%;
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
  }
  .hha-water-bottom{
    margin-top:8px;
    display:flex;
    justify-content:space-between;
    align-items:baseline;
    gap:10px;
    opacity:.92;
  }
  .hha-water-pct{
    font-weight:900;
    font-size:12px;
  }
  .hha-water-hint{
    font-size:11px;
    color: rgba(148,163,184,.95);
  }

  /* zone color hint (subtle) */
  .hha-water-ui.zone-GREEN .hha-water-zone{ border-color: rgba(34,197,94,.22); background: rgba(34,197,94,.10); }
  .hha-water-ui.zone-LOW   .hha-water-zone{ border-color: rgba(245,158,11,.24); background: rgba(245,158,11,.10); }
  .hha-water-ui.zone-HIGH  .hha-water-zone{ border-color: rgba(239,68,68,.24);  background: rgba(239,68,68,.10);  }

  /* safe-area */
  @supports(padding: max(0px)){
    .hha-water-ui{
      left: max(12px, env(safe-area-inset-left, 0px));
      bottom: max(12px, env(safe-area-inset-bottom, 0px));
    }
  }
  `;
  DOC.head.appendChild(st);
}

export function ensureWaterGauge(){
  return ensureHost();
}

export function setWaterGauge(pct){
  pct = clamp(pct, 0, 100);
  const zone = zoneFrom(pct);

  // optional mini-gauge
  const host = ensureHost();
  if (host){
    host.classList.toggle('zone-GREEN', zone === 'GREEN');
    host.classList.toggle('zone-LOW', zone === 'LOW');
    host.classList.toggle('zone-HIGH', zone === 'HIGH');

    const fill = qs('.hha-water-fill', host);
    const zEl  = qs('.hha-water-zone', host);
    const pEl  = qs('.hha-water-pct', host);
    const hEl  = qs('.hha-water-hint', host);

    if (fill) fill.style.width = pct.toFixed(0) + '%';
    if (zEl)  zEl.textContent = zone;
    if (pEl)  pEl.textContent = pct.toFixed(0) + '%';

    if (hEl){
      hEl.textContent =
        zone === 'GREEN' ? 'คุมให้อยู่ GREEN' :
        zone === 'LOW'   ? 'LOW: เพิ่มน้ำด้วย 💧' :
                           'HIGH: ลดด้วย 🥤';
    }
  }

  // notify
  emit('hha:water', { pct, zone });
  return { pct, zone };
}