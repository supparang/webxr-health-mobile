// === /herohealth/vr/ui-fever.js ===
// Fever Bar + Shield HUD สำหรับ Hero Health VR (GoodJunk / Groups / Hydration / Plate)
// ใช้จาก mode ต่าง ๆ ด้วย:
//
//   import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
//
// หรือบางที่อาจใช้ default:
//   import FeverUI from '../vr/ui-fever.js';
//   FeverUI.ensureFeverBar();

let wrap = null;
let barFill = null;
let shieldWrap = null;
let styleInjected = false;

/** inject CSS สำหรับ fever bar + shield */
function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;

  const style = document.createElement('style');
  style.id = 'hha-fever-style';
  style.textContent = `
    #hha-fever-wrap{
      position:fixed;
      left:50%;
      top:8px;
      transform:translateX(-50%);
      z-index:640;
      pointer-events:none;
      padding:4px 8px;
      border-radius:999px;
      background:rgba(15,23,42,0.92);
      border:1px solid rgba(148,163,184,0.6);
      backdrop-filter:blur(12px);
      box-shadow:0 12px 30px rgba(0,0,0,0.8);
      display:flex;
      align-items:center;
      gap:8px;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Thonburi",sans-serif;
      font-size:11px;
      color:#e5e7eb;
    }

    #hha-fever-wrap .label{
      color:#9ca3af;
    }

    #hha-fever-wrap .bar{
      position:relative;
      width:140px;
      height:8px;
      border-radius:999px;
      overflow:hidden;
      background:rgba(15,23,42,0.9);
      border:1px solid rgba(148,163,184,0.7);
    }

    #hha-fever-wrap .bar-fill{
      position:absolute;
      inset:0;
      width:0%;
      border-radius:999px;
      background:linear-gradient(90deg, #22c55e, #38bdf8);
      box-shadow:0 0 10px rgba(56,189,248,0.7);
      transition:width .18s ease-out;
    }

    #hha-fever-wrap .shield{
      min-width:54px;
      display:flex;
      justify-content:flex-end;
      gap:2px;
      font-size:14px;
    }

    #hha-fever-wrap .shield span.off{
      opacity:0.15;
      filter:grayscale(0.8);
    }

    #hha-fever-wrap.is-active .bar-fill{
      background:linear-gradient(90deg, #f97316, #eab308, #22c55e);
      box-shadow:0 0 14px rgba(249,115,22,0.9);
    }
  `;
  document.head.appendChild(style);
}

/** สร้าง DOM fever bar ถ้ายังไม่มี */
export function ensureFeverBar() {
  if (wrap && document.body.contains(wrap)) return wrap;

  injectStyle();

  wrap = document.createElement('div');
  wrap.id = 'hha-fever-wrap';

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = 'FEVER';

  const bar = document.createElement('div');
  bar.className = 'bar';

  barFill = document.createElement('div');
  barFill.className = 'bar-fill';
  bar.appendChild(barFill);

  shieldWrap = document.createElement('div');
  shieldWrap.className = 'shield';

  wrap.appendChild(label);
  wrap.appendChild(bar);
  wrap.appendChild(shieldWrap);

  document.body.appendChild(wrap);
  return wrap;
}

/** ตั้งค่าค่า fever 0–100 */
export function setFever(v) {
  ensureFeverBar();
  if (!barFill) return;
  let val = Number(v);
  if (!Number.isFinite(val)) val = 0;
  if (val < 0) val = 0;
  if (val > 100) val = 100;

  barFill.style.width = val + '%';
}

/** เปิด/ปิดโหมด fever (เปลี่ยนสี bar) */
export function setFeverActive(on) {
  ensureFeverBar();
  if (!wrap) return;
  if (on) wrap.classList.add('is-active');
  else wrap.classList.remove('is-active');
}

/** ตั้งค่าจำนวน shield 0–3 */
export function setShield(count) {
  ensureFeverBar();
  if (!shieldWrap) return;
  let n = Number(count);
  if (!Number.isFinite(n) || n < 0) n = 0;
  if (n > 3) n = 3;

  shieldWrap.innerHTML = '';
  const max = 3;
  for (let i = 0; i < max; i++) {
    const span = document.createElement('span');
    span.textContent = '🛡️';
    if (i >= n) span.classList.add('off');
    shieldWrap.appendChild(span);
  }
}

// เผื่อ code เก่าที่ใช้ default export
const FeverUI = { ensureFeverBar, setFever, setFeverActive, setShield };
export default FeverUI;

// เผื่อ global access (ถ้าอยากใช้ window.HHA_FeverUI)
if (typeof window !== 'undefined') {
  window.HHA_FeverUI = FeverUI;
}
