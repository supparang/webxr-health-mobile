// === /herohealth/vr/ui-water.js ===
// Water Gauge Utilities — PRODUCTION (v2)
// ✅ Exports: ensureWaterGauge, setWaterGauge, zoneFrom
// ✅ Avoid duplicate gauge if page already has its own water panel
// ✅ Easier control: wider GREEN zone
// ✅ Adaptive placement: mobile/cVR/cardboard safe

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

// โซนน้ำ (ทำให้ง่ายขึ้น): GREEN กว้างขึ้น
export function zoneFrom(pct){
  const p = clamp(pct,0,100);
  if (p >= 40 && p <= 70) return 'GREEN'; // เดิม 45-65
  if (p < 40) return 'LOW';
  return 'HIGH';
}

function hasNativeWaterPanel(){
  if (!DOC) return false;
  // ถ้าหน้าเกมมี panel ของตัวเองอยู่แล้ว (เช่น #water-bar/#water-pct/#water-zone)
  // จะไม่สร้าง gauge ซ้ำ
  return !!(
    DOC.getElementById('water-bar') ||
    DOC.getElementById('water-pct') ||
    DOC.getElementById('water-zone') ||
    DOC.querySelector('[data-water-panel]') ||
    DOC.getElementById('hydration-water-panel')
  );
}

function setPlacementStyle(el){
  if (!DOC || !el) return;

  const body = DOC.body;
  const isCVR = body?.classList?.contains('view-cvr');
  const isCardboard = body?.classList?.contains('cardboard');
  const small = (typeof window !== 'undefined') && window.matchMedia && window.matchMedia('(max-width: 520px)').matches;

  // safe-area
  const sat = 'env(safe-area-inset-top, 0px)';
  const sab = 'env(safe-area-inset-bottom, 0px)';
  const sal = 'env(safe-area-inset-left, 0px)';
  const sar = 'env(safe-area-inset-right, 0px)';

  // ค่าเริ่มต้น: ซ้ายล่าง (PC ดีสุด)
  let css = [
    'position:fixed',
    `left:calc(12px + ${sal})`,
    `bottom:calc(12px + ${sab})`,
    'top:auto',
    'right:auto',
  ];

  // Mobile / cVR: ขวาล่าง (กันนิ้วโป้งซ้าย + กัน HUD ซ้าย)
  if (small || isCVR){
    css = [
      'position:fixed',
      `right:calc(12px + ${sar})`,
      `bottom:calc(12px + ${sab})`,
      'left:auto',
      'top:auto',
    ];
  }

  // Cardboard: ย้ายขึ้นซ้ายบน (กัน crosshair/ยิงกลางจอ + กันโซนล่าง)
  if (isCardboard){
    css = [
      'position:fixed',
      `left:calc(12px + ${sal})`,
      `top:calc(12px + ${sat})`,
      'right:auto',
      'bottom:auto',
    ];
  }

  el.style.cssText = el.style.cssText + ';' + css.join(';');
}

export function ensureWaterGauge(){
  if (!DOC) return;
  if (DOC.getElementById('hha-water-gauge')) return;

  // ✅ ถ้ามี panel water ของหน้าเกมอยู่แล้ว ไม่สร้างซ้ำ
  if (hasNativeWaterPanel()) return;

  const wrap = DOC.createElement('div');
  wrap.id = 'hha-water-gauge';
  wrap.style.cssText = [
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

  DOC.body.appendChild(wrap);
  setPlacementStyle(wrap);

  // ถ้ามีการเปลี่ยน class view ภายหลัง ให้ reposition อีกครั้ง
  setTimeout(()=>{ try{ setPlacementStyle(wrap); }catch(_){ } }, 350);
}

export function setWaterGauge(pct){
  if (!DOC) return;
  const p = clamp(pct,0,100);

  // ถ้าไม่ได้สร้าง gauge (เพราะมี native panel) ก็ไม่ทำอะไร
  const bar = DOC.getElementById('hha-water-bar');
  const t = DOC.getElementById('hha-water-pct');
  const z = DOC.getElementById('hha-water-zone');
  if (!bar && !t && !z) return;

  if (bar) bar.style.width = p.toFixed(0) + '%';
  if (t) t.textContent = String(p|0);

  const zone = zoneFrom(p);
  if (z) z.textContent = zone;
}
