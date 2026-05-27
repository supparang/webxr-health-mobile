/* =========================================================
   HeroHealth Hydration Solo Cardboard/cVR Polish Patch
   File: /herohealth/hydration-vr/hydration-solo-cvr-pack45.patch.js
   Version: v20260527-pack45-cvr-polish

   Purpose:
   - Improve Cardboard/cVR feeling for Hydration Solo Clean Core
   - Adds cVR aim helper, reticle feedback, scan pulse, tap-to-shoot fallback
   - Keeps PC/Mobile unaffected
   - Designed to load AFTER Pack41/42/43/44
   - Does NOT depend on old hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var VERSION = 'v20260527-pack45-cvr-polish';

  if(window.HHA_HYDRATION_SOLO_CVR_PACK45){
    console.warn('[Hydration Solo cVR Pack45] already loaded');
    return;
  }

  window.HHA_HYDRATION_SOLO_CVR_PACK45 = true;

  function q(sel, root){
    try{ return (root || document).querySelector(sel); }
    catch(e){ return null; }
  }

  function qa(sel, root){
    try{ return Array.from((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function currentView(){
    var ctx = window.HHA_HYDRATION_RUN_CONTEXT || {};
    return String(ctx.view || document.body.dataset.view || '').toLowerCase();
  }

  function isCvr(){
    return currentView() === 'cvr' || document.body.classList.contains('hha-view-cvr');
  }

  function injectStyle(){
    if(q('#hha-hydration-solo-cvr-pack45-css')) return;

    var style = document.createElement('style');
    style.id = 'hha-hydration-solo-cvr-pack45-css';
    style.textContent = `
      body.hha-view-cvr{
        overscroll-behavior:none;
        touch-action:manipulation;
      }

      body.hha-view-cvr .hha-solo-hud{
        transform:scale(.86);
        transform-origin:top left;
        max-width:620px;
      }

      body.hha-view-cvr .hha-solo-topbar{
        top:calc(112px + env(safe-area-inset-top,0px));
        width:min(350px,50vw);
      }

      body.hha-view-cvr .hha-boss42-panel{
        top:calc(160px + env(safe-area-inset-top,0px));
        width:min(390px,58vw);
      }

      body.hha-view-cvr .hha-balance43-chip{
        top:calc(224px + env(safe-area-inset-top,0px));
      }

      .hha-cvr45-reticle{
        position:fixed;
        left:50%;
        top:50%;
        z-index:21000;
        width:56px;
        height:56px;
        transform:translate(-50%,-50%);
        pointer-events:none;
        display:none;
      }

      body.hha-view-cvr .hha-cvr45-reticle{
        display:block;
      }

      .hha-cvr45-reticle::before,
      .hha-cvr45-reticle::after{
        content:'';
        position:absolute;
        background:#24536f;
        border-radius:999px;
        opacity:.9;
      }

      .hha-cvr45-reticle::before{
        left:50%;
        top:0;
        width:4px;
        height:100%;
        transform:translateX(-50%);
      }

      .hha-cvr45-reticle::after{
        top:50%;
        left:0;
        height:4px;
        width:100%;
        transform:translateY(-50%);
      }

      .hha-cvr45-ring{
        position:absolute;
        inset:8px;
        border-radius:999px;
        border:4px solid #43c7ff;
        background:rgba(255,255,255,.22);
        box-shadow:0 0 0 4px rgba(67,199,255,.16),0 10px 24px rgba(30,75,115,.20);
      }

      .hha-cvr45-reticle.lock .hha-cvr45-ring{
        border-color:#62e68f;
        box-shadow:0 0 0 7px rgba(98,230,143,.22),0 0 28px rgba(98,230,143,.38);
        animation:hhaCvr45LockPulse .48s ease-in-out infinite alternate;
      }

      .hha-cvr45-reticle.danger .hha-cvr45-ring{
        border-color:#ff996f;
        box-shadow:0 0 0 7px rgba(255,153,111,.20),0 0 28px rgba(255,96,96,.28);
      }

      @keyframes hhaCvr45LockPulse{
        from{ transform:scale(.94); }
        to{ transform:scale(1.08); }
      }

      .hha-cvr45-hint{
        position:fixed;
        left:50%;
        bottom:calc(24px + env(safe-area-inset-bottom,0px));
        z-index:21001;
        transform:translateX(-50%);
        width:min(430px,84vw);
        padding:10px 14px;
        border-radius:999px;
        background:rgba(255,255,255,.93);
        border:2px solid #d7f3ff;
        box-shadow:0 14px 34px rgba(30,75,115,.18);
        color:#24445c;
        text-align:center;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
        transition:.2s ease;
      }

      body.hha-view-cvr .hha-cvr45-hint.show{
        opacity:1;
        transform:translateX(-50%) translateY(-3px);
      }

      .hha-cvr45-scan{
        position:fixed;
        left:50%;
        top:50%;
        z-index:20990;
        width:120px;
        height:120px;
        border-radius:999px;
        transform:translate(-50%,-50%);
        pointer-events:none;
        border:2px dashed rgba(67,199,255,.38);
        display:none;
        animation:hhaCvr45Scan 2.4s linear infinite;
      }

      body.hha-view-cvr .hha-cvr45-scan{
        display:block;
      }

      @keyframes hhaCvr45Scan{
        from{ transform:translate(-50%,-50%) rotate(0deg); }
        to{ transform:translate(-50%,-50%) rotate(360deg); }
      }

      body.hha-view-cvr .hha-solo-target,
      body.hha-view-cvr .hha-hydration-target{
        width:82px !important;
        min-height:96px !important;
        border-width:4px !important;
        box-shadow:0 18px 42px rgba(30,75,115,.24);
      }

      body.hha-view-cvr .hha-solo-target.cvr45-aim-lock,
      body.hha-view-cvr .hha-hydration-target.cvr45-aim-lock{
        box-shadow:0 18px 42px rgba(30,75,115,.24),0 0 0 7px rgba(98,230,143,.20),0 0 34px rgba(98,230,143,.35);
        transform:scale(1.05);
      }

      body.hha-view-cvr .hha-solo-target.cvr45-aim-danger,
      body.hha-view-cvr .hha-hydration-target.cvr45-aim-danger{
        box-shadow:0 18px 42px rgba(30,75,115,.24),0 0 0 7px rgba(255,153,111,.18),0 0 34px rgba(255,96,96,.24);
      }
    `;

    document.head.appendChild(style);
  }

  function ensureUi(){
    if(q('.hha-cvr45-reticle')) return;

    var reticle = document.createElement('div');
    reticle.className = 'hha-cvr45-reticle';
    reticle.innerHTML = '<span class="hha-cvr45-ring"></span>';
    document.body.appendChild(reticle);

    var scan = document.createElement('div');
    scan.className = 'hha-cvr45-scan';
    document.body.appendChild(scan);

    var hint = document.createElement('div');
    hint.className = 'hha-cvr45-hint';
    hint.textContent = 'เล็งเป้าที่วงเขียว แล้วแตะจอเพื่อเก็บน้ำ';
    document.body.appendChild(hint);
  }

  function centerTarget(){
    var cx = (window.innerWidth || 0) / 2;
    var cy = (window.innerHeight || 0) / 2;
    var best = null;
    var bestD = Infinity;

    qa('.hha-solo-target, .hha-hydration-target').forEach(function(t){
      if(!t || !t.isConnected) return;
      var r = t.getBoundingClientRect();
      if(r.width <= 0 || r.height <= 0) return;

      var tx = r.left + r.width / 2;
      var ty = r.top + r.height / 2;
      var d = Math.hypot(tx - cx, ty - cy);
      var pad = 60;

      if(
        cx >= r.left - pad &&
        cx <= r.right + pad &&
        cy >= r.top - pad &&
        cy <= r.bottom + pad &&
        d < bestD
      ){
        best = t;
        bestD = d;
      }
    });

    return best;
  }

  function updateAim(){
    if(!isCvr()) return;
    ensureUi();

    var reticle = q('.hha-cvr45-reticle');
    var hint = q('.hha-cvr45-hint');
    var target = centerTarget();

    qa('.hha-solo-target, .hha-hydration-target').forEach(function(t){
      t.classList.remove('cvr45-aim-lock','cvr45-aim-danger');
    });

    if(!reticle) return;

    reticle.classList.remove('lock','danger');

    if(target){
      var good = target.dataset.good === '1';
      reticle.classList.add(good ? 'lock' : 'danger');
      target.classList.add(good ? 'cvr45-aim-lock' : 'cvr45-aim-danger');
      if(hint){
        hint.textContent = good ? 'แตะจอเพื่อเก็บน้ำดี!' : 'ระวัง! เป้านี้ทำให้ Hydration ลด';
        hint.classList.add('show');
      }
    }else if(hint){
      hint.textContent = 'เล็งเป้าที่วงเขียว แล้วแตะจอเพื่อเก็บน้ำ';
      hint.classList.add('show');
    }
  }

  function bindShootFallback(){
    document.addEventListener('click', function(ev){
      if(!isCvr()) return;
      if(ev.target && ev.target.closest && ev.target.closest('button,a,input,.hha-solo-summary,.hha-solo-start,.hha-solo-controls,.hha-sfx44-toggle')) return;

      try{
        window.dispatchEvent(new CustomEvent('hha:shoot', { detail:{ source:'pack45-cvr-click' } }));
      }catch(e){}
    }, true);
  }

  function loop(){
    setInterval(function(){
      try{ updateAim(); }catch(e){}
    }, 120);
  }

  function boot(){
    injectStyle();
    ensureUi();
    bindShootFallback();
    loop();
    console.info('[Hydration Solo cVR Pack45] loaded', VERSION, { view:currentView() });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
