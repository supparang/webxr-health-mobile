// === /herohealth/vr-goodjunk/goodjunk-mobile-target-mini-v848e.js ===
// PATCH v20260604-v848e
// Purpose:
// 1) Reduce visible mobile targets a little more
// 2) Keep hitbox easy to tap
// 3) Broaden selector coverage in case target card class differs
// 4) Do NOT change score / spawn / boss logic

(function () {
  'use strict';

  const PATCH = 'GJ_MOBILE_TARGET_MINI_V848E';

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
    if (document.getElementById('gjMobileTargetMiniV848eStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjMobileTargetMiniV848eStyle';
    style.textContent = `
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e{
        width:40px !important;
        min-width:40px !important;
        max-width:44px !important;

        min-height:46px !important;
        max-height:54px !important;

        padding:3px 2px !important;
        border-radius:13px !important;
        box-sizing:border-box !important;

        font-size:10px !important;
        line-height:1.05 !important;

        box-shadow:0 6px 13px rgba(15,23,42,.12) !important;
        border-width:2px !important;

        touch-action:manipulation !important;
        overflow:visible !important;
      }

      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e img,
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e svg,
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e canvas{
        max-width:25px !important;
        max-height:25px !important;
        width:auto !important;
        height:auto !important;
        object-fit:contain !important;
        display:block !important;
        margin-left:auto !important;
        margin-right:auto !important;
      }

      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e b,
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e .emoji,
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e .icon,
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e [class*="emoji"],
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e [class*="icon"]{
        font-size:17px !important;
        line-height:1 !important;
      }

      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e span,
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e small,
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e label,
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e .label,
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e [class*="label"],
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e [class*="name"],
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e [class*="title"]{
        font-size:6.2px !important;
        line-height:1.05 !important;
        max-width:36px !important;
        margin:2px auto 0 !important;
        text-align:center !important;
        word-break:break-word !important;
        overflow-wrap:anywhere !important;
      }

      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e > *{
        max-width:100% !important;
      }

      /*
        Keep real touch area large.
        Visual card is smaller, but tapping remains friendly.
      */
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e::after{
        content:"" !important;
        position:absolute !important;
        inset:-22px !important;
        border-radius:28px !important;
        pointer-events:auto !important;
      }

      /*
        RARE label should not make the target feel huge.
      */
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e .rare,
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e .rarity,
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e [data-rarity],
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e [class*="rare"],
      html.gj-mobile-target-mini-v848e .gj-mini-target-v848e [class*="rarity"]{
        transform:scale(.72) !important;
        transform-origin:center center !important;
        font-size:8px !important;
      }

      @media (max-width:420px){
        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e{
          width:38px !important;
          min-width:38px !important;
          max-width:42px !important;
          min-height:44px !important;
          max-height:52px !important;
          padding:2px !important;
          border-radius:12px !important;
        }

        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e img,
        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e svg,
        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e canvas{
          max-width:23px !important;
          max-height:23px !important;
        }

        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e b,
        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e .emoji,
        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e .icon,
        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e [class*="emoji"],
        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e [class*="icon"]{
          font-size:16px !important;
        }

        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e span,
        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e small,
        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e label,
        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e .label,
        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e [class*="label"],
        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e [class*="name"],
        html.gj-mobile-target-mini-v848e .gj-mini-target-v848e [class*="title"]{
          font-size:5.8px !important;
          max-width:34px !important;
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
      '[data-kind="fake"]',
      '#gjSoloBossArea [class*="target"]',
      '#gjSoloBossArea [class*="food"]',
      '#gjSoloBossArea [class*="junk"]',
      '#gjSoloBossArea [class*="item"]'
    ].join(',');
  }

  function isRealGameplayTarget(el) {
    if (!el || !el.getBoundingClientRect) return false;

    if (
      el.closest('.gjpu-root') ||
      el.closest('.gjpu-card') ||
      el.closest('.gjm-hud') ||
      el.closest('.gjm-message') ||
      el.closest('.shell-back') ||
      el.closest('.gj-final-safe-action-row')
    ) {
      return false;
    }

    const area = document.getElementById('gjSoloBossArea');
    if (area && !el.closest('#gjSoloBossArea')) return false;

    if (el.classList && el.classList.contains('gjm-lane')) return false;

    const r = el.getBoundingClientRect();

    return r.width >= 24 && r.height >= 24;
  }

  function markTargets() {
    document.querySelectorAll(targetSelector()).forEach(function (el) {
      if (!isRealGameplayTarget(el)) return;

      el.classList.add('gj-mini-target-v848e');
      el.dataset.gjMiniTargetV848e = '1';
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
    document.documentElement.classList.add('gj-mobile-target-mini-v848e');

    injectStyle();
    markTargets();

    const mo = new MutationObserver(function () {
      setTimeout(markTargets, 20);
      setTimeout(markTargets, 120);
    });

    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-kind', 'data-target', 'data-food', 'data-junk']
    });

    setInterval(markTargets, 700);

    window.GJ_MOBILE_TARGET_MINI = {
      version: '20260604-v848e',
      mark: markTargets
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