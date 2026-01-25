// === /herohealth/vr/ui-water.js ===
// Water Gauge helpers (SAFE)
// Exports: ensureWaterGauge(), setWaterGauge(pct), zoneFrom(pct)

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

export function zoneFrom(pct){
  const p = clamp(pct, 0, 100);
  // ปรับ threshold ให้คุมได้ “สมเหตุผล” สำหรับเด็ก (ไม่แคบเกิน)
  // GREEN = สมดุล, LOW/HIGH = หลุดสมดุล
  if (p >= 40 && p <= 70) return 'GREEN';
  if (p < 40) return 'LOW';
  return 'HIGH';
}

function ensureStyleOnce(){
  if (DOC.getElementById('hha-water-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
  .hha-water-float{
    position:fixed;
    right: calc(12px + env(safe-area-inset-right, 0px));
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    z-index:60;
    pointer-events:none;
    width:min(260px, 52vw);
    border-radius:18px;
    border:1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.72);
    backdrop-filter: blur(10px);
    box-shadow: 0 18px 70px rgba(0,0,0,.40);
    padding:12px;
    display:none;
  }
  body.show-water-float .hha-water-float{ display:block; }
  .hha-water-float .row{
    display:flex; justify-content:space-between; align-items:flex-start; gap:10px;
  }
  .hha-water-float .t{ font-weight:900; font-size:13px; }
  .hha-water-float .z{ color:rgba(148,163,184,.95); font-size:12px; margin-top:4px; }
  .hha-water-float .pct{ font-weight:900; font-size:20px; text-align:right; }
  .hha-water-float .bar{
    margin-top:10px;
    height:10px;
    border-radius:999px;
    background:rgba(148,163,184,.18);
    overflow:hidden;
    border:1px solid rgba(148,163,184,.12);
  }
  .hha-water-float .fill{
    height:100%;
    width:50%;
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
  }`;
  DOC.head.appendChild(st);
}

function ensureFloatGauge(){
  if (DOC.getElementById('hhaWaterFloat')) return;
  ensureStyleOnce();
  const box = DOC.createElement('div');
  box.id = 'hhaWaterFloat';
  box.className = 'hha-water-float';
  box.innerHTML = `
    <div class="row">
      <div>
        <div class="t">Water</div>
        <div class="z">Zone <b id="hhaWaterZone">GREEN</b></div>
      </div>
      <div class="pct"><span id="hhaWaterPct">50</span>%</div>
    </div>
    <div class="bar"><div class="fill" id="hhaWaterBar"></div></div>
  `;
  DOC.body.appendChild(box);
}

export function ensureWaterGauge(){
  // ถ้าในหน้าเกมมี water panel อยู่แล้ว (water-bar/water-pct/water-zone) ก็ไม่ต้องสร้าง float
  const hasInline =
    DOC.getElementById('water-bar') &&
    DOC.getElementById('water-pct') &&
    DOC.getElementById('water-zone');

  if (!hasInline){
    ensureFloatGauge();
    // เปิดให้เห็นได้ด้วย body.show-water-float (ถ้าอยากใช้)
    // DOC.body.classList.add('show-water-float');
  }
}

export function setWaterGauge(pct){
  const p = clamp(pct, 0, 100);
  const zone = zoneFrom(p);

  // 1) Inline panel (ของ hydration-vr.html)
  const bar = DOC.getElementById('water-bar');
  const pctEl = DOC.getElementById('water-pct');
  const zoneEl = DOC.getElementById('water-zone');
  if (bar) bar.style.width = `${p.toFixed(0)}%`;
  if (pctEl) pctEl.textContent = String(p | 0);
  if (zoneEl) zoneEl.textContent = zone;

  // 2) Float gauge (fallback)
  const fBar = DOC.getElementById('hhaWaterBar');
  const fPct = DOC.getElementById('hhaWaterPct');
  const fZone = DOC.getElementById('hhaWaterZone');
  if (fBar) fBar.style.width = `${p.toFixed(0)}%`;
  if (fPct) fPct.textContent = String(p | 0);
  if (fZone) fZone.textContent = zone;
}