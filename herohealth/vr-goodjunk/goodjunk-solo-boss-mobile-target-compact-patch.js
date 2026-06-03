// === /herohealth/vr-goodjunk/goodjunk-solo-boss-mobile-target-compact-patch.js ===
// PATCH v20260603-v848b
// Purpose: compact mobile targets / foods / junk without breaking hitbox.

(function () {
  'use strict';

  const PATCH = 'GJ_MOBILE_TARGET_COMPACT_V848B';

  function isGoodJunk() {
    return /goodjunk|good-junk/i.test(location.pathname + ' ' + document.title);
  }

  if (!isGoodJunk()) return;

  const qs = new URLSearchParams(location.search || '');
  const view = String(qs.get('view') || '').toLowerCase();
  const isMobile =
    view === 'mobile' ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  function injectStyle() {
    if (document.getElementById('gjMobileTargetCompactV848b')) return;

    const style = document.createElement('style');
    style.id = 'gjMobileTargetCompactV848b';
    style.textContent = `
      html.gj-mobile-target-compact-v848b .gjpu-item,
      html.gj-mobile-target-compact-v848b .gj-target,
      html.gj-mobile-target-compact-v848b .target,
      html.gj-mobile-target-compact-v848b .food,
      html.gj-mobile-target-compact-v848b .junk,
      html.gj-mobile-target-compact-v848b [data-target],
      html.gj-mobile-target-compact-v848b [data-food],
      html.gj-mobile-target-compact-v848b [data-junk],
      html.gj-mobile-target-compact-v848b [data-kind="good"],
      html.gj-mobile-target-compact-v848b [data-kind="junk"],
      html.gj-mobile-target-compact-v848b [data-kind="fake"]{
        max-width:min(22vw,82px) !important;
        max-height:min(22vw,82px) !important;
      }

      html.gj-mobile-target-compact-v848b .gjpu-item{
        width:62px !important;
        min-height:68px !important;
        padding:6px 5px !important;
        border-radius:20px !important;
        z-index:42 !important;
        touch-action:manipulation !important;
      }

      html.gj-mobile-target-compact-v848b .gjpu-item b,
      html.gj-mobile-target-compact-v848b .gj-target b,
      html.gj-mobile-target-compact-v848b .target b,
      html.gj-mobile-target-compact-v848b .food b,
      html.gj-mobile-target-compact-v848b .junk b{
        font-size:30px !important;
        line-height:1 !important;
      }

      html.gj-mobile-target-compact-v848b .gjpu-item span,
      html.gj-mobile-target-compact-v848b .gj-target span,
      html.gj-mobile-target-compact-v848b .target span,
      html.gj-mobile-target-compact-v848b .food span,
      html.gj-mobile-target-compact-v848b .junk span{
        font-size:9px !important;
        line-height:1.05 !important;
      }

      html.gj-mobile-target-compact-v848b .gjpu-item::after,
      html.gj-mobile-target-compact-v848b .gj-target::after,
      html.gj-mobile-target-compact-v848b .target::after,
      html.gj-mobile-target-compact-v848b .food::after,
      html.gj-mobile-target-compact-v848b .junk::after{
        content:"" !important;
        position:absolute !important;
        inset:-13px !important;
        border-radius:24px !important;
        pointer-events:auto !important;
      }

      html.gj-mobile-target-compact-v848b .gjm-area{
        padding-top:calc(72px + env(safe-area-inset-top,0px)) !important;
        padding-bottom:calc(62px + env(safe-area-inset-bottom,0px)) !important;
      }

      html.gj-mobile-target-compact-v848b .gjm-message{
        top:58% !important;
        width:min(350px,calc(100vw - 28px)) !important;
        padding:12px !important;
        border-radius:22px !important;
      }

      @media (max-width:420px){
        html.gj-mobile-target-compact-v848b .gjpu-item{
          width:56px !important;
          min-height:62px !important;
          border-radius:18px !important;
        }

        html.gj-mobile-target-compact-v848b .gjpu-item b{
          font-size:27px !important;
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
      if (el.dataset.gjCompactMarked) return;
      el.dataset.gjCompactMarked = '1';
      el.style.touchAction = 'manipulation';

      const cs = getComputedStyle(el);
      if (cs.position === 'static') {
        el.style.position = 'absolute';
      }
    });
  }

  function install() {
    if (isMobile) {
      document.documentElement.classList.add('gj-mobile-target-compact-v848b');
    }

    injectStyle();
    markTargets();

    const mo = new MutationObserver(markTargets);
    mo.observe(document.documentElement, { childList: true, subtree: true });

    setInterval(markTargets, 1200);

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
