// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge UI — PRODUCTION (ESM clean)
// ✅ zoneFrom(pct): GREEN / LOW / HIGH
// ✅ ensureWaterGauge(): mount gauge only if page has no built-in water panel
// ✅ setWaterGauge(pct): update built-in (#water-*) first, else update mounted gauge
// ✅ Safe: never throws
// ✅ Optional: attaches window.HHA_UI_WATER for debugging

'use strict';

const DOC = (typeof document !== 'undefined') ? document : null;
const WIN = (typeof window !== 'undefined') ? window : null;

const clamp=(v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

// --- Zone rules (ปรับได้) ---
export function zoneFrom(pct){
  pct = clamp(pct, 0, 100);
  if (pct >= 40 && pct <= 70) return 'GREEN';
  if (pct < 40) return 'LOW';
  return 'HIGH';
}

function hasBuiltInPanel(){
  if (!DOC) return false;
  return !!(DOC.getElementById('water-bar') || DOC.getElementById('water-pct') || DOC.getElementById('water-zone'));
}

function ensureStyles(){
  if (!DOC || DOC.getElementById('hha-water-style')) return;

  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
/* === HHA Water Gauge (fallback) === */
#hha-water-gauge{
  position:fixed;
  left: calc(12px + env(safe-area-inset-left, 0px));
  bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  z-index: 60;
  pointer-events:none;
  font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
  color: rgba(229,231,235,.92);
  filter: drop-shadow(0 14px 34px rgba(0,0,0,.45));
}
#hha-water-gauge .card{
  width: min(320px, calc(100vw - 24px));
  border-radius: 18px;
  border: 1px solid rgba(148,163,184,.16);
  background: rgba(2,6,23,.62);
  backdrop-filter: blur(10px);
  padding: 10px 12px;
}
#hha-water-gauge .row{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
#hha-water-gauge .title{ font-weight:900; letter-spacing:.2px; font-size:12px; opacity:.95; }
#hha-water-gauge .pct{ font-weight:900; font-size:14px; }
#hha-water-gauge .zone{
  margin-left:8px;
  font-weight:900;
  font-size:12px;
  padding:4px 10px;
  border-radius:999px;
  border:1px solid rgba(148,163,184,.14);
  background: rgba(15,23,42,.55);
}
#hha-water-gauge .barWrap{
  margin-top:8px;
  height:10px;
  border-radius:999px;
  background: rgba(148,163,184,.18);
  border:1px solid rgba(148,163,184,.12);
  overflow:hidden;
}
#hha-water-gauge .bar{
  width:50%;
  height:100%;
  border-radius:999px;
  background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
}
#hha-water-gauge .hint{
  margin-top:8px;
  font-size:11px;
  line-height:1.25;
  opacity:.88;
  white-space: pre-line;
}
#hha-water-gauge.low  .zone{ border-color: rgba(245,158,11,.22); background: rgba(245,158,11,.10); }
#hha-water-gauge.high .zone{ border-color: rgba(239,68,68,.22);  background: rgba(239,68,68,.10); }
#hha-water-gauge.green .zone{ border-color: rgba(34,197,94,.22);  background: rgba(34,197,94,.10); }

body.view-mobile #hha-water-gauge .card{ width:min(290px, calc(100vw - 24px)); }
body.cardboard  #hha-water-gauge{ left:50%; transform:translateX(-50%); }
`;
  DOC.head.appendChild(st);
}

export function ensureWaterGauge(){
  try{
    if (!DOC) return;
    // ถ้ามี water panel ใน HUD ของเกมอยู่แล้ว → ไม่ต้อง mount gauge ซ้ำ
    if (hasBuiltInPanel()) return;

    ensureStyles();
    if (DOC.getElementById('hha-water-gauge')) return;

    const wrap = DOC.createElement('div');
    wrap.id = 'hha-water-gauge';
    wrap.className = 'green';
    wrap.innerHTML = `
      <div class="card" role="status" aria-label="Water gauge">
        <div class="row">
          <div class="title">💧 Water</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="pct"><span id="hha-water-pct">50</span>%</div>
            <div class="zone" id="hha-water-zone">GREEN</div>
          </div>
        </div>
        <div class="barWrap" aria-hidden="true"><div class="bar" id="hha-water-bar"></div></div>
        <div class="hint" id="hha-water-hint">Zone GREEN = สมดุลดี\nLOW/HIGH = ทำ Storm Mini ได้ แต่ระวังโดน BAD</div>
      </div>
    `;
    DOC.body.appendChild(wrap);
  }catch(_){}
}

export function setWaterGauge(pct){
  try{
    if (!DOC) return;
    pct = clamp(pct, 0, 100);
    const z = zoneFrom(pct);

    // 1) update built-in hydration HUD panel (ถ้ามี)
    const bar2 = DOC.getElementById('water-bar');
    const pct2 = DOC.getElementById('water-pct');
    const zone2 = DOC.getElementById('water-zone');
    if (bar2) bar2.style.width = `${pct.toFixed(0)}%`;
    if (pct2) pct2.textContent = String(pct|0);
    if (zone2) zone2.textContent = z;

    // 2) update fallback gauge (ถ้ามี)
    const root = DOC.getElementById('hha-water-gauge');
    const pctEl = DOC.getElementById('hha-water-pct');
    const zoneEl = DOC.getElementById('hha-water-zone');
    const barEl = DOC.getElementById('hha-water-bar');

    if (pctEl) pctEl.textContent = String(pct|0);
    if (zoneEl) zoneEl.textContent = z;
    if (barEl) barEl.style.width = `${pct.toFixed(0)}%`;

    if (root){
      root.classList.remove('low','high','green');
      root.classList.add(z === 'LOW' ? 'low' : z === 'HIGH' ? 'high' : 'green');
    }
  }catch(_){}
}

// optional: window hook for debugging
try{
  if (WIN) WIN.HHA_UI_WATER = { ensureWaterGauge, setWaterGauge, zoneFrom };
}catch(_){}
