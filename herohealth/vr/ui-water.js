// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge Helper — PRODUCTION (Module + Window bridge)
// ✅ Exports: ensureWaterGauge(), setWaterGauge(pct), zoneFrom(pct)
// ✅ Smooth UI lerp (เด็ก ป.5 รู้สึกลื่น ไม่กระตุก)
// ✅ Updates BOTH:
//    - "generic gauge" (auto-created #hhaWaterGauge)  AND
//    - Hydration panel ids (#water-bar, #water-pct, #water-zone) if present
// ✅ Optional hysteresis zone to avoid flicker around threshold
// ------------------------------------------------------------

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

const clamp = (v, a, b) => {
  v = Number(v);
  if (!Number.isFinite(v)) v = 0;
  return v < a ? a : (v > b ? b : v);
};

// --- Zone thresholds (simple + kid-friendly) ---
const Z = {
  LOW_MAX: 35,     // <=35 => LOW
  HIGH_MIN: 75     // >=75 => HIGH
};

// Hysteresis to prevent flicker near boundary
// Example: if already LOW, don't go GREEN until > 40
const H = {
  LOW_EXIT: 40,
  HIGH_EXIT: 70
};

let _lastZone = 'GREEN';

export function zoneFrom(pct){
  const p = clamp(pct, 0, 100);

  // hysteresis based on last zone
  if (_lastZone === 'LOW'){
    if (p <= H.LOW_EXIT) return (_lastZone = 'LOW');
  }
  if (_lastZone === 'HIGH'){
    if (p >= H.HIGH_EXIT) return (_lastZone = 'HIGH');
  }

  if (p <= Z.LOW_MAX) return (_lastZone = 'LOW');
  if (p >= Z.HIGH_MIN) return (_lastZone = 'HIGH');
  return (_lastZone = 'GREEN');
}

// -------------------- Auto Gauge (optional) --------------------
function hasHydrationPanel(){
  return !!(DOC && (DOC.getElementById('water-bar') || DOC.getElementById('water-pct') || DOC.getElementById('water-zone')));
}

function injectGaugeStyleOnce(){
  if (!DOC || DOC.getElementById('hha-water-style')) return;

  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
    #hhaWaterGauge{
      position:fixed;
      right: calc(12px + env(safe-area-inset-right,0px));
      bottom: calc(12px + env(safe-area-inset-bottom,0px));
      z-index: 90;
      pointer-events:none;
      width: 140px;
      border-radius: 16px;
      border:1px solid rgba(148,163,184,.16);
      background: rgba(2,6,23,.55);
      backdrop-filter: blur(10px);
      box-shadow: 0 16px 60px rgba(0,0,0,.35);
      padding: 10px;
      display:none; /* show only if hydration panel NOT present */
    }
    #hhaWaterGauge.show{ display:block; }
    #hhaWGHead{
      display:flex; justify-content:space-between; align-items:baseline;
      gap:8px;
      font-size:12px;
      color: rgba(229,231,235,.92);
      margin-bottom:6px;
    }
    #hhaWGHead b{ font-weight:950; }
    #hhaWGBar{
      height: 10px;
      border-radius: 999px;
      overflow:hidden;
      border:1px solid rgba(148,163,184,.10);
      background: rgba(148,163,184,.18);
    }
    #hhaWGFill{
      height:100%;
      width:50%;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
      will-change: width;
    }
    #hhaWGMeta{
      margin-top:6px;
      display:flex;
      justify-content:space-between;
      font-size:12px;
      color: rgba(148,163,184,.95);
    }
    #hhaWGZone.low b{ color: rgba(239,68,68,.95); }
    #hhaWGZone.green b{ color: rgba(34,197,94,.95); }
    #hhaWGZone.high b{ color: rgba(34,211,238,.95); }
  `;
  DOC.head.appendChild(st);
}

function createGaugeIfMissing(){
  if (!DOC) return null;
  let el = DOC.getElementById('hhaWaterGauge');
  if (el) return el;

  injectGaugeStyleOnce();

  el = DOC.createElement('div');
  el.id = 'hhaWaterGauge';

  el.innerHTML = `
    <div id="hhaWGHead">
      <span>Water</span>
      <span id="hhaWGZone" class="green"><b>GREEN</b></span>
    </div>
    <div id="hhaWGBar"><div id="hhaWGFill"></div></div>
    <div id="hhaWGMeta">
      <span>pct</span>
      <span id="hhaWGPct"><b>50</b>%</span>
    </div>
  `;
  DOC.body.appendChild(el);

  return el;
}

export function ensureWaterGauge(){
  if (!DOC) return;

  // ถ้ามี panel ในเกมอยู่แล้ว ไม่ต้องโชว์ gauge ลอย
  if (hasHydrationPanel()) return;

  const g = createGaugeIfMissing();
  if (g) g.classList.add('show');
}

// -------------------- Smooth Set (lerp) --------------------
let _uiPct = 50;
let _targetPct = 50;
let _raf = 0;

function setHydrationPanel(pct){
  const p = clamp(pct, 0, 100);
  const bar = DOC.getElementById('water-bar');
  const pctEl = DOC.getElementById('water-pct');
  const zoneEl = DOC.getElementById('water-zone');

  if (bar) bar.style.width = p.toFixed(0) + '%';
  if (pctEl) pctEl.textContent = String(p | 0);
  if (zoneEl) zoneEl.textContent = zoneFrom(p);
}

function setFloatingGauge(pct){
  const g = DOC.getElementById('hhaWaterGauge');
  if (!g) return;

  const p = clamp(pct, 0, 100);
  const fill = DOC.getElementById('hhaWGFill');
  const pctEl = DOC.getElementById('hhaWGPct');
  const zoneWrap = DOC.getElementById('hhaWGZone');

  const z = zoneFrom(p);
  if (fill) fill.style.width = p.toFixed(0) + '%';
  if (pctEl) pctEl.innerHTML = `<b>${(p|0)}</b>%`;

  if (zoneWrap){
    zoneWrap.classList.remove('low','green','high');
    zoneWrap.classList.add(z.toLowerCase());
    zoneWrap.innerHTML = `<b>${z}</b>`;
  }
}

function tickSmooth(){
  _raf = 0;

  // lerp แบบ “นิ่ม” สำหรับเด็ก ป.5 (ไม่เด้ง)
  const p = _uiPct;
  const t = _targetPct;

  // ถ้าห่างมาก ให้ไล่เร็วขึ้นนิด (ไม่ให้รู้สึกว่าไม่ขยับ)
  const dist = Math.abs(t - p);
  const alpha = dist > 12 ? 0.22 : (dist > 5 ? 0.16 : 0.12);

  _uiPct = p + (t - p) * alpha;

  setHydrationPanel(_uiPct);
  setFloatingGauge(_uiPct);

  if (Math.abs(_targetPct - _uiPct) > 0.35){
    _raf = WIN.requestAnimationFrame(tickSmooth);
  } else {
    _uiPct = _targetPct;
    setHydrationPanel(_uiPct);
    setFloatingGauge(_uiPct);
  }
}

export function setWaterGauge(pct){
  if (!DOC) return;

  // ensure gauge (only if no hydration panel)
  ensureWaterGauge();

  _targetPct = clamp(pct, 0, 100);

  // เรียกครั้งแรกให้ “เห็นทันที” ก่อน แล้วค่อย smooth ต่อ
  if (!_raf){
    setHydrationPanel(_targetPct);
    setFloatingGauge(_targetPct);
    _uiPct = _targetPct; // initial snap to avoid "ไม่ขยับเลย"
  }

  // แล้วค่อย lerp ถ้ามีการเปลี่ยนถี่
  if (_raf) return;
  _raf = WIN.requestAnimationFrame(tickSmooth);
}

// -------------------- Window bridge (optional) --------------------
// เพื่อให้ไฟล์อื่นที่ไม่ใช้ import เรียกได้
try{
  WIN.HHA_WATER = WIN.HHA_WATER || {};
  WIN.HHA_WATER.ensureWaterGauge = ensureWaterGauge;
  WIN.HHA_WATER.setWaterGauge = setWaterGauge;
  WIN.HHA_WATER.zoneFrom = zoneFrom;
}catch(_){}