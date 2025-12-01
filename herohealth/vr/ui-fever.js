// === /herohealth/vr/ui-fever.js
// Fever bar + Shield indicator สำหรับ HeroHealth VR

'use strict';

let wrap    = null;
let bar     = null;
let label   = null;
let shieldWrap = null;

function ensureStyle() {
  if (document.getElementById('hha-fever-style')) return;
  const style = document.createElement('style');
  style.id = 'hha-fever-style';
  style.textContent = `
  .hha-fever-wrap{
    position:fixed;
    bottom:8px;
    left:10px;
    z-index:12;
    min-width:180px;
    max-width:240px;
    padding:6px 9px 7px;
    border-radius:14px;
    background:rgba(15,23,42,0.95);
    border:1px solid rgba(251,191,36,0.9);
    box-shadow:0 18px 40px rgba(15,23,42,0.95);
    font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
    font-size:11px;
    color:#e5e7eb;
  }
  .hha-fever-top{
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:6px;
    margin-bottom:3px;
  }
  .hha-fever-label{
    display:flex;
    align-items:center;
    gap:6px;
  }
  .hha-fever-label-emoji{
    font-size:15px;
  }
  .hha-fever-bar{
    position:relative;
    width:100%;
    height:6px;
    border-radius:999px;
    background:#020617;
    overflow:hidden;
  }
  .hha-fever-bar-inner{
    position:absolute;
    inset:0;
    width:0%;
    border-radius:999px;
    background:linear-gradient(90deg,#f97316,#facc15);
    box-shadow:0 0 0 rgba(250,204,21,0);
    transition:width .22s ease-out, box-shadow .22s ease-out;
  }
  .hha-fever-wrap[data-active="1"] .hha-fever-bar-inner{
    box-shadow:0 0 18px rgba(250,204,21,0.9);
  }
  .hha-shield-wrap{
    display:flex;
    align-items:center;
    gap:4px;
    margin-top:3px;
    font-size:11px;
  }
  .hha-shield-icons{
    display:flex;
    gap:2px;
  }
  `;
  document.head.appendChild(style);
}

export function ensureFeverBar() {
  if (wrap && wrap.isConnected) return wrap;
  ensureStyle();

  wrap = document.createElement('div');
  wrap.className = 'hha-fever-wrap';
  wrap.dataset.active = '0';

  const top = document.createElement('div');
  top.className = 'hha-fever-top';

  const lab = document.createElement('div');
  lab.className = 'hha-fever-label';
  const em = document.createElement('span');
  em.className = 'hha-fever-label-emoji';
  em.textContent = '🔥';
  const txt = document.createElement('span');
  txt.textContent = 'Fever gauge';
  lab.appendChild(em);
  lab.appendChild(txt);
  label = txt;

  const val = document.createElement('span');
  val.style.fontWeight = '500';
  val.textContent = '0%';

  top.appendChild(lab);
  top.appendChild(val);

  const barOuter = document.createElement('div');
  barOuter.className = 'hha-fever-bar';
  const inner = document.createElement('div');
  inner.className = 'hha-fever-bar-inner';
  barOuter.appendChild(inner);
  bar = inner;

  const shieldRow = document.createElement('div');
  shieldRow.className = 'hha-shield-wrap';
  const shLabel = document.createElement('span');
  shLabel.textContent = '🛡 Shield:';
  const shIcons = document.createElement('span');
  shIcons.className = 'hha-shield-icons';
  shieldWrap = shIcons;
  shieldRow.appendChild(shLabel);
  shieldRow.appendChild(shIcons);

  wrap.appendChild(top);
  wrap.appendChild(barOuter);
  wrap.appendChild(shieldRow);

  document.body.appendChild(wrap);
  return wrap;
}

export function setFever(value) {
  if (!wrap || !wrap.isConnected) ensureFeverBar();
  const v = clamp(Number(value) || 0, 0, 100);
  if (bar) bar.style.width = v + '%';
  const txt = v.toFixed(0) + '%';
  if (label && label.nextSibling) {
    label.nextSibling.textContent = txt;
  } else if (wrap) {
    // fallback: หา span ตัวท้าย
    const spans = wrap.querySelectorAll('.hha-fever-top span');
    if (spans.length >= 2) spans[spans.length - 1].textContent = txt;
  }
}

export function setFeverActive(active) {
  if (!wrap || !wrap.isConnected) ensureFeverBar();
  wrap.dataset.active = active ? '1' : '0';
}

export function setShield(count) {
  if (!wrap || !wrap.isConnected) ensureFeverBar();
  const n = clamp(Number(count) || 0, 0, 5);
  if (!shieldWrap) return;
  shieldWrap.innerHTML = '';
  for (let i = 0; i < n; i
