/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-mobile-blank-recover-final.js
   PATCH v20260527a-GOODJUNK-MOBILE-BLANK-RECOVER-FINAL

   FIX:
   - แก้จอว่างหลังปลด loading
   - ไม่ลบ DOM กว้าง ๆ
   - ไม่ยุ่ง score / target / powerups / cooldown
   - ถ้าไม่มี start overlay ให้สร้างปุ่มเริ่มเล่นฉุกเฉิน
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260527a-GOODJUNK-MOBILE-BLANK-RECOVER-FINAL';
  window.__GJ_MOBILE_BLANK_RECOVER_FINAL__ = VERSION;

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

  function hideOnlyLoading(){
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
      $all(sel).forEach(function(el){
        try{
          el.style.setProperty('display','none','important');
          el.style.setProperty('visibility','hidden','important');
          el.style.setProperty('opacity','0','important');
          el.style.setProperty('pointer-events','none','important');
        }catch(e){}
      });
    });
  }

  function recoverMain(){
    show($('#gjSoloBossMain'), 'block');
    show($('#gjSoloBossArea'), 'block');

    $all('.gjm-root').forEach(function(el){ show(el, 'block'); });
    $all('.gjm-area').forEach(function(el){ show(el, 'block'); });

    const overlay = $('#gjmStartOverlay');
    const btn = $('#gjmStartBtn');

    if (overlay){
      show(overlay, 'grid');
      try{ overlay.style.setProperty('z-index','1000','important'); }catch(e){}
    }

    if (btn){
      show(btn, 'inline-block');
      try{ btn.disabled = false; }catch(e){}
    }
  }

  function makeRecoverButton(){
    if ($('#gjRecoverStartBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'gjRecoverStartBtn';
    btn.type = 'button';
    btn.textContent = '▶ เริ่มเล่น GoodJunk';
    btn.style.cssText = [
      'position:fixed',
      'left:50%',
      'top:50%',
      'transform:translate(-50%,-50%)',
      'z-index:999999',
      'border:0',
      'border-radius:999px',
      'padding:16px 26px',
      'background:linear-gradient(135deg,#22c55e,#2563eb)',
      'color:#fff',
      'font-weight:1000',
      'font-size:18px',
      'box-shadow:0 18px 42px rgba(15,23,42,.28)'
    ].join(';');

    btn.addEventListener('click', function(){
      hideOnlyLoading();
      recoverMain();

      const realBtn = $('#gjmStartBtn');

      if (realBtn){
        try{
          realBtn.click();
        }catch(e){}
      }else{
        try{
          window.dispatchEvent(new Event('gj:start'));
          window.dispatchEvent(new Event('goodjunk:start'));
          window.dispatchEvent(new Event('gjm:start'));
        }catch(e){}
      }

      try{
        btn.style.display = 'none';
      }catch(e){}
    });

    document.body.appendChild(btn);
  }

  function isBlankScreen(){
    const main = $('#gjSoloBossMain');
    const area = $('#gjSoloBossArea');
    const start = $('#gjmStartOverlay');

    if (!main && !area && !start) return true;

    const visibleCards = $all('button,.gjm-start,.gjm-start-card,.gjpu-item,.gjm-pill').filter(function(el){
      try{
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 20 && r.height > 20 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0;
      }catch(e){
        return false;
      }
    });

    return visibleCards.length === 0;
  }

  function recover(){
    hideOnlyLoading();
    recoverMain();

    if (isBlankScreen()){
      makeRecoverButton();
    }else{
      const startBtn = $('#gjmStartBtn');
      if (startBtn) makeRecoverButton();
    }
  }

  function boot(){
    recover();

    [200,500,900,1400,2200,3500,5000].forEach(function(ms){
      setTimeout(recover, ms);
    });

    console.info('[GoodJunk Mobile Blank Recover]', VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();