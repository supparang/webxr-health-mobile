// === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-mobile-fit-v852d.js ===
// PATCH v20260608-GOODJUNK-SUMMARY-MOBILE-FIT-V852D
// Purpose:
// - แก้ summary บนมือถือ: ปุ่มไม่ลอยทับเนื้อหา
// - ซ่อน powerup/back/HUD ระหว่างหน้า summary
// - รองรับทั้ง summary เก่าและ authority summary
// - ไม่ยุ่งกับสูตรคำนวณคะแนน

(function(){
  'use strict';

  const PATCH = 'v20260608-GOODJUNK-SUMMARY-MOBILE-FIT-V852D';

  if(window.__GJ_SUMMARY_MOBILE_FIT_V852D__){
    console.warn('[GJ Summary Mobile Fit V852D] already loaded');
    return;
  }
  window.__GJ_SUMMARY_MOBILE_FIT_V852D__ = true;

  let timer = null;
  let lastPatchAt = 0;

  function log(){
    try{
      console.log.apply(console, ['[GJ Summary Mobile Fit V852D]'].concat([].slice.call(arguments)));
    }catch(_){}
  }

  function byId(id){
    return document.getElementById(id);
  }

  function txt(el){
    return String((el && (el.innerText || el.textContent)) || '')
      .replace(/\s+/g,' ')
      .trim();
  }

  function ensureStyle(){
    if(byId('gjSummaryMobileFitStyleV852D')) return;

    const style = document.createElement('style');
    style.id = 'gjSummaryMobileFitStyleV852D';
    style.textContent = `
      body.gj-summary-open-v852d .gjpu-root,
      body.gj-summary-open-v852d .gjpu-card,
      body.gj-summary-open-v852d .gjpu-toast,
      body.gj-summary-open-v852d #shellBackBtn,
      body.gj-summary-open-v852d .shell-back,
      body.gj-summary-open-v852d #gjmHud,
      body.gj-summary-open-v852d .gjm-hud,
      body.gj-summary-open-v852d #gjmMessage,
      body.gj-summary-open-v852d .gjm-message{
        opacity:0 !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      .gj-summary-mobile-fit-v852d{
        position:fixed !important;
        inset:0 !important;
        z-index:2147483000 !important;
        display:flex !important;
        justify-content:center !important;
        align-items:flex-start !important;
        padding:calc(10px + env(safe-area-inset-top,0px)) 10px calc(10px + env(safe-area-inset-bottom,0px)) !important;
        background:rgba(15,23,42,.48) !important;
        backdrop-filter:blur(8px) !important;
        -webkit-backdrop-filter:blur(8px) !important;
        overflow:hidden !important;
        pointer-events:auto !important;
      }

      .gj-summary-card-mobile-fit-v852d{
        position:relative !important;
        width:min(540px, calc(100vw - 20px)) !important;
        height:auto !important;
        max-height:calc(100dvh - 20px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)) !important;
        overflow:auto !important;
        -webkit-overflow-scrolling:touch !important;
        border-radius:28px !important;
        padding-bottom:150px !important;
        margin:0 auto !important;
        box-sizing:border-box !important;
      }

      .gj-summary-card-mobile-fit-v852d [data-gj-summary-actions="1"]{
        position:sticky !important;
        left:0 !important;
        right:0 !important;
        bottom:0 !important;
        z-index:20 !important;
        display:grid !important;
        grid-template-columns:1fr !important;
        gap:10px !important;
        padding:10px 0 0 !important;
        margin-top:14px !important;
        background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.96) 22%,rgba(255,255,255,.98)) !important;
        backdrop-filter:blur(8px) !important;
        -webkit-backdrop-filter:blur(8px) !important;
      }

      .gj-summary-card-mobile-fit-v852d [data-gj-summary-actions="1"] button,
      .gj-summary-card-mobile-fit-v852d [data-gj-summary-actions="1"] a{
        position:static !important;
        width:100% !important;
        min-height:58px !important;
        border-radius:20px !important;
        font-size:clamp(18px, 4.8vw, 24px) !important;
        font-weight:1000 !important;
        transform:none !important;
      }

      .gj-summary-card-mobile-fit-v852d button,
      .gj-summary-card-mobile-fit-v852d a{
        pointer-events:auto !important;
      }

      .gj-summary-card-mobile-fit-v852d .close,
      .gj-summary-card-mobile-fit-v852d .x,
      .gj-summary-card-mobile-fit-v852d [aria-label*="close" i],
      .gj-summary-card-mobile-fit-v852d [aria-label*="ปิด"]{
        position:sticky !important;
        top:8px !important;
        float:right !important;
        z-index:30 !important;
      }

      @media(max-width:520px){
        .gj-summary-mobile-fit-v852d{
          padding:8px 8px calc(8px + env(safe-area-inset-bottom,0px)) !important;
        }

        .gj-summary-card-mobile-fit-v852d{
          width:calc(100vw - 16px) !important;
          max-height:calc(100dvh - 16px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)) !important;
          border-radius:26px !important;
          padding-bottom:158px !important;
        }

        .gj-summary-card-mobile-fit-v852d h1{
          font-size:clamp(32px, 8vw, 46px) !important;
          line-height:1.08 !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function isSummaryLike(el){
    if(!el || el.nodeType !== 1) return false;

    const id = String(el.id || '');
    const cls = String(el.className || '');
    const dataOwner = el.getAttribute && (
      el.getAttribute('data-goodjunk-summary') ||
      el.getAttribute('data-gj-summary') ||
      el.getAttribute('data-summary-owner')
    );

    if(id.includes('Summary') || id.includes('Reward') || cls.includes('summary') || cls.includes('reward') || dataOwner){
      return true;
    }

    const t = txt(el);
    return (
      t.includes('ชนะบอส') ||
      t.includes('สรุปผล GoodJunk') ||
      t.includes('GOODJUNK SOLO BOSS') ||
      (t.includes('เล่นอีกครั้ง') && t.includes('Cooldown'))
    );
  }

  function findSummaryRoot(){
    const candidates = Array.from(document.querySelectorAll(
      '#gjAuthoritySummaryOverlay,' +
      '#gjFreshSummaryOverlay,' +
      '#gjSummaryOverlay,' +
      '#gjRewardOverlay,' +
      '#gjrOverlay,' +
      '.gj-summary-overlay,' +
      '.gjr-overlay,' +
      '.gjRewardOverlay,' +
      '.gj-summary,' +
      '.gjr-root,' +
      '[data-goodjunk-summary="1"],' +
      '[data-gj-summary="1"],' +
      '[data-summary-owner]'
    ));

    for(const el of candidates){
      if(el && el.isConnected && isSummaryLike(el)) return el;
    }

    const all = Array.from(document.body.children || []);
    for(const el of all){
      if(!el || !el.isConnected) continue;
      if(isSummaryLike(el)) return el;
    }

    return null;
  }

  function findSummaryCard(root){
    if(!root) return null;

    const direct = root.querySelector(
      '#gjAuthoritySummaryCard,' +
      '#gjFreshSummaryCard,' +
      '.gj-summary-card,' +
      '.gjr-card,' +
      '.card,' +
      'section,' +
      'article'
    );

    if(direct && txt(direct).length > 40) return direct;

    return root;
  }

  function collectActionButtons(card){
    if(!card) return [];

    return Array.from(card.querySelectorAll('button,a,[role="button"]')).filter(function(el){
      const t = txt(el);
      return (
        t.includes('เล่นอีกครั้ง') ||
        t.toLowerCase().includes('replay') ||
        t.includes('Cooldown') ||
        t.includes('คูลดาวน์') ||
        t.includes('กลับเลือกโหมด')
      );
    });
  }

  function ensureActionWrap(card){
    if(!card) return;

    const buttons = collectActionButtons(card);
    if(buttons.length <= 0) return;

    let wrap = card.querySelector('[data-gj-summary-actions="1"]');

    if(!wrap){
      wrap = document.createElement('div');
      wrap.setAttribute('data-gj-summary-actions','1');
      card.appendChild(wrap);
    }

    buttons.forEach(function(btn){
      if(btn.parentNode !== wrap){
        try{ wrap.appendChild(btn); }catch(_){}
      }

      try{
        btn.style.position = 'static';
        btn.style.left = 'auto';
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
        btn.style.top = 'auto';
        btn.style.transform = 'none';
        btn.style.width = '100%';
      }catch(_){}
    });
  }

  function patchSummary(){
    ensureStyle();

    const root = findSummaryRoot();

    if(!root){
      document.body.classList.remove('gj-summary-open-v852d');
      return;
    }

    document.body.classList.add('gj-summary-open-v852d');

    try{
      root.classList.add('gj-summary-mobile-fit-v852d');
      root.setAttribute('data-gj-mobile-fit','v852d');
    }catch(_){}

    const card = findSummaryCard(root);

    if(card){
      try{
        card.classList.add('gj-summary-card-mobile-fit-v852d');
        card.setAttribute('data-gj-mobile-card-fit','v852d');
      }catch(_){}

      ensureActionWrap(card);
    }

    lastPatchAt = Date.now();
  }

  function schedulePatch(){
    if(timer) return;

    timer = setTimeout(function(){
      timer = null;
      patchSummary();
    }, 120);
  }

  function boot(){
    ensureStyle();

    patchSummary();
    setTimeout(patchSummary, 300);
    setTimeout(patchSummary, 900);
    setTimeout(patchSummary, 1600);

    window.addEventListener('gj:reward-summary-shown', schedulePatch, true);
    window.addEventListener('gj:game-over', schedulePatch, true);
    window.addEventListener('gj:end', schedulePatch, true);
    window.addEventListener('gj:boss-defeated', schedulePatch, true);
    window.addEventListener('goodjunk:game-over', schedulePatch, true);
    window.addEventListener('goodjunk:end', schedulePatch, true);
    window.addEventListener('goodjunk:boss-defeated', schedulePatch, true);

    const mo = new MutationObserver(function(){
      const t = Date.now();

      if(t - lastPatchAt < 180){
        return;
      }

      schedulePatch();
    });

    try{
      mo.observe(document.body, {
        childList:true,
        subtree:false
      });
    }catch(_){}

    window.GJ_SUMMARY_MOBILE_FIT_V852D = {
      patch:PATCH,
      patchSummary:patchSummary
    };

    log('installed', PATCH);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();