// === /herohealth/vr-goodjunk/goodjunk-mobile-target-tight-v848c.js ===
// PATCH v20260604-v848c2
// Purpose: make visible mobile food/junk targets smaller, but keep touch hitbox friendly.

(function () {
  'use strict';

  const PATCH = 'GJ_MOBILE_TARGET_TIGHT_V848C2';

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
    if (document.getElementById('gjMobileTargetTightV848c2Style')) return;

    const style = document.createElement('style');
    style.id = 'gjMobileTargetTightV848c2Style';
    style.textContent = `
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
        max-width:min(16vw,58px) !important;
        max-height:min(17vw,64px) !important;
      }

      html.gj-mobile-target-tight-v848c .gjpu-item{
        width:48px !important;
        min-height:54px !important;
        padding:4px 3px !important;
        border-radius:15px !important;
        box-shadow:0 8px 18px rgba(15,23,42,.13) !important;
      }

      html.gj-mobile-target-tight-v848c .gjpu-item img,
      html.gj-mobile-target-tight-v848c .gj-target img,
      html.gj-mobile-target-tight-v848c .target img,
      html.gj-mobile-target-tight-v848c .food img,
      html.gj-mobile-target-tight-v848c .junk img,
      html.gj-mobile-target-tight-v848c [data-target] img,
      html.gj-mobile-target-tight-v848c [data-food] img,
      html.gj-mobile-target-tight-v848c [data-junk] img,
      html.gj-mobile-target-tight-v848c [data-kind] img{
        max-width:34px !important;
        max-height:34px !important;
        object-fit:contain !important;
      }

      html.gj-mobile-target-tight-v848c .gjpu-item b,
      html.gj-mobile-target-tight-v848c .gj-target b,
      html.gj-mobile-target-tight-v848c .target b,
      html.gj-mobile-target-tight-v848c .food b,
      html.gj-mobile-target-tight-v848c .junk b{
        font-size:22px !important;
        line-height:1 !important;
      }

      html.gj-mobile-target-tight-v848c .gjpu-item span,
      html.gj-mobile-target-tight-v848c .gj-target span,
      html.gj-mobile-target-tight-v848c .target span,
      html.gj-mobile-target-tight-v848c .food span,
      html.gj-mobile-target-tight-v848c .junk span{
        font-size:7.5px !important;
        line-height:1.05 !important;
        max-width:44px !important;
        margin-left:auto !important;
        margin-right:auto !important;
      }

      /* keep touch area easy even when visual target is smaller */
      html.gj-mobile-target-tight-v848c .gjpu-item::after,
      html.gj-mobile-target-tight-v848c .gj-target::after,
      html.gj-mobile-target-tight-v848c .target::after,
      html.gj-mobile-target-tight-v848c .food::after,
      html.gj-mobile-target-tight-v848c .junk::after{
        content:"" !important;
        position:absolute !important;
        inset:-18px !important;
        border-radius:26px !important;
        pointer-events:auto !important;
      }

      /* give more play space between HUD and boss panel */
      html.gj-mobile-target-tight-v848c .gjm-area,
      html.gj-mobile-target-tight-v848c #gjSoloBossArea{
        padding-top:calc(86px + env(safe-area-inset-top,0px)) !important;
        padding-bottom:calc(150px + env(safe-area-inset-bottom,0px)) !important;
      }

      /* bottom back button should not block boss/powerups */
      html.gj-mobile-target-tight-v848c .shell-back{
        max-width:106px !important;
        padding:7px 8px !important;
        font-size:10px !important;
        opacity:.48 !important;
        transform:scale(.9) !important;
        transform-origin:left bottom !important;
      }

      html.gj-mobile-target-tight-v848c .shell-back:active,
      html.gj-mobile-target-tight-v848c .shell-back:hover{
        opacity:1 !important;
      }

      @media (max-width:420px){
        html.gj-mobile-target-tight-v848c .gjpu-item{
          width:46px !important;
          min-height:52px !important;
          border-radius:14px !important;
          padding:4px 3px !important;
        }

        html.gj-mobile-target-tight-v848c .gjpu-item img,
        html.gj-mobile-target-tight-v848c .gj-target img,
        html.gj-mobile-target-tight-v848c .target img,
        html.gj-mobile-target-tight-v848c .food img,
        html.gj-mobile-target-tight-v848c .junk img,
        html.gj-mobile-target-tight-v848c [data-kind] img{
          max-width:31px !important;
          max-height:31px !important;
        }

        html.gj-mobile-target-tight-v848c .gjpu-item b,
        html.gj-mobile-target-tight-v848c .gj-target b,
        html.gj-mobile-target-tight-v848c .target b,
        html.gj-mobile-target-tight-v848c .food b,
        html.gj-mobile-target-tight-v848c .junk b{
          font-size:20px !important;
        }

        html.gj-mobile-target-tight-v848c .gjpu-item span,
        html.gj-mobile-target-tight-v848c .gj-target span,
        html.gj-mobile-target-tight-v848c .target span,
        html.gj-mobile-target-tight-v848c .food span,
        html.gj-mobile-target-tight-v848c .junk span{
          font-size:7px !important;
          max-width:42px !important;
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
      if (el.dataset.gjTargetTightV848c2) return;

      el.dataset.gjTargetTightV848c2 = '1';
      el.style.touchAction = 'manipulation';

      try {
        const cs = getComputedStyle(el);
        if (cs.position === 'static') {
          el.style.position = 'absolute';
        }
      } catch (_) {}
    });
  }

  function install() {
    document.documentElement.classList.add('gj-mobile-target-tight-v848c');
    document.documentElement.classList.add('gj-mobile-target-tight-v848c2');

    injectStyle();
    markTargets();

    const mo = new MutationObserver(markTargets);
    mo.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    setInterval(markTargets, 900);

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