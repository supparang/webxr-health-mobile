// === /herohealth/vr-goodjunk/goodjunk-mobile-target-tight-v848c.js ===
// PATCH v20260604-v848c3
// Purpose:
// 1) Make visible mobile food/junk targets smaller
// 2) Keep touch hitbox friendly
// 3) Reduce mission toast blocking gameplay
// 4) Make play area feel less crowded on mobile

(function () {
  'use strict';

  const PATCH = 'GJ_MOBILE_TARGET_TIGHT_V848C3';

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

  function injectStyle() {
    if (document.getElementById('gjMobileTargetTightV848c3Style')) return;

    const style = document.createElement('style');
    style.id = 'gjMobileTargetTightV848c3Style';
    style.textContent = `
      /* ===============================
         GoodJunk Mobile Target Tight v848c3
         visible small / hitbox still friendly
      =============================== */

      html.gj-mobile-target-tight-v848c,
      html.gj-mobile-target-tight-v848c body{
        overflow:hidden !important;
        overscroll-behavior:none !important;
      }

      /* Main visible target size */
      html.gj-mobile-target-tight-v848c .gjpu-item,
      html.gj-mobile-target-tight-v848c .gj-target,
      html.gj-mobile-target-tight-v848c .target,
      html.gj-mobile-target-tight-v848c .food,
      html.gj-mobile-target-tight-v848c .junk,
      html.gj-mobile-target-tight-v848c [data-target],
      html.gj-mobile-target-tight-v848c [data-food],
      html.gj-mobile-target-tight-v848c [data-junk],
      html.gj-mobile-target-tight-v848c [data-kind="good"],
      html.gj-mobile-target-tight-v848c [data-kind="junk"],
      html.gj-mobile-target-tight-v848c [data-kind="fake"]{
        max-width:min(14.5vw,52px) !important;
        max-height:min(15.5vw,58px) !important;
        touch-action:manipulation !important;
      }

      html.gj-mobile-target-tight-v848c .gjpu-item{
        width:44px !important;
        min-height:50px !important;
        padding:3px 3px !important;
        border-radius:14px !important;
        box-shadow:0 7px 15px rgba(15,23,42,.12) !important;
        border-width:2px !important;
      }

      /* Images inside card */
      html.gj-mobile-target-tight-v848c .gjpu-item img,
      html.gj-mobile-target-tight-v848c .gj-target img,
      html.gj-mobile-target-tight-v848c .target img,
      html.gj-mobile-target-tight-v848c .food img,
      html.gj-mobile-target-tight-v848c .junk img,
      html.gj-mobile-target-tight-v848c [data-target] img,
      html.gj-mobile-target-tight-v848c [data-food] img,
      html.gj-mobile-target-tight-v848c [data-junk] img,
      html.gj-mobile-target-tight-v848c [data-kind] img{
        max-width:29px !important;
        max-height:29px !important;
        object-fit:contain !important;
      }

      /* Emoji / icon targets */
      html.gj-mobile-target-tight-v848c .gjpu-item b,
      html.gj-mobile-target-tight-v848c .gj-target b,
      html.gj-mobile-target-tight-v848c .target b,
      html.gj-mobile-target-tight-v848c .food b,
      html.gj-mobile-target-tight-v848c .junk b{
        font-size:19px !important;
        line-height:1 !important;
      }

      /* Target label */
      html.gj-mobile-target-tight-v848c .gjpu-item span,
      html.gj-mobile-target-tight-v848c .gj-target span,
      html.gj-mobile-target-tight-v848c .target span,
      html.gj-mobile-target-tight-v848c .food span,
      html.gj-mobile-target-tight-v848c .junk span{
        font-size:6.8px !important;
        line-height:1.05 !important;
        max-width:40px !important;
        margin-left:auto !important;
        margin-right:auto !important;
        word-break:break-word !important;
      }

      /* Keep touch area easy even when visible target is smaller */
      html.gj-mobile-target-tight-v848c .gjpu-item::after,
      html.gj-mobile-target-tight-v848c .gj-target::after,
      html.gj-mobile-target-tight-v848c .target::after,
      html.gj-mobile-target-tight-v848c .food::after,
      html.gj-mobile-target-tight-v848c .junk::after{
        content:"" !important;
        position:absolute !important;
        inset:-20px !important;
        border-radius:28px !important;
        pointer-events:auto !important;
      }

      /* More play space between top mission cards and bottom boss panel */
      html.gj-mobile-target-tight-v848c .gjm-area,
      html.gj-mobile-target-tight-v848c #gjSoloBossArea{
        padding-top:calc(94px + env(safe-area-inset-top,0px)) !important;
        padding-bottom:calc(166px + env(safe-area-inset-bottom,0px)) !important;
      }

      /* Mission / toast message should not cover gameplay too much */
      html.gj-mobile-target-tight-v848c .gjm-message{
        top:49% !important;
        width:min(285px, calc(100vw - 96px)) !important;
        padding:9px 11px !important;
        border-radius:22px !important;
        background:rgba(15,23,42,.64) !important;
        box-shadow:0 12px 28px rgba(15,23,42,.18) !important;
        transform:translate(-50%,-50%) scale(.88) !important;
      }

      html.gj-mobile-target-tight-v848c .gjm-message.show{
        transform:translate(-50%,-50%) scale(.88) !important;
      }

      html.gj-mobile-target-tight-v848c .gjm-message b{
        font-size:18px !important;
        line-height:1.1 !important;
      }

      html.gj-mobile-target-tight-v848c .gjm-message span{
        margin-top:4px !important;
        font-size:10.5px !important;
        line-height:1.15 !important;
      }

      /* Bottom back button should not block boss / gameplay */
      html.gj-mobile-target-tight-v848c .shell-back{
        max-width:96px !important;
        padding:6px 7px !important;
        font-size:9.5px !important;
        opacity:.42 !important;
        transform:scale(.88) !important;
        transform-origin:left bottom !important;
      }

      html.gj-mobile-target-tight-v848c .shell-back:active,
      html.gj-mobile-target-tight-v848c .shell-back:hover{
        opacity:1 !important;
      }

      /* Powerup bar should stay compact */
      html.gj-mobile-target-tight-v848c .gjpu-root{
        max-width:calc(100vw - 118px) !important;
        gap:4px !important;
      }

      html.gj-mobile-target-tight-v848c .gjpu-card{
        width:36px !important;
        min-height:36px !important;
        padding:4px !important;
        border-radius:13px !important;
      }

      html.gj-mobile-target-tight-v848c .gjpu-card .ico{
        width:26px !important;
        height:26px !important;
        font-size:16px !important;
        border-radius:10px !important;
      }

      html.gj-mobile-target-tight-v848c .gjpu-card b,
      html.gj-mobile-target-tight-v848c .gjpu-card span{
        display:none !important;
      }

      /* Reduce huge rarity label if present */
      html.gj-mobile-target-tight-v848c .rare,
      html.gj-mobile-target-tight-v848c .rarity,
      html.gj-mobile-target-tight-v848c [data-rarity],
      html.gj-mobile-target-tight-v848c .gj-rarity{
        transform:scale(.82) !important;
        transform-origin:center center !important;
      }

      @media (max-width:420px){
        html.gj-mobile-target-tight-v848c .gjpu-item{
          width:42px !important;
          min-height:48px !important;
          border-radius:13px !important;
          padding:3px 2px !important;
        }

        html.gj-mobile-target-tight-v848c .gjpu-item img,
        html.gj-mobile-target-tight-v848c .gj-target img,
        html.gj-mobile-target-tight-v848c .target img,
        html.gj-mobile-target-tight-v848c .food img,
        html.gj-mobile-target-tight-v848c .junk img,
        html.gj-mobile-target-tight-v848c [data-kind] img{
          max-width:27px !important;
          max-height:27px !important;
        }

        html.gj-mobile-target-tight-v848c .gjpu-item b,
        html.gj-mobile-target-tight-v848c .gj-target b,
        html.gj-mobile-target-tight-v848c .target b,
        html.gj-mobile-target-tight-v848c .food b,
        html.gj-mobile-target-tight-v848c .junk b{
          font-size:18px !important;
        }

        html.gj-mobile-target-tight-v848c .gjpu-item span,
        html.gj-mobile-target-tight-v848c .gj-target span,
        html.gj-mobile-target-tight-v848c .target span,
        html.gj-mobile-target-tight-v848c .food span,
        html.gj-mobile-target-tight-v848c .junk span{
          font-size:6.5px !important;
          max-width:38px !important;
        }

        html.gj-mobile-target-tight-v848c .gjm-message{
          width:min(260px, calc(100vw - 92px)) !important;
          padding:8px 10px !important;
          transform:translate(-50%,-50%) scale(.84) !important;
        }

        html.gj-mobile-target-tight-v848c .gjm-message.show{
          transform:translate(-50%,-50%) scale(.84) !important;
        }

        html.gj-mobile-target-tight-v848c .gjm-message b{
          font-size:16px !important;
        }

        html.gj-mobile-target-tight-v848c .gjm-message span{
          font-size:10px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function markTargets() {
    const selectors = [
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
    ];

    document.querySelectorAll(selectors.join(',')).forEach(function (el) {
      if (!el.dataset.gjTargetTightV848c3) {
        el.dataset.gjTargetTightV848c3 = '1';
      }

      el.style.touchAction = 'manipulation';

      try {
        const cs = getComputedStyle(el);
        if (cs.position === 'static') {
          el.style.position = 'absolute';
        }
      } catch (_) {}
    });
  }

  function lightlySeparateOverlaps() {
    const area = document.getElementById('gjSoloBossArea');
    if (!area) return;

    const targets = Array.prototype.slice.call(
      area.querySelectorAll(
        '.gjpu-item,.gj-target,.target,.food,.junk,[data-target],[data-food],[data-junk],[data-kind]'
      )
    ).filter(function (el) {
      const r = el.getBoundingClientRect();
      return r.width > 20 && r.height > 20;
    });

    if (targets.length < 2) return;

    const vw = Math.max(320, window.innerWidth || 360);
    const vh = Math.max(520, window.innerHeight || 640);

    targets.forEach(function (a, i) {
      const ar = a.getBoundingClientRect();

      targets.forEach(function (b, j) {
        if (j <= i) return;

        const br = b.getBoundingClientRect();

        const overlapX = Math.max(0, Math.min(ar.right, br.right) - Math.max(ar.left, br.left));
        const overlapY = Math.max(0, Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top));

        if (overlapX > 16 && overlapY > 16) {
          const dir = j % 2 === 0 ? 1 : -1;
          const currentLeft = parseFloat(b.style.left || '') || br.left;
          const currentTop = parseFloat(b.style.top || '') || br.top;

          const nextLeft = Math.min(vw - 70, Math.max(12, currentLeft + dir * 22));
          const nextTop = Math.min(vh - 210, Math.max(138, currentTop + 18));

          if (b.style.left) b.style.left = nextLeft + 'px';
          if (b.style.top) b.style.top = nextTop + 'px';
        }
      });
    });
  }

  function install() {
    document.documentElement.classList.add('gj-mobile-target-tight-v848c');
    document.documentElement.classList.add('gj-mobile-target-tight-v848c3');

    injectStyle();
    markTargets();

    const mo = new MutationObserver(function () {
      markTargets();
      setTimeout(lightlySeparateOverlaps, 30);
    });

    mo.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    setInterval(function () {
      markTargets();
      lightlySeparateOverlaps();
    }, 850);

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