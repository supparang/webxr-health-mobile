/* =========================================================
 * /english/js/lesson-route-scroll-fix.js
 * PATCH v20260503-route-scroll-fix
 *
 * Fix:
 * ✅ S1–S15 Mission Route scrolls horizontally on mobile
 * ✅ Only this route row scrolls right/left
 * ✅ Body page will NOT horizontally scroll
 * ✅ Supports touch swipe, mouse drag, wheel, and arrow buttons
 * ✅ Safe with existing lesson.html / lesson-main.js
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'lesson-route-scroll-fix-v20260503';

  function injectStyle() {
    if (document.getElementById(PATCH_ID + '-style')) return;

    const style = document.createElement('style');
    style.id = PATCH_ID + '-style';
    style.textContent = `
      html,
      body {
        max-width: 100% !important;
        overflow-x: hidden !important;
      }

      .lesson-route-scroll-fixed {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        overflow: hidden !important;
        position: relative !important;
      }

      .lesson-route-scroll-fixed .lesson-route-scroll-hint {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
        margin: 10px 0 8px !important;
        color: rgba(226, 246, 255, .86) !important;
        font-size: 13px !important;
        font-weight: 800 !important;
        letter-spacing: .2px !important;
        user-select: none !important;
        pointer-events: none !important;
      }

      .lesson-route-scroll-track-fixed {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;

        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: stretch !important;
        justify-content: flex-start !important;
        gap: 16px !important;

        overflow-x: auto !important;
        overflow-y: hidden !important;

        padding: 10px 14px 22px !important;
        margin: 0 !important;

        scroll-snap-type: x proximity !important;
        scroll-padding-inline: 16px !important;
        overscroll-behavior-x: contain !important;
        overscroll-behavior-y: auto !important;

        -webkit-overflow-scrolling: touch !important;
        touch-action: pan-x pinch-zoom !important;

        cursor: grab !important;
      }

      .lesson-route-scroll-track-fixed.is-dragging {
        cursor: grabbing !important;
        user-select: none !important;
      }

      .lesson-route-scroll-track-fixed > * {
        flex: 0 0 auto !important;
        scroll-snap-align: center !important;
      }

      .lesson-route-scroll-track-fixed .session-card,
      .lesson-route-scroll-track-fixed .mission-card,
      .lesson-route-scroll-track-fixed .route-card,
      .lesson-route-scroll-track-fixed [data-session],
      .lesson-route-scroll-track-fixed [data-session-no] {
        flex: 0 0 132px !important;
        min-width: 132px !important;
        max-width: 150px !important;
      }

      @media (max-width: 520px) {
        .lesson-route-scroll-track-fixed {
          gap: 14px !important;
          padding-left: 10px !important;
          padding-right: 22px !important;
        }

        .lesson-route-scroll-track-fixed > * {
          flex-basis: 132px !important;
          min-width: 132px !important;
        }
      }

      .lesson-route-scroll-track-fixed::-webkit-scrollbar {
        height: 8px !important;
      }

      .lesson-route-scroll-track-fixed::-webkit-scrollbar-track {
        background: rgba(255,255,255,.08) !important;
        border-radius: 999px !important;
      }

      .lesson-route-scroll-track-fixed::-webkit-scrollbar-thumb {
        background: rgba(105, 225, 255, .65) !important;
        border-radius: 999px !important;
      }

      .lesson-route-scroll-buttons {
        display: flex !important;
        justify-content: center !important;
        gap: 10px !important;
        margin: 8px 0 0 !important;
      }

      .lesson-route-scroll-buttons button {
        appearance: none !important;
        border: 1px solid rgba(134, 232, 255, .35) !important;
        background: rgba(255,255,255,.10) !important;
        color: #eaffff !important;
        border-radius: 999px !important;
        min-width: 52px !important;
        height: 38px !important;
        padding: 0 16px !important;
        font-size: 18px !important;
        font-weight: 900 !important;
        box-shadow: 0 8px 24px rgba(0,0,0,.18) !important;
      }

      .lesson-route-scroll-buttons button:active {
        transform: translateY(1px) scale(.98) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function textOf(el) {
    return String(el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();
  }

  function looksLikeMissionRoute(el) {
    const t = textOf(el);
    return (
      /Mission Route/i.test(t) &&
      /S0?1/i.test(t) &&
      (/S1?5/i.test(t) || /S0?2/i.test(t) || /S0?3/i.test(t))
    );
  }

  function findMissionRouteRoot() {
    const preferred = [
      '#missionRoute',
      '#mission-route',
      '[data-mission-route]',
      '.mission-route',
      '.missionRoute',
      '.route-panel',
      '.mission-panel',
      '.sessions-panel',
      '.session-route-panel'
    ];

    for (const sel of preferred) {
      const el = document.querySelector(sel);
      if (el && looksLikeMissionRoute(el)) return el;
    }

    const blocks = Array.from(document.querySelectorAll('section, article, main > div, .card, .panel, .glass, .screen, .page-section, div'));
    return blocks.find(looksLikeMissionRoute) || null;
  }

  function hasSessionCards(el) {
    const t = textOf(el);
    const hitCount = [
      /S0?1/i,
      /S0?2/i,
      /S0?3/i,
      /S0?4/i,
      /S0?5/i
    ].filter((rx) => rx.test(t)).length;

    return hitCount >= 3;
  }

  function findBestTrack(root) {
    if (!root) return null;

    const preferred = [
      '[data-session-track]',
      '[data-route-track]',
      '#sessionTrack',
      '#sessionsTrack',
      '#missionTrack',
      '.session-track',
      '.sessions-track',
      '.mission-track',
      '.route-track',
      '.session-row',
      '.sessions-row',
      '.mission-row',
      '.route-row',
      '.cards-row',
      '.session-cards',
      '.mission-cards'
    ];

    for (const sel of preferred) {
      const el = root.querySelector(sel);
      if (el && hasSessionCards(el)) return el;
    }

    const candidates = Array.from(root.querySelectorAll('div, ul, nav'));
    let best = null;
    let bestScore = 0;

    for (const el of candidates) {
      if (!hasSessionCards(el)) continue;

      const children = Array.from(el.children || []);
      const cardLikeChildren = children.filter((child) => {
        const t = textOf(child);
        return /S0?\d|S1[0-5]/i.test(t) || /PLAY|BOSS|FINAL/i.test(t);
      });

      const score = cardLikeChildren.length * 10 + children.length;
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }

    return best;
  }

  function addHint(root) {
    if (!root || root.querySelector('.lesson-route-scroll-hint')) return;

    const hint = document.createElement('div');
    hint.className = 'lesson-route-scroll-hint';
    hint.innerHTML = '↔️ ลากแถวนี้ซ้าย–ขวา เพื่อเลือก S1–S15';

    const title = Array.from(root.querySelectorAll('h1,h2,h3,strong,div,p'))
      .find((el) => /Mission Route/i.test(textOf(el)));

    if (title && title.parentNode) {
      title.insertAdjacentElement('afterend', hint);
    } else {
      root.insertBefore(hint, root.firstChild);
    }
  }

  function addButtons(root, track) {
    if (!root || !track || root.querySelector('.lesson-route-scroll-buttons')) return;

    const wrap = document.createElement('div');
    wrap.className = 'lesson-route-scroll-buttons';

    const left = document.createElement('button');
    left.type = 'button';
    left.setAttribute('aria-label', 'เลื่อนไปซ้าย');
    left.textContent = '←';

    const right = document.createElement('button');
    right.type = 'button';
    right.setAttribute('aria-label', 'เลื่อนไปขวา');
    right.textContent = '→';

    left.addEventListener('click', function () {
      track.scrollBy({ left: -280, behavior: 'smooth' });
    });

    right.addEventListener('click', function () {
      track.scrollBy({ left: 280, behavior: 'smooth' });
    });

    wrap.appendChild(left);
    wrap.appendChild(right);

    track.insertAdjacentElement('afterend', wrap);
  }

  function bindDragScroll(track) {
    if (!track || track.dataset.routeScrollDragBound === '1') return;
    track.dataset.routeScrollDragBound = '1';

    let down = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let moved = false;
    let horizontalLock = false;

    track.addEventListener('pointerdown', function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('button, a, input, textarea, select, label')) {
        return;
      }

      down = true;
      moved = false;
      horizontalLock = false;
      startX = ev.clientX;
      startY = ev.clientY;
      startLeft = track.scrollLeft;

      track.classList.add('is-dragging');

      try {
        track.setPointerCapture(ev.pointerId);
      } catch (e) {}
    }, { passive: true });

    track.addEventListener('pointermove', function (ev) {
      if (!down) return;

      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!horizontalLock && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        horizontalLock = true;
      }

      if (horizontalLock) {
        moved = true;
        track.scrollLeft = startLeft - dx;
        ev.preventDefault();
      }
    }, { passive: false });

    function endDrag(ev) {
      if (!down) return;

      down = false;
      horizontalLock = false;
      track.classList.remove('is-dragging');

      try {
        track.releasePointerCapture(ev.pointerId);
      } catch (e) {}

      if (moved) {
        track.dataset.justDragged = '1';
        window.setTimeout(function () {
          track.dataset.justDragged = '0';
        }, 180);
      }
    }

    track.addEventListener('pointerup', endDrag, { passive: true });
    track.addEventListener('pointercancel', endDrag, { passive: true });
    track.addEventListener('pointerleave', endDrag, { passive: true });

    track.addEventListener('click', function (ev) {
      if (track.dataset.justDragged === '1') {
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);

    track.addEventListener('wheel', function (ev) {
      if (Math.abs(ev.deltaY) <= Math.abs(ev.deltaX)) return;

      const max = track.scrollWidth - track.clientWidth;
      if (max <= 0) return;

      const before = track.scrollLeft;
      track.scrollLeft += ev.deltaY;

      if (track.scrollLeft !== before) {
        ev.preventDefault();
      }
    }, { passive: false });
  }

  function fixRouteScroll() {
    injectStyle();

    const root = findMissionRouteRoot();
    if (!root) return false;

    const track = findBestTrack(root);
    if (!track) return false;

    root.classList.add('lesson-route-scroll-fixed');
    track.classList.add('lesson-route-scroll-track-fixed');

    addHint(root);
    addButtons(root, track);
    bindDragScroll(track);

    // Keep route starting at S1 on first load unless user already scrolled.
    if (!track.dataset.routeScrollInitialized) {
      track.dataset.routeScrollInitialized = '1';
      track.scrollLeft = 0;
    }

    return true;
  }

  function runSoon() {
    fixRouteScroll();

    // lesson.html บางชุด render route หลังโหลด script แล้ว จึงยิงซ้ำเบา ๆ
    let tries = 0;
    const timer = window.setInterval(function () {
      tries += 1;
      const ok = fixRouteScroll();
      if (ok || tries >= 20) {
        window.clearInterval(timer);
      }
    }, 250);

    const mo = new MutationObserver(function () {
      fixRouteScroll();
    });

    try {
      mo.observe(document.body, {
        childList: true,
        subtree: true
      });

      window.setTimeout(function () {
        try { mo.disconnect(); } catch (e) {}
      }, 10000);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runSoon, { once: true });
  } else {
    runSoon();
  }
})();
