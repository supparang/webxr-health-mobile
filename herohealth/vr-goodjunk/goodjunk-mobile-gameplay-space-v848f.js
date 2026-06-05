// === /herohealth/vr-goodjunk/goodjunk-mobile-gameplay-space-v848f.js ===
// PATCH v20260605-v848f
// Purpose:
// 1) Give mobile gameplay more usable space
// 2) Make visible targets slightly smaller again
// 3) Keep hitbox friendly
// 4) Move targets away from top mission panel and bottom boss panel
// 5) Compact center toast
// 6) Do NOT change score / boss / hit logic

(function () {
  'use strict';

  const PATCH = 'GJ_MOBILE_GAMEPLAY_SPACE_V848F';

  function isGoodJunk() {
    return /goodjunk|good-junk/i.test(location.pathname + ' ' + document.title);
  }

  if (!isGoodJunk()) return;

  const qs = new URLSearchParams(location.search || '');
  const view = String(qs.get('view') || '').toLowerCase();

  const isMobile =
    view === 'mobile' ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  if (!isMobile) return;

  const state = {
    installed: false,
    lastSafeRun: 0
  };

  function injectStyle() {
    if (document.getElementById('gjMobileGameplaySpaceV848fStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjMobileGameplaySpaceV848fStyle';
    style.textContent = `
      html.gj-mobile-gameplay-space-v848f,
      html.gj-mobile-gameplay-space-v848f body{
        overflow:hidden !important;
        overscroll-behavior:none !important;
      }

      /*
        Slightly smaller visible target.
        Hitbox remains large via ::after.
      */
      html.gj-mobile-gameplay-space-v848f .gj-mini-target-v848e,
      html.gj-mobile-gameplay-space-v848f .gjpu-item,
      html.gj-mobile-gameplay-space-v848f .gj-target,
      html.gj-mobile-gameplay-space-v848f .target,
      html.gj-mobile-gameplay-space-v848f .food,
      html.gj-mobile-gameplay-space-v848f .junk,
      html.gj-mobile-gameplay-space-v848f [data-target],
      html.gj-mobile-gameplay-space-v848f [data-food],
      html.gj-mobile-gameplay-space-v848f [data-junk],
      html.gj-mobile-gameplay-space-v848f [data-kind="good"],
      html.gj-mobile-gameplay-space-v848f [data-kind="junk"],
      html.gj-mobile-gameplay-space-v848f [data-kind="fake"]{
        max-width:40px !important;
        max-height:50px !important;
        touch-action:manipulation !important;
      }

      html.gj-mobile-gameplay-space-v848f .gj-mini-target-v848e,
      html.gj-mobile-gameplay-space-v848f .gjpu-item{
        width:38px !important;
        min-width:38px !important;
        max-width:40px !important;
        min-height:44px !important;
        max-height:50px !important;
        padding:2px !important;
        border-radius:12px !important;
        box-shadow:0 5px 12px rgba(15,23,42,.11) !important;
        border-width:2px !important;
      }

      html.gj-mobile-gameplay-space-v848f .gj-mini-target-v848e img,
      html.gj-mobile-gameplay-space-v848f .gjpu-item img,
      html.gj-mobile-gameplay-space-v848f .gj-target img,
      html.gj-mobile-gameplay-space-v848f .target img,
      html.gj-mobile-gameplay-space-v848f .food img,
      html.gj-mobile-gameplay-space-v848f .junk img,
      html.gj-mobile-gameplay-space-v848f [data-target] img,
      html.gj-mobile-gameplay-space-v848f [data-food] img,
      html.gj-mobile-gameplay-space-v848f [data-junk] img,
      html.gj-mobile-gameplay-space-v848f [data-kind] img{
        max-width:23px !important;
        max-height:23px !important;
        object-fit:contain !important;
      }

      html.gj-mobile-gameplay-space-v848f .gj-mini-target-v848e b,
      html.gj-mobile-gameplay-space-v848f .gjpu-item b,
      html.gj-mobile-gameplay-space-v848f .gj-target b,
      html.gj-mobile-gameplay-space-v848f .target b,
      html.gj-mobile-gameplay-space-v848f .food b,
      html.gj-mobile-gameplay-space-v848f .junk b{
        font-size:16px !important;
        line-height:1 !important;
      }

      html.gj-mobile-gameplay-space-v848f .gj-mini-target-v848e span,
      html.gj-mobile-gameplay-space-v848f .gjpu-item span,
      html.gj-mobile-gameplay-space-v848f .gj-target span,
      html.gj-mobile-gameplay-space-v848f .target span,
      html.gj-mobile-gameplay-space-v848f .food span,
      html.gj-mobile-gameplay-space-v848f .junk span{
        font-size:5.8px !important;
        line-height:1.05 !important;
        max-width:34px !important;
        margin:2px auto 0 !important;
        text-align:center !important;
        word-break:break-word !important;
        overflow-wrap:anywhere !important;
      }

      /*
        Hitbox remains friendly.
      */
      html.gj-mobile-gameplay-space-v848f .gj-mini-target-v848e::after,
      html.gj-mobile-gameplay-space-v848f .gjpu-item::after,
      html.gj-mobile-gameplay-space-v848f .gj-target::after,
      html.gj-mobile-gameplay-space-v848f .target::after,
      html.gj-mobile-gameplay-space-v848f .food::after,
      html.gj-mobile-gameplay-space-v848f .junk::after{
        content:"" !important;
        position:absolute !important;
        inset:-23px !important;
        border-radius:30px !important;
        pointer-events:auto !important;
      }

      /*
        Make visible playfield feel larger.
        JS will also clamp targets into this zone.
      */
      html.gj-mobile-gameplay-space-v848f .gjm-area,
      html.gj-mobile-gameplay-space-v848f #gjSoloBossArea{
        padding-top:calc(210px + env(safe-area-inset-top,0px)) !important;
        padding-bottom:calc(220px + env(safe-area-inset-bottom,0px)) !important;
      }

      /*
        Compact dark center toast.
      */
      html.gj-mobile-gameplay-space-v848f .gjm-message{
        top:auto !important;
        bottom:calc(178px + env(safe-area-inset-bottom,0px)) !important;
        width:min(238px, calc(100vw - 136px)) !important;
        padding:7px 9px !important;
        border-radius:20px !important;
        background:rgba(15,23,42,.62) !important;
        box-shadow:0 8px 20px rgba(15,23,42,.16) !important;
        transform:translateX(-50%) scale(.76) !important;
        backdrop-filter:blur(7px) !important;
      }

      html.gj-mobile-gameplay-space-v848f .gjm-message.show{
        transform:translateX(-50%) scale(.76) !important;
      }

      html.gj-mobile-gameplay-space-v848f .gjm-message b{
        font-size:14px !important;
        line-height:1.1 !important;
      }

      html.gj-mobile-gameplay-space-v848f .gjm-message span{
        margin-top:2px !important;
        font-size:8.5px !important;
        line-height:1.15 !important;
      }

      /*
        Slightly reduce large top mission panels found by JS.
      */
      html.gj-mobile-gameplay-space-v848f .gj-top-panel-compact-v848f{
        transform:scale(.92) !important;
        transform-origin:top center !important;
      }

      /*
        Slightly reduce bottom boss panel found by JS.
      */
      html.gj-mobile-gameplay-space-v848f .gj-boss-panel-compact-v848f{
        transform:scale(.94) !important;
        transform-origin:bottom center !important;
      }

      html.gj-mobile-gameplay-space-v848f [data-gj-space-moved="1"]{
        transition:left .10s ease, top .10s ease !important;
      }

      /*
        Back button should be very quiet during gameplay.
      */
      html.gj-mobile-gameplay-space-v848f .shell-back{
        max-width:86px !important;
        padding:5px 6px !important;
        font-size:8.5px !important;
        opacity:.32 !important;
        transform:scale(.82) !important;
        transform-origin:left bottom !important;
      }

      html.gj-mobile-gameplay-space-v848f .shell-back:active,
      html.gj-mobile-gameplay-space-v848f .shell-back:hover{
        opacity:1 !important;
      }

      @media (max-width:420px){
        html.gj-mobile-gameplay-space-v848f .gj-mini-target-v848e,
        html.gj-mobile-gameplay-space-v848f .gjpu-item{
          width:36px !important;
          min-width:36px !important;
          max-width:38px !important;
          min-height:42px !important;
          max-height:48px !important;
        }

        html.gj-mobile-gameplay-space-v848f .gj-mini-target-v848e img,
        html.gj-mobile-gameplay-space-v848f .gjpu-item img,
        html.gj-mobile-gameplay-space-v848f .gj-target img,
        html.gj-mobile-gameplay-space-v848f .target img,
        html.gj-mobile-gameplay-space-v848f .food img,
        html.gj-mobile-gameplay-space-v848f .junk img,
        html.gj-mobile-gameplay-space-v848f [data-kind] img{
          max-width:22px !important;
          max-height:22px !important;
        }

        html.gj-mobile-gameplay-space-v848f .gj-mini-target-v848e span,
        html.gj-mobile-gameplay-space-v848f .gjpu-item span,
        html.gj-mobile-gameplay-space-v848f .gj-target span,
        html.gj-mobile-gameplay-space-v848f .target span,
        html.gj-mobile-gameplay-space-v848f .food span,
        html.gj-mobile-gameplay-space-v848f .junk span{
          font-size:5.5px !important;
          max-width:32px !important;
        }

        html.gj-mobile-gameplay-space-v848f .gjm-message{
          width:min(220px, calc(100vw - 148px)) !important;
          transform:translateX(-50%) scale(.72) !important;
        }

        html.gj-mobile-gameplay-space-v848f .gjm-message.show{
          transform:translateX(-50%) scale(.72) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function targetSelector() {
    return [
      '.gj-mini-target-v848e',
      '.gjpu-item',
      '.gj-target',
      '.target',
      '.food',
      '.junk',
      '[data-target]',
      '[data-food]',
      '[data-junk]',
      '[data-kind="good"]',
      '[data-kind="junk"]',
      '[data-kind="fake"]',
      '#gjSoloBossArea [class*="target"]',
      '#gjSoloBossArea [class*="food"]',
      '#gjSoloBossArea [class*="junk"]',
      '#gjSoloBossArea [class*="item"]'
    ].join(',');
  }

  function isGameplayTarget(el) {
    if (!el || !el.getBoundingClientRect) return false;

    if (
      el.closest('.gjpu-root') ||
      el.closest('.gjpu-card') ||
      el.closest('.gjm-hud') ||
      el.closest('.gjm-message') ||
      el.closest('.shell-back') ||
      el.closest('.gj-final-safe-action-row') ||
      el.closest('.gjm-start')
    ) {
      return false;
    }

    const area = document.getElementById('gjSoloBossArea');
    if (area && !el.closest('#gjSoloBossArea')) return false;

    const r = el.getBoundingClientRect();
    return r.width >= 20 && r.height >= 20;
  }

  function getTargets() {
    return Array.prototype.slice.call(document.querySelectorAll(targetSelector()))
      .filter(isGameplayTarget);
  }

  function px(n) {
    return Math.round(n) + 'px';
  }

  function getBounds() {
    const vw = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 360);
    const vh = Math.max(520, window.innerHeight || document.documentElement.clientHeight || 640);

    return {
      vw,
      vh,
      left: 18,
      right: vw - 18,
      top: Math.min(Math.max(230, Math.round(vh * 0.31)), 305),
      bottom: vh - Math.min(Math.max(210, Math.round(vh * 0.27)), 265)
    };
  }

  function currentPosition(el, rect) {
    const left = parseFloat(el.style.left);
    const top = parseFloat(el.style.top);

    return {
      left: Number.isFinite(left) ? left : rect.left,
      top: Number.isFinite(top) ? top : rect.top
    };
  }

  function setPosition(el, left, top) {
    const cs = getComputedStyle(el);

    if (cs.position === 'static') {
      el.style.position = 'absolute';
    }

    el.style.left = px(left);
    el.style.top = px(top);
    el.dataset.gjSpaceMoved = '1';
  }

  function markTargetsMini() {
    getTargets().forEach(function (el) {
      el.classList.add('gj-mini-target-v848e');
      el.dataset.gjGameplaySpaceV848f = '1';
      el.style.touchAction = 'manipulation';
    });
  }

  function clampTargets() {
    const bounds = getBounds();
    const targets = getTargets();

    targets.forEach(function (el, index) {
      const r = el.getBoundingClientRect();
      const pos = currentPosition(el, r);

      const w = Math.max(36, r.width);
      const h = Math.max(42, r.height);

      const minLeft = bounds.left;
      const maxLeft = bounds.right - w;
      const minTop = bounds.top;
      const maxTop = bounds.bottom - h;

      let nextLeft = pos.left;
      let nextTop = pos.top;

      if (r.left < bounds.left) {
        nextLeft = minLeft + (index % 2) * 8;
      }

      if (r.right > bounds.right) {
        nextLeft = maxLeft - (index % 2) * 8;
      }

      if (r.top < bounds.top) {
        nextTop = minTop + (index % 3) * 16;
      }

      if (r.bottom > bounds.bottom) {
        nextTop = maxTop - (index % 3) * 14;
      }

      nextLeft = Math.min(maxLeft, Math.max(minLeft, nextLeft));
      nextTop = Math.min(maxTop, Math.max(minTop, nextTop));

      if (
        Math.abs(nextLeft - pos.left) > 2 ||
        Math.abs(nextTop - pos.top) > 2
      ) {
        setPosition(el, nextLeft, nextTop);
      }
    });
  }

  function separateTargets() {
    const bounds = getBounds();
    const targets = getTargets();

    if (targets.length < 2) return;

    for (let i = 0; i < targets.length; i += 1) {
      for (let j = i + 1; j < targets.length; j += 1) {
        const a = targets[i];
        const b = targets[j];

        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();

        const overlapX =
          Math.max(0, Math.min(ar.right, br.right) - Math.max(ar.left, br.left));

        const overlapY =
          Math.max(0, Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top));

        if (overlapX > 10 && overlapY > 10) {
          const pos = currentPosition(b, br);

          const bw = Math.max(36, br.width);
          const bh = Math.max(42, br.height);

          const dirX = j % 2 === 0 ? 1 : -1;
          const dirY = j % 3 === 0 ? 1 : -1;

          let nextLeft = pos.left + dirX * Math.max(18, overlapX * .7);
          let nextTop = pos.top + dirY * Math.max(16, overlapY * .7);

          nextLeft = Math.min(bounds.right - bw, Math.max(bounds.left, nextLeft));
          nextTop = Math.min(bounds.bottom - bh, Math.max(bounds.top, nextTop));

          setPosition(b, nextLeft, nextTop);
        }
      }
    }
  }

  function compactTopAndBottomPanels() {
    const vh = Math.max(520, window.innerHeight || 640);
    const nodes = Array.prototype.slice.call(document.body.querySelectorAll('body *'));

    nodes.forEach(function (el) {
      if (!el || !el.getBoundingClientRect) return;

      if (
        el.closest('#gjSoloBossArea') ||
        el.closest('.gjm-start') ||
        el.closest('.gjm-message') ||
        el.closest('.gjpu-root') ||
        el.closest('.gj-final-safe-action-row')
      ) {
        return;
      }

      const text = (el.innerText || el.textContent || '').trim();
      if (!text) return;

      const r = el.getBoundingClientRect();
      if (r.width < 220 || r.height < 38) return;

      if (
        r.top < 250 &&
        /(ภารกิจ|พายุอาหาร|เก็บโปรตีน|เก็บอาหารดี|เก็บผัก|เก็บผลไม้)/.test(text)
      ) {
        el.classList.add('gj-top-panel-compact-v848f');
      }

      if (
        r.bottom > vh - 230 &&
        /(Junk Boss|HP|Boss|บอส)/i.test(text)
      ) {
        el.classList.add('gj-boss-panel-compact-v848f');
      }
    });
  }

  function compactToastText() {
    const msg = document.getElementById('gjmMessage');
    if (!msg) return;

    const main = document.getElementById('gjmMessageMain');
    const sub = document.getElementById('gjmMessageSub');

    if (main && main.textContent.length > 16) {
      main.style.fontSize = '14px';
    }

    if (sub && sub.textContent.length > 28) {
      sub.style.fontSize = '8.5px';
    }
  }

  function runSafePass() {
    const now = Date.now();
    if (now - state.lastSafeRun < 80) return;
    state.lastSafeRun = now;

    markTargetsMini();
    compactTopAndBottomPanels();
    compactToastText();
    clampTargets();
    separateTargets();
  }

  function install() {
    if (state.installed) return;
    state.installed = true;

    document.documentElement.classList.add('gj-mobile-gameplay-space-v848f');

    injectStyle();
    runSafePass();

    const mo = new MutationObserver(function () {
      setTimeout(runSafePass, 20);
      setTimeout(runSafePass, 120);
    });

    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-kind', 'data-target', 'data-food', 'data-junk']
    });

    [120, 300, 600, 1000, 1600, 2400].forEach(function (ms) {
      setTimeout(runSafePass, ms);
    });

    setInterval(runSafePass, 420);

    window.addEventListener('resize', function () {
      setTimeout(runSafePass, 100);
    });

    window.GJ_MOBILE_GAMEPLAY_SPACE = {
      version: '20260605-v848f',
      run: runSafePass,
      bounds: getBounds,
      targets: getTargets
    };

    try {
      console.log('[' + PATCH + '] installed');
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();