// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — FULL v20260221n
(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  if(!DOC || WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  const CFG = Object.assign({ lockPx: 30, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});
  const emit = (name, detail)=>{ try{ WIN.dispatchEvent(new CustomEvent(name,{detail})); }catch{} };

  function domReady(fn){
    if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
    else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
  }

  function safeMount(){ return DOC.body || DOC.documentElement; }

  function ensureCrosshair(){
    const mount = safeMount();
    if(!mount) return null;

    let ch = DOC.getElementById('hhaCrosshair');
    if(ch) return ch;

    ch = DOC.createElement('div');
    ch.id = 'hhaCrosshair';
    ch.style.cssText = [
      'position:fixed','left:50%','top:50%','transform:translate(-50%,-50%)',
      'width:18px','height:18px','border:2px solid rgba(229,231,235,.9)',
      'border-radius:999px','box-shadow:0 0 0 3px rgba(2,6,23,.55)',
      'pointer-events:none','z-index:9999','display:none'
    ].join(';');

    mount.appendChild(ch);
    return ch;
  }

  function showCrosshair(on){
    const ch = ensureCrosshair();
    if(!ch) return;
    ch.style.display = on ? 'block' : 'none';
  }

  let lastShoot = 0;
  function onTapShoot(){
    const now = Date.now();
    if(now - lastShoot < CFG.cooldownMs) return;
    lastShoot = now;
    emit('hha:shoot', { x: WIN.innerWidth/2, y: WIN.innerHeight/2, lockPx: CFG.lockPx, source:'tap' });
  }

  function getView(){
    try{
      const v = new URL(location.href).searchParams.get('view');
      return (v||'').toLowerCase();
    }catch{ return ''; }
  }

  domReady(()=>{
    const view = getView();
    if(view === 'cvr') showCrosshair(true);

    if(view === 'cvr'){
      DOC.addEventListener('click', onTapShoot, { passive:true });
      DOC.addEventListener('touchstart', onTapShoot, { passive:true });
    }
  });
})();