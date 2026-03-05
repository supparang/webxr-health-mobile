// === /herohealth/vr-brush/brush.fx.js ===
// BrushFX — tiny DOM FX helpers (no deps)
// PATCH v20260304-BRUSH-FX
(function(){
  'use strict';
  const WIN = window, DOC = document;

  function ensure(){
    let root = DOC.getElementById('br-fx');
    if(root) return root;
    root = DOC.createElement('div');
    root.id = 'br-fx';
    root.style.position='fixed';
    root.style.inset='0';
    root.style.zIndex='8';
    root.style.pointerEvents='none';
    root.innerHTML = `
      <div id="fxFlash" style="position:absolute;inset:0;opacity:0;background:rgba(255,255,255,.12);transition:opacity .12s ease"></div>
      <div id="fxLaser" style="position:absolute;inset:0;opacity:0;
        background:linear-gradient(115deg,transparent 0%, rgba(251,191,36,.18) 30%, rgba(239,68,68,.22) 50%, rgba(251,191,36,.18) 70%, transparent 100%);
        transform: translateX(-120%) skewX(-10deg)"></div>
      <div id="fxFin" style="position:absolute;inset:0;opacity:0;background:radial-gradient(600px 400px at 50% 60%, rgba(244,114,182,.18), transparent 60%);transition:opacity .18s ease"></div>
    `;
    DOC.body.appendChild(root);
    return root;
  }

  function flash(ms=110){
    const r = ensure();
    const el = r.querySelector('#fxFlash');
    if(!el) return;
    el.style.opacity='1';
    clearTimeout(flash._t);
    flash._t = setTimeout(()=> el.style.opacity='0', ms);
  }

  function laser(){
    const r = ensure();
    const el = r.querySelector('#fxLaser');
    if(!el) return;
    el.style.opacity='1';
    el.style.transform='translateX(-120%) skewX(-10deg)';
    void el.offsetWidth;
    el.style.transition='transform 1.25s linear, opacity .10s ease';
    el.style.transform='translateX(120%) skewX(-10deg)';
    clearTimeout(laser._t);
    laser._t = setTimeout(()=>{ el.style.opacity='0'; }, 1300);
  }

  function fin(on){
    const r = ensure();
    const el = r.querySelector('#fxFin');
    if(!el) return;
    el.style.opacity = on ? '1' : '0';
  }

  WIN.BrushFX = { flash, laser, fin };
})();