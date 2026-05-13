// === /herohealth/vr-groups/groups-solo-v8-mobile-scroll-fix.js ===
// HeroHealth Groups Solo — v8.8 Mobile Scroll Fix
// FIX: intro/how-to/start screen cannot scroll on mobile
// Keeps gameplay/countdown locked, but unlocks scroll before game and on summary.
// PATCH v20260513-GROUPS-SOLO-V88-MOBILE-SCROLL

(function () {
  'use strict';

  const VERSION = 'v8.8-mobile-scroll-20260513';

  if (window.__HHA_GROUPS_SOLO_V88_MOBILE_SCROLL__) {
    console.warn('[GroupsSolo v8.8] already installed');
    return;
  }

  window.__HHA_GROUPS_SOLO_V88_MOBILE_SCROLL__ = true;

  const WIN = window;
  const DOC = document;

  function textOf(el) {
    return String(el ? el.textContent || '' : '').replace(/\s+/g, ' ').trim();
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8;
  }

  function looksLikeSummary() {
    const selectors = [
      '#summary',
      '.summary',
      '.result',
      '.result-screen',
      '.game-over',
      '.end-screen',
      '[data-summary]',
      '[data-screen="summary"]',
      '[data-state="ended"]'
    ];

    for (const sel of selectors) {
      const nodes = DOC.querySelectorAll(sel);
      for (const n of nodes) {
        if (!isVisible(n)) continue;
        const tx = textOf(n);
        if (
          tx.includes('สรุปผล') ||
          tx.includes('สรุปผลการเล่น') ||
          tx.includes('Hero Rank') ||
          tx.includes('Food Rookie') ||
          tx.includes('ความแม่นยำ') ||
          tx.includes('คอมโบสูงสุด')
        ) return true;
      }
    }

    return false;
  }

  function hasStartOrIntro() {
    const bodyText = textOf(DOC.body);

    if (
      bodyText.includes('Groups Solo Arena') ||
      bodyText.includes('แตะอาหาร') ||
      bodyText.includes('ประตูหมู่') ||
      bodyText.includes('ก่อนอาหารชนพื้น') ||
      bodyText.includes('ดูหมู่') ||
      bodyText.includes('สู้บอส')
    ) {
      return true;
    }

    const buttons = DOC.querySelectorAll('button,a,[role="button"],.btn,.button,[data-start],[data-action]');
    for (const b of buttons) {
      if (!isVisible(b)) continue;
      const tx = textOf(b).toLowerCase();
      if (
        tx.includes('เริ่ม') ||
        tx.includes('เล่น') ||
        tx.includes('start') ||
        tx.includes('play')
      ) {
        return true;
      }
    }

    return false;
  }

  function isCountdown() {
    return Boolean(
      DOC.body.classList.contains('hha-groups-v831-counting') ||
      DOC.body.classList.contains('hha-groups-v83-counting') ||
      DOC.getElementById('hha-groups-v831-overlay') ||
      DOC.getElementById('hha-groups-v83-countdown')
    );
  }

  function isGameplay() {
    if (looksLikeSummary()) return false;
    if (isCountdown()) return true;

    const cls = String(DOC.body.className || '').toLowerCase();

    if (
      cls.includes('hha-groups-v821-playing') ||
      cls.includes('hha-groups-v822-playing') ||
      cls.includes('hha-groups-v83-playing') ||
      cls.includes('hha-groups-v87-playing')
    ) {
      return true;
    }

    const targets = DOC.querySelectorAll('.hha-groups-v82-target,[data-hha-v82-target="1"]');
    for (const t of targets) {
      if (isVisible(t)) return true;
    }

    return false;
  }

  function injectStyle() {
    if (DOC.getElementById('hha-groups-v88-scroll-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-groups-v88-scroll-style';
    style.textContent = `
      /*
        Default mobile problem:
        Some earlier game shells use height:100vh / overflow:hidden.
        v8.8 unlocks only intro/how-to/summary screens.
      */

      html.hha-groups-v88-scroll-unlocked,
      html.hha-groups-v88-scroll-unlocked body{
        height: auto !important;
        min-height: 100% !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        overscroll-behavior-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
        touch-action: pan-y !important;
        position: relative !important;
      }

      body.hha-groups-v88-scroll-unlocked{
        min-height: 100dvh !important;
        padding-bottom: calc(110px + env(safe-area-inset-bottom, 0px)) !important;
      }

      /*
        Unlock common shell/card wrappers on intro only.
      */
      body.hha-groups-v88-scroll-unlocked main,
      body.hha-groups-v88-scroll-unlocked .app,
      body.hha-groups-v88-scroll-unlocked .page,
      body.hha-groups-v88-scroll-unlocked .screen,
      body.hha-groups-v88-scroll-unlocked .start-screen,
      body.hha-groups-v88-scroll-unlocked .intro,
      body.hha-groups-v88-scroll-unlocked .howto,
      body.hha-groups-v88-scroll-unlocked .container,
      body.hha-groups-v88-scroll-unlocked .wrap,
      body.hha-groups-v88-scroll-unlocked .shell,
      body.hha-groups-v88-scroll-unlocked .card,
      body.hha-groups-v88-scroll-unlocked .panel{
        max-height: none !important;
        overflow: visible !important;
      }

      /*
        If the main white card is centered with 100vh, let it breathe.
      */
      body.hha-groups-v88-scroll-unlocked .hero,
      body.hha-groups-v88-scroll-unlocked .hero-card,
      body.hha-groups-v88-scroll-unlocked .game-card,
      body.hha-groups-v88-scroll-unlocked .start-card,
      body.hha-groups-v88-scroll-unlocked .menu-card{
        max-height: none !important;
        overflow: visible !important;
      }

      /*
        Gameplay/countdown should not scroll accidentally.
      */
      html.hha-groups-v88-scroll-locked,
      html.hha-groups-v88-scroll-locked body{
        overflow: hidden !important;
        overscroll-behavior: none !important;
        touch-action: none !important;
      }

      /*
        Keep fixed back-zone button usable but not blocking all bottom content.
      */
      body.hha-groups-v88-scroll-unlocked #hha-groups-v8-return,
      body.hha-groups-v88-scroll-unlocked .hha-groups-v8-return{
        position: fixed !important;
        left: 12px !important;
        bottom: calc(12px + env(safe-area-inset-bottom, 0px)) !important;
        z-index: 99990 !important;
      }

      @media (max-width: 640px){
        body.hha-groups-v88-scroll-unlocked{
          padding-top: 0 !important;
          padding-bottom: calc(120px + env(safe-area-inset-bottom, 0px)) !important;
        }

        body.hha-groups-v88-scroll-unlocked main,
        body.hha-groups-v88-scroll-unlocked .app,
        body.hha-groups-v88-scroll-unlocked .screen,
        body.hha-groups-v88-scroll-unlocked .container,
        body.hha-groups-v88-scroll-unlocked .wrap,
        body.hha-groups-v88-scroll-unlocked .shell{
          min-height: auto !important;
          height: auto !important;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function unlockScroll(reason) {
    DOC.documentElement.classList.add('hha-groups-v88-scroll-unlocked');
    DOC.documentElement.classList.remove('hha-groups-v88-scroll-locked');

    DOC.body.classList.add('hha-groups-v88-scroll-unlocked');
    DOC.body.classList.remove('hha-groups-v88-scroll-locked');

    DOC.body.style.overflowY = 'auto';
    DOC.body.style.touchAction = 'pan-y';
  }

  function lockScroll(reason) {
    DOC.documentElement.classList.add('hha-groups-v88-scroll-locked');
    DOC.documentElement.classList.remove('hha-groups-v88-scroll-unlocked');

    DOC.body.classList.add('hha-groups-v88-scroll-locked');
    DOC.body.classList.remove('hha-groups-v88-scroll-unlocked');

    DOC.body.style.overflowY = 'hidden';
    DOC.body.style.touchAction = 'none';
  }

  function applyMode(reason) {
    injectStyle();

    if (looksLikeSummary()) {
      unlockScroll('summary');
      return;
    }

    if (isGameplay()) {
      lockScroll('gameplay');
      return;
    }

    if (hasStartOrIntro()) {
      unlockScroll('intro');
      return;
    }

    unlockScroll('fallback');
  }

  function installHooks() {
    [
      'groups:end',
      'hha:end',
      'game:end',
      'groups:summary',
      'hha:summary',
      'groups:v87:summary-ready'
    ].forEach(function (name) {
      WIN.addEventListener(name, function () {
        setTimeout(() => applyMode(name), 30);
      });
    });

    [
      'groups:start',
      'hha:start',
      'game:start',
      'groups:play',
      'hha:play',
      'groups:v831:countdown-done'
    ].forEach(function (name) {
      WIN.addEventListener(name, function () {
        setTimeout(() => applyMode(name), 30);
      });
    });

    DOC.addEventListener('click', function () {
      setTimeout(() => applyMode('click'), 80);
      setTimeout(() => applyMode('click-late'), 450);
    }, true);

    WIN.addEventListener('resize', function () {
      applyMode('resize');
    });

    WIN.addEventListener('orientationchange', function () {
      setTimeout(() => applyMode('orientationchange'), 300);
    });
  }

  function publicApi() {
    WIN.HHA_GROUPS_V88_SCROLL = {
      version: VERSION,
      unlock: unlockScroll,
      lock: lockScroll,
      apply: applyMode,
      getState: function () {
        return {
          version: VERSION,
          summary: looksLikeSummary(),
          gameplay: isGameplay(),
          intro: hasStartOrIntro(),
          countdown: isCountdown(),
          htmlClass: DOC.documentElement.className,
          bodyClass: DOC.body.className
        };
      }
    };
  }

  function init() {
    injectStyle();
    installHooks();
    publicApi();

    applyMode('init');

    setInterval(function () {
      applyMode('interval');
    }, 350);

    console.info('[GroupsSolo v8.8] mobile scroll fix installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();