// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (NO override if ?view= exists)
// ✅ Sets body classes: view-pc / view-mobile / view-vr / view-cvr + cardboard
// ✅ Sets window.HHA_VIEW.layers for engine (L/R for cardboard)
// ✅ Shows Start overlay -> dispatches hha:start
// ✅ Cardboard: reveals #cbWrap and uses hydration-layerL/R
// ✅ Best-effort fullscreen + landscape lock for Cardboard
// ✅ Back HUB buttons supported (.btnBackHub)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  const hub = String(qs('hub','../hub.html'));
  const userView = (qs('view','')||'').toLowerCase().trim(); // if exists => DO NOT override
  const kids = (String(qs('kids','0')).toLowerCase()==='1' || String(qs('kids','0')).toLowerCase()==='true');

  const isMobileUA = ()=> /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');
  const hasXR = async ()=>{
    try{
      if (!navigator.xr || !navigator.xr.isSessionSupported) return false;
      return await navigator.xr.isSessionSupported('immersive-vr');
    }catch(_){ return false; }
  };
  const isOculusBrowser = ()=> /OculusBrowser/i.test(navigator.userAgent||'');

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    if (view==='pc') b.classList.add('view-pc');
    else if (view==='vr') b.classList.add('view-vr');
    else if (view==='cvr') b.classList.add('view-cvr');
    else b.classList.add('view-mobile');
  }

  function setCardboard(on){
    const b = DOC.body;
    b.classList.toggle('cardboard', !!on);

    const cbWrap = DOC.getElementById('cbWrap');
    const layerMain = DOC.getElementById('hydration-layer');
    const layerL = DOC.getElementById('hydration-layerL');
    const layerR = DOC.getElementById('hydration-layerR');

    if (cbWrap) cbWrap.hidden = !on;
    if (layerMain) layerMain.style.display = on ? 'none' : '';
    if (layerL) layerL.style.display = on ? '' : 'none';
    if (layerR) layerR.style.display = on ? '' : 'none';

    WIN.HHA_VIEW = WIN.HHA_VIEW || {};
    if (on) WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
    else WIN.HHA_VIEW.layers = ['hydration-layer'];
  }

  async function detectView(){
    // Respect explicit view (no override)
    if (userView){
      // map aliases
      if (userView === 'desktop') return 'pc';
      if (userView === 'phone') return 'mobile';
      return userView;
    }

    // Auto detect
    // - OculusBrowser => vr
    // - Mobile + XR => vr
    // - Mobile + no XR => mobile
    // - Desktop => pc
    if (isOculusBrowser()) return 'vr';

    const mobile = isMobileUA();
    if (mobile){
      const xr = await hasXR();
      return xr ? 'vr' : 'mobile';
    }
    return 'pc';
  }

  function bestEffortFullscreen(){
    try{
      const el = DOC.documentElement;
      if (DOC.fullscreenElement) return;
      if (el.requestFullscreen) el.requestFullscreen().catch(()=>{});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }catch(_){}
  }
  function bestEffortLandscapeLock(){
    try{
      const scr = screen;
      if (scr && scr.orientation && scr.orientation.lock){
        scr.orientation.lock('landscape').catch(()=>{});
      }
    }catch(_){}
  }

  function bindHubButtons(){
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        location.href = hub;
      });
    });
  }

  function startGame(){
    // hide overlay + dispatch start
    const ov = DOC.getElementById('startOverlay');
    if (ov){
      ov.classList.add('hide');
      ov.style.display = 'none';
    }
    WIN.dispatchEvent(new CustomEvent('hha:start'));
  }

  function bindStartOverlay(view){
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return;

    const sub = DOC.getElementById('ovSub');
    if (sub){
      if (view==='vr') sub.textContent = 'แตะเพื่อเริ่ม (รองรับ Enter VR)';
      else if (view==='cvr') sub.textContent = 'แตะเพื่อเริ่ม (ยิงจากกลางจอ)';
      else sub.textContent = 'แตะเพื่อเริ่ม';
    }

    const btn = DOC.getElementById('btnStart');
    const go = ()=>{
      // user gesture: resume audio + fullscreen best effort
      try{
        const AC = (window.AudioContext || window.webkitAudioContext);
        if (AC){
          const ac = new AC();
          ac.resume?.().catch(()=>{});
          // close quickly to avoid keeping extra ctx (engine may create its own)
          setTimeout(()=>{ try{ ac.close?.(); }catch(_){ } }, 300);
        }
      }catch(_){}

      if (DOC.body.classList.contains('cardboard')){
        bestEffortFullscreen();
        bestEffortLandscapeLock();
      }
      startGame();
    };

    btn?.addEventListener('click', go);

    // tap anywhere on overlay
    ov.addEventListener('click', (e)=>{
      // allow click on buttons naturally
      if ((e.target && e.target.closest && e.target.closest('button'))){
        return;
      }
      go();
    });

    // key
    WIN.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter' || e.key === ' ') go();
    }, { passive:true });
  }

  function installSceneHints(){
    // make embedded a-scene non-blocking (vr-ui handles buttons)
    const scene = DOC.querySelector('a-scene');
    if (scene){
      scene.style.pointerEvents = 'none';
      scene.style.opacity = '0.001';
    }
  }

  async function main(){
    // Safe-area css vars
    try{
      const root = DOC.documentElement;
      root.style.setProperty('--sat', `env(safe-area-inset-top, 0px)`);
      root.style.setProperty('--sar', `env(safe-area-inset-right, 0px)`);
      root.style.setProperty('--sab', `env(safe-area-inset-bottom, 0px)`);
      root.style.setProperty('--sal', `env(safe-area-inset-left, 0px)`);
    }catch(_){}

    const view = await detectView();
    setBodyView(view);

    // Cardboard decision:
    // - explicit ?view=cvr => NOT cardboard (strict center shoot)
    // - explicit ?view=vr => allow cardboard split if ?cardboard=1 or ?cb=1
    // - auto vr on mobile: if query cb=1 => cardboard, else non-split
    const cb = (String(qs('cardboard','0')).toLowerCase()==='1' || String(qs('cb','0')).toLowerCase()==='1');
    const wantCardboard = cb && (view==='vr');

    setCardboard(!!wantCardboard);

    // Kids class (optional use in CSS)
    DOC.body.classList.toggle('kids', !!kids);

    installSceneHints();
    bindHubButtons();
    bindStartOverlay(view);

    // If overlay missing, start shortly
    setTimeout(()=>{
      const ov = DOC.getElementById('startOverlay');
      if (!ov) startGame();
    }, 700);
  }

  // run after DOM ready
  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main, { once:true });
  else main();

})();