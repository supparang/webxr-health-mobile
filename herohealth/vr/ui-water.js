// === /herohealth/vr/ui-water.js ===
// HHA Water UI — PRODUCTION (shared module)
// ✅ ensureWaterGauge({ mount?, position?, zIndex? })
// ✅ setWaterGauge(pct, { silent? })
// ✅ zoneFrom(pct) -> 'LOW' | 'GREEN' | 'HIGH'
// ✅ Non-invasive: won't break custom HUD; can be hidden if not used
// ✅ Safe-area aware + avoid VR-UI buttons area (top-left)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

export function zoneFrom(pct){
  const p = clamp(pct, 0, 100);
  // ปรับ threshold ได้ทีหลัง แต่ตอนนี้เน้น "คุม GREEN"
  if (p < 45) return 'LOW';
  if (p > 65) return 'HIGH';
  return 'GREEN';
}

function ensureStyle(){
  if (!DOC || DOC.getElementById('hha-water-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
    .hha-water{
      position: fixed;
      left: calc(12px + env(safe-area-inset-left, 0px));
      top:  calc(12px + env(safe-area-inset-top, 0px) + 54px); /* เว้นปุ่ม VR-UI ด้านบน */
      z-index: 88; /* ต่ำกว่า vr-ui(โดยมาก 90-100) แต่สูงกว่า playfield */
      width: min(280px, calc(100vw - 24px));
      pointer-events: none;
      user-select: none;
    }
    body.view-cvr .hha-water{ top: calc(12px + env(safe-area-inset-top,0px) + 54px); }
    body.cardboard .hha-water{ top: calc(12px + env(safe-area-inset-top,0px) + 54px); }

    .hha-water .card{
      background: rgba(2,6,23,.62);
      border: 1px solid rgba(148,163,184,.18);
      border-radius: 18px;
      padding: 10px 12px;
      backdrop-filter: blur(10px);
      box-shadow: 0 18px 70px rgba(0,0,0,.40);
    }
    .hha-water .row{
      display:flex; justify-content:space-between; align-items:baseline;
      gap:10px;
    }
    .hha-water .title{
      font-weight: 900;
      letter-spacing: .2px;
      font-size: 13px;
      color: rgba(229,231,235,.95);
      display:flex; align-items:center; gap:8px;
    }
    .hha-water .meta{
      font-weight: 900;
      font-size: 13px;
      color: rgba(229,231,235,.95);
    }
    .hha-water .meta .pct{
      font-size: 18px;
      margin-right: 4px;
    }
    .hha-water .zone{
      margin-top: 6px;
      font-size: 12px;
      color: rgba(148,163,184,.95);
    }
    .hha-water .bar{
      margin-top: 9px;
      height: 10px;
      border-radius: 999px;
      background: rgba(148,163,184,.18);
      overflow: hidden;
      border: 1px solid rgba(148,163,184,.12);
    }
    .hha-water .fill{
      height: 100%;
      width: 50%;
      background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
      transition: width 120ms linear;
    }
    .hha-water .hint{
      margin-top: 8px;
      font-size: 11px;
      line-height: 1.25;
      color: rgba(229,231,235,.85);
      white-space: pre-line;
    }

    /* zone tint */
    .hha-water[data-zone="LOW"]  .fill{ background: linear-gradient(90deg, rgba(34,211,238,.95), rgba(59,130,246,.95)); }
    .hha-water[data-zone="HIGH"] .fill{ background: linear-gradient(90deg, rgba(245,158,11,.95), rgba(239,68,68,.95)); }
    .hha-water[data-zone="GREEN"] .fill{ background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95)); }
  `;
  DOC.head.appendChild(st);
}

function ensureNode(opts={}){
  if (!DOC) return null;
  ensureStyle();

  let wrap = DOC.querySelector('.hha-water');
  if (wrap) return wrap;

  wrap = DOC.createElement('div');
  wrap.className = 'hha-water';
  wrap.setAttribute('data-zone', 'GREEN');
  wrap.innerHTML = `
    <div class="card">
      <div class="row">
        <div class="title"><span aria-hidden="true">💧</span><span>Water</span></div>
        <div class="meta"><span class="pct" id="hhaWaterPct">50</span><span>%</span></div>
      </div>
      <div class="zone">Zone <b id="hhaWaterZone">GREEN</b></div>
      <div class="bar"><div class="fill" id="hhaWaterFill"></div></div>
      <div class="hint" id="hhaWaterHint">คุมให้อยู่ GREEN ให้ได้นาน ๆ</div>
    </div>
  `;

  // mount
  const mount = opts.mount && typeof opts.mount === 'string'
    ? DOC.querySelector(opts.mount)
    : (opts.mount instanceof Element ? opts.mount : DOC.body);

  (mount || DOC.body).appendChild(wrap);

  // optional position override
  if (opts.position === 'top-right'){
    wrap.style.left = 'auto';
    wrap.style.right = 'calc(12px + env(safe-area-inset-right, 0px))';
  }
  if (Number.isFinite(opts.zIndex)) wrap.style.zIndex = String(opts.zIndex|0);

  return wrap;
}

// Public: create if not exists
export function ensureWaterGauge(opts={}){
  return ensureNode(opts);
}

// Public: update percentage + derived zone + hint optional
export function setWaterGauge(pct, opts={}){
  if (!DOC) return;
  const wrap = ensureNode(opts);
  if (!wrap) return;

  const p = clamp(pct, 0, 100);
  const z = zoneFrom(p);

  const elPct  = DOC.getElementById('hhaWaterPct');
  const elZone = DOC.getElementById('hhaWaterZone');
  const elFill = DOC.getElementById('hhaWaterFill');

  if (elPct) elPct.textContent = String(p|0);
  if (elZone) elZone.textContent = z;
  if (elFill) elFill.style.width = `${p.toFixed(0)}%`;

  wrap.setAttribute('data-zone', z);

  if (opts.hint){
    const elHint = DOC.getElementById('hhaWaterHint');
    if (elHint) elHint.textContent = String(opts.hint);
  }

  if (!opts.silent){
    // hook เผื่อเกมอื่นอยากฟัง event
    try{
      ROOT.dispatchEvent(new CustomEvent('hha:water', { detail:{ pct:p, zone:z } }));
    }catch(_){}
  }
}