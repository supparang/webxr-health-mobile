// === /herohealth/vr/particles.js
// Simple DOM-based particle & score FX for HeroHealth VR

'use strict';

let layer = null;

function ensureStyle() {
  if (document.getElementById('hha-particles-style')) return;
  const style = document.createElement('style');
  style.id = 'hha-particles-style';
  style.textContent = `
  .hha-fx-layer{
    position:fixed;
    inset:0;
    pointer-events:none;
    z-index:20;
    overflow:hidden;
  }
  .hha-score-pop{
    position:absolute;
    transform:translate(-50%,-50%);
    font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
    font-size:14px;
    font-weight:600;
    padding:2px 6px;
    border-radius:999px;
    background:rgba(15,23,42,0.95);
    color:#bbf7d0;
    opacity:0;
    transition:transform .6s ease-out, opacity .6s ease-out;
    white-space:nowrap;
  }
  .hha-score-pop.bad{
    color:#fed7aa;
  }
  .hha-frag{
    position:absolute;
    width:6px;
    height:6px;
    border-radius:999px;
    background:#22c55e;
    opacity:0.9;
    pointer-events:none;
    transform:translate(-50%,-50%);
    transition:transform .7s ease-out, opacity .7s ease-out;
  }
  `;
  document.head.appendChild(style);
}

function ensureLayer() {
  if (layer && layer.isConnected) return layer;
  ensureStyle();
  layer = document.createElement('div');
  layer.className = 'hha-fx-layer';
  document.body.appendChild(layer);
  return layer;
}

export function scorePop(x, y, text, opts = {}) {
  const host = ensureLayer();
  const el = document.createElement('div');
  el.className = 'hha-score-pop' + (opts.good === false ? ' bad' : '');
  el.textContent = text;

  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  host.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-120%)';
  });

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%,-180%)';
    setTimeout(() => el.remove(), 260);
  }, 420);
}

export function burstAt(x, y, opts = {}) {
  const host = ensureLayer();
  const color = opts.color || '#22c55e';
  const n = opts.count || 12;
  const radius = opts.radius || 50;

  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'hha-frag';
    el.style.background = color;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    host.appendChild(el);

    cons
