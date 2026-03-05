// === /herohealth/vr-brush/brush.fx.js ===
// Brush FX — optional (toast/pulse)
// FULL v20260304-BRUSH-FX
'use strict';

export function bootFx(){
  const D = document;
  let layer = D.getElementById('fxLayer');
  if(!layer){
    layer = D.createElement('div');
    layer.id = 'fxLayer';
    layer.style.cssText = `position:fixed; inset:0; pointer-events:none; z-index:55;`;
    D.body.appendChild(layer);
  }

  function toast(text, kind='info', ms=900){
    const el = D.createElement('div');
    el.textContent = String(text||'');
    el.style.cssText = `
      position:fixed; left:50%; top:14%;
      transform:translate(-50%,-6px);
      padding:8px 12px; border-radius:999px;
      font-weight:900; font-size:14px;
      background: rgba(15,23,42,.92);
      border: 1px solid rgba(148,163,184,.24);
      box-shadow: 0 14px 34px rgba(0,0,0,.30);
      color: rgba(229,231,235,.95);
      opacity:0; transition: all .16s ease;
    `;
    if (kind === 'good') el.style.borderColor = 'rgba(34,197,94,.35)';
    if (kind === 'bad')  el.style.borderColor = 'rgba(239,68,68,.35)';
    if (kind === 'warn') el.style.borderColor = 'rgba(245,158,11,.35)';
    layer.appendChild(el);

    requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='translate(-50%,0)'; });
    setTimeout(()=>{
      el.style.opacity='0';
      el.style.transform='translate(-50%,-6px)';
      setTimeout(()=> el.remove(), 220);
    }, ms);
  }

  function pulse(kind='good', ms=180){
    const el = D.createElement('div');
    el.style.cssText = `position:fixed; inset:0; opacity:0; transition: opacity .10s ease;`;
    el.style.background = 'rgba(34,197,94,.10)';
    if (kind === 'bad') el.style.background = 'rgba(239,68,68,.10)';
    if (kind === 'warn') el.style.background = 'rgba(245,158,11,.10)';
    layer.appendChild(el);
    requestAnimationFrame(()=>{ el.style.opacity='1'; });
    setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(), 160); }, ms);
  }

  return { toast, pulse };
}