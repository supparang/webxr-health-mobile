// === /herohealth/vr-groups/groups-solo-v8-clean-ramp-fix.js ===
// Groups Solo v8.2.2 — Summary Clean + Soft Start Ramp Fix
// FIX:
// 1) hide/kill all floating targets, FX, toasts, mission panels on summary/end
// 2) reduce early-game spawn pressure
// 3) slow down target fall speed during first 20–30 sec
// PATCH v20260512-GROUPS-SOLO-V822-CLEAN-RAMP

(function () {
  'use strict';

  const VERSION = 'v8.2.2-clean-ramp-20260512';

  if (window.__HHA_GROUPS_SOLO_V822_CLEAN_RAMP__) {
    console.warn('[GroupsSolo v8.2.2] already installed');
    return;
  }

  window.__HHA_GROUPS_SOLO_V822_CLEAN_RAMP__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    startedAt: 0,
    playing: false,
    ended: false,
    lastCleanupAt: 0,
    cleanupTimer: null
  };

  function qs(name, fallback = '') {
    try {
      const u = new URL(location.href);
      return u.searchParams.get(name) || fallback;
    } catch (e) {
      return fallback;
    }
  }

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
          tx.includes('ดาว / คะแนน') ||
          tx.includes('ความแม่นยำ') ||
          tx.includes('คอมโบสูงสุด')
        ) {
          return true;
        }
      }
    }

    const bodyText = textOf(DOC.body);
    return (
      bodyText.includes('สรุปผลการเล่น') &&
      bodyText.includes('Hero Rank') &&
      bodyText.includes('ความแม่นยำ')
    );
  }

  function injectStyle() {
    if (DOC.getElementById('hha-groups-v822-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-groups-v822-style';
    style.textContent = `
      /*
        Summary / End = ห้ามมีอะไรแว๊บ ๆ ทับหน้าสรุป
      */
      body.hha-groups-v822-ended .hha-groups-v82-layer,
      body.hha-groups-v822-ended .hha-groups-v82-target,
      body.hha-groups-v822-ended [data-hha-v82-target="1"],
      body.hha-groups-v822-ended .hha-groups-v82-chip,
      body.hha-groups-v822-ended .hha-groups-v82-fx,
      body.hha-groups-v822-ended .hha-groups-v81-pop,
      body.hha-groups-v822-ended .hha-groups-v81-toast,
      body.hha-groups-v822-ended .hha-groups-v8-toast,
      body.hha-groups-v822-ended .hha-groups-v8-burst,
      body.hha-groups-v822-ended .hha-groups-v81-mission,
      body.hha-groups-v822-ended .hha-groups-v81-bossbar,
      body.hha-groups-v822-ended .hha-groups-v8-panel{
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
        animation: none !important;
      }

      /*
        ช่วงเริ่มเกม ลดความเร็ว/ลดความวุ่นวายก่อน
      */
      body.hha-groups-v822-softstart .hha-groups-v82-target{
        animation-duration: calc(var(--life, 4200ms) * 1.28) !important;
      }

      body.hha-groups-v822-softstart .hha-groups-v82-target.boss{
        animation-duration: calc(var(--life, 3600ms) * 1.18) !important;
      }

      /*
        ลดความใหญ่/ความหนาแน่นทางสายตาของ target layer นิดหนึ่ง
      */
      body.hha-groups-v822-softstart .hha-groups-v82-target{
        width: clamp(48px, 8vw, 66px) !important;
        height: clamp(48px, 8vw, 66px) !important;
        border-radius: 20px !important;
        font-size: clamp(25px, 4.4vw, 36px) !important;
      }

      @media (max-width:640px){
        body.hha-groups-v822-softstart .hha-groups-v82-target{
          width: clamp(46px, 11vw, 60px) !important;
          height: clamp(46px, 11vw, 60px) !important;
          font-size: clamp(24px, 7vw, 34px) !important;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function killFloatingThings(reason) {
    const now = Date.now();
    if (now - state.lastCleanupAt < 80) return;
    state.lastCleanupAt = now;

    const selectors = [
      '.hha-groups-v82-target',
      '[data-hha-v82-target="1"]',
      '.hha-groups-v82-fx',
      '.hha-groups-v81-pop',
      '.hha-groups-v8-burst'
    ];

    selectors.forEach(function (sel) {
      DOC.querySelectorAll(sel).forEach(function (el) {
        try {
          clearTimeout(el.__hhaV82Timeout);
          el.remove();
        } catch (e) {}
      });
    });

    try {
      if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.killAllTargets === 'function') {
        WIN.HHA_GROUPS_V82.killAllTargets();
      }
    } catch (e) {}

    try {
      WIN.dispatchEvent(new CustomEvent('groups:v822:cleanup', {
        detail: {
          reason: reason || 'cleanup',
          version: VERSION
        }
      }));
    } catch (e) {}
  }

  function markEnded(reason) {
    if (state.ended) {
      killFloatingThings(reason || 'ended-again');
      return;
    }

    state.ended = true;
    state.playing = false;

    DOC.body.classList.add('hha-groups-v822-ended');
    DOC.body.classList.remove('hha-groups-v822-playing');
    DOC.body.classList.remove('hha-groups-v822-softstart');

    killFloatingThings(reason || 'ended');

    /*
      กัน delayed setTimeout ที่ยิงตามหลัง summary 1–2 วินาที
    */
    clearInterval(state.cleanupTimer);
    state.cleanupTimer = setInterval(function () {
      killFloatingThings('post-end-clean-loop');

      if (!looksLikeSummary()) return;

      DOC.body.classList.add('hha-groups-v822-ended');
    }, 160);

    setTimeout(function () {
      clearInterval(state.cleanupTimer);
      state.cleanupTimer = null;
      killFloatingThings('post-end-final-clean');
    }, 3500);
  }

  function markStarted(reason) {
    if (state.ended) return;

    if (!state.startedAt) {
      state.startedAt = Date.now();
    }

    state.playing = true;

    DOC.body.classList.add('hha-groups-v822-playing');
    DOC.body.classList.add('hha-groups-v822-softstart');
    DOC.body.classList.remove('hha-groups-v822-ended');

    /*
      ช่วง 25 วิแรกให้เป็น soft start
      หลังจากนั้นค่อยปล่อยให้ storm/boss ทำงานเต็มขึ้น
    */
    setTimeout(function () {
      if (state.ended) return;
      DOC.body.classList.remove('hha-groups-v822-softstart');
    }, 25000);

    try {
      WIN.dispatchEvent(new CustomEvent('groups:v822:start', {
        detail: {
          reason: reason || 'start',
          version: VERSION
        }
      }));
    } catch (e) {}
  }

  /*
    ปรับ tuning กลางให้ v8.1/v8.2 ใช้ค่าที่ช้าลงในช่วงต้นเกม
    สำคัญ: ไม่ไปแก้ state private ของ v8.2 โดยตรง แต่ override tuning output
  */
  function installTuningOverride() {
    const wait = setInterval(function () {
      const api = WIN.HHA_GROUPS_V81;
      if (!api || typeof api.getTuning !== 'function') return;

      clearInterval(wait);

      if (api.__HHA_V822_TUNING_PATCHED__) return;
      api.__HHA_V822_TUNING_PATCHED__ = true;

      const originalGetTuning = api.getTuning.bind(api);

      api.getTuning = function () {
        const t = Object.assign({}, originalGetTuning());

        if (state.ended || looksLikeSummary()) {
          t.spawnMs = 999999;
          t.fallSpeed = 0.1;
          t.distractorRate = 0;
          t.targetScale = 0.01;
          t.phase = 'ended';
          return t;
        }

        const elapsed = state.startedAt ? Date.now() - state.startedAt : 0;
        const sec = elapsed / 1000;

        /*
          Soft ramp:
          0–10s   ช้ามาก / เป้าน้อย
          10–25s  ค่อย ๆ เพิ่ม
          หลัง 25s ให้กลับไปใกล้ค่าปกติ
        */
        if (state.playing && sec < 25) {
          const ramp = Math.max(0, Math.min(1, sec / 25));

          const slowFactor = 1.75 - ramp * 0.45;
          const speedFactor = 0.72 + ramp * 0.2;

          t.spawnMs = Math.max(900, Math.round(Number(t.spawnMs || 980) * slowFactor));
          t.fallSpeed = Math.max(0.55, Number(t.fallSpeed || 1) * speedFactor);
          t.distractorRate = Math.min(Number(t.distractorRate || 0.22), 0.18 + ramp * 0.08);
          t.targetScale = Math.min(Number(t.targetScale || 1), 0.96);
        }

        WIN.HHA_GROUPS_V822_TUNING = Object.assign({}, t, {
          source: VERSION,
          elapsedSec: Math.round(sec),
          softStart: state.playing && sec < 25,
          ended: state.ended
        });

        return t;
      };

      console.info('[GroupsSolo v8.2.2] tuning override installed');
    }, 120);

    setTimeout(function () {
      clearInterval(wait);
    }, 6000);
  }

  /*
    ลดจำนวนเป้าที่อยู่พร้อมกัน โดยลบตัวที่เกินออก
    เพราะ v8.2 state private แก้ activeLimit จากภายนอกไม่ได้
    จึงใช้ safety cap ชั้นนอก
  */
  function installActiveTargetCap() {
    setInterval(function () {
      if (state.ended || looksLikeSummary()) {
        markEnded('summary-detected-by-cap');
        return;
      }

      if (!state.playing) return;

      const elapsed = state.startedAt ? (Date.now() - state.startedAt) / 1000 : 0;
      const isMobile = WIN.innerWidth <= 640;

      let cap = 2;

      if (elapsed > 10) cap = 3;
      if (elapsed > 25) cap = 4;
      if (elapsed > 45) cap = 5;

      if (isMobile) cap = Math.max(2, cap - 1);

      const targets = Array.from(DOC.querySelectorAll('.hha-groups-v82-target,[data-hha-v82-target="1"]'))
        .filter(isVisible);

      if (targets.length <= cap) return;

      targets.slice(0, targets.length - cap).forEach(function (el) {
        try {
          clearTimeout(el.__hhaV82Timeout);
          el.remove();
        } catch (e) {}
      });
    }, 180);
  }

  function installEventHooks() {
    DOC.addEventListener('click', function (ev) {
      const tx = textOf(ev.target && ev.target.closest
        ? ev.target.closest('button,a,[role="button"],.btn,.button,[data-start],[data-action]')
        : ev.target
      );

      if (
        tx.includes('เริ่ม') ||
        tx.includes('เล่น') ||
        tx.toLowerCase().includes('start') ||
        tx.toLowerCase().includes('play')
      ) {
        markStarted('button-click');
      }
    }, true);

    [
      'groups:start',
      'hha:start',
      'game:start',
      'groups:play',
      'hha:play'
    ].forEach(function (name) {
      WIN.addEventListener(name, function () {
        markStarted(name);
      });
    });

    [
      'groups:end',
      'hha:end',
      'game:end',
      'groups:summary',
      'hha:summary',
      'groups:v82:end',
      'hha:summary-enriched'
    ].forEach(function (name) {
      WIN.addEventListener(name, function () {
        markEnded(name);
      });
    });

    WIN.addEventListener('pagehide', function () {
      killFloatingThings('pagehide');
    });
  }

  function summaryWatcher() {
    setInterval(function () {
      if (looksLikeSummary()) {
        markEnded('summary-watcher');
      }
    }, 180);
  }

  function publicApi() {
    WIN.HHA_GROUPS_V822 = {
      version: VERSION,
      start: markStarted,
      end: markEnded,
      cleanup: killFloatingThings,
      getState: function () {
        return {
          version: VERSION,
          startedAt: state.startedAt,
          playing: state.playing,
          ended: state.ended,
          summaryVisible: looksLikeSummary()
        };
      }
    };
  }

  function init() {
    injectStyle();
    installEventHooks();
    installTuningOverride();
    installActiveTargetCap();
    summaryWatcher();
    publicApi();

    /*
      ถ้าโหลดมาเจอ summary อยู่แล้ว เช่น replay/back cache
      ให้เคลียร์ทันที
    */
    if (looksLikeSummary()) {
      markEnded('init-summary');
    } else {
      killFloatingThings('init-clean');
    }

    console.info('[GroupsSolo v8.2.2] clean ramp fix installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
