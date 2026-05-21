/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260520-groups-solo-gameplay-mobile-cvr-final-03
   File: /herohealth/patches/groups/03-groups-solo-gameplay-mobile-cvr-final.js

   Purpose:
   - Final polish gameplay screen for Mobile / Cardboard VR
   - Make targets visually smaller but still easy to tap/shoot
   - Prevent HUD / floating buttons from blocking gameplay
   - Add safe aim helper for cVR
   - Improve touch/crosshair hit detection
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260520-groups-solo-gameplay-mobile-cvr-final-03';
  if (window.__HHA_GROUPS_SOLO_GAMEPLAY_MOBILE_CVR_FINAL__) return;
  window.__HHA_GROUPS_SOLO_GAMEPLAY_MOBILE_CVR_FINAL__ = true;

  const qs = new URLSearchParams(location.search);

  function isMobileUA(){
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  }

  function normalizeView(){
    const raw = String(qs.get('view') || '').toLowerCase();
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].includes(raw)) return 'cvr';
    if (['mobile','phone','touch'].includes(raw)) return 'mobile';
    if (['pc','desktop'].includes(raw)) return 'pc';
    return isMobileUA() ? 'mobile' : 'pc';
  }

  const VIEW = normalizeView();

  document.body.classList.add('hha-groups-gameplay-polish-ready');
  document.body.classList.add('hha-gameplay-view-' + VIEW);

  function addStyle(){
    if (document.getElementById('hha-groups-gameplay-mobile-cvr-final-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-groups-gameplay-mobile-cvr-final-style';
    style.textContent = `
      body.hha-groups-gameplay-mode{
        overflow:hidden !important;
        overscroll-behavior:none !important;
        touch-action:manipulation !important;
      }

      body.hha-groups-gameplay-mode *{
        -webkit-tap-highlight-color:transparent;
      }

      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode{
        --hha-food-size: clamp(48px, 15vw, 76px);
        --hha-gate-size: clamp(54px, 16vw, 84px);
        --hha-font-mini: clamp(10px, 2.65vw, 13px);
        --hha-font-normal: clamp(12px, 3.1vw, 15px);
      }

      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .food,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .food-card,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .foodItem,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .target,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .orb,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .item,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode [data-food],
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode [data-target],
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode [data-choice]{
        width:var(--hha-food-size) !important;
        height:var(--hha-food-size) !important;
        min-width:var(--hha-food-size) !important;
        min-height:var(--hha-food-size) !important;
        max-width:var(--hha-food-size) !important;
        max-height:var(--hha-food-size) !important;
        font-size:clamp(22px, 6.2vw, 34px) !important;
        line-height:1 !important;
        box-sizing:border-box !important;
      }

      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .gate,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .group,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .bucket,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .answer,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode [data-group],
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode [data-gate]{
        min-width:var(--hha-gate-size) !important;
        min-height:var(--hha-gate-size) !important;
        max-width:clamp(74px, 21vw, 104px) !important;
        max-height:clamp(74px, 21vw, 104px) !important;
        font-size:clamp(18px, 5vw, 28px) !important;
        box-sizing:border-box !important;
      }

      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .hud,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode #hud,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .topbar,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .scorebar,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .statusbar,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .gameHud,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode [class*="hud"],
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode [class*="HUD"]{
        font-size:var(--hha-font-mini) !important;
        line-height:1.12 !important;
        max-height:23vh !important;
        overflow:hidden !important;
      }

      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode button,
      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .btn{
        min-height:34px !important;
        padding:7px 10px !important;
        font-size:var(--hha-font-normal) !important;
        border-radius:14px !important;
      }

      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode{
        --hha-food-size: clamp(38px, 10vw, 58px);
        --hha-gate-size: clamp(48px, 12vw, 70px);
        cursor:none !important;
      }

      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .food,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .food-card,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .foodItem,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .target,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .orb,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .item,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode [data-food],
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode [data-target],
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode [data-choice]{
        width:var(--hha-food-size) !important;
        height:var(--hha-food-size) !important;
        min-width:var(--hha-food-size) !important;
        min-height:var(--hha-food-size) !important;
        max-width:var(--hha-food-size) !important;
        max-height:var(--hha-food-size) !important;
        font-size:clamp(18px, 4.6vw, 26px) !important;
        line-height:1 !important;
        box-sizing:border-box !important;
      }

      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .gate,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .group,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .bucket,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .answer,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode [data-group],
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode [data-gate]{
        min-width:var(--hha-gate-size) !important;
        min-height:var(--hha-gate-size) !important;
        max-width:clamp(58px, 15vw, 82px) !important;
        max-height:clamp(58px, 15vw, 82px) !important;
        font-size:clamp(16px, 4vw, 22px) !important;
        box-sizing:border-box !important;
      }

      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .hud,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode #hud,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .topbar,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .scorebar,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .statusbar,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .gameHud,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode [class*="hud"],
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode [class*="HUD"]{
        font-size:clamp(9px, 2.2vw, 12px) !important;
        line-height:1.05 !important;
        opacity:.84 !important;
        max-height:18vh !important;
        overflow:hidden !important;
        pointer-events:none !important;
      }

      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode button,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .btn{
        min-height:30px !important;
        padding:5px 8px !important;
        font-size:clamp(10px, 2.5vw, 13px) !important;
        border-radius:12px !important;
      }

      body.hha-groups-gameplay-mode .hha-floating-tool-safe{
        transform:scale(.86) !important;
        transform-origin:center center !important;
        opacity:.82 !important;
      }

      body.hha-gameplay-view-mobile.hha-groups-gameplay-mode .hha-floating-tool-safe,
      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .hha-floating-tool-safe{
        bottom:calc(8px + env(safe-area-inset-bottom, 0px)) !important;
      }

      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .hha-floating-tool-safe{
        opacity:.55 !important;
      }

      .hha-cvr-aim-label{
        position:fixed;
        left:50%;
        top:calc(50% + 30px);
        transform:translateX(-50%);
        z-index:999998;
        padding:5px 9px;
        border-radius:999px;
        background:rgba(21,48,74,.70);
        color:#fff;
        font:800 10px/1.1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        pointer-events:none;
        opacity:0;
        transition:.12s ease;
        max-width:70vw;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .hha-cvr-aim-label.show{
        opacity:1;
      }

      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .hha-cvr-aim-hot{
        outline:3px solid rgba(255,220,90,.95) !important;
        outline-offset:3px !important;
        filter:drop-shadow(0 0 16px rgba(255,220,90,.9)) brightness(1.08) !important;
      }

      body.hha-groups-gameplay-mode .hha-hit-boost{
        position:relative;
      }

      body.hha-groups-gameplay-mode .hha-hit-boost::after{
        content:"";
        position:absolute;
        inset:-10px;
        border-radius:inherit;
        pointer-events:auto;
      }

      body.hha-gameplay-view-cvr.hha-groups-gameplay-mode .hha-hit-boost::after{
        inset:-16px;
      }
    `;

    document.head.appendChild(style);
  }

  function textOf(el){
    return String(el && (el.innerText || el.textContent || el.getAttribute('aria-label') || '') || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isSummaryVisible(){
    const t = String(document.body && document.body.innerText || '');
    return (
      t.includes('สรุปผลการเล่น') ||
      t.includes('เล่นอีกครั้ง') ||
      t.includes('กลับ Nutrition Zone') ||
      (t.includes('Food Hero') && t.includes('Best Score'))
    );
  }

  function hasGameplaySigns(){
    const t = String(document.body && document.body.innerText || '');

    if (isSummaryVisible()) return false;

    const hasGameWords =
      t.includes('คะแนน') ||
      t.includes('เวลา') ||
      t.includes('คอมโบ') ||
      t.includes('Combo') ||
      t.includes('Score') ||
      t.includes('หมู่') ||
      t.includes('Mission');

    const hasTargets = document.querySelector(
      '.food,.food-card,.foodItem,.target,.orb,.item,.gate,.group,.bucket,.answer,[data-food],[data-target],[data-group],[data-gate],[data-choice]'
    );

    return !!(hasGameWords || hasTargets);
  }

  function markMode(){
    if (hasGameplaySigns()) {
      document.body.classList.add('hha-groups-gameplay-mode');
      document.body.classList.remove('hha-groups-summary-mode');
    } else {
      document.body.classList.remove('hha-groups-gameplay-mode');
    }
  }

  function getCandidateTargets(){
    const selectors = [
      '[data-food]',
      '[data-target]',
      '[data-choice]',
      '[data-group]',
      '[data-gate]',
      '.food',
      '.food-card',
      '.foodItem',
      '.target',
      '.orb',
      '.item',
      '.gate',
      '.group',
      '.bucket',
      '.answer',
      '.choice'
    ];

    return Array.from(document.querySelectorAll(selectors.join(',')))
      .filter(el => {
        if (!el || !el.getBoundingClientRect) return false;
        if (el.closest('.hha-summary-root')) return false;

        const r = el.getBoundingClientRect();
        if (r.width < 10 || r.height < 10) return false;

        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden') return false;
        if (Number(st.opacity) <= 0.04) return false;

        return true;
      });
  }

  function boostTargets(){
    getCandidateTargets().forEach(el => {
      el.classList.add('hha-hit-boost');
      el.style.touchAction = 'manipulation';
    });
  }

  function markFloatingTools(){
    const els = Array.from(document.querySelectorAll('button,a,div,[role="button"]'));

    els.forEach(el => {
      if (!el || el.closest('.hha-summary-root')) return;

      const st = getComputedStyle(el);
      if (st.position !== 'fixed' && st.position !== 'sticky') return;

      const r = el.getBoundingClientRect();
      const smallRound =
        r.width >= 34 &&
        r.width <= 94 &&
        r.height >= 34 &&
        r.height <= 94;

      const lowerRight =
        r.bottom >= window.innerHeight - 180 &&
        r.right >= window.innerWidth - 240;

      const text = textOf(el);

      const likelyTool =
        text === '' ||
        text === '🔎' ||
        text === '🌿' ||
        text === '🔇' ||
        text === '🔊' ||
        text.length <= 4;

      if (smallRound && lowerRight && likelyTool) {
        el.classList.add('hha-floating-tool-safe');
      }
    });
  }

  let aimLabel = null;

  function ensureAimLabel(){
    if (VIEW !== 'cvr') return null;
    if (aimLabel && document.body.contains(aimLabel)) return aimLabel;

    aimLabel = document.createElement('div');
    aimLabel.className = 'hha-cvr-aim-label';
    aimLabel.textContent = 'เล็งแล้วแตะเพื่อเลือก';
    document.body.appendChild(aimLabel);

    return aimLabel;
  }

  function centerPoint(){
    return {
      x: Math.round(window.innerWidth / 2),
      y: Math.round(window.innerHeight / 2)
    };
  }

  function distanceToCenter(rect){
    const c = centerPoint();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const dx = x - c.x;
    const dy = y - c.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function targetScore(el){
    const r = el.getBoundingClientRect();
    const c = centerPoint();

    const centerInside =
      c.x >= r.left - 18 &&
      c.x <= r.right + 18 &&
      c.y >= r.top - 18 &&
      c.y <= r.bottom + 18;

    const d = distanceToCenter(r);

    let score = d;

    if (centerInside) score *= 0.25;

    const txt = textOf(el);
    if (txt.includes('กลับ') || txt.includes('ออก') || txt.includes('Zone') || txt.includes('Hub')) {
      score += 9999;
    }

    return score;
  }

  function findAimTarget(){
    const maxRadius = VIEW === 'cvr'
      ? Math.max(70, Math.min(window.innerWidth, window.innerHeight) * 0.26)
      : Math.max(84, Math.min(window.innerWidth, window.innerHeight) * 0.30);

    const candidates = getCandidateTargets()
      .map(el => ({
        el,
        score: targetScore(el),
        rect: el.getBoundingClientRect()
      }))
      .filter(x => distanceToCenter(x.rect) <= maxRadius || x.score < maxRadius)
      .sort((a,b) => a.score - b.score);

    return candidates.length ? candidates[0].el : null;
  }

  let lastHot = null;

  function updateAimHint(){
    if (VIEW !== 'cvr') return;

    const label = ensureAimLabel();
    const target = findAimTarget();

    if (lastHot && lastHot !== target) {
      lastHot.classList.remove('hha-cvr-aim-hot');
    }

    lastHot = target;

    if (target) {
      target.classList.add('hha-cvr-aim-hot');

      const labelText = textOf(target);
      label.textContent = labelText
        ? 'เล็ง: ' + labelText.slice(0, 26)
        : 'เล็งแล้วแตะเพื่อเลือก';

      label.classList.add('show');
    } else {
      label.textContent = 'เล็งอาหารหรือประตูหมู่';
      label.classList.remove('show');
    }
  }

  function safeClick(el){
    if (!el) return false;

    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;

    try {
      const opts = {
        bubbles:true,
        cancelable:true,
        clientX:x,
        clientY:y,
        view:window
      };

      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
      return true;
    } catch(e) {
      try {
        el.click();
        return true;
      } catch(err) {
        return false;
      }
    }
  }

  function toast(message, type){
    window.dispatchEvent(new CustomEvent('hha:toast', {
      detail:{
        type:type || 'info',
        message:String(message || '')
      }
    }));
  }

  let lastShootAt = 0;

  function shootCenter(){
    const now = Date.now();
    if (now - lastShootAt < 140) return false;
    lastShootAt = now;

    const target = findAimTarget();

    if (!target) {
      toast('เล็งให้ตรงอาหารหรือประตูหมู่ก่อนนะ', 'warn');
      return false;
    }

    target.classList.add('hha-cvr-aim-hot');
    setTimeout(() => target.classList.remove('hha-cvr-aim-hot'), 160);

    return safeClick(target);
  }

  function bindShoot(){
    if (window.__HHA_GROUPS_GAMEPLAY_SHOOT_BOUND__) return;
    window.__HHA_GROUPS_GAMEPLAY_SHOOT_BOUND__ = true;

    window.addEventListener('hha:shoot', function(){
      if (VIEW === 'cvr') shootCenter();
    }, true);

    document.addEventListener('keydown', function(ev){
      if (VIEW !== 'cvr') return;
      if (ev.code === 'Space' || ev.key === 'Enter') {
        ev.preventDefault();
        shootCenter();
      }
    }, true);

    document.addEventListener('click', function(ev){
      if (VIEW !== 'cvr') return;
      if (!document.body.classList.contains('hha-groups-gameplay-mode')) return;

      const tag = String(ev.target && ev.target.tagName || '').toLowerCase();
      if (['button','a','input','select','textarea'].includes(tag)) return;

      shootCenter();
    }, true);

    document.addEventListener('touchend', function(ev){
      if (VIEW !== 'cvr') return;
      if (!document.body.classList.contains('hha-groups-gameplay-mode')) return;

      const targetTag = String(ev.target && ev.target.tagName || '').toLowerCase();
      if (['button','a','input','select','textarea'].includes(targetTag)) return;

      shootCenter();
    }, {passive:true, capture:true});
  }

  function compactViewportHeight(){
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--hha-vh', vh + 'px');
  }

  function scan(){
    markMode();

    if (!document.body.classList.contains('hha-groups-gameplay-mode')) return;

    boostTargets();
    markFloatingTools();

    if (VIEW === 'cvr') {
      ensureAimLabel();
      updateAimHint();
    }
  }

  function boot(){
    addStyle();
    compactViewportHeight();
    bindShoot();

    scan();
    setTimeout(scan, 250);
    setTimeout(scan, 800);
    setTimeout(scan, 1600);

    window.addEventListener('resize', function(){
      compactViewportHeight();
      setTimeout(scan, 120);
    }, {passive:true});

    window.addEventListener('orientationchange', function(){
      setTimeout(function(){
        compactViewportHeight();
        scan();
      }, 300);
    }, {passive:true});

    setInterval(function(){
      if (VIEW === 'cvr' && document.body.classList.contains('hha-groups-gameplay-mode')) {
        updateAimHint();
      }
    }, 180);

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_GAMEPLAY_SCAN_TIMER__);
      window.__HHA_GROUPS_GAMEPLAY_SCAN_TIMER__ = setTimeout(scan, 90);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','style','data-food','data-target','data-group','data-gate']
    });

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready', {
      view: VIEW
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }

})();
