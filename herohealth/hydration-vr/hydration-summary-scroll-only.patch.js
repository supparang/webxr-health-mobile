/* =========================================================
   HeroHealth Hydration Summary Scroll Only Patch
   File: /herohealth/hydration-vr/hydration-summary-scroll-only.patch.js
   Version: v20260519-pack31-summary-scroll-only

   Purpose:
   - แก้ Summary โดนตัด / เลื่อนลงไม่สุด
   - ไม่แตะปุ่ม Start
   - ไม่แตะ gameplay
   - ไม่แตะ cVR
   - ไม่ดัก event เริ่มเกม
   ========================================================= */

(function(){
  'use strict';

  var PATCH = 'v20260519-pack31-summary-scroll-only';

  if(window.HHA_HYDRATION_SUMMARY_SCROLL_ONLY_PACK31){
    return;
  }

  window.HHA_HYDRATION_SUMMARY_SCROLL_ONLY_PACK31 = true;

  function q(sel, root){
    try{
      return (root || document).querySelector(sel);
    }catch(e){
      return null;
    }
  }

  function qa(sel, root){
    try{
      return Array.from((root || document).querySelectorAll(sel));
    }catch(e){
      return [];
    }
  }

  function isStartOpen(){
    return !!q('.hha-hydration-start, .hha-start-btn, [data-hha-hydration-start-btn]');
  }

  function hasGameplayTarget(){
    return !!q('.hha-hydration-target');
  }

  function findSummary(){
    if(isStartOpen()) return null;

    var direct = q(
      '.hha-hydration-summary, #hha-hydration-summary, #hydration-summary, .hha-summary-card, .hha-summary-panel, [data-hha-summary]'
    );

    if(direct) return direct;

    var text = String(document.body.textContent || '');

    if(
      !hasGameplayTarget() &&
      /ภารกิจเติมน้ำสำเร็จ|คะแนนรวม|Aqua Legend|Aqua Master|Hydration|Combo|Mission|Heat Boss|Badge|ชนะ/i.test(text)
    ){
      return document.body;
    }

    return null;
  }

  function unlockSummaryScroll(){
    var summary = findSummary();
    if(!summary) return;

    document.documentElement.classList.add('hha-hydration-summary-scroll-only');
    document.body.classList.add('hha-hydration-summary-scroll-only');

    document.documentElement.style.height = 'auto';
    document.documentElement.style.minHeight = '100svh';
    document.documentElement.style.overflowY = 'auto';
    document.documentElement.style.overflowX = 'hidden';

    document.body.style.height = 'auto';
    document.body.style.minHeight = '100svh';
    document.body.style.overflowY = 'auto';
    document.body.style.overflowX = 'hidden';
    document.body.style.touchAction = 'auto';

    [
      q('#hha-hydration-app'),
      q('#hha-hydration-stage'),
      q('#hha-hydration-playfield')
    ].forEach(function(el){
      if(!el) return;

      el.style.height = 'auto';
      el.style.minHeight = '100svh';
      el.style.maxHeight = 'none';
      el.style.overflow = 'visible';
      el.style.position = 'relative';
    });

    summary.style.height = 'auto';
    summary.style.minHeight = 'auto';
    summary.style.maxHeight = 'none';
    summary.style.overflow = 'visible';
    summary.style.paddingBottom = '180px';
    summary.dataset.hhaSummaryScrollOnly = PATCH;
  }

  function injectCss(){
    if(document.getElementById('hha-hydration-summary-scroll-only-css')) return;

    var style = document.createElement('style');
    style.id = 'hha-hydration-summary-scroll-only-css';
    style.textContent = `
      html.hha-hydration-summary-scroll-only,
      body.hha-hydration-summary-scroll-only{
        height:auto !important;
        min-height:100svh !important;
        overflow-y:auto !important;
        overflow-x:hidden !important;
        touch-action:auto !important;
      }

      body.hha-hydration-summary-scroll-only #hha-hydration-app,
      body.hha-hydration-summary-scroll-only #hha-hydration-stage,
      body.hha-hydration-summary-scroll-only #hha-hydration-playfield{
        height:auto !important;
        min-height:100svh !important;
        max-height:none !important;
        overflow:visible !important;
        position:relative !important;
      }

      body.hha-hydration-summary-scroll-only .hha-summary-card,
      body.hha-hydration-summary-scroll-only .hha-hydration-summary,
      body.hha-hydration-summary-scroll-only #hha-hydration-summary,
      body.hha-hydration-summary-scroll-only #hydration-summary,
      body.hha-hydration-summary-scroll-only [data-hha-summary]{
        height:auto !important;
        max-height:none !important;
        overflow:visible !important;
        padding-bottom:180px !important;
      }
    `;

    document.head.appendChild(style);
  }

  function boot(){
    injectCss();

    setInterval(unlockSummaryScroll, 700);

    var mo = new MutationObserver(unlockSummaryScroll);
    mo.observe(document.body, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','style']
    });

    window.HHA = window.HHA || {};
    window.HHA.HydrationSummaryScrollOnly = {
      version: PATCH,
      unlock: unlockSummaryScroll
    };

    console.info('[Hydration Pack31] summary scroll only loaded');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
