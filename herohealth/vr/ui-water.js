// === /herohealth/vr/ui-water.js ===
// Water Gauge Utilities — PRODUCTION (No-duplicate + Adaptive Position)
// ✅ Exports: ensureWaterGauge, setWaterGauge, zoneFrom
// ✅ Avoid duplicate gauge if page already has its own (#water-panel / #water-bar / #water-pct)
// ✅ Auto-position by view: PC=BL, Mobile=BR, cVR/Cardboard=TL (safe-area aware)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

// ---------- View helpers ----------
function getView(){
  try{
    const body = DOC?.body;
    if (!body) return 'pc';
    if (body.classList.contains('view-cvr')) return 'cvr';
    if (body.classList.contains('cardboard')) return 'cardboard';
    if (body.classList.contains('view-mobile')) return 'mobile';
    if (body.classList.contains('view-pc')) return 'pc';
    const v = new URL(location.href).searchParams.get('view');
    return (v||'pc').toLowerCase();
  }catch(_){ return 'pc'; }
}

function setPosStyle(el, view){
  const sat = 'env(safe-area-inset-top, 0px)';
  const sar = 'env(safe-area-inset-right, 0px)';
  const sab = 'env(safe-area-inset-bottom, 0px)';
  const sal = 'env(safe-area-inset-left, 0px)';

  el.style.top = '';
  el.style.right = '';
  el.style.bottom = '';
  el.style.left = '';

  const pad = 12;
  const topPad = 12;
  const bottomPad = 12;

  if (view === 'mobile'){
    el.style.right  = `calc(${pad}px + ${sar})`;
    el.style.bottom = `calc(${bottomPad}px + ${sab})`;
  } else if (view === 'cvr' || view === 'cardboard'){
    el.style.left = `calc(${pad}px + ${sal})`;
    el.style.top  = `calc(${topPad}px + ${sat})`;
  } else {
    el.style.left   = `calc(${pad}px + ${sal})`;
    el.style.bottom = `calc(${bottomPad}px + ${sab})`;
  }
  el.style.transform = 'none';
}

// ---------- Zone (ทำให้ GREEN กว้างขึ้น => คุมง่ายขึ้น) ----------
export function zoneFrom(pct){
  const p = clamp(pct,0,100);
  // เดิม 45–65 → ปรับเป็น 40–70 เพื่อให้ "คุม GREEN" ง่ายขึ้น
  if (p >= 40 && p <= 70) return 'GREEN';
  if (p < 40) return 'LOW';
  return 'HIGH';
}

// ---------- Mount ----------
function pageHasNativeGauge(){
  if (!DOC) return false;
  // ถ้า hydration-vr.html มี panel ของตัวเองอยู่แล้ว → อย่าสร้างซ้ำ
  return !!(
    DOC.getElementById('water-panel') ||
    DOC.getElementById('water-bar') ||
    DOC.getElementById('water-pct') ||
    DOC.getElementById('water-zone')
  );
}

export function ensureWaterGauge(){
  if (!DOC) return;

  // ✅ กันซ้ำ: ถ้ามี native gauge ในหน้าอยู่แล้ว ไม่สร้าง overlay อีก
  if (pageHasNativeGauge()) return;

  const existing = DOC.getElementById('hha-water-gauge');
  if (existing){
    try{ setPosStyle(existing, getView()); }catch(_){}
    return;
  }

  const wrap = DOC.createElement('div');
  wrap.id = 'hha-water-gauge';
  wrap.style.cssText = [
    'position:fixed',
    'z-index:60',
    'pointer-events:none',
    'width:220px',
    'padding:10px 12px',
    'border-radius:16px',
    'border:1px solid rgba(148,163,184,.18)',
    'background:rgba(2,6,23,.55)',
    'backdrop-filter:blur(10px)',
    'box-shadow:0 18px 70px rgba(0,0,0,.35)',
    'color:#e5e7eb',
    'font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial'
  ].join(';');

  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
      <div style="font-weight:900;font-size:13px;letter-spacing:.2px">Water</div>
      <div style="font-weight:900;font-size:18px">
        <span id="hha-water-pct">50</span><span style="opacity:.8;font-size:12px">%</span>
      </div>
    </div>
    <div style="margin-top:8px;height:10px;border-radius:999px;overflow:hidden;border:1px solid rgba(148,163,184,.14);background:rgba(148,163,184,.16)">
      <div id="hha-water-bar" style="height:100%;width:50%;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95))"></div>
    </div>
    <div style="margin-top:6px;font-size:12px;color:rgba(148,163,184,.95)">
      Zone: <b id="hha-water-zone" style="color:#e5e7eb">GREEN</b>
    </div>
  `;

  setPosStyle(wrap, getView());
  DOC.body.appendChild(wrap);

  const onReflow = ()=>{ try{ setPosStyle(wrap, getView()); }catch(_){ } };
  try{
    window.addEventListener('resize', onReflow, { passive:true });
    window.addEventListener('orientationchange', onReflow, { passive:true });
    setTimeout(onReflow, 250);
    setTimeout(onReflow, 900);
  }catch(_){}
}

export function setWaterGauge(pct){
  if (!DOC) return;

  // ถ้ามี native gauge ให้ปล่อย hydration.safe.js ไปจัดการเอง (ไม่ชนกัน)
  if (pageHasNativeGauge()) return;

  const p = clamp(pct,0,100);
  const bar = DOC.getElementById('hha-water-bar');
  const t = DOC.getElementById('hha-water-pct');
  const z = DOC.getElementById('hha-water-zone');

  if (bar) bar.style.width = p.toFixed(0) + '%';
  if (t) t.textContent = String(p|0);

  const zone = zoneFrom(p);
  if (z) z.textContent = zone;

  try{
    const wrap = DOC.getElementById('hha-water-gauge');
    if (wrap) setPosStyle(wrap, getView());
  }catch(_){}
}