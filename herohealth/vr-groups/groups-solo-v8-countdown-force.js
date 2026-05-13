// === /herohealth/vr-groups/groups-solo-v8-countdown-force.js ===
// HeroHealth Groups Solo — v8.3.1 Countdown Force Bridge
// FIX: force countdown before gameplay even when old start button/core start does not trigger v8.3
// PATCH v20260513-GROUPS-SOLO-V831-COUNTDOWN-FORCE

(function () {
  'use strict';

  const VERSION = 'v8.3.1-countdown-force-20260513';

  if (window.__HHA_GROUPS_SOLO_V831_COUNTDOWN_FORCE__) {
    console.warn('[GroupsSolo v8.3.1] already installed');
    return;
  }

  window.__HHA_GROUPS_SOLO_V831_COUNTDOWN_FORCE__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    active: false,
    done: false,
    bypass: false,
    ended: false,
    lastStartAt: 0,
    cleanupTimer: null,
    suppressNativeCountdownUntil: 0
  };

  function textOf(el) {
    return String(el ? el.textContent || el.getAttribute?.('aria-label') || el.getAttribute?.('title') || '' : '')
      .replace(/\s+/g, ' ')
      .trim();
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

  function isClickableLike(el) {
    if (!el || el.nodeType !== 1) return false;

    const tag = el.tagName.toLowerCase();
    const role = String(el.getAttribute('role') || '').toLowerCase();
    const cls = String(el.className || '').toLowerCase();
    const dataAction = String(el.getAttribute('data-action') || el.getAttribute('data-start') || '').toLowerCase();

    if (tag === 'button' || tag === 'a') return true;
    if (role === 'button') return true;
    if (el.hasAttribute('onclick')) return true;
    if (el.hasAttribute('tabindex')) return true;
    if (dataAction) return true;

    return (
      cls.includes('btn') ||
      cls.includes('button') ||
      cls.includes('start') ||
      cls.includes('play') ||
      cls.includes('launch') ||
      cls.includes('ready')
    );
  }

  function findStartElement(ev) {
    const path = typeof ev.composedPath === 'function' ? ev.composedPath() : [];

    for (const item of path) {
      if (!item || item === WIN || item === DOC || item === DOC.body) continue;
      if (!item.nodeType || item.nodeType !== 1) continue;
      if (!isVisible(item)) continue;
      if (!isClickableLike(item)) continue;

      const tx = textOf(item).toLowerCase();
      const action = String(item.getAttribute('data-action') || item.getAttribute('data-start') || '').toLowerCase();
      const cls = String(item.className || '').toLowerCase();

      const saysStart =
        action.includes('start') ||
        action.includes('play') ||
        cls.includes('start') ||
        cls.includes('play') ||
        tx.includes('เริ่ม') ||
        tx.includes('เล่น') ||
        tx.includes('start') ||
        tx.includes('play') ||
        tx.includes('go!') ||
        tx.includes('ready');

      const isBad =
        tx.includes('กลับ') ||
        tx.includes('nutrition') ||
        tx.includes('zone') ||
        tx.includes('hub') ||
        tx.includes('สรุป') ||
        tx.includes('summary') ||
        tx.includes('เล่นอีกครั้ง');

      if (saysStart && !isBad) return item;
    }

    const closest = ev.target?.closest?.(
      'button,a,[role="button"],.btn,.button,.start,.play,.start-btn,.play-btn,[data-start],[data-action]'
    );

    if (closest && isVisible(closest)) {
      const tx = textOf(closest).toLowerCase();

      if (
        !tx.includes('กลับ') &&
        !tx.includes('สรุป') &&
        !tx.includes('เล่นอีกครั้ง') &&
        (
          tx.includes('เริ่ม') ||
          tx.includes('เล่น') ||
          tx.includes('start') ||
          tx.includes('play')
        )
      ) {
        return closest;
      }
    }

    return null;
  }

  function injectStyle() {
    if (DOC.getElementById('hha-groups-v831-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-groups-v831-style';
    style.textContent = `
      body.hha-groups-v831-counting .hha-groups-v82-layer,
      body.hha-groups-v831-counting .hha-groups-v82-target,
      body.hha-groups-v831-counting [data-hha-v82-target="1"],
      body.hha-groups-v831-counting .hha-groups-v82-chip,
      body.hha-groups-v831-counting .hha-groups-v82-fx,
      body.hha-groups-v831-counting .hha-groups-v81-pop,
      body.hha-groups-v831-counting .hha-groups-v8-burst{
        display:none !important;
        opacity:0 !important;
        pointer-events:none !important;
        animation:none !important;
      }

      .hha-groups-v831-overlay{
        position:fixed;
        inset:0;
        z-index:2147483000;
        display:grid;
        place-items:center;
        pointer-events:auto;
        background:
          radial-gradient(circle at 50% 42%, rgba(255,255,255,.92), rgba(255,255,255,.24) 46%, rgba(226,246,255,.18) 100%);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .hha-groups-v831-card{
        width:min(380px,84vw);
        border-radius:36px;
        padding:28px 22px;
        text-align:center;
        color:#244e68;
        background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(236,250,255,.94));
        border:3px solid rgba(255,255,255,.92);
        box-shadow:0 26px 76px rgba(35,81,107,.2);
      }

      .hha-groups-v831-main{
        font-size:clamp(64px,18vw,120px);
        line-height:.9;
        font-weight:1000;
        color:#5e9fc8;
        text-shadow:0 5px 0 rgba(255,255,255,.9);
        animation:hhaV831Pop .62s ease both;
      }

      .hha-groups-v831-title{
        margin-top:14px;
        font-size:clamp(19px,4.8vw,30px);
        line-height:1.12;
        font-weight:1000;
      }

      .hha-groups-v831-tip{
        margin-top:8px;
        font-size:clamp(13px,3.2vw,18px);
        line-height:1.25;
        font-weight:850;
        opacity:.82;
      }

      @keyframes hhaV831Pop{
        0%{opacity:0; transform:scale(.72);}
        24%{opacity:1; transform:scale(1.14);}
        100%{opacity:1; transform:scale(1);}
      }
    `;

    DOC.head.appendChild(style);
  }

  function killTargets(reason) {
    DOC.querySelectorAll(
      '.hha-groups-v82-target,[data-hha-v82-target="1"],.hha-groups-v82-fx,.hha-groups-v81-pop,.hha-groups-v8-burst'
    ).forEach(function (el) {
      try {
        clearTimeout(el.__hhaV82Timeout);
        el.remove();
      } catch (e) {}
    });

    try {
      if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.killAllTargets === 'function') {
        WIN.HHA_GROUPS_V82.killAllTargets();
      }
    } catch (e) {}

    try {
      if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.setEnabled === 'function') {
        WIN.HHA_GROUPS_V82.setEnabled(false);
      }
    } catch (e) {}

    try {
      WIN.dispatchEvent(new CustomEvent('groups:v831:cleanup', {
        detail: { version: VERSION, reason: reason || 'cleanup' }
      }));
    } catch (e) {}
  }

  function setSpawnEnabled(v) {
    try {
      if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.setEnabled === 'function') {
        WIN.HHA_GROUPS_V82.setEnabled(Boolean(v));
      }
    } catch (e) {}
  }

  function removeNativeV83Countdown() {
    if (Date.now() > state.suppressNativeCountdownUntil) return;

    const old = DOC.getElementById('hha-groups-v83-countdown');
    if (old) old.remove();

    DOC.body.classList.remove('hha-groups-v83-counting');
  }

  function triggerOriginalStart(el) {
    state.bypass = true;
    state.suppressNativeCountdownUntil = Date.now() + 2200;

    setSpawnEnabled(true);

    try {
      if (el && el.isConnected && typeof el.click === 'function') {
        el.click();
      }
    } catch (e) {}

    setTimeout(function () {
      removeNativeV83Countdown();
      setSpawnEnabled(true);

      try {
        if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.start === 'function') {
          WIN.HHA_GROUPS_V82.start();
        }
      } catch (e) {}

      state.bypass = false;
    }, 80);

    setTimeout(function () {
      state.bypass = false;
      removeNativeV83Countdown();
    }, 500);
  }

  function showCountdownThenStart(el, reason) {
    if (state.active || state.ended || looksLikeSummary()) return;

    const now = Date.now();
    if (now - state.lastStartAt < 1200) return;
    state.lastStartAt = now;

    state.active = true;
    state.done = false;

    injectStyle();

    DOC.body.classList.add('hha-groups-v831-counting');

    killTargets('countdown-force-start');

    clearInterval(state.cleanupTimer);
    state.cleanupTimer = setInterval(function () {
      killTargets('countdown-force-loop');
      removeNativeV83Countdown();
    }, 100);

    const overlay = DOC.createElement('div');
    overlay.id = 'hha-groups-v831-overlay';
    overlay.className = 'hha-groups-v831-overlay';
    overlay.innerHTML = `
      <div class="hha-groups-v831-card">
        <div class="hha-groups-v831-main" data-v831-main>3</div>
        <div class="hha-groups-v831-title">เตรียมแยกหมู่อาหาร!</div>
        <div class="hha-groups-v831-tip" data-v831-tip>ดูโจทย์ก่อน แล้วค่อยแตะอาหารที่ถูกต้อง</div>
      </div>
    `;

    DOC.body.appendChild(overlay);

    const main = overlay.querySelector('[data-v831-main]');
    const tip = overlay.querySelector('[data-v831-tip]');

    const steps = [
      { at: 0, text: '3', tip: 'ดูโจทย์ก่อน' },
      { at: 820, text: '2', tip: 'เก็บอาหารหมู่ที่กำหนด' },
      { at: 1640, text: '1', tip: 'หลบตัวหลอก เช่น 🍩 🥤 🍬' },
      { at: 2460, text: 'เริ่ม!', tip: 'ลุยเลย!' }
    ];

    steps.forEach(function (s) {
      setTimeout(function () {
        if (!overlay.isConnected) return;

        main.textContent = s.text;
        tip.textContent = s.tip;

        main.style.animation = 'none';
        void main.offsetWidth;
        main.style.animation = 'hhaV831Pop .62s ease both';
      }, s.at);
    });

    setTimeout(function () {
      clearInterval(state.cleanupTimer);
      state.cleanupTimer = null;

      overlay.remove();
      DOC.body.classList.remove('hha-groups-v831-counting');

      state.active = false;
      state.done = true;

      setSpawnEnabled(true);
      triggerOriginalStart(el);

      try {
        WIN.dispatchEvent(new CustomEvent('groups:v831:countdown-done', {
          detail: { version: VERSION, reason: reason || 'start' }
        }));
      } catch (e) {}

      console.info('[GroupsSolo v8.3.1] countdown done, released start');
    }, 3250);
  }

  function interceptStart(ev) {
    if (state.bypass || state.active || state.ended || looksLikeSummary()) return;

    const startEl = findStartElement(ev);
    if (!startEl) return;

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();

    showCountdownThenStart(startEl, ev.type);
  }

  function installHooks() {
    /*
      ใช้ window capture เพื่อดักก่อน document capture ของ v8.2.1/v8.3
    */
    WIN.addEventListener('click', interceptStart, true);

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
        state.active = false;
        clearInterval(state.cleanupTimer);
        DOC.body.classList.remove('hha-groups-v831-counting');

        const overlay = DOC.getElementById('hha-groups-v831-overlay');
        if (overlay) overlay.remove();
      });
    });

    /*
      ถ้า v8.3 native countdown โผล่ตามหลัง bridge ให้ซ่อน เพื่อไม่ให้ซ้อน 2 ชั้น
    */
    const mo = new MutationObserver(removeNativeV83Countdown);
    mo.observe(DOC.body, { childList: true, subtree: true });
  }

  function publicApi() {
    WIN.HHA_GROUPS_V831 = {
      version: VERSION,
      forceCountdown: function () {
        showCountdownThenStart(null, 'api');
      },
      getState: function () {
        return {
          version: VERSION,
          active: state.active,
          done: state.done,
          ended: state.ended,
          bypass: state.bypass
        };
      }
    };
  }

  function init() {
    injectStyle();
    installHooks();
    publicApi();

    console.info('[GroupsSolo v8.3.1] countdown force installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
