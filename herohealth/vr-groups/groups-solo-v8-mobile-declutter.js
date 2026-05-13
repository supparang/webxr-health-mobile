// === /herohealth/vr-groups/groups-solo-v8-mobile-declutter.js ===
// HeroHealth Groups Solo — v8.9 Mobile Declutter + Gameplay Layer Fix
// FIX:
// 1) Hide intro/how-to/start content while gameplay is active
// 2) Hide duplicate/large panels that crowd mobile gameplay
// 3) Compact group gates, mission prompt, return button
// 4) Release v8.8 scroll-force during gameplay
// PATCH v20260513-GROUPS-SOLO-V89-MOBILE-DECLUTTER

(function () {
  'use strict';

  const VERSION = 'v8.9-mobile-declutter-20260513';

  if (window.__HHA_GROUPS_SOLO_V89_MOBILE_DECLUTTER__) {
    console.warn('[GroupsSolo v8.9] already installed');
    return;
  }
  window.__HHA_GROUPS_SOLO_V89_MOBILE_DECLUTTER__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    playing: false,
    summary: false,
    countdown: false,
    lastScanAt: 0,
    lastMode: '',
    marked: 0
  };

  function textOf(el) {
    return String(
      el
        ? el.textContent ||
            (el.getAttribute && el.getAttribute('aria-label')) ||
            ''
        : ''
    )
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const cs = getComputedStyle(el);
    if (
      cs.display === 'none' ||
      cs.visibility === 'hidden' ||
      Number(cs.opacity) === 0
    ) {
      return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8;
  }

  function looksLikeSummary() {
    const bodyText = textOf(DOC.body);
    return (
      bodyText.includes('สรุปผลการเล่น') ||
      bodyText.includes('Hero Rank') ||
      bodyText.includes('Food Rookie') ||
      bodyText.includes('ความแม่นยำ') ||
      bodyText.includes('คอมโบสูงสุด')
    );
  }

  function isCountdown() {
    return Boolean(
      DOC.getElementById('hha-groups-v831-overlay') ||
        DOC.getElementById('hha-groups-v83-countdown') ||
        DOC.body.classList.contains('hha-groups-v831-counting') ||
        DOC.body.classList.contains('hha-groups-v83-counting')
    );
  }

  function hasActiveGameplayTarget() {
    const selectors = [
      '.hha-groups-v82-target',
      '[data-hha-v82-target="1"]',
      '[data-hha-food-target="1"]',
      '.food-target',
      '.target-food',
      '.spawn-food'
    ];

    for (const sel of selectors) {
      const nodes = DOC.querySelectorAll(sel);
      for (const n of nodes) {
        if (isVisible(n)) return true;
      }
    }

    return false;
  }

  function looksLikeGameplay() {
    if (looksLikeSummary()) return false;
    if (isCountdown()) return false;

    const cls = String(DOC.body.className || '').toLowerCase();

    if (
      cls.includes('hha-groups-v821-playing') ||
      cls.includes('hha-groups-v822-playing') ||
      cls.includes('hha-groups-v83-playing') ||
      cls.includes('hha-groups-v87-playing') ||
      cls.includes('playing')
    ) {
      return true;
    }

    if (hasActiveGameplayTarget()) return true;

    const tx = textOf(DOC.body);

    return (
      tx.includes('Wave 1') ||
      tx.includes('Calm Phase') ||
      tx.includes('Fever:') ||
      tx.includes('Target Group') ||
      tx.includes('เลือก') && tx.includes('ส่งเข้าประตู') ||
      tx.includes('หมู่ 1') && tx.includes('หมู่ 5')
    );
  }

  function injectStyle() {
    if (DOC.getElementById('hha-groups-v89-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-groups-v89-style';
    style.textContent = `
      :root{
        --hha-v89-safe-top: env(safe-area-inset-top, 0px);
        --hha-v89-safe-bottom: env(safe-area-inset-bottom, 0px);
      }

      /*
        Gameplay mode: lock scrolling and remove intro/scroll-force classes.
      */
      html.hha-groups-v89-playing,
      html.hha-groups-v89-playing body{
        overflow: hidden !important;
        height: 100dvh !important;
        min-height: 100dvh !important;
        max-height: 100dvh !important;
        overscroll-behavior: none !important;
        touch-action: none !important;
      }

      body.hha-groups-v89-playing{
        padding: 0 !important;
      }

      /*
        Hide old intro/how-to/start content while gameplay is active.
      */
      body.hha-groups-v89-playing [data-hha-v89-hide-playing="1"]{
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      /*
        Hide duplicate or heavy panels during gameplay.
      */
      body.hha-groups-v89-playing .hha-groups-v8-panel,
      body.hha-groups-v89-playing .hha-groups-v81-mission,
      body.hha-groups-v89-playing .hha-groups-v81-bossbar,
      body.hha-groups-v89-playing .hha-groups-v82-chip,
      body.hha-groups-v89-playing .hha-groups-v87-mission,
      body.hha-groups-v89-playing [data-hha-v89-heavy-panel="1"]{
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /*
        Compact the big instruction prompt if the core game renders one.
      */
      body.hha-groups-v89-playing [data-hha-v89-big-prompt="1"]{
        position: fixed !important;
        left: 50% !important;
        bottom: calc(76px + var(--hha-v89-safe-bottom)) !important;
        transform: translateX(-50%) !important;
        z-index: 99940 !important;
        width: min(92vw, 520px) !important;
        max-height: 74px !important;
        overflow: hidden !important;
        border-radius: 22px !important;
        padding: 8px 12px !important;
        font-size: clamp(18px, 5vw, 28px) !important;
        line-height: 1.15 !important;
        background: rgba(255,255,255,.92) !important;
        box-shadow: 0 12px 32px rgba(35,81,107,.16) !important;
      }

      body.hha-groups-v89-playing [data-hha-v89-big-prompt="1"] *{
        font-size: inherit !important;
        line-height: 1.12 !important;
      }

      /*
        Compact the 1–5 group gates.
      */
      body.hha-groups-v89-playing [data-hha-v89-gate="1"]{
        width: clamp(50px, 13vw, 68px) !important;
        min-width: clamp(50px, 13vw, 68px) !important;
        max-width: clamp(50px, 13vw, 68px) !important;
        min-height: 72px !important;
        max-height: 96px !important;
        padding: 4px 4px !important;
        border-radius: 18px !important;
        font-size: 11px !important;
        line-height: 1.05 !important;
        overflow: hidden !important;
        box-shadow: 0 8px 22px rgba(35,81,107,.14) !important;
      }

      body.hha-groups-v89-playing [data-hha-v89-gate="1"] *{
        font-size: min(11px, 3vw) !important;
        line-height: 1.05 !important;
      }

      /*
        Reduce giant target cards/circles on mobile if they are too big.
      */
      body.hha-groups-v89-playing [data-hha-v89-big-target="1"]{
        transform: scale(.82) !important;
        transform-origin: center center !important;
        max-width: 42vw !important;
        max-height: 26vh !important;
      }

      /*
        Return button should not block gameplay.
      */
      body.hha-groups-v89-playing #hha-groups-v8-return,
      body.hha-groups-v89-playing .hha-groups-v8-return{
        left: 8px !important;
        bottom: calc(8px + var(--hha-v89-safe-bottom)) !important;
        max-width: 46vw !important;
        padding: 8px 10px !important;
        border-radius: 999px !important;
        font-size: 12px !important;
        opacity: .88 !important;
        z-index: 99960 !important;
      }

      /*
        Hide bottom spacer from scroll-force while playing.
      */
      body.hha-groups-v89-playing #hha-groups-v881-bottom-spacer,
      body.hha-groups-v89-playing .hha-groups-v881-bottom-spacer{
        display: none !important;
        height: 0 !important;
      }

      /*
        Custom compact mission pill.
      */
      .hha-groups-v89-mini{
        position: fixed;
        left: 50%;
        bottom: calc(10px + var(--hha-v89-safe-bottom));
        transform: translateX(-50%);
        z-index: 99955;
        width: min(52vw, 290px);
        border-radius: 999px;
        padding: 8px 12px;
        background: linear-gradient(135deg, rgba(255,255,255,.94), rgba(236,250,255,.9));
        border: 2px solid rgba(255,255,255,.92);
        box-shadow: 0 12px 30px rgba(35,81,107,.16);
        color: #244e68;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: clamp(11px, 3vw, 14px);
        line-height: 1.15;
        font-weight: 1000;
        text-align: center;
        pointer-events: none;
        display: none;
      }

      body.hha-groups-v89-playing .hha-groups-v89-mini{
        display: block;
      }

      body.hha-groups-v89-summary .hha-groups-v89-mini,
      body.hha-groups-v89-countdown .hha-groups-v89-mini{
        display: none !important;
      }

      @media (max-width: 640px){
        body.hha-groups-v89-playing [data-hha-v89-big-prompt="1"]{
          bottom: calc(68px + var(--hha-v89-safe-bottom)) !important;
          width: min(86vw, 420px) !important;
          max-height: 62px !important;
          padding: 7px 10px !important;
          font-size: clamp(16px, 4.8vw, 23px) !important;
        }

        .hha-groups-v89-mini{
          width: min(48vw, 230px);
          padding: 7px 9px;
          font-size: 11px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureMini() {
    let el = DOC.getElementById('hha-groups-v89-mini');
    if (el) return el;

    el = DOC.createElement('div');
    el.id = 'hha-groups-v89-mini';
    el.className = 'hha-groups-v89-mini';
    el.textContent = 'ดูโจทย์ แล้วส่งเข้าประตูให้ถูกหมู่';
    DOC.body.appendChild(el);

    return el;
  }

  function getMissionText() {
    try {
      if (WIN.HHA_GROUPS_V87 && typeof WIN.HHA_GROUPS_V87.getState === 'function') {
        const s = WIN.HHA_GROUPS_V87.getState();
        const m = s && s.mission && s.mission.group;
        if (m && m.icon && m.label) return `${m.icon} เก็บหมู่ ${m.label}`;
      }
    } catch (e) {}

    try {
      if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.getState === 'function') {
        const s = WIN.HHA_GROUPS_V82.getState();
        const m = s && s.mission;
        if (m && m.icon && m.label) return `${m.icon} เก็บหมู่ ${m.label}`;
      }
    } catch (e) {}

    const bodyText = textOf(DOC.body);
    const m = bodyText.match(/เลือก\s+([^\s]{1,4})\s+([^ ]{1,20})\s+แล้ว/);
    if (m) return `เลือก ${m[1]} ${m[2]}`;

    return 'ส่งอาหารเข้าประตูหมู่ให้ถูก';
  }

  function updateMini() {
    const el = ensureMini();
    el.textContent = getMissionText();
  }

  function markIntroAndClutter() {
    const now = Date.now();
    if (now - state.lastScanAt < 180) return;
    state.lastScanAt = now;

    const nodes = DOC.querySelectorAll(
      'main,section,article,div,h1,h2,h3,p,button,a,[role="button"]'
    );

    nodes.forEach(function (el) {
      if (!el || el === DOC.body || el === DOC.documentElement) return;

      const tx = textOf(el);
      if (!tx) return;

      /*
        Hide intro/how-to pieces only during gameplay.
      */
      const introLike =
        tx.includes('Groups Solo Arena') ||
        tx.includes('แตะอาหารที่ตกลงมา') ||
        tx.includes('ก่อนอาหารชนพื้น') ||
        tx.includes('เลือกชิ้นที่ใกล้ชนพื้น') ||
        tx.includes('อาหารนี้อยู่หมู่ไหน') ||
        tx.includes('ทำคำสั่งบอสให้สำเร็จ') ||
        tx.includes('วิธีเล่น');

      if (introLike && tx.length < 900) {
        el.setAttribute('data-hha-v89-hide-playing', '1');
        state.marked += 1;
      }

      /*
        Hide heavy duplicate panels.
      */
      const heavyLike =
        tx.includes('Comeback Shield') ||
        tx.includes('Teacher') ||
        tx.includes('Power') ||
        tx.includes('Fever: พร้อม') ||
        tx.includes('Daily') ||
        tx.includes('Target Group') ||
        tx.includes('Hero Rank') && !looksLikeSummary();

      if (heavyLike && tx.length < 900) {
        el.setAttribute('data-hha-v89-heavy-panel', '1');
      }

      /*
        Core big mission prompt.
      */
      const promptLike =
        tx.includes('เลือก') &&
        tx.includes('ส่ง') &&
        tx.includes('ประตูหมู่');

      if (promptLike && tx.length < 350) {
        el.setAttribute('data-hha-v89-big-prompt', '1');
      }

      /*
        Group gates: หมู่ 1–5.
      */
      const gateLike =
        /หมู่\s*[1-5]/.test(tx) &&
        (
          tx.includes('โปรตีน') ||
          tx.includes('ข้าว') ||
          tx.includes('แป้ง') ||
          tx.includes('ผัก') ||
          tx.includes('ผลไม้') ||
          tx.includes('ไขมัน')
        );

      if (gateLike && tx.length < 120) {
        el.setAttribute('data-hha-v89-gate', '1');
      }

      /*
        Big circular target cards.
      */
      const targetLike =
        (
          tx.includes('ผักใบเขียว') ||
          tx.includes('มะม่วง') ||
          tx.includes('Target Group')
        ) &&
        tx.length < 160;

      if (targetLike) {
        el.setAttribute('data-hha-v89-big-target', '1');
      }
    });
  }

  function releaseScrollForceForGameplay() {
    DOC.documentElement.classList.remove('hha-groups-v881-force-scroll');
    DOC.body.classList.remove('hha-groups-v881-force-scroll');

    DOC.documentElement.classList.remove('hha-groups-v88-scroll-unlocked');
    DOC.body.classList.remove('hha-groups-v88-scroll-unlocked');

    DOC.documentElement.classList.add('hha-groups-v89-playing');
    DOC.body.classList.add('hha-groups-v89-playing');

    DOC.documentElement.style.setProperty('overflow-y', 'hidden', 'important');
    DOC.body.style.setProperty('overflow-y', 'hidden', 'important');
    DOC.body.style.setProperty('touch-action', 'none', 'important');
  }

  function unlockForIntroOrSummary() {
    DOC.documentElement.classList.remove('hha-groups-v89-playing');
    DOC.body.classList.remove('hha-groups-v89-playing');

    if (looksLikeSummary()) {
      DOC.documentElement.style.setProperty('overflow-y', 'auto', 'important');
      DOC.body.style.setProperty('overflow-y', 'auto', 'important');
      DOC.body.style.setProperty('touch-action', 'pan-y', 'important');
    }
  }

  function applyMode(reason) {
    injectStyle();
    markIntroAndClutter();

    state.summary = looksLikeSummary();
    state.countdown = isCountdown();
    state.playing = looksLikeGameplay();

    DOC.body.classList.toggle('hha-groups-v89-summary', state.summary);
    DOC.body.classList.toggle('hha-groups-v89-countdown', state.countdown);

    if (state.playing && !state.summary && !state.countdown) {
      releaseScrollForceForGameplay();
      updateMini();
      state.lastMode = 'playing';
      return;
    }

    unlockForIntroOrSummary();
    state.lastMode = state.summary ? 'summary' : state.countdown ? 'countdown' : 'intro';
  }

  function installHooks() {
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
        setTimeout(() => applyMode(name + '-late'), 400);
      });
    });

    [
      'groups:end',
      'hha:end',
      'game:end',
      'groups:summary',
      'hha:summary',
      'groups:v82:end',
      'groups:v83:end',
      'groups:v87:summary-ready'
    ].forEach(function (name) {
      WIN.addEventListener(name, function () {
        setTimeout(() => applyMode(name), 30);
      });
    });

    DOC.addEventListener('click', function () {
      setTimeout(() => applyMode('click'), 80);
      setTimeout(() => applyMode('click-late'), 520);
    }, true);

    WIN.addEventListener('resize', function () {
      applyMode('resize');
    });

    WIN.addEventListener('orientationchange', function () {
      setTimeout(() => applyMode('orientation'), 250);
    });

    const mo = new MutationObserver(function () {
      applyMode('mutation');
    });

    mo.observe(DOC.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  function publicApi() {
    WIN.HHA_GROUPS_V89_DECLUTTER = {
      version: VERSION,
      apply: applyMode,
      getState: function () {
        return {
          version: VERSION,
          playing: state.playing,
          summary: state.summary,
          countdown: state.countdown,
          mode: state.lastMode,
          marked: state.marked,
          mission: getMissionText(),
          bodyClass: DOC.body.className,
          htmlClass: DOC.documentElement.className
        };
      }
    };
  }

  function init() {
    injectStyle();
    ensureMini();
    installHooks();
    publicApi();

    applyMode('init');

    setInterval(function () {
      applyMode('interval-fast');
    }, 160);

    setInterval(function () {
      updateMini();
    }, 650);

    console.info('[GroupsSolo v8.9] mobile declutter installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
