// === /herohealth/hydration-vr/hydration-mobile-freeze-rescue-v2.js ===
// PATCH v20260604-HYDRATION-MOBILE-FREEZE-RESCUE-V2
// Purpose:
// 1) Fix Hydration Solo Mobile input-lock where coach/mission/heat-boss UI blocks targets.
// 2) Make instructional overlays pass-through during gameplay.
// 3) Keep real targets tappable.
// 4) Prevent mobile gameplay from feeling frozen when HUD layers overlap.

(function () {
  'use strict';

  const PATCH = 'HYDRATION_MOBILE_FREEZE_RESCUE_V2_20260604';

  const pathText = String(location.pathname + ' ' + location.search + ' ' + document.title).toLowerCase();
  if (!/hydration/.test(pathText)) return;

  const qs = new URLSearchParams(location.search || '');
  const view = String(qs.get('view') || '').toLowerCase();

  const isMobile =
    view === 'mobile' ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

  if (!isMobile) return;

  if (window.__HYDRATION_MOBILE_FREEZE_RESCUE_V2__) return;
  window.__HYDRATION_MOBILE_FREEZE_RESCUE_V2__ = true;

  const HTML_CLASS = 'hydration-mobile-freeze-rescue-v2';
  const STYLE_ID = 'hydrationMobileFreezeRescueV2Style';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function norm(v) {
    return String(v || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function lower(v) {
    return norm(v).toLowerCase();
  }

  function rectOf(el) {
    try {
      const r = el.getBoundingClientRect();
      if (!r || !Number.isFinite(r.width) || !Number.isFinite(r.height)) return null;
      return r;
    } catch (_) {
      return null;
    }
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const r = rectOf(el);
    if (!r || r.width < 4 || r.height < 4) return false;

    const cs = getComputedStyle(el);
    if (cs.display === 'none') return false;
    if (cs.visibility === 'hidden') return false;
    if (Number(cs.opacity || 1) <= 0.02) return false;

    return true;
  }

  function textOf(el) {
    if (!el) return '';
    return norm(
      [
        el.id || '',
        typeof el.className === 'string' ? el.className : '',
        el.getAttribute && el.getAttribute('aria-label'),
        el.getAttribute && el.getAttribute('title'),
        el.getAttribute && el.getAttribute('data-kind'),
        el.getAttribute && el.getAttribute('data-type'),
        el.getAttribute && el.getAttribute('data-role'),
        el.getAttribute && el.getAttribute('data-target'),
        el.textContent || ''
      ].filter(Boolean).join(' ')
    );
  }

  function isControl(el) {
    if (!el || !el.closest) return false;

    return !!el.closest(
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
        '.speaker-btn',
        '.mute',
        '.mute-btn'
      ].join(',')
    );
  }

  function looksLikeTarget(el) {
    if (!el || !isVisible(el)) return false;
    if (el === document.body || el === document.documentElement) return false;

    const r = rectOf(el);
    if (!r) return false;

    // Real game targets are usually small/medium cards, not full HUD panels.
    if (r.width > Math.min(window.innerWidth * 0.75, 260)) return false;
    if (r.height > Math.min(window.innerHeight * 0.38, 260)) return false;
    if (r.width < 22 || r.height < 22) return false;

    const s = lower(textOf(el));

    const hasTargetWords =
      /target|water|drink|drop|bottle|good|junk|food|item|collect|spawn/.test(s) ||
      /น้ำเปล่า|น้ำดี|น้ำ|ดื่ม|เติม|เก็บน้ำ|หวาน|เค็ม|มัน|ชา|น้ำอัดลม|โดนัท|เฟรนช์|ขวด|หยด/.test(s);

    if (!hasTargetWords) return false;

    // Avoid HUD/coach/mission text being classified as target.
    const badPanelWords =
      /score|combo|shield|fever|hydration|coach|rescue|challenge|heat boss|calm|aim assist|mission|goal|hud/.test(s) ||
      /คะแนน|คอมโบ|โล่|โค้ช|ภารกิจ|บอส|ช่วย|เป้าหมาย|คำแนะนำ|แตะเป้า|ให้สูง/.test(s);

    if (badPanelWords && r.width > 120 && r.height > 50) return false;

    return true;
  }

  function looksLikeBlockingOverlay(el) {
    if (!el || !isVisible(el)) return false;
    if (el === document.body || el === document.documentElement) return false;
    if (isControl(el)) return false;
    if (looksLikeTarget(el)) return false;

    const r = rectOf(el);
    if (!r) return false;

    const cs = getComputedStyle(el);
    const pos = cs.position;

    const s = lower(textOf(el));

    const overlayWords =
      /coach|rescue|aim assist|heat boss|challenge|calm|mission|goal|toast|hint|tip|director/.test(s) ||
      /โค้ช|ช่วย|เก็บน้ำดี|hydration ให้สูง|แตะเป้า|เป้าน้ำดี|ดื่มมาก|เติมน้ำ|บอส|ภารกิจ|คำแนะนำ|ระวัง/.test(s);

    if (!overlayWords) return false;

    const isPanelSize =
      r.width >= 90 &&
      r.height >= 28 &&
      r.top >= 80 &&
      r.bottom <= window.innerHeight - 20;

    const isPositioned =
      pos === 'fixed' ||
      pos === 'absolute' ||
      pos === 'sticky' ||
      Number(cs.zIndex || 0) > 1;

    return isPanelSize || isPositioned;
  }

  function isCompactOverlay(el) {
    const s = lower(textOf(el));
    return (
      /coach|rescue|aim assist|mission|goal|hint|tip/.test(s) ||
      /โค้ช|ช่วย|เก็บน้ำดี|hydration ให้สูง|แตะเป้า|เป้าน้ำดี|คำแนะนำ|ภารกิจ/.test(s)
    );
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html.${HTML_CLASS},
      html.${HTML_CLASS} body {
        touch-action: manipulation !important;
        -webkit-tap-highlight-color: transparent !important;
        overscroll-behavior: none !important;
      }

      html.${HTML_CLASS} [data-hydration-pass="1"] {
        pointer-events: none !important;
      }

      html.${HTML_CLASS} [data-hydration-pass="1"] button,
      html.${HTML_CLASS} [data-hydration-pass="1"] a,
      html.${HTML_CLASS} [data-hydration-pass="1"] [role="button"],
      html.${HTML_CLASS} button,
      html.${HTML_CLASS} a,
      html.${HTML_CLASS} [role="button"] {
        pointer-events: auto !important;
        touch-action: manipulation !important;
      }

      html.${HTML_CLASS} [data-hydration-target="1"] {
        pointer-events: auto !important;
        touch-action: manipulation !important;
        -webkit-tap-highlight-color: rgba(56,189,248,.20) !important;
      }

      html.${HTML_CLASS} [data-hydration-compact="1"] {
        max-height: 56px !important;
        overflow: hidden !important;
        opacity: .48 !important;
        filter: none !important;
      }

      html.${HTML_CLASS} [data-hydration-compact="1"]:active {
        opacity: .20 !important;
      }

      html.${HTML_CLASS} .hydration-mobile-rescue-badge {
        position: fixed !important;
        right: 10px !important;
        bottom: calc(76px + env(safe-area-inset-bottom, 0px)) !important;
        z-index: 99999 !important;
        padding: 6px 9px !important;
        border-radius: 999px !important;
        background: rgba(255,255,255,.72) !important;
        border: 1px solid rgba(125,211,252,.65) !important;
        color: #0f3a52 !important;
        font: 800 10px/1.1 system-ui, -apple-system, Segoe UI, sans-serif !important;
        pointer-events: none !important;
        box-shadow: 0 8px 20px rgba(14,165,233,.18) !important;
        opacity: .72 !important;
      }
    `;

    document.head.appendChild(style);
  }

  function markLayers() {
    document.documentElement.classList.add(HTML_CLASS);

    const nodes = Array.from(document.querySelectorAll('body *'));
    for (const el of nodes) {
      if (!el || !el.isConnected) continue;

      if (looksLikeTarget(el)) {
        el.setAttribute('data-hydration-target', '1');
        el.style.pointerEvents = 'auto';
        el.style.touchAction = 'manipulation';

        const cs = getComputedStyle(el);
        if (cs.position !== 'static') {
          const zi = Number(cs.zIndex || 0);
          if (!Number.isFinite(zi) || zi < 40) el.style.zIndex = '80';
        }
        continue;
      }

      if (looksLikeBlockingOverlay(el)) {
        el.setAttribute('data-hydration-pass', '1');
        el.style.pointerEvents = 'none';

        if (isCompactOverlay(el)) {
          el.setAttribute('data-hydration-compact', '1');
        }

        const controls = el.querySelectorAll('button,a,[role="button"],[onclick]');
        controls.forEach((btn) => {
          btn.style.pointerEvents = 'auto';
          btn.style.touchAction = 'manipulation';
        });
      }
    }
  }

  function clearBodyLocks() {
    const badClasses = [
      'paused',
      'is-paused',
      'modal-open',
      'overlay-open',
      'coach-open',
      'tip-open',
      'locked',
      'is-locked',
      'no-touch',
      'disable-touch',
      'pointer-locked'
    ];

    for (const c of badClasses) {
      document.body.classList.remove(c);
      document.documentElement.classList.remove(c);
    }

    document.body.style.pointerEvents = '';
    document.documentElement.style.pointerEvents = '';
  }

  function dispatchTap(el, x, y) {
    if (!el || !el.isConnected) return false;

    try {
      const opts = {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true
      };

      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
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

  function findTargetFromPoint(x, y) {
    markLayers();

    let el = document.elementFromPoint(x, y);
    if (!el) return null;

    let target = el.closest && el.closest('[data-hydration-target="1"]');
    if (target) return target;

    // Try a small radius because mobile fingers often land on the label/border.
    const offsets = [
      [0, -18],
      [0, 18],
      [-18, 0],
      [18, 0],
      [-18, -18],
      [18, -18],
      [-18, 18],
      [18, 18]
    ];

    for (const [dx, dy] of offsets) {
      const nx = Math.max(1, Math.min(window.innerWidth - 1, x + dx));
      const ny = Math.max(1, Math.min(window.innerHeight - 1, y + dy));
      el = document.elementFromPoint(nx, ny);
      target = el && el.closest && el.closest('[data-hydration-target="1"]');
      if (target) return target;
    }

    return null;
  }

  function onPointer(e) {
    if (!e || !e.isTrusted) return;
    if (isControl(e.target)) return;

    const directTarget =
      e.target &&
      e.target.closest &&
      e.target.closest('[data-hydration-target="1"]');

    if (directTarget) return;

    const x = Number(e.clientX || 0);
    const y = Number(e.clientY || 0);
    if (!x || !y) return;

    const rescueTarget = findTargetFromPoint(x, y);
    if (!rescueTarget) return;

    e.preventDefault();
    e.stopPropagation();

    dispatchTap(rescueTarget, x, y);
  }

  let lastBodySig = '';
  let sameSigCount = 0;

  function bodySignature() {
    const t = norm(document.body ? document.body.innerText : '');
    const sec = (t.match(/(\d{1,3})s/) || [])[1] || '';
    const score = (t.match(/Score\s*(\d+)/i) || t.match(/คะแนน\s*(\d+)/i) || [])[1] || '';
    const hyd = (t.match(/(\d{1,3})%\s*Hydration/i) || [])[1] || '';
    const combo = (t.match(/Combo\s*(\d+)/i) || [])[1] || '';
    return [sec, score, hyd, combo].join('|');
  }

  function watchdog() {
    clearBodyLocks();
    markLayers();

    const sig = bodySignature();
    if (sig && sig === lastBodySig) {
      sameSigCount += 1;
    } else {
      sameSigCount = 0;
      lastBodySig = sig;
    }

    // If mobile UI has not changed for a few cycles, make blockers even more transparent.
    if (sameSigCount >= 2) {
      const blockers = document.querySelectorAll('[data-hydration-pass="1"]');
      blockers.forEach((el) => {
        if (isCompactOverlay(el)) {
          el.setAttribute('data-hydration-compact', '1');
          el.style.pointerEvents = 'none';
          el.style.opacity = '0.34';
        }
      });
    }
  }

  function addBadge() {
    if (document.querySelector('.hydration-mobile-rescue-badge')) return;

    const b = document.createElement('div');
    b.className = 'hydration-mobile-rescue-badge';
    b.textContent = 'Touch Rescue ON';
    document.body.appendChild(b);

    setTimeout(() => {
      try {
        b.style.opacity = '0';
        setTimeout(() => b.remove(), 700);
      } catch (_) {}
    }, 1800);
  }

  ready(() => {
    injectStyle();
    clearBodyLocks();
    markLayers();
    addBadge();

    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('touchstart', function () {
      clearBodyLocks();
      markLayers();
    }, { capture: true, passive: true });

    document.addEventListener('visibilitychange', function () {
      setTimeout(() => {
        clearBodyLocks();
        markLayers();
      }, 120);
    });

    window.addEventListener('focus', function () {
      setTimeout(() => {
        clearBodyLocks();
        markLayers();
      }, 120);
    });

    window.addEventListener('resize', function () {
      setTimeout(markLayers, 150);
    });

    setInterval(watchdog, 850);

    // Extra early passes during first gameplay seconds.
    setTimeout(markLayers, 300);
    setTimeout(markLayers, 900);
    setTimeout(markLayers, 1600);
    setTimeout(markLayers, 2600);

    console.info('[HeroHealth]', PATCH, 'active');
  });
})();