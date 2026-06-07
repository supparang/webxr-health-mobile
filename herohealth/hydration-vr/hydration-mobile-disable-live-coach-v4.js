// === /herohealth/hydration-vr/hydration-mobile-disable-live-coach-v4.js ===
// PATCH v20260604-HYDRATION-MOBILE-DISABLE-LIVE-COACH-V4
// Fix: mobile freezes after short play when Coach Shield / Aim Assist / mission card appears.
// Strategy: during live mobile gameplay, remove/pass-through large coach panels,
// keep HUD buttons usable, keep targets tappable, and continuously unlock pause/input state.

(function () {
  'use strict';

  const PATCH = 'HYDRATION_MOBILE_DISABLE_LIVE_COACH_V4_20260604';

  const page = String(location.pathname + ' ' + location.search + ' ' + document.title).toLowerCase();
  if (!/hydration/.test(page)) return;

  const qs = new URLSearchParams(location.search || '');
  const view = String(qs.get('view') || '').toLowerCase();
  const isMobile =
    view === 'mobile' ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

  if (!isMobile) return;
  if (window.__HYDRATION_MOBILE_DISABLE_LIVE_COACH_V4__) return;
  window.__HYDRATION_MOBILE_DISABLE_LIVE_COACH_V4__ = true;

  const STYLE_ID = 'hydrationMobileDisableLiveCoachV4Style';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function text(el) {
    if (!el) return '';
    return String([
      el.id || '',
      typeof el.className === 'string' ? el.className : '',
      el.getAttribute && el.getAttribute('aria-label'),
      el.getAttribute && el.getAttribute('title'),
      el.getAttribute && el.getAttribute('data-role'),
      el.getAttribute && el.getAttribute('data-kind'),
      el.textContent || ''
    ].filter(Boolean).join(' ')).replace(/\s+/g, ' ').trim();
  }

  function low(el) {
    return text(el).toLowerCase();
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
    if (!r || r.width < 5 || r.height < 5) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0.02;
  }

  function isHudButton(el) {
    if (!el || !el.closest) return false;
    return !!el.closest(
      'button,a,[role="button"],[onclick],#pauseBtn,#btnPause,.pause,.pause-btn,#homeBtn,.home-btn,#soundBtn,.sound-btn,.speaker,.mute'
    );
  }

  function looksLikeTarget(el) {
    if (!visible(el)) return false;

    const r = rect(el);
    if (!r) return false;

    if (r.width < 24 || r.height < 24) return false;
    if (r.width > Math.min(280, window.innerWidth * 0.68)) return false;
    if (r.height > Math.min(250, window.innerHeight * 0.34)) return false;

    const s = low(el);

    const target =
      /water|drink|drop|bottle|good|junk|target|item|collect/.test(s) ||
      /น้ำเปล่า|น้ำเยอะ|น้ำดี|น้ำ|ดื่ม|ขวด|หยด|หวาน|เค็ม|มัน|ชา|โดนัท|เฟรนช์|กระหายน้ำ|เสียคะแนน/.test(s);

    const coach =
      /coach|aim assist|shield|rescue|mission|goal|hint|tip|heat boss|challenge|calm/.test(s) ||
      /โค้ช|ใกล้เป้า|แตะเพื่อเก็บ|เก็บน้ำดี|ภารกิจ|คำแนะนำ|บอส|ให้สูง|กันแดด/.test(s);

    return target && !(coach && r.width > 110);
  }

  function looksLikeLiveCoach(el) {
    if (!visible(el)) return false;
    if (isHudButton(el)) return false;
    if (looksLikeTarget(el)) return false;

    const r = rect(el);
    if (!r) return false;

    const s = low(el);

    const coachWords =
      /coach|aim assist|coach shield|rescue|mission|goal|hint|tip|tutorial|near target/.test(s) ||
      /โค้ช|ใกล้เป้าแล้ว|แตะเพื่อเก็บ|เก็บน้ำดี|hydration ให้สูง|ภารกิจ|คำแนะนำ|ช่วยผู้เล่นใหม่|เป้าน้ำดี/.test(s);

    if (!coachWords) return false;

    const inPlayArea = r.top > 120 && r.bottom < window.innerHeight - 40;
    const bigPanel = r.width > 120 && r.height > 30;

    return inPlayArea && bigPanel;
  }

  function looksLikeBossPanel(el) {
    if (!visible(el)) return false;
    const s = low(el);
    return /heat boss|challenge|calm/.test(s) || /บอส/.test(s);
  }

  function panelAncestor(el) {
    let cur = el;
    let best = el;

    for (let i = 0; i < 9 && cur && cur !== document.body && cur !== document.documentElement; i++) {
      const r = rect(cur);
      if (r && r.width >= 120 && r.height >= 30) best = cur;
      if (r && r.width >= window.innerWidth * 0.70 && r.height >= 45) return cur;
      cur = cur.parentElement;
    }

    return best;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html, body {
        touch-action: manipulation !important;
        overscroll-behavior: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }

      [data-hyd-live-coach-v4="1"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      [data-hyd-boss-pass-v4="1"] {
        pointer-events: none !important;
        opacity: .46 !important;
        transform: scale(.92) !important;
      }

      [data-hyd-target-v4="1"] {
        pointer-events: auto !important;
        touch-action: manipulation !important;
        z-index: 9999 !important;
      }

      .hydration-v4-badge {
        position: fixed !important;
        right: 10px !important;
        bottom: calc(72px + env(safe-area-inset-bottom, 0px)) !important;
        z-index: 2147483647 !important;
        background: rgba(255,255,255,.86) !important;
        border: 1px solid rgba(14,165,233,.75) !important;
        color: #0f3a52 !important;
        border-radius: 999px !important;
        padding: 7px 10px !important;
        font: 900 10px/1.1 system-ui, -apple-system, Segoe UI, sans-serif !important;
        box-shadow: 0 10px 24px rgba(14,165,233,.22) !important;
        pointer-events: none !important;
      }
    `;

    document.head.appendChild(style);
  }

  function clearLocks() {
    const bad = [
      'paused',
      'is-paused',
      'game-paused',
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
      'pointer-locked'
    ];

    for (const c of bad) {
      document.body.classList.remove(c);
      document.documentElement.classList.remove(c);
    }

    document.body.style.pointerEvents = '';
    document.documentElement.style.pointerEvents = '';
    document.body.style.touchAction = 'manipulation';
    document.documentElement.style.touchAction = 'manipulation';
  }

  function markTargets() {
    document.querySelectorAll('body *').forEach((el) => {
      if (looksLikeTarget(el)) {
        el.setAttribute('data-hyd-target-v4', '1');
        el.style.pointerEvents = 'auto';
        el.style.touchAction = 'manipulation';

        const cs = getComputedStyle(el);
        if (cs.position !== 'static') {
          el.style.zIndex = '9999';
        }
      }
    });
  }

  function killLiveCoach() {
    document.querySelectorAll('body *').forEach((el) => {
      if (!visible(el)) return;

      if (looksLikeLiveCoach(el)) {
        const p = panelAncestor(el);
        if (p && !isHudButton(p) && !looksLikeTarget(p)) {
          p.setAttribute('data-hyd-live-coach-v4', '1');
          p.style.display = 'none';
          p.style.pointerEvents = 'none';
        }
      }

      if (looksLikeBossPanel(el)) {
        const p = panelAncestor(el);
        if (p && !isHudButton(p)) {
          p.setAttribute('data-hyd-boss-pass-v4', '1');
          p.style.pointerEvents = 'none';
        }
      }
    });
  }

  function dispatchResume() {
    const names = [
      'resume',
      'game:resume',
      'hydration:resume',
      'hydration:unpause',
      'hha:resume',
      'hha:play',
      'hha:unlock',
      'coach:skip',
      'tutorial:skip'
    ];

    names.forEach((name) => {
      try {
        window.dispatchEvent(new CustomEvent(name, { detail: { patch: PATCH } }));
        document.dispatchEvent(new CustomEvent(name, { detail: { patch: PATCH } }));
      } catch (_) {}
    });

    [
      'resumeGame',
      'unpauseGame',
      'resume',
      'hideCoach',
      'closeCoach',
      'skipCoach',
      'dismissCoach',
      'hideTip',
      'closeTip',
      'startLoop',
      'startGameLoop'
    ].forEach((fn) => {
      try {
        if (typeof window[fn] === 'function') window[fn]();
      } catch (_) {}
    });
  }

  function targetFromPoint(x, y) {
    markTargets();

    const offsets = [
      [0, 0], [0, -22], [0, 22], [-22, 0], [22, 0],
      [-24, -24], [24, -24], [-24, 24], [24, 24],
      [0, -45], [0, 45]
    ];

    for (const [dx, dy] of offsets) {
      const nx = Math.max(1, Math.min(window.innerWidth - 1, x + dx));
      const ny = Math.max(1, Math.min(window.innerHeight - 1, y + dy));
      const hit = document.elementFromPoint(nx, ny);
      const t = hit && hit.closest && hit.closest('[data-hyd-target-v4="1"]');
      if (t) return t;
    }

    return null;
  }

  function fakeTap(el, x, y) {
    try {
      const opt = {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true
      };

      el.dispatchEvent(new PointerEvent('pointerdown', opt));
      el.dispatchEvent(new PointerEvent('pointerup', opt));
      el.dispatchEvent(new MouseEvent('mousedown', opt));
      el.dispatchEvent(new MouseEvent('mouseup', opt));
      el.dispatchEvent(new MouseEvent('click', opt));
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

  function onPointerDown(e) {
    if (!e || !e.isTrusted) return;
    if (isHudButton(e.target)) return;

    clearLocks();
    killLiveCoach();
    markTargets();
    dispatchResume();

    const direct = e.target && e.target.closest && e.target.closest('[data-hyd-target-v4="1"]');
    if (direct) return;

    const x = Number(e.clientX || 0);
    const y = Number(e.clientY || 0);
    if (!x || !y) return;

    const t = targetFromPoint(x, y);
    if (!t) return;

    e.preventDefault();
    e.stopPropagation();
    fakeTap(t, x, y);
  }

  function addBadge() {
    if (document.querySelector('.hydration-v4-badge')) return;
    const b = document.createElement('div');
    b.className = 'hydration-v4-badge';
    b.textContent = 'HYD V4 COACH OFF';
    document.body.appendChild(b);

    setTimeout(() => {
      try {
        b.style.opacity = '.25';
      } catch (_) {}
    }, 4000);
  }

  function pulse() {
    clearLocks();
    killLiveCoach();
    markTargets();
    dispatchResume();
  }

  ready(() => {
    injectStyle();
    addBadge();

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('touchstart', pulse, { capture: true, passive: true });
    window.addEventListener('focus', () => setTimeout(pulse, 100));
    document.addEventListener('visibilitychange', () => setTimeout(pulse, 100));

    setInterval(pulse, 500);

    setTimeout(pulse, 100);
    setTimeout(pulse, 400);
    setTimeout(pulse, 900);
    setTimeout(pulse, 1600);
    setTimeout(pulse, 2600);

    console.info('[HeroHealth]', PATCH, 'active');
  });
})();