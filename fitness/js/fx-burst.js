'use strict';

/**
 * fx-burst.js
 * - DOM-based lightweight FX (no canvas)
 * - burstText(x,y,text,grade)
 * - burstRing(x,y,grade)
 */

function ensureLayer(){
  let layer = document.getElementById('sb-fx-layer');
  if(layer) return layer;
  layer = document.createElement('div');
  layer.id = 'sb-fx-layer';
  layer.style.position = 'fixed';
  layer.style.inset = '0';
  layer.style.pointerEvents = 'none';
  layer.style.zIndex = '9999';
  document.body.appendChild(layer);
  return layer;
}

function colorByGrade(grade){
  if(grade === 'perfect') return '#facc15';
  if(grade === 'good') return '#22c55e';
  if(grade === 'bad') return '#fb7185';
  if(grade === 'miss') return '#e5e7eb';
  if(grade === 'bomb') return '#fb7185';
  if(grade === 'shield') return '#38bdf8';
  if(grade === 'heal') return '#22c55e';
  return '#e5e7eb';
}

export function burstText(x,y,text,grade){
  const layer = ensureLayer();
  const el = document.createElement('div');
  el.className = 'sb-fx-text';
  el.textContent = text;

  const c = colorByGrade(grade);
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.color = c;
  el.style.fontSize = (grade === 'perfect' ? '22px' : '18px');
  el.style.opacity = '1';

  layer.appendChild(el);

  const t0 = performance.now();
  const dur = 520;

  function tick(now){
    const p = Math.min(1, (now - t0)/dur);
    const dy = -18 * p;
    el.style.transform = `translate(-50%,-50%) translateY(${dy}px) scale(${1 + 0.08*p})`;
    el.style.opacity = String(1 - p);
    if(p < 1) requestAnimationFrame(tick);
    else el.remove();
  }
  requestAnimationFrame(tick);
}

export function burstRing(x,y,grade){
  const layer = ensureLayer();
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.width = '18px';
  el.style.height = '18px';
  el.style.borderRadius = '999px';
  el.style.border = '2px solid ' + colorByGrade(grade);
  el.style.transform = 'translate(-50%,-50%) scale(1)';
  el.style.opacity = '0.9';
  el.style.boxShadow = '0 0 22px rgba(56,189,248,0.18)';
  layer.appendChild(el);

  const t0 = performance.now();
  const dur = 420;

  function tick(now){
    const p = Math.min(1, (now - t0)/dur);
    const s = 1 + p*2.2;
    el.style.transform = `translate(-50%,-50%) scale(${s})`;
    el.style.opacity = String(0.9*(1-p));
    if(p < 1) requestAnimationFrame(tick);
    else el.remove();
  }
  requestAnimationFrame(tick);
}