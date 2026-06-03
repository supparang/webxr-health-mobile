// === /herohealth/vr-goodjunk/goodjunk-mobile-powerups-hitbox-unblock-final.js ===
// PATCH v20260603-v848b
// Purpose: make mobile targets and powerups clickable without blocking gameplay.

(function () {
  'use strict';

  const PATCH = 'GJ_MOBILE_POWERUPS_HITBOX_UNBLOCK_V848B';

  function isGoodJunk() {
    return /goodjunk|good-junk/i.test(location.pathname + ' ' + document.title);
  }

  if (!isGoodJunk()) return;

  function injectStyle() {
    if (document.getElementById('gjHitboxUnblockV848bStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjHitboxUnblockV848bStyle';
    style.textContent = `
      .gjm-area,
      #gjSoloBossArea{
        pointer-events:auto !important;
      }

      .gjpu-root{
        pointer-events:none !important;
      }

      .gjpu-card{
        pointer-events:auto !important;
      }

      .gjpu-item,
      .gj-target,
      .target,
      .food,
      .junk,
      [data-target],
      [data-food],
      [data-junk],
      [data-kind]{
        pointer-events:auto !important;
        touch-action:manipulation !important;
        cursor:pointer !important;
      }

      .gjpu-item::after,
      .gj-target::after,
      .target::after,
      .food::after,
      .junk::after{
        content:"" !important;
        position:absolute !important;
        inset:-14px !important;
        border-radius:26px !important;
        pointer-events:auto !important;
      }

      .gjm-bg-orbs,
      .gjm-bg-orbs *,
      .gjm-lane{
        pointer-events:none !important;
      }

      .gjm-hud{
        pointer-events:none !important;
      }

      .shell-back,
      .gjm-start,
      .gjm-start *,
      .gjm-message,
      .gjpu-card{
        pointer-events:auto !important;
      }
    `;

    document.head.appendChild(style);
  }

  function mark(el) {
    if (!el || el.dataset.gjHitboxFixed) return;

    el.dataset.gjHitboxFixed = '1';

    try {
      const cs = getComputedStyle(el);
      if (cs.position === 'static') {
        el.style.position = 'absolute';
      }
    } catch (_) {}

    el.style.pointerEvents = 'auto';
    el.style.touchAction = 'manipulation';
  }

  function scan() {
    const selectors = [
      '.gjpu-item',
      '.gj-target',
      '.target',
      '.food',
      '.junk',
      '[data-target]',
      '[data-food]',
      '[data-junk]',
      '[data-kind]'
    ];

    document.querySelectorAll(selectors.join(',')).forEach(mark);
  }

  function install() {
    injectStyle();
    scan();

    const mo = new MutationObserver(scan);
    mo.observe(document.documentElement, { childList: true, subtree: true });

    setInterval(scan, 1000);

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
