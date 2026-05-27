/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-mobile-force-start-button-final.js
   PATCH v20260527a-GOODJUNK-MOBILE-FORCE-START-BUTTON-FINAL

   PURPOSE:
   - แก้จอว่าง / overlay หาย / ปุ่มเริ่มเดิมกดไม่ติด
   - ไม่ลบ DOM เกม
   - ไม่ซ่อน main
   - ไม่แตะ score / target / powerups / cooldown
   - สร้างปุ่มเริ่มเล่นกลางจอแบบปลอดภัยเสมอ
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260527a-GOODJUNK-MOBILE-FORCE-START-BUTTON-FINAL';
  window.__GJ_MOBILE_FORCE_START_BUTTON_FINAL__ = VERSION;

  function $(sel){
    try{ return document.querySelector(sel); }catch(e){ return null; }
  }

  function $all(sel){
    try{ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function show(el, display){
    if (!el) return;
    try{
      el.style.setProperty('display', display || 'block', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('pointer-events', 'auto', 'important');
      el.style.setProperty('transform', 'none', 'important');
    }catch(e){}
  }

  function hide(el){
    if (!el) return;
    try{
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    }catch(e){}
  }

  function removeOnlyLoading(){
    [
      '#shellLoading',
      '.shell-loading',
      '.shell-loading-card',
      '#goodjunkMobileLoading',
      '.gj-mobile-loading',
      '.gj-mobile-loading-card',
      '.loading-screen',
      '[data-loading]',
      '[data-gj-loading]'
    ].forEach(function(sel){
      $all(sel).forEach(hide);
    });
  }

  function restoreGameDom(){
    show($('#gjSoloBossMain'), 'block');
    show($('#gjSoloBossArea'), 'block');
    $all('.gjm-root').forEach(function(el){ show(el, 'block'); });
    $all('.gjm-area').forEach(function(el){ show(el, 'block'); });

    const hud = $('#gjmHud');
    if (hud) show(hud, 'grid');
  }

  function getApi(){
    return window.GoodJunkSoloBossMain ||
           window.GJSBM ||
           window.GJ_SOLO_BOSS_MAIN ||
           null;
  }

  function tryStartByApi(){
    const api = getApi();

    if (api && typeof api.startGame === 'function'){
      try{
        api.startGame({
          manual:true,
          source:'force-start-button',
          patch:VERSION
        });
        return true;
      }catch(e){
        console.warn('[GoodJunk Force Start] api.startGame failed', e);
      }
    }

    return false;
  }

  function tryStartByButton(){
    const btn = $('#gjmStartBtn');

    if (btn){
      try{
        btn.disabled = false;
        show(btn, 'inline-block');
        btn.click();
        return true;
      }catch(e){
        console.warn('[GoodJunk Force Start] real button click failed', e);
      }
    }

    return false;
  }

  function tryStartByEvents(){
    try{
      window.dispatchEvent(new CustomEvent('gj:start', { detail:{ source:'force-start-button', patch:VERSION } }));
      window.dispatchEvent(new CustomEvent('goodjunk:start', { detail:{ source:'force-start-button', patch:VERSION } }));
      window.dispatchEvent(new CustomEvent('gjm:start', { detail:{ source:'force-start-button', patch:VERSION } }));
      document.dispatchEvent(new CustomEvent('gj:start', { detail:{ source:'force-start-button', patch:VERSION } }));
      return true;
    }catch(e){
      return false;
    }
  }

  function forceStart(){
    removeOnlyLoading();
    restoreGameDom();

    const started =
      tryStartByApi() ||
      tryStartByButton() ||
      tryStartByEvents();

    hide($('#gjmStartOverlay'));

    const panel = $('#gjForceStartPanel');
    if (panel) hide(panel);

    setTimeout(function(){
      removeOnlyLoading();
      restoreGameDom();
      hide($('#gjmStartOverlay'));
    }, 200);

    console.info('[GoodJunk Mobile Force Start]', VERSION, 'started=', started);
  }

  function makeForcePanel(){
    if ($('#gjForceStartPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'gjForceStartPanel';
    panel.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:999999',
      'display:grid',
      'place-items:center',
      'padding:22px',
      'background:linear-gradient(180deg,rgba(220,252,231,.92),rgba(254,243,199,.92))',
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    ].join(';');

    panel.innerHTML = `
      <div style="
        width:min(520px,calc(100vw - 34px));
        border-radius:30px;
        padding:26px 22px;
        text-align:center;
        background:rgba(255,255,255,.95);
        border:3px solid rgba(255,255,255,.98);
        box-shadow:0 24px 70px rgba(15,23,42,.22);
      ">
        <div style="font-size:58px;line-height:1;">🥗👾</div>
        <h1 style="margin:10px 0 0;color:#0f172a;font-size:clamp(34px,9vw,52px);line-height:1.04;">
          GoodJunk Solo Boss
        </h1>
        <p style="margin:12px auto 0;max-width:390px;color:#475569;font-weight:900;font-size:18px;line-height:1.35;">
          พร้อมแล้ว กดเริ่มเพื่อเข้าเกม
        </p>
        <button id="gjForceStartBtn" type="button" style="
          margin-top:22px;
          border:0;
          border-radius:999px;
          padding:17px 30px;
          background:linear-gradient(135deg,#22c55e,#2563eb);
          color:white;
          font-size:22px;
          font-weight:1000;
          box-shadow:0 16px 36px rgba(37,99,235,.28);
        ">▶ เริ่มเล่น</button>
      </div>
    `;

    document.body.appendChild(panel);

    const btn = $('#gjForceStartBtn');
    if (btn){
      btn.addEventListener('click', function(ev){
        try{
          ev.preventDefault();
          ev.stopPropagation();
        }catch(e){}
        forceStart();
      }, true);

      btn.addEventListener('touchend', function(ev){
        try{
          ev.preventDefault();
          ev.stopPropagation();
        }catch(e){}
        forceStart();
      }, true);
    }
  }

  function boot(){
    removeOnlyLoading();
    restoreGameDom();
    makeForcePanel();

    [300,800,1500,2500].forEach(function(ms){
      setTimeout(function(){
        removeOnlyLoading();
        restoreGameDom();
        makeForcePanel();
      }, ms);
    });

    console.info('[GoodJunk Mobile Force Start Button]', VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
