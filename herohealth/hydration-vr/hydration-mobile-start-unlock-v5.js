// === /herohealth/hydration-vr/hydration-mobile-start-unlock-v5.js ===
// PATCH v20260610-HYDRATION-MOBILE-START-UNLOCK-V5
// Fix mobile stuck on Aqua Rush intro because start button is below viewport / hidden by browser nav.

(function(){
  'use strict';

  var PATCH = 'HYDRATION_MOBILE_START_UNLOCK_V5_20260610';

  var page = String(location.pathname + ' ' + location.search + ' ' + document.title).toLowerCase();
  if(page.indexOf('hydration') === -1) return;

  var qs = new URLSearchParams(location.search || '');
  var view = String(qs.get('view') || '').toLowerCase();

  var isMobile =
    view === 'mobile' ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

  if(!isMobile) return;
  if(window.__HYDRATION_MOBILE_START_UNLOCK_V5__) return;
  window.__HYDRATION_MOBILE_START_UNLOCK_V5__ = true;

  var STYLE_ID = 'hydrationMobileStartUnlockV5Style';

  function ready(fn){
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', fn, { once:true });
    }else{
      fn();
    }
  }

  function txt(el){
    if(!el) return '';
    return String([
      el.id || '',
      typeof el.className === 'string' ? el.className : '',
      el.getAttribute && el.getAttribute('aria-label'),
      el.getAttribute && el.getAttribute('title'),
      el.textContent || ''
    ].filter(Boolean).join(' ')).replace(/\s+/g, ' ').trim();
  }

  function low(el){
    return txt(el).toLowerCase();
  }

  function rect(el){
    try{
      return el.getBoundingClientRect();
    }catch(e){
      return null;
    }
  }

  function visible(el){
    if(!el || !el.isConnected) return false;
    var r = rect(el);
    if(!r || r.width < 4 || r.height < 4) return false;
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0.02;
  }

  function injectStyle(){
    if(document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html,
      body {
        height: 100% !important;
        min-height: 100% !important;
        overflow: auto !important;
        touch-action: manipulation !important;
        overscroll-behavior: contain !important;
      }

      body.hha-view-mobile,
      body[data-view="mobile"] {
        overflow: auto !important;
      }

      body.hha-view-mobile .hha-hydration-app,
      body[data-view="mobile"] .hha-hydration-app,
      body.hha-view-mobile .hha-hydration-stage,
      body[data-view="mobile"] .hha-hydration-stage {
        min-height: 100dvh !important;
        height: auto !important;
        overflow: visible !important;
      }

      body.hha-view-mobile .hha-hydration-playfield,
      body[data-view="mobile"] .hha-hydration-playfield {
        min-height: 100dvh !important;
        height: auto !important;
        overflow: visible !important;
        padding-bottom: calc(120px + env(safe-area-inset-bottom, 0px)) !important;
      }

      body.hha-view-mobile .hha-hydration-start,
      body.hha-view-mobile .hha-start,
      body.hha-view-mobile .hha-solo-start,
      body.hha-view-mobile [data-hha-hydration-start],
      body[data-view="mobile"] .hha-hydration-start,
      body[data-view="mobile"] .hha-start,
      body[data-view="mobile"] .hha-solo-start,
      body[data-view="mobile"] [data-hha-hydration-start] {
        max-height: none !important;
        height: auto !important;
        overflow: visible !important;
        padding-bottom: calc(132px + env(safe-area-inset-bottom, 0px)) !important;
      }

      body.hha-view-mobile .hha-mobile-start-clone-v5 {
        position: fixed !important;
        left: 18px !important;
        right: 18px !important;
        bottom: calc(18px + env(safe-area-inset-bottom, 0px)) !important;
        z-index: 2147483647 !important;
        border: 0 !important;
        border-radius: 24px !important;
        padding: 16px 18px !important;
        background: linear-gradient(180deg,#43c7ff,#2388ff) !important;
        color: white !important;
        font: 1000 20px/1.1 system-ui,-apple-system,Segoe UI,sans-serif !important;
        box-shadow: 0 18px 44px rgba(14,116,190,.32) !important;
        cursor: pointer !important;
        touch-action: manipulation !important;
      }

      body.hha-view-mobile .hydration-start-v5-badge {
        position: fixed !important;
        right: 10px !important;
        bottom: calc(82px + env(safe-area-inset-bottom, 0px)) !important;
        z-index: 2147483647 !important;
        background: rgba(255,255,255,.86) !important;
        border: 1px solid rgba(14,165,233,.75) !important;
        color: #0f3a52 !important;
        border-radius: 999px !important;
        padding: 7px 10px !important;
        font: 900 10px/1.1 system-ui,-apple-system,Segoe UI,sans-serif !important;
        box-shadow: 0 10px 24px rgba(14,165,233,.22) !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function findStartButton(){
    var selectors = [
      '.hha-hydration-start button',
      '.hha-start button',
      '.hha-solo-start button',
      '[data-hha-hydration-start] button',
      '.hha-start-btn',
      '.hha-solo-start-btn',
      '[data-hha-start]',
      '[data-start]',
      'button'
    ];

    var all = [];
    selectors.forEach(function(sel){
      try{
        document.querySelectorAll(sel).forEach(function(el){
          if(all.indexOf(el) === -1) all.push(el);
        });
      }catch(e){}
    });

    for(var i = 0; i < all.length; i++){
      var el = all[i];
      if(!visible(el)) continue;

      var s = low(el);
      if(
        s.indexOf('เริ่ม') !== -1 ||
        s.indexOf('เล่น') !== -1 ||
        s.indexOf('start') !== -1 ||
        s.indexOf('play') !== -1 ||
        s.indexOf('go') !== -1
      ){
        return el;
      }
    }

    return null;
  }

  function makeClone(){
    if(document.querySelector('.hha-mobile-start-clone-v5')) return;

    var realBtn = findStartButton();
    if(!realBtn) return;

    var clone = document.createElement('button');
    clone.type = 'button';
    clone.className = 'hha-mobile-start-clone-v5';
    clone.textContent = 'เริ่มเล่น Aqua Rush';

    clone.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();

      try{
        realBtn.scrollIntoView({ block:'center', inline:'center' });
      }catch(err){}

      setTimeout(function(){
        try{
          realBtn.click();
        }catch(err){
          if(typeof window.beginHydrationFromOverlay === 'function'){
            window.beginHydrationFromOverlay();
          }else if(typeof window.HHA_HYDRATION_FORCE_START === 'function'){
            window.HHA_HYDRATION_FORCE_START();
          }
        }
      }, 60);
    }, true);

    document.body.appendChild(clone);
  }

  function addBadge(){
    if(document.querySelector('.hydration-start-v5-badge')) return;

    var b = document.createElement('div');
    b.className = 'hydration-start-v5-badge';
    b.textContent = 'HYD START V5';
    document.body.appendChild(b);

    setTimeout(function(){
      try{ b.style.opacity = '.25'; }catch(e){}
    }, 4000);
  }

  function pulse(){
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    makeClone();
  }

  ready(function(){
    injectStyle();
    addBadge();

    setInterval(pulse, 650);
    setTimeout(pulse, 100);
    setTimeout(pulse, 400);
    setTimeout(pulse, 900);
    setTimeout(pulse, 1500);
    setTimeout(pulse, 2500);

    console.info('[HeroHealth]', PATCH, 'active');
  });
})();