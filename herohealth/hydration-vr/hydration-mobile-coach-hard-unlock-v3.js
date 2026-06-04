// === /herohealth/hydration-vr/hydration-mobile-coach-hard-unlock-v3.js ===
// PATCH v20260604-HYDRATION-MOBILE-COACH-HARD-UNLOCK-V3
// Purpose:
// - Fix Mobile Hydration stuck at 149s / 0 score because Coach / Aim Assist / mission UI gate blocks gameplay.
// - Force coach/tutorial panels to pass-through or hide during live gameplay.
// - Unlock body/html pointer/touch state.
// - Keep real water/junk targets tappable.
// - Add visible QA badge so we can confirm the patch is loaded.

(function () {
  'use strict';

  const PATCH = 'HYDRATION_MOBILE_COACH_HARD_UNLOCK_V3_20260604';

  const page = String(location.pathname + ' ' + location.search + ' ' + document.title).toLowerCase();
  if (!/hydration/.test(page)) return;

  const qs = new URLSearchParams(location.search || '');
  const view = String(qs.get('view') || '').toLowerCase();

  const isMobile =
    view === 'mobile' ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

  if (!isMobile) return;

  if (window.__HYDRATION_MOBILE_COACH_HARD_UNLOCK_V3__) return;
  window.__HYDRATION_MOBILE_COACH_HARD_UNLOCK_V3__ = true;

  const STYLE_ID = 'hydrationMobileCoachHardUnlockV3Style';
  const ROOT_CLASS = 'hydration-mobile-coach-hard-unlock-v3';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function txt(el) {
    if (!el) return '';
    return String(
      [
        el.id || '',
        typeof el.className === 'string' ? el.className : '',
        el.getAttribute && el.getAttribute('aria-label'),
        el.getAttribute && el.getAttribute('title'),
        el.getAttribute && el.getAttribute('data-role'),
        el.getAttribute && el.getAttribute('data-kind'),
        el.textContent || ''
      ].filter(Boolean).join(' ')
    ).replace(/\s+/g, ' ').trim();
  }

  function low(el) {
    return txt(el).toLowerCase();
  }

  function rect(el) {
    try {
      return el.getBoundingClientRect();
    } catch (_) {
      return null;
    }
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const r = rect(el);
    if (!r || r.width < 6 || r.height < 6) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0.02;
  }

  function isTopHudOrControl(el) {
    if (!el || !el.closest) return false;

    const control = el.closest(
      [
        'button',
        'a',
        '[role="button"]',
        '[onclick]',
        '#pauseBtn',
        '#btnPause',
        '.pause',
        '.pauseBtn',
        '.pause-btn',
        '#homeBtn',
        '.homeBtn',
        '.home-btn',
        '#soundBtn',
        '.soundBtn',
        '.sound-btn',
        '.speaker',
        '.mute',
        '.hud',
        '.top',
        '.score',
        '.combo',
        '.shield',
        '.fever'
      ].join(',')
    );

    if (!control) return false;

    const r = rect(control);
    if (!r) return false;

    return r.top < 190 || /pause|home|sound|speaker|mute|score|combo|shield|fever|hydration/i.test(txt(control));
  }

  function looksLikeTarget(el) {
    if (!el || !visible(el)) return false;
    if (el === document.body || el === document.documentElement) return false;

    const r = rect(el);
    if (!r) return false;

    if (r.width < 28 || r.height < 28) return false;
    if (r.width > Math.min(260, window.innerWidth * 0.62)) return false;
    if (r.height > Math.min(220, window.innerHeight * 0.30)) return false;

    const s = low(el);

    const targetWords =
      /water|bottle|drop|drink|good|junk|target|item|spawn|collect/.test(s) ||
      /น้ำเปล่า|น้ำดี|น้ำ|ดื่ม|ขวด|หยด|หวาน|เค็ม|มัน|ชา|โดนัท|เฟรนช์|เก็บน้ำ|กระหายน้ำ|เสียคะแนน/.test(s);

    if (!targetWords) return false;

    const blockerWords =
      /coach|rescue|aim assist|heat boss|challenge|calm|mission|goal|hint|tip|hydration ให้สูง/.test(s) ||
      /โค้ช|ช่วย|บอส|ภารกิจ|คำแนะนำ|แตะเป้า|ใกล้เป้า|ให้สูง|เริ่มภารกิจ/.test(s);

    if (blockerWords && r.width > 120) return false;

    return true;
  }

  function findPanelAncestor(el) {
    let cur = el;
    let best = el;

    for (let i = 0; i < 8 && cur && cur !== document.body && cur !== document.documentElement; i++) {
      const r = rect(cur);
      if (r && r.width >= 130 && r.height >= 36) best = cur;

      if (r && r.width >= window.innerWidth * 0.72 && r.height >= 42) return cur;

      cur = cur.parentElement;
    }

    return best;
  }

  function looksLikeCoachGate(el) {
    if (!el || !visible(el)) return false;
    if (isTopHudOrControl(el)) return false;
    if (looksLikeTarget(el)) return false;

    const r = rect(el);
    if (!r) return false;

    const s = low(el);

    const words =
      /coach|rescue|aim assist|mission|goal|hint|tip|tutorial|director|near target|collect/.test(s) ||
      /โค้ช|ช่วย|aim assist|เก็บน้ำดี|hydration ให้สูง|แตะเป้า|ใกล้เป้า|เริ่มภารกิจ|ภารกิจ|คำแนะนำ|เป้าน้ำดี/.test(s);

    if (!words) return false;

    const inPlayArea = r.top > 170 && r.bottom < window.innerHeight - 58;
    const largeEnough = r.width >= 110 && r.height >= 28;

    return inPlayArea && largeEnough;
  }

  function looksLikeBossPanel(el) {
    if (!el || !visible(el)) return false;
    const s = low(el);
    return /heat boss|challenge|calm/.test(s) || /บอส/.test(s);
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html.${ROOT_CLASS},
      html.${ROOT_CLASS} body {
        touch-action: manipulation !important;
        overscroll-behavior: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }

      html.${ROOT_CLASS} [data-hyd-target-v3="1"] {
        pointer-events: auto !important;
        touch-action: manipulation !important;
        z-index: 9000 !important;
      }

      html.${ROOT_CLASS} [data-hyd-coach-gate-v3="1"] {
        pointer-events: none !important;
        opacity: 0.12 !important;
        transform: scale(0.86) translateY(10px) !important;
        filter: none !important;
        max-height: 44px !important;
        overflow: hidden !important;
        z-index: 40 !important;
      }

      html.${ROOT_CLASS} [data-hyd-coach-gate-v3="1"] * {
        pointer-events: none !important;
      }

      html.${ROOT_CLASS} [data-hyd-boss-v3="1"] {
        pointer-events: none !important;
        opacity: 0.62 !important;
        transform: scale(0.92) !important;
        z-index: 35 !important;
      }

      html.${ROOT_CLASS} [data-hyd-boss-v3="1"] * {
        pointer-events: none !important;
      }

      html.${ROOT_CLASS} .hydration-v3-loaded-badge {
        position: fixed !important;
        right: 10px !important;
        bottom: calc(72px + env(safe-area-inset-bottom, 0px)) !important;
        z-index: 2147483647 !important;
        background: rgba(255,255,255,.82) !important;
        border: 1px solid rgba(34,197,94,.75) !important;
        color: #14532d !important;
        border-radius: 999px !important;
        padding: 7px 10px !important;
        font: 900 10px/1.1 system-ui, -apple-system, Segoe UI, sans-serif !important;
        box-shadow: 0 10px 28px rgba(22,163,74,.22) !important;
        pointer-events: none !important;
      }
    `;

    document.head.appendChild(style);
  }

  function clearLocks() {
    const classes = [
      'paused',
      'is-paused',
      'modal-open',
      'overlay-open',
      'coach-open',
      'coach-lock',
      'tutorial-open',
      'tip-open',
      'locked',
      'is-locked',
      'no-touch',
      'disable-touch',
      'pointer-locked',
      'game-paused'
    ];

    for (const c of classes) {
      document.body.classList.remove(c);
      document.documentElement.classList.remove(c);
    }

    document.body.style.pointerEvents = '';
    document.documentElement.style.pointerEvents = '';
    document.body.style.touchAction = 'manipulation';
    document.documentElement.style.touchAction = 'manipulation';
  }

  function markTargets() {
    const nodes = Array.from(document.querySelectorAll('body *'));

    for (const el of nodes) {
      if (looksLikeTarget(el)) {
        el.setAttribute('data-hyd-target-v3', '1');
        el.style.pointerEvents = 'auto';
        el.style.touchAction = 'manipulation';

        const cs = getComputedStyle(el);
        if (cs.position !== 'static') {
          el.style.zIndex = '9000';
        }
      }
    }
  }

  function markAndSuppressGates() {
    const nodes = Array.from(document.querySelectorAll('body *'));

    for (const el of nodes) {
      if (!visible(el)) continue;

      if (looksLikeCoachGate(el)) {
        const panel = findPanelAncestor(el);
        if (panel && !isTopHudOrControl(panel) && !looksLikeTarget(panel)) {
          panel.setAttribute('data-hyd-coach-gate-v3', '1');
          panel.style.pointerEvents = 'none';
        }
      }

      if (looksLikeBossPanel(el)) {
        const panel = findPanelAncestor(el);
        if (panel && !isTopHudOrControl(panel)) {
          panel.setAttribute('data-hyd-boss-v3', '1');
          panel.style.pointerEvents = 'none';
        }
      }
    }
  }

  function getSecondsText() {
    const bodyText = String(document.body ? document.body.innerText : '');
    const m = bodyText.match(/(\d{1,3})s/);
    return m ? Number(m[1]) : NaN;
  }

  let lastSec = NaN;
  let frozenTicks = 0;

  function tryCall(name) {
    try {
      if (typeof window[name] === 'function') {
        window[name]();
        return true;
      }
    } catch (_) {}
    return false;
  }

  function softResumeEvents() {
    const events = [
      'resume',
      'game:resume',
      'hydration:resume',
      'hydration:unpause',
      'hha:resume',
      'hha:play',
      'hha:unlock'
    ];

    for (const name of events) {
      try {
        window.dispatchEvent(new CustomEvent(name, { detail: { patch: PATCH } }));
        document.dispatchEvent(new CustomEvent(name, { detail: { patch: PATCH } }));
      } catch (_) {}
    }

    const fnNames = [
      'resumeGame',
      'unpauseGame',
      'resume',
      'startLoop',
      'startGameLoop',
      'gameLoop',
      'spawnTarget',
      'spawnItem',
      'spawnWater'
    ];

    for (const fn of fnNames) tryCall(fn);
  }

  function dispatchTap(el, x, y) {
    if (!el || !el.isConnected) return false;

    try {
      const base = {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true
      };

      el.dispatchEvent(new PointerEvent('pointerdown', base));
      el.dispatchEvent(new PointerEvent('pointerup', base));
      el.dispatchEvent(new MouseEvent('mousedown', base));
      el.dispatchEvent(new MouseEvent('mouseup', base));
      el.dispatchEvent(new MouseEvent('click', base));
      return true;
    } catch (_) {
      try {
        el.click();
        return true;
      } catch (__) {
        return false;
      }
    }
  }

  function targetFromPoint(x, y) {
    markTargets();

    const offsets = [
      [0, 0],
      [0, -20],
      [0, 20],
      [-20, 0],
      [20, 0],
      [-24, -24],
      [24, -24],
      [-24, 24],
      [24, 24],
      [0, -42],
      [0, 42]
    ];

    for (const [dx, dy] of offsets) {
      const nx = Math.max(1, Math.min(window.innerWidth - 1, x + dx));
      const ny = Math.max(1, Math.min(window.innerHeight - 1, y + dy));
      const hit = document.elementFromPoint(nx, ny);
      const t = hit && hit.closest && hit.closest('[data-hyd-target-v3="1"]');
      if (t) return t;
    }

    return null;
  }

  function onPointerDown(e) {
    if (!e || !e.isTrusted) return;
    if (isTopHudOrControl(e.target)) return;

    clearLocks();
    markTargets();
    markAndSuppressGates();
    softResumeEvents();

    const direct = e.target && e.target.closest && e.target.closest('[data-hyd-target-v3="1"]');
    if (direct) return;

    const x = Number(e.clientX || 0);
    const y = Number(e.clientY || 0);
    if (!x || !y) return;

    const t = targetFromPoint(x, y);
    if (!t) return;

    e.preventDefault();
    e.stopPropagation();
    dispatchTap(t, x, y);
  }

  function watchdog() {
    clearLocks();
    markTargets();
    markAndSuppressGates();

    const sec = getSecondsText();

    if (Number.isFinite(sec)) {
      if (sec === lastSec) {
        frozenTicks++;
      } else {
        frozenTicks = 0;
        lastSec = sec;
      }

      // At 149/150 seconds, if it stays frozen, force suppress all coach gates harder.
      if (frozenTicks >= 2 && sec >= 145) {
        const gates = document.querySelectorAll('[data-hyd-coach-gate-v3="1"]');
        gates.forEach((el) => {
          el.style.opacity = '0.02';
          el.style.maxHeight = '12px';
          el.style.transform = 'scale(0.70) translateY(30px)';
          el.style.pointerEvents = 'none';
        });

        const bosses = document.querySelectorAll('[data-hyd-boss-v3="1"]');
        bosses.forEach((el) => {
          el.style.opacity = '0.28';
          el.style.pointerEvents = 'none';
        });

        softResumeEvents();
      }
    }
  }

  function addLoadedBadge() {
    if (document.querySelector('.hydration-v3-loaded-badge')) return;

    const b = document.createElement('div');
    b.className = 'hydration-v3-loaded-badge';
    b.textContent = 'HYD V3 UNLOCK ON';
    document.body.appendChild(b);

    setTimeout(() => {
      try {
        b.style.opacity = '0.25';
      } catch (_) {}
    }, 5000);
  }

  ready(() => {
    document.documentElement.classList.add(ROOT_CLASS);
    injectStyle();
    addLoadedBadge();

    clearLocks();
    markTargets();
    markAndSuppressGates();
    softResumeEvents();

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('touchstart', function () {
      clearLocks();
      markTargets();
      markAndSuppressGates();
      softResumeEvents();
    }, { capture: true, passive: true });

    window.addEventListener('focus', function () {
      setTimeout(() => {
        clearLocks();
        markTargets();
        markAndSuppressGates();
        softResumeEvents();
      }, 120);
    });

    document.addEventListener('visibilitychange', function () {
      setTimeout(() => {
        clearLocks();
        markTargets();
        markAndSuppressGates();
        softResumeEvents();
      }, 120);
    });

    setInterval(watchdog, 650);

    setTimeout(watchdog, 120);
    setTimeout(watchdog, 450);
    setTimeout(watchdog, 900);
    setTimeout(watchdog, 1400);
    setTimeout(watchdog, 2200);

    console.info('[HeroHealth]', PATCH, 'active');
  });
})();