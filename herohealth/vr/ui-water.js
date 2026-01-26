// === /herohealth/vr/ui-water.js ===
// Water Gauge UI helper (HeroHealth)
// ✅ Exports: ensureWaterGauge, setWaterGauge, zoneFrom
// ✅ Works with existing DOM ids: #water-bar #water-pct #water-zone #water-tip
// ✅ If not found, auto-create a compact floating gauge

'use strict';

const DOC = (typeof window !== 'undefined') ? window.document : null;

export function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function zoneFrom(pct){
  const p = clamp(pct,0,100);
  // ปรับ threshold ให้ "GREEN ไม่แคบเกิน" (เล่นสนุก)
  if (p < 45) return 'LOW';
  if (p > 65) return 'HIGH';
  return 'GREEN';
}

function qs(id){ return DOC ? DOC.getElementById(id) : null; }

function ensureNode(){
  if (!DOC) return;

  // ถ้ามี panel อยู่แล้ว ใช้ของเดิม
  if (qs('water-bar') && qs('water-pct') && qs('water-zone')) return;

  // สร้าง floating gauge แบบเล็ก (fallback)
  const wrap = DOC.createElement('div');
  wrap.id = 'hha-water-fallback';
  wrap.style.cssText = `
    position:fixed; right:12px; top:12px; z-index:9999;
    width:220px; padding:10px 10px; border-radius:16px;
    background: rgba(2,6,23,.72);
    border:1px solid rgba(148,163,184,.18);
    color:#e5e7eb; font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
    backdrop-filter: blur(10px);
    pointer-events:none;
  `;
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
      <div style="font-weight:900;font-size:12px;letter-spacing:.2px">Water</div>
      <div style="font-weight:900;font-size:16px">
        <span id="water-pct">50</span><span style="opacity:.75;font-size:12px">%</span>
      </div>
    </div>
    <div style="margin-top:6px;opacity:.9;font-size:12px">Zone <b id="water-zone">GREEN</b></div>
    <div style="margin-top:8px;height:10px;border-radius:999px;background:rgba(148,163,184,.18);overflow:hidden;border:1px solid rgba(148,163,184,.12)">
      <div id="water-bar" style="height:100%;width:50%;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));"></div>
    </div>
    <div id="water-tip" style="margin-top:8px;font-size:11px;opacity:.88;white-space:pre-line;line-height:1.25">
      Tip: คุม GREEN ให้นาน ๆ
    </div>
  `;
  DOC.body.appendChild(wrap);
}

export function ensureWaterGauge(){
  ensureNode();
}

export function setWaterGauge(pct){
  if (!DOC) return;
  ensureNode();

  const p = clamp(pct,0,100);
  const z = zoneFrom(p);

  const bar = qs('water-bar');
  const pctEl = qs('water-pct');
  const zoneEl = qs('water-zone');
  const tipEl = qs('water-tip');

  if (bar) bar.style.width = `${p.toFixed(0)}%`;
  if (pctEl) pctEl.textContent = String(p|0);
  if (zoneEl) zoneEl.textContent = z;

  if (tipEl){
    if (z === 'GREEN') tipEl.textContent = '✅ GREEN: ดีมาก! รักษาให้ต่อเนื่อง\nทิป: ยิง 💧 คุมสมดุล + เก็บ 🛡️ รอพายุ';
    else if (z === 'LOW') tipEl.textContent = '🟦 LOW: น้ำต่ำไป\nทิป: ยิง 💧 เพิ่มเพื่อกลับ GREEN และเตรียมกันพายุ';
    else tipEl.textContent = '🟥 HIGH: น้ำสูงไป\nทิป: คุมจังหวะ อย่ารัว แล้วกลับเข้า GREEN';
  }
}