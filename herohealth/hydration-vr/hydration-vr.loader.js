// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration Loader — PRODUCTION
// ✅ sets body classes: view-pc / view-mobile / view-cvr
// ✅ optional cardboard mode: ?view=cvr&cardboard=1  (or ?view=cardboard)
// ✅ prepares layers config: window.HHA_VIEW.layers = ['hydration-layer'] or L/R
// ✅ start overlay -> emits hha:start
// ✅ back to hub via ?hub=...

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;

  const qs=(k,def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr','cardboard');
    if (view === 'pc') b.classList.add('view-pc');
    else if (view === 'cvr') b.classList.add('view-cvr');
    else b.classList.add('view-mobile');
  }

  function detectViewNoOverride(){
    const explicit = String(qs('view','')).toLowerCase();
    if (explicit) return explicit;

    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  // resolve view
  let view = String(qs('view','')).toLowerCase();
  if (!view) view = detectViewNoOverride();
  if (view === 'cardboard') view = 'cvr';
  setBodyView(view);

  // cardboard flag
  const cardboardQ = String(qs('cardboard','0')).toLowerCase();
  const isCardboard = (cardboardQ==='1' || cardboardQ==='true' || String(qs('view','')).toLowerCase()==='cardboard');

  const cbWrap = DOC.getElementById('cbWrap');
  if (cbWrap) cbWrap.hidden = !isCardboard;
  if (isCardboard) DOC.body.classList.add('cardboard');

  // setup layers list for hydration.safe.js
  const H = WIN.HHA_VIEW = WIN.HHA_VIEW || {};
  if (isCardboard) H.layers = ['hydration-layerL','hydration-layerR'];
  else H.layers = ['hydration-layer'];

  // start overlay behavior
  const ov = DOC.getElementById('startOverlay');
  const btn = DOC.getElementById('btnStart');
  const sub = DOC.getElementById('ovSub');

  const kids = String(qs('kids','0')).toLowerCase();
  const run = String(qs('run', qs('runMode','play'))).toLowerCase();

  if (sub){
    let s = (view==='pc') ? 'คลิกเพื่อเริ่ม' : 'แตะเพื่อเริ่ม';
    if (view==='cvr') s = 'cVR: ยิงจากกลางจอ • แตะเริ่ม';
    if (isCardboard) s = 'Cardboard: crosshair กลางจอ • แตะเริ่ม';
    if (kids==='1' || kids==='true') s += ' • kids mode';
    if (run==='research') s += ' • research';
    sub.textContent = s;
  }

  function start(){
    if (ov) ov.classList.add('hide');
    if (ov) ov.style.display = 'none';
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  btn?.addEventListener('click', start);

  if (ov){
    ov.addEventListener('pointerdown', (ev)=>{
      if (ev.target && String(ev.target.tagName||'').toLowerCase()==='button') return;
      start();
    }, {passive:true});
  }

  // hub back
  const hub = String(qs('hub','../hub.html'));
  DOC.querySelectorAll('.btnBackHub').forEach(el=>{
    el.addEventListener('click', ()=>{ location.href = hub; });
  });

})();
