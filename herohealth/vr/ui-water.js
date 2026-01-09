// === /herohealth/vr/ui-water.js ===
// Water UI + Zone helper — PRODUCTION (ESM)
// ✅ zoneFrom(pct) => 'LOW' | 'GREEN' | 'HIGH'
// ✅ ensureWaterGauge() : สร้าง overlay gauge ถ้าไม่มี DOM panel
// ✅ setWaterGauge(pct) : sync ทั้ง overlay + DOM panel (ถ้ามี #water-bar/#water-pct/#water-zone)
// ✅ ไม่บังคับ CSS (ทำงานได้แม้ไม่มีไฟล์ css แยก)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

export function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

export function zoneFrom(pct){
  const p = clamp(pct, 0, 100);
  // โซนกลาง 45–65 (ปรับได้ง่ายและ “จับรู้สึก”)
  if (p < 45) return 'LOW';
  if (p > 65) return 'HIGH';
  return 'GREEN';
}

function ensureStyleOnce(){
  if (!DOC || DOC.getElementById('hha-water-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
  .hha-water-gauge{
    position:fixed;
    left:12px;
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    z-index: 60;
    width: 210px;
    pointer-events:none;
    color: rgba(229,231,235,.95);
    font: 800 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial;
    text-shadow: 0 6px 22px rgba(0,0,0,.45);
  }
  .hha-water-gauge .box{
    background: rgba(2,6,23,.70);
    border: 1px solid rgba(148,163,184,.18);
    border-radius: 16px;
    backdrop-filter: blur(10px);
    box-shadow: 0 18px 70px rgba(0,0,0,.40);
    padding: 10px 10px;
  }
  .hha-water-gauge .row{
    display:flex; align-items:baseline; justify-content:space-between; gap:10px;
  }
  .hha-water-gauge .lbl{ opacity:.82; font-weight:800; letter-spacing:.2px; }
  .hha-water-gauge .val{ font-size:18px; font-weight:1000; }
  .hha-water-gauge .sub{ margin-top:4px; opacity:.78; font-weight:900; }
  .hha-water-gauge .barWrap{
    margin-top:8px;
    height:10px;
    border-radius:999px;
    overflow:hidden;
    background: rgba(148,163,184,.18);
    border:1px solid rgba(148,163,184,.12);
  }
  .hha-water-gauge .bar{
    height:100%;
    width:50%;
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
  }
  .hha-water-gauge[data-zone="LOW"]  .bar{ background: linear-gradient(90deg, rgba(59,130,246,.95), rgba(34,211,238,.92)); }
  .hha-water-gauge[data-zone="GREEN"] .bar{ background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95)); }
  .hha-water-gauge[data-zone="HIGH"] .bar{ background: linear-gradient(90deg, rgba(245,158,11,.92), rgba(239,68,68,.92)); }

  /* mobile friendly */
  @media (max-width: 520px){
    .hha-water-gauge{ width: 180px; left:10px; }
    .hha-water-gauge .val{ font-size:16px; }
  }
  `;
  DOC.head.appendChild(st);
}

let gaugeEl = null;

export function ensureWaterGauge(){
  if (!DOC) return null;

  // ถ้าในหน้าเกมมี DOM panel ของคุณอยู่แล้ว (#water-bar ฯลฯ) ก็ไม่จำเป็นต้องสร้าง overlay
  const hasPanel = DOC.getElementById('water-bar') || DOC.getElementById('water-pct') || DOC.getElementById('water-zone');
  if (hasPanel) return null;

  ensureStyleOnce();
  if (gaugeEl && gaugeEl.isConnected) return gaugeEl;

  gaugeEl = DOC.createElement('div');
  gaugeEl.className = 'hha-water-gauge';
  gaugeEl.dataset.zone = 'GREEN';
  gaugeEl.innerHTML = `
    <div class="box">
      <div class="row">
        <div class="lbl">Water</div>
        <div class="val"><span data-wpct>50</span><span style="font-size:12px;opacity:.75">%</span></div>
      </div>
      <div class="sub">Zone <b data-wzone>GREEN</b></div>
      <div class="barWrap"><div class="bar" data-wbar></div></div>
    </div>
  `;
  DOC.body.appendChild(gaugeEl);
  return gaugeEl;
}

export function setWaterGauge(pct){
  if (!DOC) return;

  const p = clamp(pct, 0, 100);
  const z = zoneFrom(p);

  // 1) Sync overlay gauge (ถ้ามี)
  if (!gaugeEl || !gaugeEl.isConnected){
    // ถ้าหน้าไม่มี panel ก็สร้าง overlay ให้เอง
    ensureWaterGauge();
  }
  if (gaugeEl && gaugeEl.isConnected){
    gaugeEl.dataset.zone = z;
    const wp = gaugeEl.querySelector('[data-wpct]');
    const wz = gaugeEl.querySelector('[data-wzone]');
    const wb = gaugeEl.querySelector('[data-wbar]');
    if (wp) wp.textContent = String(p|0);
    if (wz) wz.textContent = z;
    if (wb) wb.style.width = (p.toFixed(0) + '%');
  }

  // 2) Sync DOM panel ของ Hydration page (ของคุณมีอยู่แล้ว)
  const bar = DOC.getElementById('water-bar');
  const wpct = DOC.getElementById('water-pct');
  const wzone = DOC.getElementById('water-zone');
  if (bar) bar.style.width = (p.toFixed(0) + '%');
  if (wpct) wpct.textContent = String(p|0);
  if (wzone) wzone.textContent = z;

  // 3) Optional tip slot
  const tip = DOC.getElementById('water-tip');
  if (tip){
    // ไม่ยัดเยียด — แค่ช่วยบอกสั้น ๆ
    if (z === 'GREEN') tip.textContent = 'Tip: คุมให้อยู่ GREEN แล้วเก็บ 🛡️ รอทำ Storm Mini';
    else tip.textContent = 'Tip: ตอนพายุให้ “ไม่ GREEN” แล้ว BLOCK ช่วง End Window';
  }
}