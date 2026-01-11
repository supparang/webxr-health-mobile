// === /herohealth/vr/ui-water.js ===
// Universal Water UI — PRODUCTION
// ✅ ensureWaterGauge(): สร้างแถบ Water Gauge แบบ fixed (ไม่บังคับให้ใช้ ถ้าเกมมี panel เองก็ได้)
// ✅ setWaterGauge(pct): อัปเดต % + สี/โซน
// ✅ zoneFrom(pct): GREEN | LOW | HIGH (simple & stable)
// ✅ Does NOT depend on frameworks/modules, safe for ES module import
//
// Notes:
// - Hydration.safe.js ของคุณเรียก ensureWaterGauge(), setWaterGauge(), zoneFrom()
// - ถ้าใน HTML มี panel ของคุณเอง (เช่น #water-bar / #water-zone / #water-pct) ก็ยังใช้ร่วมได้
// - Gauge นี้เป็น "fallback / global overlay" เผื่อเกมไหนยังไม่มี panel

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){
  v = Number(v)||0;
  return v<a?a:(v>b?b:v);
}

export function zoneFrom(pct){
  const p = clamp(pct, 0, 100);
  // ปรับ threshold ให้ “เล่นสนุก” และเข้าใจง่าย:
  // - GREEN: ช่วงสมดุล
  // - LOW/HIGH: ออกนอกสมดุล (เข้าเงื่อนไข Storm mini ของคุณ)
  if (p >= 40 && p <= 70) return 'GREEN';
  if (p < 40) return 'LOW';
  return 'HIGH';
}

function ensureStyle(){
  if (!DOC || DOC.getElementById('hha-water-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
    .hha-water{
      position:fixed;
      right: calc(12px + env(safe-area-inset-right,0px));
      bottom: calc(12px + env(safe-area-inset-bottom,0px));
      z-index: 85;
      width: min(320px, 48vw);
      pointer-events:none;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
    }
    .hha-water .card{
      background: rgba(2,6,23,.70);
      border: 1px solid rgba(148,163,184,.18);
      border-radius: 18px;
      padding: 10px 12px;
      backdrop-filter: blur(10px);
      box-shadow: 0 18px 70px rgba(0,0,0,.40);
    }
    .hha-water .top{
      display:flex;
      justify-content:space-between;
      align-items:flex-end;
      gap:10px;
    }
    .hha-water .title{
      font-weight:900;
      letter-spacing:.2px;
      font-size: 13px;
      color: rgba(229,231,235,.96);
    }
    .hha-water .zone{
      font-size: 12px;
      color: rgba(148,163,184,.95);
      margin-top: 3px;
    }
    .hha-water .pct{
      font-weight: 900;
      font-size: 18px;
      color: rgba(229,231,235,.96);
      text-align:right;
      line-height:1;
    }
    .hha-water .barWrap{
      margin-top:10px;
      height: 10px;
      border-radius: 999px;
      background: rgba(148,163,184,.18);
      overflow:hidden;
      border: 1px solid rgba(148,163,184,.12);
    }
    .hha-water .bar{
      height:100%;
      width:50%;
      transition: width 120ms linear;
      background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
    }

    /* Zone accent */
    .hha-water[data-zone="GREEN"] .bar{
      background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
    }
    .hha-water[data-zone="LOW"] .bar{
      background: linear-gradient(90deg, rgba(56,189,248,.92), rgba(59,130,246,.95));
    }
    .hha-water[data-zone="HIGH"] .bar{
      background: linear-gradient(90deg, rgba(245,158,11,.92), rgba(239,68,68,.95));
    }

    /* Hide in case game already has its own bigger panel (optional toggle) */
    body.hha-hide-global-water .hha-water{ display:none !important; }
  `;
  DOC.head.appendChild(st);
}

function buildGauge(){
  if (!DOC) return null;
  ensureStyle();

  let root = DOC.querySelector('.hha-water');
  if (root) return root;

  root = DOC.createElement('div');
  root.className = 'hha-water';
  root.dataset.zone = 'GREEN';

  root.innerHTML = `
    <div class="card">
      <div class="top">
        <div>
          <div class="title">Water</div>
          <div class="zone">Zone <b class="z">GREEN</b></div>
        </div>
        <div class="pct"><span class="p">50</span>%</div>
      </div>
      <div class="barWrap"><div class="bar"></div></div>
    </div>
  `;

  DOC.body.appendChild(root);
  return root;
}

export function ensureWaterGauge(){
  // สร้างเฉพาะเมื่อมี body แล้ว
  if (!DOC || !DOC.body) return null;
  return buildGauge();
}

export function setWaterGauge(pct){
  if (!DOC || !DOC.body) return;

  const p = clamp(pct, 0, 100);
  const z = zoneFrom(p);

  // Update global gauge (fallback overlay)
  const g = buildGauge();
  if (g){
    g.dataset.zone = z;
    const pEl = g.querySelector('.p');
    const zEl = g.querySelector('.z');
    const bar = g.querySelector('.bar');
    if (pEl) pEl.textContent = String(p|0);
    if (zEl) zEl.textContent = z;
    if (bar) bar.style.width = `${p.toFixed(0)}%`;
  }

  // Also update common IDs if present in the game's HUD panel
  const idPct  = DOC.getElementById('water-pct');
  const idZone = DOC.getElementById('water-zone');
  const idBar  = DOC.getElementById('water-bar');

  if (idPct)  idPct.textContent  = String(p|0);
  if (idZone) idZone.textContent = z;
  if (idBar)  idBar.style.width  = `${p.toFixed(0)}%`;
}