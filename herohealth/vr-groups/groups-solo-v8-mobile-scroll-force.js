// === /herohealth/vr-groups/groups-solo-v8-mobile-scroll-force.js ===
// HeroHealth Groups Solo — v8.8.1 Force Mobile Scroll
// FIX: intro/how-to screen still cannot scroll on mobile because old scripts lock overflow/touchmove.
// PATCH v20260513-GROUPS-SOLO-V881-MOBILE-SCROLL-FORCE

(function () {
  'use strict';

  const VERSION = 'v8.8.1-mobile-scroll-force-20260513';

  if (window.__HHA_GROUPS_SOLO_V881_MOBILE_SCROLL_FORCE__) {
    console.warn('[GroupsSolo v8.8.1] already installed');
    return;
  }

  window.__HHA_GROUPS_SOLO_V881_MOBILE_SCROLL_FORCE__ = true;

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
        ) {
          return true;
        }
      }
    }

    return false;
  }

  function looksLikeIntro() {
    const tx = textOf(DOC.body);

    return (
      tx.includes('Groups Solo Arena') ||
      tx.includes('แตะอาหาร') ||
      tx.includes('ประตูหมู่') ||
      tx.includes('ก่อนอาหารชนพื้น') ||
      tx.includes('ดูหมู่') ||
      tx.includes('สู้บอส') ||
      tx.includes('กลับ Nutrition Zone')
    );
  }

  function hasVisibleStartButton() {
    const nodes = DOC.querySelectorAll(
      'button,a,[role="button"],.btn,.button,.start,.play,.start-btn,.play-btn,[data-start],[data-action]'
    );

    for (const n of nodes) {
      if (!isVisible(n)) continue;

      const tx = textOf(n).toLowerCase();
      const action = String(n.getAttribute('data-action') || n.getAttribute('data-start') || '').toLowerCase();

      if (
        action.includes('start') ||
        action.includes('play') ||
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
      DOC.getElementById('hha-groups-v831-overlay') ||
      DOC.getElementById('hha-groups-v83-countdown') ||
      DOC.body.classList.contains('hha-groups-v831-counting') ||
      DOC.body.classList.contains('hha-groups-v83-counting')
    );
  }

  function hasActiveTargets() {
    const targets = DOC.querySelectorAll('.hha-groups-v82-target,[data-hha-v82-target="1"]');

    for (const t of targets) {
      if (isVisible(t)) return true;
    }

    return false;
  }

  function shouldForceScroll() {
    if (isCountdown()) return false;
    if (hasActiveTargets()) return false;
    if (looksLikeSummary()) return true;
    if (hasVisibleStartButton()) return true;
    if (looksLikeIntro()) return true;

    return false;
  }

  function injectStyle() {
    if (DOC.getElementById('hha-groups-v881-force-scroll-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-groups-v881-force-scroll-style';
    style.textContent = `
      /*
        FORCE INTRO/START/SUMMARY SCROLL
        This overrides older gameplay locks: overflow:hidden, height:100vh, touch-action:none.
      */

      html.hha-groups-v881-force-scroll,
      html.hha-groups-v881-force-scroll body{
        width: 100% !important;
        height: auto !important;
        min-height: 100% !important;
        max-height: none !important;
        overflow-x: hidden !important;
        overflow-y: scroll !important;
        overscroll-behavior-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
        touch-action: pan-y !important;
        position: static !important;
      }

      body.hha-groups-v881-force-scroll{
        min-height: 100dvh !important;
        max-height: none !important;
        overflow-y: scroll !important;
        touch-action: pan-y !important;
        padding-bottom: calc(160px + env(safe-area-inset-bottom, 0px)) !important;
      }

      body.hha-groups-v881-force-scroll *{
        touch-action: pan-y !important;
      }

      /*
        Unlock common fixed/fullscreen wrappers on intro page.
      */
      body.hha-groups-v881-force-scroll main,
      body.hha-groups-v881-force-scroll #app,
      body.hha-groups-v881-force-scroll .app,
      body.hha-groups-v881-force-scroll .page,
      body.hha-groups-v881-force-scroll .screen,
      body.hha-groups-v881-force-scroll .start-screen,
      body.hha-groups-v881-force-scroll .intro,
      body.hha-groups-v881-force-scroll .howto,
      body.hha-groups-v881-force-scroll .container,
      body.hha-groups-v881-force-scroll .wrap,
      body.hha-groups-v881-force-scroll .shell,
      body.hha-groups-v881-force-scroll .card,
      body.hha-groups-v881-force-scroll .panel,
      body.hha-groups-v881-force-scroll .hero,
      body.hha-groups-v881-force-scroll .hero-card,
      body.hha-groups-v881-force-scroll .game-card,
      body.hha-groups-v881-force-scroll .start-card,
      body.hha-groups-v881-force-scroll .menu-card{
        height: auto !important;
        min-height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        overflow-y: visible !important;
        overscroll-behavior-y: auto !important;
        touch-action: pan-y !important;
      }

      /*
        Some shells use body > div fixed inset 0.
        On intro/summary, convert only non-overlay direct children back to normal flow.
      */
      body.hha-groups-v881-force-scroll > div:not(#hha-groups-v82-layer):not(#hha-groups-v831-overlay):not(#hha-groups-v83-countdown):not(.hha-groups-v82-layer):not(.hha-groups-v831-overlay):not(.hha-groups-v83-countdown){
        max-height: none !important;
        overflow: visible !important;
        overflow-y: visible !important;
      }

      /*
        Hide gameplay floating layer while intro/summary scroll is forced.
      */
      body.hha-groups-v881-force-scroll .hha-groups-v82-layer,
      body.hha-groups-v881-force-scroll .hha-groups-v82-target,
      body.hha-groups-v881-force-scroll [data-hha-v82-target="1"],
      body.hha-groups-v881-force-scroll .hha-groups-v82-chip,
      body.hha-groups-v881-force-scroll .hha-groups-v82-fx{
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /*
        Keep buttons tappable.
      */
      body.hha-groups-v881-force-scroll button,
      body.hha-groups-v881-force-scroll a,
      body.hha-groups-v881-force-scroll [role="button"]{
        touch-action: manipulation !important;
      }

      body.hha-groups-v881-force-scroll #hha-groups-v8-return,
      body.hha-groups-v881-force-scroll .hha-groups-v8-return{
        position: fixed !important;
        left: 12px !important;
        bottom: calc(12px + env(safe-area-inset-bottom, 0px)) !important;
        z-index: 99990 !important;
        touch-action: manipulation !important;
      }

      .hha-groups-v881-bottom-spacer{
        display: block !important;
        height: calc(180px + env(safe-area-inset-bottom, 0px)) !important;
        width: 100% !important;
        pointer-events: none !important;
        flex: 0 0 auto !important;
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureSpacer() {
    let sp = DOC.getElementById('hha-groups-v881-bottom-spacer');
    if (sp) return sp;

    sp = DOC.createElement('div');
    sp.id = 'hha-groups-v881-bottom-spacer';
    sp.className = 'hha-groups-v881-bottom-spacer';
    DOC.body.appendChild(sp);

    return sp;
  }

  function forceUnlock(reason) {
    injectStyle();
    ensureSpacer();

    DOC.documentElement.classList.add('hha-groups-v881-force-scroll');
    DOC.body.classList.add('hha-groups-v881-force-scroll');

    DOC.documentElement.classList.remove('hha-groups-v88-scroll-locked');
    DOC.body.classList.remove('hha-groups-v88-scroll-locked');

    DOC.documentElement.classList.add('hha-groups-v88-scroll-unlocked');
    DOC.body.classList.add('hha-groups-v88-scroll-unlocked');

    DOC.documentElement.style.setProperty('height', 'auto', 'important');
    DOC.documentElement.style.setProperty('min-height', '100%', 'important');
    DOC.documentElement.style.setProperty('overflow-y', 'scroll', 'important');
    DOC.documentElement.style.setProperty('touch-action', 'pan-y', 'important');
    DOC.documentElement.style.setProperty('position', 'static', 'important');

    DOC.body.style.setProperty('height', 'auto', 'important');
    DOC.body.style.setProperty('min-height', '100dvh', 'important');
    DOC.body.style.setProperty('overflow-y', 'scroll', 'important');
    DOC.body.style.setProperty('touch-action', 'pan-y', 'important');
    DOC.body.style.setProperty('position', 'static', 'important');

    try {
      if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.killAllTargets === 'function') {
        WIN.HHA_GROUPS_V82.killAllTargets();
      }
    } catch (e) {}

    try {
      WIN.dispatchEvent(new CustomEvent('groups:v881:scroll-force-unlock', {
        detail: { version: VERSION, reason: reason || 'unlock' }
      }));
    } catch (e) {}
  }

  function releaseForce(reason) {
    DOC.documentElement.classList.remove('hha-groups-v881-force-scroll');
    DOC.body.classList.remove('hha-groups-v881-force-scroll');

    const sp = DOC.getElementById('hha-groups-v881-bottom-spacer');
    if (sp) sp.remove();
  }

  function apply(reason) {
    if (shouldForceScroll()) {
      forceUnlock(reason);
    } else {
      releaseForce(reason);
    }
  }

  function unblockTouchMove(ev) {
    if (!shouldForceScroll()) return;

    /*
      Important:
      Do NOT preventDefault.
      Stop old game listeners from preventing scroll.
    */
    ev.stopImmediatePropagation();

    DOC.documentElement.style.setProperty('overflow-y', 'scroll', 'important');
    DOC.body.style.setProperty('overflow-y', 'scroll', 'important');
    DOC.body.style.setProperty('touch-action', 'pan-y', 'important');
  }

  function unblockWheel(ev) {
    if (!shouldForceScroll()) return;

    ev.stopImmediatePropagation();

    DOC.documentElement.style.setProperty('overflow-y', 'scroll', 'important');
    DOC.body.style.setProperty('overflow-y', 'scroll', 'important');
  }

  function installHooks() {
    /*
      Capture at window before older document/body listeners.
      This is the part v8.8 did not do.
    */
    WIN.addEventListener('touchmove', unblockTouchMove, { capture: true, passive: false });
    WIN.addEventListener('wheel', unblockWheel, { capture: true, passive: false });

    WIN.addEventListener('touchstart', function () {
      apply('touchstart');
    }, { capture: true, passive: true });

    WIN.addEventListener('resize', function () {
      apply('resize');
    });

    WIN.addEventListener('orientationchange', function () {
      setTimeout(() => apply('orientationchange'), 250);
    });

    DOC.addEventListener('click', function () {
      setTimeout(() => apply('click-80'), 80);
      setTimeout(() => apply('click-450'), 450);
    }, true);

    [
      'groups:end',
      'hha:end',
      'game:end',
      'groups:summary',
      'hha:summary',
      'groups:v87:summary-ready'
    ].forEach(function (name) {
      WIN.addEventListener(name, function () {
        setTimeout(() => apply(name), 50);
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
        setTimeout(() => apply(name), 80);
      });
    });

    const mo = new MutationObserver(function () {
      apply('mutation');
    });

    mo.observe(DOC.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  function publicApi() {
    WIN.HHA_GROUPS_V881_SCROLL_FORCE = {
      version: VERSION,
      apply,
      unlock: forceUnlock,
      release: releaseForce,
      getState: function () {
        return {
          version: VERSION,
          shouldForceScroll: shouldForceScroll(),
          intro: looksLikeIntro(),
          summary: looksLikeSummary(),
          startButton: hasVisibleStartButton(),
          countdown: isCountdown(),
          activeTargets: hasActiveTargets(),
          htmlClass: DOC.documentElement.className,
          bodyClass: DOC.body.className,
          scrollHeight: DOC.documentElement.scrollHeight,
          innerHeight: WIN.innerHeight
        };
      }
    };
  }

  function init() {
    injectStyle();
    installHooks();
    publicApi();

    apply('init');

    /*
      Beat older intervals that keep re-locking scroll.
    */
    setInterval(function () {
      apply('interval-fast');
    }, 90);

    setInterval(function () {
      apply('interval-slow');
    }, 500);

    console.info('[GroupsSolo v8.8.1] mobile scroll force installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();