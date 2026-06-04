// === /herohealth/vr-goodjunk/goodjunk-mobile-playfield-safe-v848d.js ===
// PATCH v20260604-v848d
// Purpose:
// 1) Keep mobile targets inside safe playfield
// 2) Avoid mission/HUD top overlay
// 3) Avoid boss/powerup bottom overlay
// 4) Lightly separate overlapping targets
// 5) Compact center toast so it does not block gameplay
// Note: does NOT change score / hit / boss logic

(function () {
  'use strict';

  const PATCH = 'GJ_MOBILE_PLAYFIELD_SAFE_V848D';

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
    lastRun: 0,
    lastToastPatch: 0
  };

  function injectStyle() {
    if (document.getElementById('gjMobilePlayfieldSafeV848dStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjMobilePlayfieldSafeV848dStyle';
    style.textContent = `
      html.gj-mobile-playfield-safe-v848d,
      html.gj-mobile-playfield-safe-v848d body{
        overflow:hidden !important;
        overscroll-behavior:none !important;
      }

      /*
        Safe gameplay area:
        top mission/HUD area is visually heavy,
        bottom boss panel is visually heavy,
        so targets should stay in the middle-safe zone.
      */
      html.gj-mobile-playfield-safe-v848d .gjm-area,
      html.gj-mobile-playfield-safe-v848d #gjSoloBossArea{
        padding-top:calc(180px + env(safe-area-inset-top,0px)) !important;
        padding-bottom:calc(205px + env(safe-area-inset-bottom,0px)) !important;
      }

      /*
        Make mission/gameplay toast smaller and less blocking.
        This targets the dark message such as "สวนกลับสำเร็จ!"
      */
      html.gj-mobile-playfield-safe-v848d .gjm-message{
        top:auto !important;
        bottom:calc(190px + env(safe-area-inset-bottom,0px)) !important;
        width:min(270px, calc(100vw - 110px)) !important;
        min-height:0 !important;
        padding:8px 10px !important;
        border-radius:22px !important;
        background:rgba(15,23,42,.68) !important;
        box-shadow:0 10px 26px rgba(15,23,42,.18) !important;
        transform:translateX(-50%) scale(.82) !important;
        backdrop-filter:blur(7px) !important;
      }

      html.gj-mobile-playfield-safe-v848d .gjm-message.show{
        transform:translateX(-50%) scale(.82) !important;
      }

      html.gj-mobile-playfield-safe-v848d .gjm-message b{
        font-size:16px !important;
        line-height:1.1 !important;
      }

      html.gj-mobile-playfield-safe-v848d .gjm-message span{
        margin-top:3px !important;
        font-size:9.5px !important;
        line-height:1.15 !important;
      }

      /*
        Targets that were corrected by this patch.
        Do not make them look selected; only stabilize touch and layout.
      */
      html.gj-mobile-playfield-safe-v848d [data-gj-safe-moved="1"]{
        transition:
          left .12s ease,
          top .12s ease,
          transform .12s ease !important;
      }

      /*
        Reduce visual dominance of the back button.
      */
      html.gj-mobile-playfield-safe-v848d .shell-back{
        max-width:92px !important;
        padding:6px 7px !important;
        font-size:9px !important;
        opacity:.38 !important;
        transform:scale(.86) !important;
        transform-origin:left bottom !important;
      }

      html.gj-mobile-playfield-safe-v848d .shell-back:active,
      html.gj-mobile-playfield-safe-v848d .shell-back:hover{
        opacity:1 !important;
      }

      /*
        Keep powerups compact and away from the boss text.
      */
      html.gj-mobile-playfield-safe-v848d .gjpu-root{
        right:calc(8px + env(safe-area-inset-right,0px)) !important;
        bottom:calc(10px + env(safe-area-inset-bottom,0px)) !important;
        max-width:calc(100vw - 112px) !important;
        gap:4px !important;
      }

      html.gj-mobile-playfield-safe-v848d .gjpu-card{
        width:35px !important;
        min-height:35px !important;
        border-radius:12px !important;
        padding:4px !important;
      }

      html.gj-mobile-playfield-safe-v848d .gjpu-card .ico{
        width:25px !important;
        height:25px !important;
        font-size:15px !important;
      }

      @media (max-width:420px){
        html.gj-mobile-playfield-safe-v848d .gjm-area,
        html.gj-mobile-playfield-safe-v848d #gjSoloBossArea{
          padding-top:calc(178px + env(safe-area-inset-top,0px)) !important;
          padding-bottom:calc(210px + env(safe-area-inset-bottom,0px)) !important;
        }

        html.gj-mobile-playfield-safe-v848d .gjm-message{
          bottom:calc(188px + env(safe-area-inset-bottom,0px)) !important;
          width:min(246px, calc(100vw - 118px)) !important;
          padding:7px 9px !important;
          transform:translateX(-50%) scale(.78) !important;
        }

        html.gj-mobile-playfield-safe-v848d .gjm-message.show{
          transform:translateX(-50%) scale(.78) !important;
        }

        html.gj-mobile-playfield-safe-v848d .gjm-message b{
          font-size:15px !important;
        }

        html.gj-mobile-playfield-safe-v848d .gjm-message span{
          font-size:9px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function targetSelector() {
    return [
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
      '[data-kind="fake"]'
    ].join(',');
  }

  function isRealTarget(el) {
    if (!el || !el.getBoundingClientRect) return false;

    if (
      el.closest('.gjpu-root') ||
      el.closest('.gjm-hud') ||
      el.closest('.shell-back') ||
      el.closest('.gjm-message') ||
      el.closest('.gj-final-safe-action-row')
    ) {
      return false;
    }

    const area = document.getElementById('gjSoloBossArea');
    const gjArea = el.closest('#gjSoloBossArea,.gjm-area');

    if (area && !gjArea) return false;

    const r = el.getBoundingClientRect();

    return r.width >= 20 && r.height >= 20;
  }

  function getTargets() {
    return Array.prototype.slice
      .call(document.querySelectorAll(targetSelector()))
      .filter(isRealTarget);
  }

  function px(n) {
    return Math.round(n) + 'px';
  }

  function getSafeBounds() {
    const vw = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 360);
    const vh = Math.max(520, window.innerHeight || document.documentElement.clientHeight || 640);

    /*
      These values are based on actual mobile screenshots:
      top mission cards occupy around first 170–220 px,
      bottom boss panel/powerups occupy last 170–220 px.
    */
    const topSafe = Math.min(Math.max(178, Math.round(vh * 0.235)), 230);
    const bottomSafe = Math.min(Math.max(190, Math.round(vh * 0.265)), 245);

    return {
      vw: vw,
      vh: vh,
      left: 14,
      right: vw - 14,
      top: topSafe,
      bottom: vh - bottomSafe
    };
  }

  function currentPosition(el, rect) {
    const style = el.style || {};
    const left = parseFloat(style.left);
    const top = parseFloat(style.top);

    return {
      left: Number.isFinite(left) ? left : rect.left,
      top: Number.isFinite(top) ? top : rect.top
    };
  }

  function setPosition(el, left, top) {
    if (!el || !el.style) return;

    const cs = getComputedStyle(el);
    if (cs.position === 'static') {
      el.style.position = 'absolute';
    }

    el.style.left = px(left);
    el.style.top = px(top);
    el.dataset.gjSafeMoved = '1';
  }

  function clampTargetsIntoSafeZone() {
    const bounds = getSafeBounds();
    const targets = getTargets();

    targets.forEach(function (el, index) {
      const r = el.getBoundingClientRect();
      const pos = currentPosition(el, r);

      const w = Math.max(40, r.width);
      const h = Math.max(46, r.height);

      let nextLeft = pos.left;
      let nextTop = pos.top;

      const minLeft = bounds.left;
      const maxLeft = bounds.right - w;
      const minTop = bounds.top;
      const maxTop = bounds.bottom - h;

      if (r.top < bounds.top) {
        nextTop = minTop + (index % 3) * 12;
      }

      if (r.bottom > bounds.bottom) {
        nextTop = maxTop - (index % 3) * 10;
      }

      if (r.left < bounds.left) {
        nextLeft = minLeft + (index % 2) * 10;
      }

      if (r.right > bounds.right) {
        nextLeft = maxLeft - (index % 2) * 10;
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

  function separateOverlaps() {
    const bounds = getSafeBounds();
    const targets = getTargets();

    if (targets.length < 2) return;

    const rects = targets.map(function (el) {
      return {
        el: el,
        rect: el.getBoundingClientRect()
      };
    });

    rects.forEach(function (a, i) {
      rects.forEach(function (b, j) {
        if (j <= i) return;

        const ar = a.el.getBoundingClientRect();
        const br = b.el.getBoundingClientRect();

        const overlapX =
          Math.max(0, Math.min(ar.right, br.right) - Math.max(ar.left, br.left));

        const overlapY =
          Math.max(0, Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top));

        if (overlapX > 12 && overlapY > 12) {
          const pos = currentPosition(b.el, br);
          const bw = Math.max(40, br.width);
          const bh = Math.max(46, br.height);

          const dirX = j % 2 === 0 ? 1 : -1;
          const dirY = j % 3 === 0 ? 1 : -1;

          let nextLeft = pos.left + dirX * Math.max(18, overlapX * 0.65);
          let nextTop = pos.top + dirY * Math.max(14, overlapY * 0.55);

          nextLeft = Math.min(bounds.right - bw, Math.max(bounds.left, nextLeft));
          nextTop = Math.min(bounds.bottom - bh, Math.max(bounds.top, nextTop));

          setPosition(b.el, nextLeft, nextTop);
        }
      });
    });
  }

  function compactMessage() {
    const msg = document.getElementById('gjmMessage');
    if (!msg) return;

    if (!msg.dataset.gjPlayfieldSafeMsg) {
      msg.dataset.gjPlayfieldSafeMsg = '1';
    }

    /*
      If long text appears, reduce it a bit so it does not cover the playfield.
      Keep readable Thai text.
    */
    const main = document.getElementById('gjmMessageMain');
    const sub = document.getElementById('gjmMessageSub');

    if (main && main.textContent.length > 20) {
      main.style.fontSize = '15px';
    }

    if (sub && sub.textContent.length > 34) {
      sub.style.fontSize = '9px';
    }
  }

  function runSafePass() {
    const now = Date.now();
    if (now - state.lastRun < 90) return;
    state.lastRun = now;

    clampTargetsIntoSafeZone();
    separateOverlaps();
    compactMessage();
  }

  function install() {
    if (state.installed) return;
    state.installed = true;

    document.documentElement.classList.add('gj-mobile-playfield-safe-v848d');

    injectStyle();

    const mo = new MutationObserver(function () {
      setTimeout(runSafePass, 20);
      setTimeout(runSafePass, 120);
    });

    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'data-kind', 'data-target']
    });

    [
      100,
      250,
      500,
      900,
      1300,
      1800
    ].forEach(function (ms) {
      setTimeout(runSafePass, ms);
    });

    setInterval(runSafePass, 420);

    window.addEventListener('resize', function () {
      setTimeout(runSafePass, 80);
    });

    window.GJ_MOBILE_PLAYFIELD_SAFE = {
      version: '20260604-v848d',
      run: runSafePass,
      bounds: getSafeBounds,
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