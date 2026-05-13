// === /herohealth/vr-groups/groups-solo-v8-mobile-declutter.js ===
// HeroHealth Groups Solo — v8.9.1 Rescue Declutter
// FIX: v8.9 detected gameplay too early and could block Start/Intro.
// This version NEVER locks/hides intro until real gameplay is confirmed.
// PATCH v20260513-GROUPS-SOLO-V891-RESCUE

(function () {
  'use strict';

  const VERSION = 'v8.9.1-rescue-declutter-20260513';

  if (window.__HHA_GROUPS_SOLO_V891_RESCUE_DECLUTTER__) {
    console.warn('[GroupsSolo v8.9.1] already installed');
    return;
  }
  window.__HHA_GROUPS_SOLO_V891_RESCUE_DECLUTTER__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    confirmedPlaying: false,
    ended: false,
    countdownDone: false,
    lastMode: 'intro',
    lastApplyAt: 0
  };

  function textOf(el) {
    return String(el ? (el.textContent || '') : '').replace(/\s+/g, ' ').trim();
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8;
  }

  function looksLikeSummary() {
    const tx = textOf(DOC.body);
    return (
      tx.includes('สรุปผลการเล่น') ||
      tx.includes('Hero Rank') ||
      tx.includes('Food Rookie') ||
      tx.includes('ความแม่นยำ') ||
      tx.includes('คอมโบสูงสุด')
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

  function hasVisibleStartButton() {
    const nodes = DOC.querySelectorAll(
      'button,a,[role="button"],.btn,.button,.start,.play,.start-btn,.play-btn,[data-start],[data-action]'
    );

    for (const n of nodes) {
      if (!isVisible(n)) continue;

      const tx = textOf(n).toLowerCase();
      const action = String(n.getAttribute('data-action') || n.getAttribute('data-start') || '').toLowerCase();

      const isStart =
        action.includes('start') ||
        action.includes('play') ||
        tx.includes('เริ่ม') ||
        tx.includes('เล่น') ||
        tx.includes('start') ||
        tx.includes('play');

      const isBack =
        tx.includes('กลับ') ||
        tx.includes('nutrition') ||
        tx.includes('zone') ||
        tx.includes('hub');

      if (isStart && !isBack) return true;
    }

    return false;
  }

  function hasActiveV82Targets() {
    const nodes = DOC.querySelectorAll('.hha-groups-v82-target,[data-hha-v82-target="1"]');
    for (const n of nodes) {
      if (isVisible(n)) return true;
    }
    return false;
  }

  function apiState(name) {
    try {
      const api = WIN[name];
      if (api && typeof api.getState === 'function') return api.getState() || {};
    } catch (e) {}
    return {};
  }

  function isRealGameplay() {
    if (state.ended || looksLikeSummary()) return false;
    if (isCountdown()) return false;

    /*
      สำคัญ:
      ห้ามใช้ข้อความ Wave / หมู่ 1–5 / Groups Solo Arena เป็นตัวตัดสินแล้ว
      เพราะหน้า Intro ก็มีข้อความพวกนี้ ทำให้ v8.9 เดิมเข้าใจผิด
    */

    if (hasVisibleStartButton() && !state.countdownDone) return false;

    const s82 = apiState('HHA_GROUPS_V82');
    const s83 = apiState('HHA_GROUPS_V83');

    if (s82 && (s82.playing || s82.hasStarted) && !s82.ended) return true;
    if (s83 && s83.playing && !s83.ended && !s83.countdownActive) return true;

    if (hasActiveV82Targets()) return true;

    if (state.confirmedPlaying) return true;

    return false;
  }

  function injectStyle() {
    if (DOC.getElementById('hha-groups-v891-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-groups-v891-style';
    style.textContent = `
      :root{
        --hha-v891-safe-bottom: env(safe-area-inset-bottom, 0px);
      }

      /*
        Intro mode must stay clickable and scrollable.
      */
      html.hha-groups-v891-intro,
      html.hha-groups-v891-intro body{
        overflow-y: auto !important;
        touch-action: pan-y !important;
        height: auto !important;
        max-height: none !important;
      }

      body.hha-groups-v891-intro button,
      body.hha-groups-v891-intro a,
      body.hha-groups-v891-intro [role="button"]{
        pointer-events: auto !important;
        touch-action: manipulation !important;
      }

      /*
        Gameplay only: compact clutter.
        This class is added only after real gameplay is confirmed.
      */
      html.hha-groups-v891-playing,
      html.hha-groups-v891-playing body{
        overflow: hidden !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        touch-action: none !important;
        overscroll-behavior: none !important;
      }

      body.hha-groups-v891-playing{
        padding: 0 !important;
      }

      body.hha-groups-v891-playing .hha-groups-v8-panel,
      body.hha-groups-v891-playing .hha-groups-v81-mission,
      body.hha-groups-v891-playing .hha-groups-v81-bossbar,
      body.hha-groups-v891-playing .hha-groups-v82-chip,
      body.hha-groups-v891-playing .hha-groups-v87-mission{
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      body.hha-groups-v891-playing [data-hha-v891-hide-during-play="1"]{
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      body.hha-groups-v891-playing [data-hha-v891-prompt="1"]{
        position: fixed !important;
        left: 50% !important;
        bottom: calc(72px + var(--hha-v891-safe-bottom)) !important;
        transform: translateX(-50%) !important;
        z-index: 99940 !important;
        width: min(88vw, 500px) !important;
        max-height: 64px !important;
        overflow: hidden !important;
        border-radius: 22px !important;
        padding: 8px 12px !important;
        font-size: clamp(16px, 4.8vw, 24px) !important;
        line-height: 1.14 !important;
        background: rgba(255,255,255,.92) !important;
        box-shadow: 0 12px 28px rgba(35,81,107,.16) !important;
      }

      body.hha-groups-v891-playing [data-hha-v891-gate="1"]{
        width: clamp(50px, 13vw, 68px) !important;
        min-width: clamp(50px, 13vw, 68px) !important;
        max-width: clamp(50px, 13vw, 68px) !important;
        min-height: 72px !important;
        max-height: 96px !important;
        padding: 4px !important;
        border-radius: 18px !important;
        font-size: 11px !important;
        line-height: 1.05 !important;
        overflow: hidden !important;
      }

      body.hha-groups-v891-playing [data-hha-v891-gate="1"] *{
        font-size: min(11px, 3vw) !important;
        line-height: 1.05 !important;
      }

      body.hha-groups-v891-playing #hha-groups-v8-return,
      body.hha-groups-v891-playing .hha-groups-v8-return{
        left: 8px !important;
        bottom: calc(8px + var(--hha-v891-safe-bottom)) !important;
        max-width: 46vw !important;
        padding: 8px 10px !important;
        border-radius: 999px !important;
        font-size: 12px !important;
        opacity: .88 !important;
        z-index: 99960 !important;
      }

      .hha-groups-v891-mini{
        position: fixed;
        left: 50%;
        bottom: calc(10px + var(--hha-v891-safe-bottom));
        transform: translateX(-50%);
        z-index: 99955;
        width: min(48vw, 230px);
        border-radius: 999px;
        padding: 7px 9px;
        background: linear-gradient(135deg, rgba(255,255,255,.94), rgba(236,250,255,.9));
        border: 2px solid rgba(255,255,255,.92);
        box-shadow: 0 12px 30px rgba(35,81,107,.16);
        color: #244e68;
        font-family: system-ui, -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size: 11px;
        line-height: 1.15;
        font-weight: 1000;
        text-align: center;
        pointer-events: none;
        display: none;
      }

      body.hha-groups-v891-playing .hha-groups-v891-mini{
        display: block;
      }

      body.hha-groups-v891-summary .hha-groups-v891-mini,
      body.hha-groups-v891-countdown .hha-groups-v891-mini,
      body.hha-groups-v891-intro .hha-groups-v891-mini{
        display: none !important;
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureMini() {
    let el = DOC.getElementById('hha-groups-v891-mini');
    if (el) return el;

    el = DOC.createElement('div');
    el.id = 'hha-groups-v891-mini';
    el.className = 'hha-groups-v891-mini';
    el.textContent = 'ส่งอาหารเข้าประตูให้ถูกหมู่';
    DOC.body.appendChild(el);

    return el;
  }

  function getMissionText() {
    try {
      if (WIN.HHA_GROUPS_V87 && typeof WIN.HHA_GROUPS_V87.getState === 'function') {
        const s = WIN.HHA_GROUPS_V87.getState();
        const g = s && s.mission && s.mission.group;
        if (g && g.icon && g.label) return `${g.icon} หมู่ ${g.label}`;
      }
    } catch (e) {}

    try {
      if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.getState === 'function') {
        const s = WIN.HHA_GROUPS_V82.getState();
        const m = s && s.mission;
        if (m && m.icon && m.label) return `${m.icon} หมู่ ${m.label}`;
      }
    } catch (e) {}

    return 'ส่งเข้าประตูให้ถูกหมู่';
  }

  function updateMini() {
    ensureMini().textContent = getMissionText();
  }

  function markOnlyGameplayClutter() {
    /*
      ไม่แตะ intro ตอนยังไม่ได้เล่น
      จะ mark เฉพาะหลัง confirmed gameplay แล้วเท่านั้น
    */
    if (!state.confirmedPlaying) return;

    const nodes = DOC.querySelectorAll('div,section,article,p,h1,h2,h3,button,a,[role="button"]');

    nodes.forEach(function (el) {
      if (!el || el === DOC.body || el === DOC.documentElement) return;
      if (!isVisible(el)) return;

      const tx = textOf(el);
      if (!tx) return;

      const isBackOrStart =
        tx.includes('กลับ Nutrition Zone') ||
        tx.includes('เริ่ม') ||
        tx.includes('เล่น') ||
        tx.toLowerCase().includes('start') ||
        tx.toLowerCase().includes('play');

      /*
        ห้ามซ่อนปุ่มเริ่ม/ปุ่มกลับ
      */
      if (isBackOrStart) return;

      const introLike =
        tx.includes('Groups Solo Arena') ||
        tx.includes('แตะอาหารที่ตกลงมา') ||
        tx.includes('ก่อนอาหารชนพื้น') ||
        tx.includes('เลือกชิ้นที่ใกล้ชนพื้น') ||
        tx.includes('อาหารนี้อยู่หมู่ไหน') ||
        tx.includes('ทำคำสั่งบอสให้สำเร็จ') ||
        tx.includes('วิธีเล่น');

      if (introLike && tx.length < 900) {
        el.setAttribute('data-hha-v891-hide-during-play', '1');
      }

      const promptLike =
        tx.includes('เลือก') &&
        tx.includes('ส่ง') &&
        tx.includes('ประตูหมู่');

      if (promptLike && tx.length < 350) {
        el.setAttribute('data-hha-v891-prompt', '1');
      }

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
        el.setAttribute('data-hha-v891-gate', '1');
      }
    });
  }

  function removeBadOldClassesInIntro() {
    /*
      v8.9 เดิมอาจเคยทิ้ง class ไว้
      ต้องล้างเพื่อให้หน้า Start กลับมากดได้
    */
    DOC.documentElement.classList.remove('hha-groups-v89-playing');
    DOC.body.classList.remove('hha-groups-v89-playing');

    DOC.documentElement.style.removeProperty('overflow-y');
    DOC.body.style.removeProperty('overflow-y');
    DOC.body.style.removeProperty('touch-action');
  }

  function enterIntroMode(reason) {
    state.lastMode = 'intro';

    removeBadOldClassesInIntro();

    DOC.documentElement.classList.add('hha-groups-v891-intro');
    DOC.body.classList.add('hha-groups-v891-intro');

    DOC.documentElement.classList.remove('hha-groups-v891-playing');
    DOC.body.classList.remove('hha-groups-v891-playing');

    DOC.body.classList.remove('hha-groups-v891-summary');
    DOC.body.classList.remove('hha-groups-v891-countdown');

    DOC.documentElement.style.setProperty('overflow-y', 'auto', 'important');
    DOC.body.style.setProperty('overflow-y', 'auto', 'important');
    DOC.body.style.setProperty('touch-action', 'pan-y', 'important');
  }

  function enterGameplayMode(reason) {
    state.lastMode = 'playing';
    state.confirmedPlaying = true;

    DOC.documentElement.classList.remove('hha-groups-v891-intro');
    DOC.body.classList.remove('hha-groups-v891-intro');

    DOC.documentElement.classList.add('hha-groups-v891-playing');
    DOC.body.classList.add('hha-groups-v891-playing');

    DOC.body.classList.remove('hha-groups-v891-summary');
    DOC.body.classList.remove('hha-groups-v891-countdown');

    markOnlyGameplayClutter();
    updateMini();
  }

  function enterSummaryMode(reason) {
    state.lastMode = 'summary';
    state.ended = true;

    DOC.documentElement.classList.remove('hha-groups-v891-playing');
    DOC.body.classList.remove('hha-groups-v891-playing');

    DOC.documentElement.classList.remove('hha-groups-v891-intro');
    DOC.body.classList.remove('hha-groups-v891-intro');

    DOC.body.classList.add('hha-groups-v891-summary');

    DOC.documentElement.style.setProperty('overflow-y', 'auto', 'important');
    DOC.body.style.setProperty('overflow-y', 'auto', 'important');
    DOC.body.style.setProperty('touch-action', 'pan-y', 'important');
  }

  function enterCountdownMode(reason) {
    state.lastMode = 'countdown';

    DOC.body.classList.add('hha-groups-v891-countdown');
    DOC.documentElement.classList.remove('hha-groups-v891-playing');
    DOC.body.classList.remove('hha-groups-v891-playing');
  }

  function applyMode(reason) {
    injectStyle();

    const now = Date.now();
    if (now - state.lastApplyAt < 50) return;
    state.lastApplyAt = now;

    if (looksLikeSummary()) {
      enterSummaryMode(reason);
      return;
    }

    if (isCountdown()) {
      enterCountdownMode(reason);
      return;
    }

    if (isRealGameplay()) {
      enterGameplayMode(reason);
      return;
    }

    enterIntroMode(reason);
  }

  function installHooks() {
    [
      'groups:v831:countdown-done',
      'groups:start',
      'hha:start',
      'game:start',
      'groups:play',
      'hha:play'
    ].forEach(function (name) {
      WIN.addEventListener(name, function () {
        if (name === 'groups:v831:countdown-done') {
          state.countdownDone = true;
        }

        setTimeout(() => applyMode(name), 80);
        setTimeout(() => applyMode(name + '-late'), 600);
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
        state.ended = true;
        setTimeout(() => applyMode(name), 50);
      });
    });

    DOC.addEventListener('click', function () {
      /*
        อย่า block click ใด ๆ
        แค่ตรวจ mode หลัง click เท่านั้น
      */
      setTimeout(() => applyMode('click'), 100);
      setTimeout(() => applyMode('click-late'), 700);
    }, true);

    WIN.addEventListener('resize', () => applyMode('resize'));
    WIN.addEventListener('orientationchange', () => {
      setTimeout(() => applyMode('orientation'), 260);
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
    WIN.HHA_GROUPS_V891_RESCUE = {
      version: VERSION,
      apply: applyMode,
      confirmPlaying: function () {
        state.confirmedPlaying = true;
        applyMode('api-confirm-playing');
      },
      resetIntro: function () {
        state.confirmedPlaying = false;
        state.ended = false;
        enterIntroMode('api-reset-intro');
      },
      getState: function () {
        return {
          version: VERSION,
          confirmedPlaying: state.confirmedPlaying,
          ended: state.ended,
          countdownDone: state.countdownDone,
          mode: state.lastMode,
          summary: looksLikeSummary(),
          countdown: isCountdown(),
          startButton: hasVisibleStartButton(),
          activeTargets: hasActiveV82Targets(),
          realGameplay: isRealGameplay(),
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

    /*
      สำคัญมาก:
      เริ่มต้นต้องเป็น Intro mode เสมอ
      ไม่ให้ declutter เข้าใจผิดว่าเป็น gameplay
    */
    enterIntroMode('init');

    setInterval(function () {
      applyMode('interval');
      updateMini();
    }, 300);

    console.info('[GroupsSolo v8.9.1] rescue declutter installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
