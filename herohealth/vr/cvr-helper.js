// === /herohealth/vr/cvr-helper.js ===
// HHA cVR + Cardboard helpers (FULLSCREEN / ORIENTATION / SAFEZONE / RECENTER)
// Works with: view=cvr, view=cardboard (split), plus any game that emits hha:shoot.
// Adds:
//  - window.HHA_CVR.safeInset -> reserved UI inset to avoid overlapping Enter VR button
//  - overlay hint + long-press to recenter (hha:recenter)
//  - optional fullscreen+landscape lock on start gesture

'use strict';

(function(root){
  const DOC = root.document;
  if (!DOC) return;

  const qs=(k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const view = String(qs('view','')).toLowerCase();
  const isCVR = (view==='cvr' || DOC.body.classList.contains('view-cvr'));
  const isCB  = (view==='cardboard' || DOC.body.classList.contains('cardboard'));

  // ---------- Safe inset to avoid Enter VR overlay (bottom-right) ----------
  // Most browsers place "Enter VR" around bottom-right; reserve that corner.
  const SAFE = {
    // percent-based inset (works across resolutions)
    rightPct: 18,  // reserve ~18% width on right
    bottomPct: 22, // reserve ~22% height at bottom
    enabled: true
  };
  root.HHA_CVR = root.HHA_CVR || {};
  root.HHA_CVR.safeInset = SAFE;

  function injectStyle(){
    if (DOC.getElementById('hha-cvr-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-cvr-style';
    st.textContent = `
      /* Reserve bottom-right so HUD won't block browser Enter VR */
      :root{
        --hha-enter-safe-right: ${SAFE.rightPct}vw;
        --hha-enter-safe-bottom: ${SAFE.bottomPct}vh;
      }

      body.hha-safe-enter .hud{
        padding-right: calc(12px + var(--sar) + var(--hha-enter-safe-right));
        padding-bottom: calc(12px + var(--sab) + var(--hha-enter-safe-bottom));
      }

      /* Make any overlay respect safe corner too */
      body.hha-safe-enter #startOverlay,
      body.hha-safe-enter #resultBackdrop{
        padding-right: calc(18px + var(--sar) + var(--hha-enter-safe-right));
        padding-bottom: calc(18px + var(--sab) + var(--hha-enter-safe-bottom));
      }

      /* Recenter hint overlay */
      .hha-recenter-hint{
        position:fixed;
        left:50%;
        top: calc(12px + var(--sat));
        transform: translateX(-50%);
        z-index: 160;
        pointer-events:none;
        padding: 8px 12px;
        border-radius: 999px;
        font: 900 12px/1.2 system-ui;
        color: rgba(229,231,235,.95);
        background: rgba(2,6,23,.70);
        border: 1px solid rgba(148,163,184,.18);
        backdrop-filter: blur(10px);
        box-shadow: 0 18px 70px rgba(0,0,0,.40);
        opacity: 0;
        transition: opacity .2s ease;
        white-space: nowrap;
      }
      body.hha-recenter-on .hha-recenter-hint{ opacity: .95; }

      /* Long-press detector area (invisible) */
      .hha-recenter-zone{
        position:fixed;
        left: 0;
        top: 0;
        width: 100%;
        height: 18vh; /* top band */
        z-index: 150;
        pointer-events:auto;
        background: transparent;
        touch-action: none;
      }
    `;
    DOC.head.appendChild(st);
  }

  injectStyle();

  // Turn on safe-enter behavior for cVR or Cardboard (where Enter VR button matters)
  if (isCVR || isCB){
    DOC.body.classList.add('hha-safe-enter');
  }

  // ---------- Fullscreen / orientation lock ----------
  async function enterFull(){
    try{
      const el = DOC.documentElement;
      if (!DOC.fullscreenElement && el.requestFullscreen){
        await el.requestFullscreen({navigationUI:'hide'});
      }
    }catch(_){}
    try{
      if (screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
      }
    }catch(_){}
  }

  // Provide helper you can call from overlay buttons
  root.HHA_enterFull = enterFull;

  // If query says fs=1, attempt once (needs user gesture in many browsers)
  // We'll only run it on first pointerdown.
  const wantFS = String(qs('fs','')) === '1';
  if (wantFS){
    const once = async ()=>{
      DOC.removeEventListener('pointerdown', once, true);
      await enterFull();
    };
    DOC.addEventListener('pointerdown', once, true);
  }

  // ---------- Recenter helper (long press on top band) ----------
  function mountRecenter(){
    if (!(isCVR || isCB)) return;

    // hint
    if (!DOC.querySelector('.hha-recenter-hint')){
      const hint = DOC.createElement('div');
      hint.className = 'hha-recenter-hint';
      hint.textContent = '📍 แตะค้างด้านบน 1 วินาที = RECENTER';
      DOC.body.appendChild(hint);
    }

    // zone
    if (DOC.querySelector('.hha-recenter-zone')) return;
    const zone = DOC.createElement('div');
    zone.className = 'hha-recenter-zone';
    DOC.body.appendChild(zone);

    let t0=0, timer=null, pressed=false;

    function fire(){
      DOC.body.classList.remove('hha-recenter-on');
      try{ root.dispatchEvent(new CustomEvent('hha:recenter')); }catch(_){}
      // optional: haptic tick
      try{ navigator.vibrate?.(25); }catch(_){}
    }

    function clear(){
      pressed=false;
      t0=0;
      if (timer){ clearTimeout(timer); timer=null; }
      DOC.body.classList.remove('hha-recenter-on');
    }

    zone.addEventListener('pointerdown', (ev)=>{
      pressed=true;
      t0=performance.now();
      DOC.body.classList.add('hha-recenter-on');
      timer=setTimeout(()=>{ if(pressed) fire(); }, 1000);
      try{ zone.setPointerCapture(ev.pointerId); }catch(_){}
      ev.preventDefault();
    }, {passive:false});

    zone.addEventListener('pointerup', (ev)=>{ clear(); ev.preventDefault(); }, {passive:false});
    zone.addEventListener('pointercancel', ()=>clear(), {passive:true});
  }

  mountRecenter();

})(window);