// === /herohealth/vr-groups/groups-solo-v8-start-balance.js ===
// HeroHealth Groups Solo — v8.3 Start Balance + Gameplay Feel
// Goal:
// 1) Start game with 3-2-1 cue, no target flood
// 2) Cap active targets softly in early game
// 3) Make food targets slower/smaller at start, then ramp up
// 4) Keep gameplay readable for children
// PATCH v20260512-GROUPS-SOLO-V83-START-BALANCE

(function () {
  'use strict';

  const VERSION = 'v8.3-start-balance-20260512';

  if (window.__HHA_GROUPS_SOLO_V83_START_BALANCE__) {
    console.warn('[GroupsSolo v8.3] already installed');
    return;
  }

  window.__HHA_GROUPS_SOLO_V83_START_BALANCE__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    startedAt: 0,
    playing: false,
    ended: false,
    countdownActive: false,
    tuningPatched: false,
    lastCapAt: 0,
    lastOverlayAt: 0,
    startLockUntil: 0
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
          tx.includes('ความแม่นยำ') ||
          tx.includes('คอมโบสูงสุด')
        ) {
          return true;
        }
      }
    }

    return false;
  }

  function looksLikeStartButton(el) {
    if (!el || !el.closest) return false;

    const btn = el.closest('button,a,[role="button"],.btn,.button,[data-start],[data-action]');
    if (!btn || !isVisible(btn)) return false;

    const tx = textOf(btn).toLowerCase();
    const action = String(btn.getAttribute('data-action') || btn.getAttribute('data-start') || '').toLowerCase();

    return (
      action.includes('start') ||
      action.includes('play') ||
      tx.includes('เริ่ม') ||
      tx.includes('เล่น') ||
      tx.includes('start') ||
      tx.includes('play')
    );
  }

  function elapsedSec() {
    if (!state.startedAt) return 0;
    return Math.max(0, (Date.now() - state.startedAt) / 1000);
  }

  function injectStyle() {
    if (DOC.getElementById('hha-groups-v83-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-groups-v83-style';
    style.textContent = `
      :root{
        --hha-v83-safe-top: env(safe-area-inset-top, 0px);
        --hha-v83-safe-bottom: env(safe-area-inset-bottom, 0px);
      }

      .hha-groups-v83-countdown{
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: grid;
        place-items: center;
        pointer-events: none;
        background:
          radial-gradient(circle at 50% 42%, rgba(255,255,255,.82), rgba(255,255,255,0) 42%),
          linear-gradient(180deg, rgba(218,244,255,.22), rgba(255,255,255,0));
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .hha-groups-v83-count-card{
        min-width: min(360px, 82vw);
        border-radius: 34px;
        padding: 26px 22px;
        text-align: center;
        background: linear-gradient(145deg, rgba(255,255,255,.96), rgba(237,250,255,.92));
        border: 3px solid rgba(255,255,255,.9);
        box-shadow: 0 24px 70px rgba(35,81,107,.18);
        color: #244e68;
        animation: hhaV83CardIn .28s ease both;
      }

      .hha-groups-v83-count-main{
        font-size: clamp(56px, 16vw, 108px);
        line-height: .9;
        font-weight: 1000;
        color: #6f96ad;
        text-shadow: 0 4px 0 rgba(255,255,255,.8);
        animation: hhaV83Pop .62s ease both;
      }

      .hha-groups-v83-count-sub{
        margin-top: 12px;
        font-size: clamp(18px, 4vw, 28px);
        font-weight: 1000;
      }

      .hha-groups-v83-count-tip{
        margin-top: 8px;
        font-size: clamp(13px, 3vw, 18px);
        font-weight: 850;
        opacity: .82;
      }

      .hha-groups-v83-coach{
        position: fixed;
        left: 50%;
        top: calc(12px + var(--hha-v83-safe-top));
        transform: translateX(-50%);
        z-index: 99986;
        width: min(520px, calc(100vw - 22px));
        border-radius: 999px;
        padding: 10px 14px;
        text-align: center;
        background: linear-gradient(135deg, rgba(255,255,255,.94), rgba(239,251,255,.9));
        border: 2px solid rgba(255,255,255,.9);
        box-shadow: 0 14px 36px rgba(35,81,107,.15);
        color: #244e68;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: clamp(12px, 2.8vw, 16px);
        font-weight: 1000;
        pointer-events: none;
        opacity: 0;
        animation: hhaV83Coach 4.2s ease both;
      }

      body.hha-groups-v83-counting .hha-groups-v82-layer,
      body.hha-groups-v83-counting .hha-groups-v82-target,
      body.hha-groups-v83-counting [data-hha-v82-target="1"]{
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /*
        Start readability: first seconds are slower and cleaner.
      */
      body.hha-groups-v83-stage0 .hha-groups-v82-target{
        width: clamp(46px, 8vw, 62px) !important;
        height: clamp(46px, 8vw, 62px) !important;
        border-radius: 20px !important;
        font-size: clamp(24px, 4.2vw, 34px) !important;
        animation-duration: calc(var(--life, 4200ms) * 1.45) !important;
      }

      body.hha-groups-v83-stage1 .hha-groups-v82-target{
        width: clamp(48px, 8.5vw, 66px) !important;
        height: clamp(48px, 8.5vw, 66px) !important;
        border-radius: 21px !important;
        font-size: clamp(25px, 4.4vw, 36px) !important;
        animation-duration: calc(var(--life, 4000ms) * 1.24) !important;
      }

      body.hha-groups-v83-stage2 .hha-groups-v82-target{
        width: clamp(50px, 9vw, 70px) !important;
        height: clamp(50px, 9vw, 70px) !important;
        animation-duration: calc(var(--life, 3800ms) * 1.08) !important;
      }

      /*
        ลด label ใต้เป้าในมือถือ เพื่อไม่รกสายตา
      */
      @media (max-width: 640px){
        .hha-groups-v83-coach{
          top: calc(8px + var(--hha-v83-safe-top));
          border-radius: 22px;
          padding: 8px 10px;
          line-height: 1.25;
        }

        body.hha-groups-v83-stage0 .hha-groups-v82-target,
        body.hha-groups-v83-stage1 .hha-groups-v82-target{
          width: clamp(44px, 10.5vw, 58px) !important;
          height: clamp(44px, 10.5vw, 58px) !important;
          font-size: clamp(23px, 6.5vw, 32px) !important;
        }
      }

      @keyframes hhaV83CardIn{
        from{ opacity: 0; transform: translateY(12px) scale(.96); }
        to{ opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes hhaV83Pop{
        0%{ opacity: 0; transform: scale(.72); }
        28%{ opacity: 1; transform: scale(1.14); }
        100%{ opacity: 1; transform: scale(1); }
      }

      @keyframes hhaV83Coach{
        0%{ opacity:0; transform:translateX(-50%) translateY(-12px); }
        14%{ opacity:1; transform:translateX(-50%) translateY(0); }
        82%{ opacity:1; transform:translateX(-50%) translateY(0); }
        100%{ opacity:0; transform:translateX(-50%) translateY(-10px); }
      }
    `;

    DOC.head.appendChild(style);
  }

  function killTargets(reason) {
    try {
      if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.killAllTargets === 'function') {
        WIN.HHA_GROUPS_V82.killAllTargets();
      }
    } catch (e) {}

    DOC.querySelectorAll('.hha-groups-v82-target,[data-hha-v82-target="1"],.hha-groups-v82-fx,.hha-groups-v81-pop,.hha-groups-v8-burst')
      .forEach(function (el) {
        try {
          clearTimeout(el.__hhaV82Timeout);
          el.remove();
        } catch (e) {}
      });

    try {
      WIN.dispatchEvent(new CustomEvent('groups:v83:cleanup', {
        detail: { version: VERSION, reason: reason || 'cleanup' }
      }));
    } catch (e) {}
  }

  function setSpawnEnabled(value) {
    try {
      if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.setEnabled === 'function') {
        WIN.HHA_GROUPS_V82.setEnabled(Boolean(value));
      }
    } catch (e) {}
  }

  function showCountdown() {
    if (state.countdownActive || state.ended || looksLikeSummary()) return;

    state.countdownActive = true;
    DOC.body.classList.add('hha-groups-v83-counting');

    killTargets('countdown-start');
    setSpawnEnabled(false);

    const overlay = DOC.createElement('div');
    overlay.id = 'hha-groups-v83-countdown';
    overlay.className = 'hha-groups-v83-countdown';

    overlay.innerHTML = `
      <div class="hha-groups-v83-count-card">
        <div class="hha-groups-v83-count-main" data-v83-count-main>3</div>
        <div class="hha-groups-v83-count-sub">เตรียมแยกหมู่อาหาร!</div>
        <div class="hha-groups-v83-count-tip">ดูโจทย์ก่อน แล้วค่อยแตะอาหารที่ถูกต้อง</div>
      </div>
    `;

    DOC.body.appendChild(overlay);

    const main = overlay.querySelector('[data-v83-count-main]');
    const steps = [
      { t: 0, text: '3', tip: 'ดูโจทย์ก่อน' },
      { t: 850, text: '2', tip: 'เก็บอาหารหมู่ที่กำหนด' },
      { t: 1700, text: '1', tip: 'อย่าแตะตัวหลอก!' },
      { t: 2550, text: 'เริ่ม!', tip: 'ลุยเลย' }
    ];

    steps.forEach(function (s) {
      setTimeout(function () {
        if (!main || !main.isConnected) return;
        main.textContent = s.text;
        main.style.animation = 'none';
        void main.offsetWidth;
        main.style.animation = 'hhaV83Pop .62s ease both';

        const tip = overlay.querySelector('.hha-groups-v83-count-tip');
        if (tip) tip.textContent = s.tip;
      }, s.t);
    });

    setTimeout(function () {
      overlay.remove();
      DOC.body.classList.remove('hha-groups-v83-counting');

      state.countdownActive = false;
      state.startLockUntil = Date.now() + 1200;

      setSpawnEnabled(true);

      try {
        if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.start === 'function') {
          WIN.HHA_GROUPS_V82.start();
        }
      } catch (e) {}

      showCoach('เริ่มเบา ๆ ก่อน: แตะอาหารตามภารกิจ แล้วหลบตัวหลอก');
    }, 3300);
  }

  function showCoach(text) {
    if (state.ended || looksLikeSummary()) return;

    const now = Date.now();
    if (now - state.lastOverlayAt < 1800) return;
    state.lastOverlayAt = now;

    const old = DOC.getElementById('hha-groups-v83-coach');
    if (old) old.remove();

    const el = DOC.createElement('div');
    el.id = 'hha-groups-v83-coach';
    el.className = 'hha-groups-v83-coach';
    el.textContent = text;
    DOC.body.appendChild(el);

    setTimeout(function () {
      el.remove();
    }, 4300);
  }

  function markStarted(reason) {
    if (state.ended || looksLikeSummary()) return;

    if (!state.startedAt) {
      state.startedAt = Date.now();
    }

    state.playing = true;

    DOC.body.classList.remove('hha-groups-v83-ended');
    DOC.body.classList.add('hha-groups-v83-playing');

    showCountdown();

    try {
      WIN.dispatchEvent(new CustomEvent('groups:v83:start', {
        detail: { version: VERSION, reason: reason || 'start' }
      }));
    } catch (e) {}
  }

  function markEnded(reason) {
    state.ended = true;
    state.playing = false;
    state.countdownActive = false;

    DOC.body.classList.add('hha-groups-v83-ended');
    DOC.body.classList.remove('hha-groups-v83-playing');
    DOC.body.classList.remove('hha-groups-v83-counting');
    DOC.body.classList.remove('hha-groups-v83-stage0');
    DOC.body.classList.remove('hha-groups-v83-stage1');
    DOC.body.classList.remove('hha-groups-v83-stage2');

    const overlay = DOC.getElementById('hha-groups-v83-countdown');
    if (overlay) overlay.remove();

    const coach = DOC.getElementById('hha-groups-v83-coach');
    if (coach) coach.remove();

    setSpawnEnabled(false);
    killTargets(reason || 'end');

    try {
      WIN.dispatchEvent(new CustomEvent('groups:v83:end', {
        detail: { version: VERSION, reason: reason || 'end' }
      }));
    } catch (e) {}
  }

  function updateStageClasses() {
    if (!state.playing || state.ended) return;

    const sec = elapsedSec();

    DOC.body.classList.toggle('hha-groups-v83-stage0', sec < 12);
    DOC.body.classList.toggle('hha-groups-v83-stage1', sec >= 12 && sec < 30);
    DOC.body.classList.toggle('hha-groups-v83-stage2', sec >= 30 && sec < 50);

    if (sec >= 50) {
      DOC.body.classList.remove('hha-groups-v83-stage0');
      DOC.body.classList.remove('hha-groups-v83-stage1');
      DOC.body.classList.remove('hha-groups-v83-stage2');
    }
  }

  function activeCap() {
    const sec = elapsedSec();
    const mobile = WIN.innerWidth <= 640;

    let cap = 1;

    if (sec >= 5) cap = 2;
    if (sec >= 14) cap = 3;
    if (sec >= 30) cap = 4;
    if (sec >= 50) cap = 5;

    if (mobile) cap = Math.max(1, cap - 1);

    return cap;
  }

  function enforceTargetCap() {
    if (!state.playing || state.ended || state.countdownActive || looksLikeSummary()) {
      killTargets('cap-not-playing');
      return;
    }

    const now = Date.now();
    if (now - state.lastCapAt < 120) return;
    state.lastCapAt = now;

    const targets = Array.from(
      DOC.querySelectorAll('.hha-groups-v82-target,[data-hha-v82-target="1"]')
    ).filter(isVisible);

    const cap = activeCap();

    if (targets.length <= cap) return;

    /*
      ลบตัวที่เก่าก่อน เพื่อไม่ให้จอแน่นเกิน
    */
    targets.slice(0, targets.length - cap).forEach(function (el) {
      try {
        clearTimeout(el.__hhaV82Timeout);
        el.remove();
      } catch (e) {}
    });
  }

  function installTuningOverride() {
    const wait = setInterval(function () {
      const api = WIN.HHA_GROUPS_V81;
      if (!api || typeof api.getTuning !== 'function') return;

      clearInterval(wait);

      if (api.__HHA_V83_TUNING_PATCHED__) return;
      api.__HHA_V83_TUNING_PATCHED__ = true;

      const originalGetTuning = api.getTuning.bind(api);

      api.getTuning = function () {
        const t = Object.assign({}, originalGetTuning());

        if (state.ended || looksLikeSummary() || state.countdownActive) {
          t.spawnMs = 999999;
          t.fallSpeed = 0.1;
          t.distractorRate = 0;
          t.targetScale = 0.01;
          t.phase = state.countdownActive ? 'countdown' : 'ended';
          return t;
        }

        const sec = elapsedSec();

        /*
          v8.3 curve:
          0–12s  = very calm
          12–30s = readable
          30–50s = normal ramp
          50s+   = allow core storm/boss
        */
        if (state.playing && sec < 50) {
          if (sec < 12) {
            t.spawnMs = Math.max(1700, Math.round(Number(t.spawnMs || 980) * 2.0));
            t.fallSpeed = Math.min(Number(t.fallSpeed || 1), 0.62);
            t.distractorRate = Math.min(Number(t.distractorRate || 0.22), 0.08);
            t.targetScale = Math.min(Number(t.targetScale || 1), 0.9);
          } else if (sec < 30) {
            t.spawnMs = Math.max(1350, Math.round(Number(t.spawnMs || 980) * 1.58));
            t.fallSpeed = Math.min(Number(t.fallSpeed || 1), 0.78);
            t.distractorRate = Math.min(Number(t.distractorRate || 0.22), 0.14);
            t.targetScale = Math.min(Number(t.targetScale || 1), 0.94);
          } else {
            t.spawnMs = Math.max(1080, Math.round(Number(t.spawnMs || 980) * 1.25));
            t.fallSpeed = Math.min(Number(t.fallSpeed || 1), 0.92);
            t.distractorRate = Math.min(Number(t.distractorRate || 0.22), 0.2);
            t.targetScale = Math.min(Number(t.targetScale || 1), 0.98);
          }
        }

        WIN.HHA_GROUPS_V83_TUNING = Object.assign({}, t, {
          source: VERSION,
          elapsedSec: Math.round(sec),
          activeCap: activeCap(),
          countdown: state.countdownActive
        });

        return t;
      };

      console.info('[GroupsSolo v8.3] tuning override installed');
    }, 120);

    setTimeout(function () {
      clearInterval(wait);
    }, 6000);
  }

  function installHooks() {
    DOC.addEventListener('click', function (ev) {
      if (looksLikeStartButton(ev.target)) {
        markStarted('start-button-click');
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
      'groups:v822:cleanup',
      'hha:summary-enriched'
    ].forEach(function (name) {
      WIN.addEventListener(name, function () {
        if (looksLikeSummary() || name.includes('end') || name.includes('summary')) {
          markEnded(name);
        }
      });
    });

    DOC.addEventListener('visibilitychange', function () {
      if (DOC.hidden) killTargets('hidden');
    });

    WIN.addEventListener('pagehide', function () {
      killTargets('pagehide');
    });
  }

  function tick() {
    if (looksLikeSummary()) {
      markEnded('summary-watch');
      return;
    }

    updateStageClasses();

    if (state.countdownActive) {
      killTargets('countdown-tick');
      return;
    }

    enforceTargetCap();

    if (state.playing && Date.now() < state.startLockUntil) {
      enforceTargetCap();
    }
  }

  function publicApi() {
    WIN.HHA_GROUPS_V83 = {
      version: VERSION,
      start: markStarted,
      end: markEnded,
      cleanup: killTargets,
      getState: function () {
        return {
          version: VERSION,
          startedAt: state.startedAt,
          elapsedSec: Math.round(elapsedSec()),
          playing: state.playing,
          ended: state.ended,
          countdownActive: state.countdownActive,
          activeCap: activeCap(),
          summaryVisible: looksLikeSummary()
        };
      }
    };
  }

  function init() {
    injectStyle();
    installHooks();
    installTuningOverride();
    publicApi();

    setInterval(tick, 140);

    if (looksLikeSummary()) {
      markEnded('init-summary');
    } else {
      killTargets('init-clean');
    }

    console.info('[GroupsSolo v8.3] start balance installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
