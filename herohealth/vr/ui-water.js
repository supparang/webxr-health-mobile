// === /herohealth/vr/ui-water.js
// Water gauge + zone helper (LOW / GREEN / HIGH)

'use strict';

let gaugeWrap = null;
let gaugeBar  = null;
let gaugeText = null;
let zoneText  = null;

function ensureStyle() {
  if (document.getElementById('hha-water-style')) return;
  const style = document.createElement('style');
  style.id = 'hha-water-style';
  style.textContent = `
  .hha-water-wrap{
    position:fixed;
    top:8px;
    left:50%;
    transform:translateX(-50%);
    z-index:12;
    min-width:200px;
    max-width:260px;
    padding:6px 10px 7px;
    border-radius:999px;
    background:rgba(15,23,42,0.92);
    border:1px solid rgba(56,189,248,0.8);
    box-shadow:0 16px 34px rgba(15,23,42,0.9);
    font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
    font-size:11px;
    color:#e5e7eb;
    display:flex;
    flex-direction:column;
    gap:3px;
  }
  .hha-water-top{
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:6px;
  }
  .hha-water-label{
    display:flex;
    align-items:center;
    gap:6px;
  }
  .hha-water-label-emoji{
    font-size:15px;
  }
  .hha-water-zone{
    font-weight:600;
  }
  .hha-water-bar{
    position:relative;
    width:100%;
    height:6px;
    border-radius:999px;
    background:#020617;
    overflow:hidden;
  }
  .hha-water-bar-inner{
    position:absolute;
    inset:0;
    width:50%;
    border-radius:999px;
    background:linear-gradient(90deg,#22c55e,#4ade80);
    transition:width .25s ease-out, background .25s ease-out;
  }
  .hha-water-wrap[data-zone="LOW"] .hha-water-bar-inner{
    background:linear-gradient(90deg,#38bdf8,#22c55e);
  }
  .hha-water-wrap[data-zone="HIGH"] .hha-water-bar-inner{
    background:linear-gradient(90deg,#f97316,#ef4444);
  }
  `;
  document.head.appendChild(style);
}

export function zoneFrom(pct) {
  const v = Number(pct) || 0;
  if (v < 35) return 'LOW';
  if (v > 65) return 'HIGH';
  return 'GREEN';
}

export function ensureWaterGauge() {
  if (gaugeWrap && gaugeWrap.isConnected) return gaugeWrap;
  ensureStyle();

  gaugeWrap = document.createElement('div');
  gaugeWrap.className = 'hha-water-wrap';
  gaugeWrap.dataset.zone = 'GREEN';

  const top = document.createElement('div');
  top.className = 'hha-water-top';

  const label = document.createElement('div');
  label.className = 'hha-water-label';
  const em = document.createElement('span');
  em.className = 'hha-water-label-emoji';
  em.textContent = '💧';
  const txt = document.createElement('span');
  txt.textContent = 'Water balance';
  label.appendChild(em);
  label.appendChild(txt);

  const zoneSpan = document.createElement('span');
  zoneSpan.className = 'hha-water-zone';
  zoneSpan.textContent = 'GREEN';
  zoneText = zoneSpan;

  const valSpan = document.createElement('span');
  valSpan.style.fontWeight = '500';
  valSpan.textContent = '50%';
  gaugeText = valSpan;

  const topRight = document.createElement('div');
  topRight.style.display = 'flex';
  topRight.style.gap = '6px';
  topRight.appendChild(zoneSpan);
  topRight.appendChild(valSpan);

  top.appendChild(label);
  top.appendChild(topRight);

  const bar = document.createElement('div');
  bar.className = 'hha-water-bar';
  const inner = document.createElement('div');
  inner.className = 'hha-water-bar-inner';
  bar.appendChild(inner);
  gaugeBar = inner;

  gaugeWrap.appendChild(top);
  gaugeWrap.appendChild(bar);

  document.body.appendChild(gaugeWrap);
  return gaugeWrap;
}

// setWaterGauge(pct) → { pct, zone }
export function setWaterGauge(pct) {
  if (!gaugeWrap || !gaugeWrap.isConnected) ensureWaterGauge();
  const v = clamp(Number(pct), 0, 100);
  const zone = zoneFrom(v);

  gaugeWrap.dataset.zone = zone;
  if (gaugeBar) gaugeBar.style.width = v + '%';
  if (gaugeText) gaugeText.textContent = v.toFixed(0) + '%';
  if (zoneText) zoneText.textContent = zone;

  return { pct: v, zone };
}

function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}

export default { ensureWaterGauge, setWaterGauge, zoneFrom };
