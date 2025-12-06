// === /herohealth/vr/ui-fever.js ===
// Global Fever UI — ใช้ร่วมกันทุกโหมด (GoodJunk / Groups / Hydration)
// 2025-12-06 — ES module + global fallback

'use strict';

const doc = (typeof document !== 'undefined') ? document : null;

let wrapEl  = null;
let barEl   = null;
let fillEl  = null;
let labelEl = null;
let shieldEl = null;

let feverVal   = 0;
let feverOn    = false;
let shieldVal  = 0;

function ensureBaseStyle() {
  if (!doc) return;
  if (doc.getElementById('hha-fever-style')) return;

  const css = `
  .hha-fever-wrap{
    position:fixed;
    left:8px;
    bottom:8px;
    z-index:640;
    pointer-events:none;
    min-width:180px;
    max-width:260px;
    padding:6px 10px 8px;
    border-radius:14px;
    background:rgba(15,23,42,0.96);
    border:1px solid rgba(248,250,252,0.06);
    box-shadow:0 18px 40px rgba(15,23,42,0.7);
    font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    color:#e5e7eb;
  }
  @media (min-width:1024px){
    .hha-fever-wrap{
      left:14px;
      bottom:14px;
    }
  }
  .hha-fever-title{
    font-size:11px;
    text-transform:uppercase;
    letter-spacing:0.08em;
    opacity:0.8;
    margin-bottom:4px;
    display:flex;
    align-items:center;
    gap:4px;
  }
  .hha-fever-title span.emoji{
    font-size:14px;
  }
  .hha-fever-bar{
    position:relative;
    width:100%;
    height:10px;
    border-radius:999px;
    background:rgba(15,23,42,0.9);
    overflow:hidden;
    box-shadow:inset 0 0 0 1px rgba(15,118,110,0.4);
  }
  .hha-fever-fill{
    position:absolute;
    left:0;
    top:0;
    bottom:0;
    width:0%;
    border-radius:999px;
    background:linear-gradient(90deg,#fb923c,#f97316,#facc15);
    transition:width .18s ease-out, transform .18s ease-out, opacity .18s ease-out;
    transform-origin:left center;
  }
  .hha-fever-wrap.is-active .hha-fever-fill{
    box-shadow:0 0 14px rgba(248,250,109,0.75);
  }
  .hha-fever-meta{
    display:flex;
    justify-content:space-between;
    align-items:center;
    margin-top:4px;
    font-size:11px;
    opacity:0.9;
    gap:8px;
  }
  .hha-fever-meta span{
    white-space:nowrap;
  }
  .hha-fever-meta strong{
    font-weight:600;
  }
  .hha-fever-shield{
    text-align:right;
  }
  `;

  const style = doc.createElement('style');
  style.id = 'hha-fever-style';
  style.textContent = css;
  doc.head.appendChild(style);
}

export function ensureFeverBar() {
  if (!doc) return null;
  ensureBaseStyle();

  if (wrapEl && doc.body.contains(wrapEl)) {
    return wrapEl;
  }

  wrapEl = doc.createElement('div');
  wrapEl.className = 'hha-fever-wrap';

  const title = doc.createElement('div');
  title.className = 'hha-fever-title';
  title.innerHTML = `<span class="emoji">🔥</span><span>Fever gauge</span>`;

  barEl = doc.createElement('div');
  barEl.className = 'hha-fever-bar';

  fillEl = doc.createElement('div');
  fillEl.className = 'hha-fever-fill';
  barEl.appendChild(fillEl);

  const meta = doc.createElement('div');
  meta.className = 'hha-fever-meta';

  labelEl = doc.createElement('span');
  labelEl.textContent = '0%';

  shieldEl = doc.createElement('span');
  shieldEl.className = 'hha-fever-shield';
  shieldEl.textContent = 'Shield: -';

  meta.appendChild(labelEl);
  meta.appendChild(shieldEl);

  wrapEl.appendChild(title);
  wrapEl.appendChild(barEl);
  wrapEl.appendChild(meta);

  doc.body.appendChild(wrapEl);
  syncFever();
  syncShield();

  return wrapEl;
}

function clampPct(v) {
  v = Number(v) || 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

function syncFever() {
  if (!fillEl || !labelEl) return;
  const pct = clampPct(feverVal);
  fillEl.style.width = pct + '%';
  labelEl.textContent = `${pct | 0}%`;
}

function syncShield() {
  if (!shieldEl) return;
  if (shieldVal <= 0) {
    shieldEl.textContent = 'Shield: -';
  } else {
    shieldEl.textContent = `Shield: 🛡 x${shieldVal}`;
  }
}

export function setFever(pct) {
  ensureFeverBar();
  feverVal = clampPct(pct);
  syncFever();
}

export function setFeverActive(on) {
  ensureFeverBar();
  feverOn = !!on;
  if (!wrapEl) return;
  if (feverOn) {
    wrapEl.classList.add('is-active');
  } else {
    wrapEl.classList.remove('is-active');
  }
}

export function setShield(n) {
  ensureFeverBar();
  const v = Number(n) || 0;
  shieldVal = v < 0 ? 0 : v;
  syncShield();
}

// เผื่อบางเกมอยาก reset ตอนจบ
export function resetFeverUI() {
  feverVal  = 0;
  feverOn   = false;
  shieldVal = 0;
  syncFever();
  syncShield();
  if (wrapEl) wrapEl.classList.remove('is-active');
}

// optional: ใช้ลบออกจาก DOM ถ้าต้องการ
export function destroyFeverUI() {
  if (wrapEl && wrapEl.parentNode) {
    wrapEl.parentNode.removeChild(wrapEl);
  }
  wrapEl = barEl = fillEl = labelEl = shieldEl = null;
}

// ----- global fallback สำหรับโค้ดเก่า -----
const FeverAPI = {
  ensureFeverBar,
  setFever,
  setFeverActive,
  setShield,
  resetFeverUI,
  destroyFeverUI
};

if (typeof window !== 'undefined') {
  window.HHA_FeverUI = FeverAPI;
  window.GAME_MODULES = window.GAME_MODULES || {};
  window.GAME_MODULES.FeverUI = FeverAPI;
}

export default FeverAPI;
