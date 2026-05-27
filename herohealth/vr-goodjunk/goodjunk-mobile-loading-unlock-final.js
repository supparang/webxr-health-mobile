/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-mobile-loading-unlock-final.js
   PATCH v20260527f-GOODJUNK-MOBILE-LOADING-CARD-BYPASS-FINAL

   FIX:
   - Mobile ค้างที่การ์ด "GoodJunk Solo Boss กำลังเตรียม..."
   - v20260527e โหลดแล้วแต่ยังไม่ลบ card
   - ตัวนี้ลบ card กลางจอโดยตรง + ปลด interaction + กดเริ่มเกมให้อัตโนมัติเมื่อพร้อม
   - ไม่แตะ score / target / powerups / cooldown logic
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260527f-GOODJUNK-MOBILE-LOADING-CARD-BYPASS-FINAL';
  window.__GJ_MOBILE_LOADING_CARD_BYPASS_FINAL__ = VERSION;

  function $(sel, root){
    try{ return (root || document).querySelector(sel); }catch(e){ return null; }
  }

  function $all(sel, root){
    try{ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function txt(el){
    try{
      return (el.innerText || el.textContent || '').replace(/\s+/g,' ').trim();
    }catch(e){
      return '';
    }
  }

  function rect(el){
    try{ return el.getBoundingClientRect(); }catch(e){ return null; }
  }

  function css(el){
    try{ return getComputedStyle(el); }catch(e){ return null; }
  }

  function visible(el){
    const r = rect(el);
    const s = css(el);
    if (!r || !s) return false;
    return (
      r.width > 20 &&
      r.height > 20 &&
      s.display !== 'none' &&
      s.visibility !== 'hidden' &&
      Number(s.opacity || 1) > 0.01
    );
  }

  function kill(el){
    if (!el) return;

    try{
      el.setAttribute('data-gj-loading-killed', VERSION);
      el.style.setProperty('display','none','important');
      el.style.setProperty('visibility','hidden','important');
      el.style.setProperty('opacity','0','important');
      el.style.setProperty('pointer-events','none','important');
      el.style.setProperty('z-index','-999999','important');
      el.style.setProperty('transform','translateY(-99999px) scale(0.01)','important');
    }catch(e){}

    try{
      if (el.parentNode) el.parentNode.removeChild(el);
    }catch(e){}
  }

  function looksLikeLoadingText(t){
    return (
      t &&
      t.indexOf('GoodJunk Solo Boss') >= 0 &&
      (
        t.indexOf('กำลังเตรียม') >= 0 ||
        t.indexOf('อาหารดี') >= 0 ||
        t.indexOf('อาหารขยะ') >= 0 ||
        t.indexOf('ภารกิจโภชนาการ') >= 0
      )
    );
  }

  function killKnownLoading(){
    [
      '#shellLoading',
      '#gjLoading',
      '#gjmLoading',
      '#gjSoloBossLoading',
      '#goodjunkLoading',
      '#goodjunkMobileLoading',
      '.shell-loading',
      '.shell-loading-card',
      '.gj-loading',
      '.gj-loading-card',
      '.gjm-loading',
      '.gjm-loading-card',
      '.loading',
      '.loading-card',
      '.loading-screen',
      '.gj-mobile-loading',
      '.gj-mobile-loading-card',
      '[data-loading]',
      '[data-gj-loading]',
      '[data-role="loading"]'
    ].forEach(function(sel){
      $all(sel).forEach(kill);
    });
  }

  function bestLoadingCardFromNode(el){
    let cur = el;
    let best = el;

    for (let i = 0; i < 10 && cur && cur !== document.body && cur !== document.documentElement; i++){
      const r = rect(cur);
      const s = css(cur);
      const idc = String(cur.id || '') + ' ' + String(cur.className || '');

      if (r && s){
        const centerish =
          r.left > -30 &&
          r.top > -30 &&
          r.right < window.innerWidth + 30 &&
          r.bottom < window.innerHeight + 30;

        const cardish =
          r.width >= 220 &&
          r.width <= window.innerWidth * 0.95 &&
          r.height >= 90 &&
          r.height <= window.innerHeight * 0.72;

        const loadingName = /load|splash|boot|intro|prepare/i.test(idc);

        const positioned =
          s.position === 'fixed' ||
          s.position === 'absolute' ||
          s.position === 'relative';

        if ((centerish && cardish) || loadingName || positioned){
          best = cur;
        }
      }

      cur = cur.parentElement;
    }

    return best;
  }

  function killLoadingByText(){
    $all('body *').forEach(function(el){
      if (!visible(el)) return;

      const t = txt(el);
      if (!looksLikeLoadingText(t)) return;

      kill(bestLoadingCardFromNode(el));
    });
  }

  function killCenteredGoodJunkCard(){
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    $all('body *').forEach(function(el){
      if (!visible(el)) return;

      const r = rect(el);
      if (!r) return;

      const t = txt(el);
      const isGoodJunkCard =
        t.indexOf('GoodJunk Solo Boss') >= 0 &&
        r.width >= 220 &&
        r.height >= 90 &&
        r.width <= window.innerWidth * 0.96 &&
        r.height <= window.innerHeight * 0.75 &&
        r.left < cx &&
        r.right > cx &&
        r.top < cy &&
        r.bottom > cy;

      if (!isGoodJunkCard) return;

      kill(el);
    });
  }

  function killProgressOnlyCard(){
    $all('body *').forEach(function(el){
      if (!visible(el)) return;

      const r = rect(el);
      if (!r) return;

      const t = txt(el);
      if (t.indexOf('GoodJunk Solo Boss') < 0) return;

      const bars = $all('i,span,div', el).filter(function(x){
        const rr = rect(x);
        const ss = css(x);
        if (!rr || !ss) return false;
        return (
          rr.width >= 40 &&
          rr.height >= 4 &&
          rr.height <= 24 &&
          (
            String(ss.background || '').includes('gradient') ||
            ss.borderRadius !== '0px'
          )
        );
      });

      if (bars.length){
        kill(el);
      }
    });
  }

  function injectForceCss(){
    if ($('#gjMobileLoadingBypassStyle')) return;

    const st = document.createElement('style');
    st.id = 'gjMobileLoadingBypassStyle';
    st.textContent = `
      #shellLoading,
      #gjLoading,
      #gjmLoading,
      #gjSoloBossLoading,
      #goodjunkLoading,
      #goodjunkMobileLoading,
      .shell-loading,
      .shell-loading-card,
      .gj-loading,
      .gj-loading-card,
      .gjm-loading,
      .gjm-loading-card,
      .loading-screen,
      .gj-mobile-loading,
      .gj-mobile-loading-card,
      [data-loading],
      [data-gj-loading],
      [data-role="loading"]{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
        z-index:-999999 !important;
      }

      #gjSoloBossMain,
      #gjSoloBossArea,
      .gjm-root,
      .gjm-area{
        display:block !important;
        visibility:visible !important;
        opacity:1 !important;
        pointer-events:auto !important;
      }

      #gjmStartOverlay{
        visibility:visible !important;
        opacity:1 !important;
        pointer-events:auto !important;
      }

      #gjmStartBtn{
        visibility:visible !important;
        opacity:1 !important;
        pointer-events:auto !important;
      }
    `;

    try{ document.head.appendChild(st); }catch(e){}
  }

  function unlockMainLayers(){
    [
      '#gjSoloBossMain',
      '#gjSoloBossArea',
      '.gjm-root',
      '.gjm-area'
    ].forEach(function(sel){
      $all(sel).forEach(function(el){
        try{
          el.style.setProperty('display','block','important');
          el.style.setProperty('visibility','visible','important');
          el.style.setProperty('opacity','1','important');
          el.style.setProperty('pointer-events','auto','important');
          el.style.setProperty('transform','none','important');
        }catch(e){}
      });
    });

    const start = $('#gjmStartOverlay');
    const btn = $('#gjmStartBtn');

    if (start){
      try{
        start.style.setProperty('display','grid','important');
        start.style.setProperty('visibility','visible','important');
        start.style.setProperty('opacity','1','important');
        start.style.setProperty('pointer-events','auto','important');
        start.style.setProperty('z-index','80','important');
      }catch(e){}
    }

    if (btn){
      try{
        btn.style.setProperty('display','inline-block','important');
        btn.style.setProperty('visibility','visible','important');
        btn.style.setProperty('opacity','1','important');
        btn.style.setProperty('pointer-events','auto','important');
      }catch(e){}
    }
  }

  function autoStartIfOnlyLoadingWasBlocking(){
    const btn = $('#gjmStartBtn');
    const start = $('#gjmStartOverlay');

    if (!btn || !start) return;

    const run = new URLSearchParams(location.search || '').get('run');
    const phase = new URLSearchParams(location.search || '').get('phase');

    if (run === 'menu') return;
    if (phase === 'summary' || phase === 'cooldown') return;

    const already = window.__GJ_MOBILE_AUTO_START_DONE__;
    if (already) return;

    window.__GJ_MOBILE_AUTO_START_DONE__ = true;

    setTimeout(function(){
      try{
        if (document.body.contains(btn)){
          btn.click();
          console.info('[GoodJunk Mobile Loading Bypass] auto clicked start');
        }
      }catch(e){}
    }, 350);
  }

  function hardBypass(){
    injectForceCss();
    killKnownLoading();
    killLoadingByText();
    killCenteredGoodJunkCard();
    killProgressOnlyCard();
    unlockMainLayers();
    autoStartIfOnlyLoadingWasBlocking();
  }

  function boot(){
    hardBypass();

    [
      40,80,140,220,350,500,700,900,
      1200,1500,1800,2200,2800,3500,
      4500,6000,8000,10000,13000
    ].forEach(function(ms){
      setTimeout(hardBypass, ms);
    });

    let n = 0;
    const timer = setInterval(function(){
      n++;
      hardBypass();
      if (n >= 120) clearInterval(timer);
    }, 250);

    try{
      const mo = new MutationObserver(function(){
        hardBypass();
      });

      mo.observe(document.documentElement || document.body, {
        childList:true,
        subtree:true,
        attributes:true,
        attributeFilter:['class','style','id']
      });

      setTimeout(function(){
        try{ mo.disconnect(); }catch(e){}
      }, 25000);
    }catch(e){}

    window.addEventListener('pageshow', hardBypass, true);
    window.addEventListener('focus', hardBypass, true);
    document.addEventListener('visibilitychange', hardBypass, true);
    document.addEventListener('pointerdown', hardBypass, true);
    document.addEventListener('touchstart', hardBypass, true);

    console.info('[GoodJunk Mobile Loading Card Bypass]', VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
