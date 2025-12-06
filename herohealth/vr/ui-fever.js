// === /herohealth/vr/ui-fever.js ===
// Global Fever UI (shared by GoodJunk / Hydration / Groups)
// - Fever gauge มุมล่างซ้าย
// - ไฟลุกทั้งจอเวลา FEVER ACTIVE
// 2025-12-06

'use strict';

let wrapEl = null;
let fillEl = null;
let shieldDotsEl = null;
let fireEl = null;

let feverValue = 0;
let feverActive = false;
let shieldCount = 0;

function ensureBaseStyle() {
  if (document.getElementById('hha-fever-style')) return;

  const css = `
  .hha-fever-wrap{
    position:fixed;
    left:12px;
    bottom:10px;
    z-index:640;
    pointer-events:none;
    min-width:220px;
    max-width:320px;
    padding:6px 10px 8px;
    border-radius:999px;
    background:rgba(15,23,42,0.96);
    border:1px solid rgba(248,113,113,0.9);
    box-shadow:0 18px 40px rgba(15,23,42,0.9);
    font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    color:#fee2e2;
    display:flex;
    align-items:center;
    gap:8px;
  }
  .hha-fever-wrap small{
    font-size:12px;
    opacity:.85;
    letter-spacing:.03em;
  }
  .hha-fever-bar{
    flex:1;
    height:10px;
    border-radius:999px;
    background:linear-gradient(90deg,#0f172a,#1f2937);
    overflow:hidden;
    box-shadow:0 0 0 1px rgba(248,113,113,0.4) inset;
  }
  .hha-fever-fill{
    width:0%;
    height:100%;
    background:linear-gradient(90deg,#fb923c,#f97316,#ef4444,#facc15);
    box-shadow:0 0 18px rgba(248,113,113,0.9);
    transition:width .18s ease-out;
  }
  .hha-fever-wrap span.hha-fever-label{
    font-size:11px;
    text-transform:uppercase;
    letter-spacing:.12em;
    opacity:.9;
    min-width:52px;
  }
  .hha-fever-wrap.hha-fever-active{
    border-color:rgba(250,204,21,1);
    box-shadow:0 0 35px rgba(248,250,252,0.9),0 0 90px rgba(248,113,113,0.9);
    transform:translateY(-2px);
    transition:transform .12s ease-out,box-shadow .12s ease-out,border-color .12s ease-out;
  }

  /* Shield chips */
  .hha-shield-wrap{
    display:flex;
    align-items:center;
    gap:4px;
    font-size:13px;
    opacity:.9;
  }
  .hha-shield-dots{
    display:flex;
    gap:2px;
  }
  .hha-shield-dot{
    width:7px;
    height:7px;
    border-radius:999px;
    background:rgba(148,163,184,.55);
  }
  .hha-shield-dot.on{
    background:#facc15;
    box-shadow:0 0 8px rgba(250,204,21,.9);
  }

  /* ไฟ Fever เต็มจอ */
  .hha-fever-fire{
    position:fixed;
    inset:0;
    pointer-events:none;
    z-index:630;
    background:
      radial-gradient(circle at 50% 20%, rgba(254,249,195,0.55) 0, transparent 38%),
      radial-gradient(circle at 50% 80%, rgba(248,113,113,0.8) 0, transparent 55%),
      radial-gradient(circle at 0% 50%, rgba(248,113,113,0.8) 0, transparent 55%),
      radial-gradient(circle at 100% 50%, rgba(249,115,22,0.8) 0, transparent 55%),
      radial-gradient(circle at 50% 50%, rgba(127,29,29,0.95) 0, #020617 70%);
    mix-blend-mode:screen;
    opacity:0;
    transform:scale(1.02);
    transition:opacity .22s ease-out, transform .22s ease-out;
  }
  .hha-fever-fire.hha-fever-fire--active{
    opacity:.55;
    animation:hha-fever-pulse 0.9s ease-in-out infinite alternate;
  }
  @keyframes hha-fever-pulse{
    0%{transform:scale(1.02);filter:brightness(1);}
    100%{transform:scale(1.06);filter:brightness(1.15);}
  }

  @media (max-width:640px){
    .hha-fever-wrap{
      left:10px;
      bottom:8px;
      min-width:190px;
      padding:5px 9px 6px;
    }
    .hha-fever-wrap span.hha-fever-label{
      display:none;
    }
  }
  `;

  const style = document.createElement('style');
  style.id = 'hha-fever-style';
  style.textContent = css;
  document.head.appendChild(style);
}

function clamp(v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

export function ensureFeverBar() {
  ensureBaseStyle();
  if (wrapEl && fillEl && fireEl) return;

  if (!fireEl) {
    fireEl = document.createElement('div');
    fireEl.className = 'hha-fever-fire';
    document.body.appendChild(fireEl);
  }

  if (!wrapEl) {
    wrapEl = document.createElement('div');
    wrapEl.className = 'hha-fever-wrap';

    const label = document.createElement('span');
    label.className = 'hha-fever-label';
    label.textContent = 'FEVER';

    const bar = document.createElement('div');
    bar.className = 'hha-fever-bar';

    const fill = document.createElement('div');
    fill.className = 'hha-fever-fill';
    bar.appendChild(fill);

    const shieldWrap = document.createElement('div');
    shieldWrap.className = 'hha-shield-wrap';
    const shieldLabel = document.createElement('span');
    shieldLabel.textContent = '🛡️';
    const shieldDots = document.createElement('div');
    shieldDots.className = 'hha-shield-dots';
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('div');
      d.className = 'hha-shield-dot';
      shieldDots.appendChild(d);
    }
    shieldWrap.appendChild(shieldLabel);
    shieldWrap.appendChild(shieldDots);

    wrapEl.appendChild(label);
    wrapEl.appendChild(bar);
    wrapEl.appendChild(shieldWrap);

    document.body.appendChild(wrapEl);

    fillEl = fill;
    shieldDotsEl = shieldDots;
  }

  applyFeverVisual();
  updateShieldDots();
}

export function setFever(v) {
  feverValue = clamp(v, 0, 100);
  if (fillEl) {
    fillEl.style.width = feverValue + '%';
  }
  applyFeverVisual();
}

export function setFeverActive(active) {
  feverActive = !!active;
  if (wrapEl) {
    wrapEl.classList.toggle('hha-fever-active', feverActive);
  }
  applyFeverVisual();
}

export function setShield(n) {
  shieldCount = clamp(n, 0, 3);
  updateShieldDots();
}

function updateShieldDots() {
  if (!shieldDotsEl) return;
  const children = shieldDotsEl.children;
  for (let i = 0; i < children.length; i++) {
    if (i < shieldCount) children[i].classList.add('on');
    else children[i].classList.remove('on');
  }
}

function applyFeverVisual() {
  if (!fireEl) return;

  if (!feverActive && feverValue <= 0) {
    fireEl.classList.remove('hha-fever-fire--active');
    fireEl.style.opacity = '0';
    return;
  }

  if (feverActive) {
    fireEl.classList.add('hha-fever-fire--active');
    const o = 0.35 + (feverValue / 100) * 0.25; // 0.35–0.6
    fireEl.style.opacity = String(o);
  } else {
    fireEl.classList.remove('hha-fever-fire--active');
    const o = (feverValue / 100) * 0.3; // ชาร์จอยู่
    fireEl.style.opacity = String(o);
  }
}

// ---- Global hook สำหรับโหมดที่ยิง event (GoodJunk etc.) ----
function hookGlobalEvents() {
  if (typeof window === 'undefined') return;
  if (window.__HHA_FEVER_HOOKED__) return;
  window.__HHA_FEVER_HOOKED__ = true;

  window.addEventListener('hha:fever', (ev) => {
    const d = ev.detail || {};
    ensureFeverBar();
    if (typeof d.value === 'number') {
      setFever(d.value);
    }
    if (d.state === 'start') {
      setFeverActive(true);
    } else if (d.state === 'end') {
      setFeverActive(false);
    }
  });
}

hookGlobalEvents();

// ---- ผูกเข้า global เพื่อให้ Groups ใช้ผ่าน window.GAME_MODULES.FeverUI ได้ ----
const FeverUI = {
  ensureFeverBar,
  setFever,
  setFeverActive,
  setShield
};

if (typeof window !== 'undefined') {
  window.GAME_MODULES = window.GAME_MODULES || {};
  window.GAME_MODULES.FeverUI = FeverUI;
  window.FeverUI = FeverUI;
}

export default FeverUI;
