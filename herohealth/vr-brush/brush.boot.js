// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — PRODUCTION SAFE (scroll harden + view binding + tap-to-start gate)
// v20260228-brushBootA
//
// Goals:
// 1) Ensure data-view is consistent for vr-ui (especially view=cvr / mobile)
// 2) Add "Tap to Start" overlay gate for mobile/VR to avoid gesture-related scroll/audio issues
// 3) Harden scroll behavior at page-level while playing (extra layer beyond brush.safe.js)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function isMobile(){
    const ua = navigator.userAgent || '';
    const coarse = (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
    return /Android|iPhone|iPad|iPod/i.test(ua) || coarse;
  }

  function getView(){
    const v = String(qs('view','') || '').toLowerCase();
    if(v) return v;
    // fallback: if mobile default to mobile (not cvr) unless user asked
    return isMobile() ? 'mobile' : 'pc';
  }

  function applyViewDataset(view){
    // vr-ui checks documentElement.dataset.view in some cases
    try{ DOC.documentElement.dataset.view = view; }catch(_){}
    try{
      const wrap = DOC.getElementById('br-wrap');
      if(wrap) wrap.dataset.view = view;
    }catch(_){}
    try{ DOC.body.dataset.view = view; }catch(_){}
  }

  // Extra scroll harden at BOOT layer (safe.js also locks during play)
  function ensureBaseNoScrollCSS(){
    if(DOC.getElementById('br-boot-noscr')) return;
    const st = DOC.createElement('style');
    st.id = 'br-boot-noscr';
    st.textContent = `
      html,body{
        overscroll-behavior: none;
        -webkit-text-size-adjust: 100%;
      }
      /* prevent iOS double-tap zoom on controls */
      button, a, .br-btn, #hha-vrui .hha-btn{ touch-action: manipulation; }
    `;
    DOC.head.appendChild(st);
  }

  // Tap-to-start overlay gate:
  // - show on mobile or view=cvr or if explicitly ?tap=1
  function setupTapGate(){
    const tap = DOC.getElementById('tapStart');
    const tapBtn = DOC.getElementById('tapBtn');
    if(!tap || !tapBtn) return;

    const view = getView();
    const needGate =
      (String(qs('tap','')||'') === '1') ||
      isMobile() ||
      view === 'cvr' || view === 'cardboard' || view === 'vr';

    if(!needGate){
      tap.style.display = 'none';
      return;
    }

    tap.style.display = 'grid';

    const unlock = ()=>{
      // unlock audio context if any future fx uses it
      try{
        const AC = WIN.AudioContext || WIN.webkitAudioContext;
        if(AC){
          const ac = new AC();
          if(ac.state === 'suspended') ac.resume();
          // close quickly to avoid leak
          setTimeout(()=>{ try{ ac.close(); }catch(_){} }, 120);
        }
      }catch(_){}

      tap.style.display = 'none';

      // Prevent "page jumped down" after tapping overlay
      try{ WIN.scrollTo(0,0); }catch(_){}
    };

    tapBtn.addEventListener('click', unlock, { passive:true });
    tap.addEventListener('pointerdown', (ev)=>{
      // allow tap anywhere on overlay
      if(ev.target === tap) unlock();
    }, { passive:true });
  }

  function wireRecenterButton(){
    const btn = DOC.getElementById('btnRecenter');
    if(!btn) return;
    btn.addEventListener('click', ()=>{
      try{ WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'brush-boot', ts:Date.now() } })); }catch(_){}
    }, { passive:true });
  }

  function init(){
    ensureBaseNoScrollCSS();
    const view = getView();
    applyViewDataset(view);

    // If user requests view=cvr but forgot in html dataset, this fixes it
    if(view === 'cvr' || view === 'cardboard'){
      try{ DOC.documentElement.dataset.view = 'cvr'; }catch(_){}
    }

    setupTapGate();
    wireRecenterButton();

    // Keep top pinned (some Android browsers jump after address bar hide/show)
    setTimeout(()=>{ try{ WIN.scrollTo(0,0); }catch(_){ } }, 120);
    WIN.addEventListener('orientationchange', ()=>{ setTimeout(()=>{ try{ WIN.scrollTo(0,0); }catch(_){ } }, 200); }, { passive:true });
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }

})();