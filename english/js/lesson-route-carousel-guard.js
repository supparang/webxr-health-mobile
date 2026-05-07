/* =========================================================
 * /english/js/lesson-route-carousel-guard.js
 * PATCH v20260507c-CAROUSEL-GUARD
 *
 * ใช้หลัง lesson-route-carousel-force.js
 *
 * ✅ กัน carousel หายหลังหน้า re-render
 * ✅ ดัน z-index / pointer-events ให้กดได้จริง
 * ✅ เพิ่ม floating arrows สำรองบนมือถือ
 * ✅ กด S01–S15 แล้วตั้งค่า session ให้ engine เดิม
 * ✅ fallback reload ด้วย ?s=1..15 ถ้า engine ไม่มี function
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'lesson-route-carousel-guard-v20260507c';

  function qs(k, d = '') {
    try {
      return new URL(location.href).searchParams.get(k) || d;
    } catch (e) {
      return d;
    }
  }

  function setI(el, prop, value) {
    if (!el || !el.style) return;
    el.style.setProperty(prop, value, 'important');
  }

  function injectStyle() {
    if (document.getElementById(PATCH_ID + '-style')) return;

    const style = document.createElement('style');
    style.id = PATCH_ID + '-style';
    style.textContent = `
      #lessonRouteCarouselForce,
      #lessonRouteCarouselForce * {
        pointer-events: auto !important;
      }

      #lessonRouteCarouselForce {
        position: relative !important;
        z-index: 999990 !important;
        isolation: isolate !important;
      }

      #lessonRouteCarouselForce .route-force-btn,
      #lessonRouteCarouselForce .route-force-card,
      #lessonRouteCarouselForce .route-dot {
        position: relative !important;
        z-index: 999991 !important;
        pointer-events: auto !important;
        touch-action: manipulation !important;
      }

      #lessonRouteFloatNav {
        position: fixed !important;
        left: 10px !important;
        right: 10px !important;
        bottom: 92px !important;
        z-index: 999992 !important;
        display: none !important;
        grid-template-columns: 56px 1fr 56px !important;
        gap: 10px !important;
        align-items: center !important;
        pointer-events: none !important;
      }

      #lessonRouteFloatNav.show {
        display: grid !important;
      }

      #lessonRouteFloatNav button {
        pointer-events: auto !important;
        width: 56px !important;
        height: 44px !important;
        border-radius: 999px !important;
        border: 1px solid rgba(112,232,255,.55) !important;
        background: rgba(6,20,36,.92) !important;
        color: #eaffff !important;
        font: 1000 22px/1 system-ui,-apple-system,Segoe UI,sans-serif !important;
        box-shadow: 0 12px 32px rgba(0,0,0,.35) !important;
      }

      #lessonRouteFloatNav .float-label {
        pointer-events: none !important;
        text-align: center !important;
        border-radius: 999px !important;
        padding: 10px 12px !important;
        background: rgba(6,20,36,.86) !important;
        border: 1px solid rgba(112,232,255,.30) !important;
        color: #eaffff !important;
        font: 900 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif !important;
      }

      @media (max-width: 820px) {
        #lessonRouteFloatNav.show {
          display: grid !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureCarousel() {
    if (
      window.LessonRouteCarouselForce &&
      typeof window.LessonRouteCarouselForce.debug === 'function'
    ) {
      const info = window.LessonRouteCarouselForce.debug();

      if (info && info.shellFound) {
        return true;
      }
    }

    // ถ้า force script มี object แต่ยังไม่ mount ให้ลอง next/prev เพื่อกระตุ้น
    try {
      if (window.LessonRouteCarouselForce && typeof window.LessonRouteCarouselForce.goTo === 'function') {
        window.LessonRouteCarouselForce.goTo(0);
        return true;
      }
    } catch (e) {}

    return false;
  }

  function ensureFloatNav() {
    if (document.getElementById('lessonRouteFloatNav')) return;

    const nav = document.createElement('div');
    nav.id = 'lessonRouteFloatNav';
    nav.className = 'show';
    nav.innerHTML = `
      <button type="button" id="lessonRouteFloatPrev" aria-label="Previous">←</button>
      <div class="float-label">S01–S15 • กดลูกศรเพื่อเลื่อน Route</div>
      <button type="button" id="lessonRouteFloatNext" aria-label="Next">→</button>
    `;

    document.body.appendChild(nav);

    document.getElementById('lessonRouteFloatPrev').addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();

      if (window.LessonRouteCarouselForce && typeof window.LessonRouteCarouselForce.prev === 'function') {
        window.LessonRouteCarouselForce.prev();
      }
    }, true);

    document.getElementById('lessonRouteFloatNext').addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();

      if (window.LessonRouteCarouselForce && typeof window.LessonRouteCarouselForce.next === 'function') {
        window.LessonRouteCarouselForce.next();
      }
    }, true);
  }

  function patchOpenSession() {
    if (!window.LessonRouteCarouselForce || window.LessonRouteCarouselForce.__guardPatched) return;

    const oldOpen = window.LessonRouteCarouselForce.open;

    window.LessonRouteCarouselForce.open = function (sid) {
      sid = String(sid || 'S01').toUpperCase();
      const n = Number(sid.replace('S', '')) || 1;

      window.LESSON_SESSION = sid;
      window.currentSession = sid;
      window.currentS = n;

      window.dispatchEvent(new CustomEvent('lesson:session-selected', {
        detail: {
          session: sid,
          sessionNo: n,
          source: PATCH_ID
        }
      }));

      const fnNames = [
        'selectSession',
        'startSession',
        'loadSession',
        'chooseSession',
        'openSession',
        'playSession',
        'goSession',
        'setSession',
        'startLessonSession'
      ];

      for (const name of fnNames) {
        if (typeof window[name] === 'function') {
          try {
            window[name](sid, n);
            return;
          } catch (e1) {
            try {
              window[name](n);
              return;
            } catch (e2) {}
          }
        }
      }

      if (typeof oldOpen === 'function') {
        try {
          oldOpen(sid);
          return;
        } catch (e3) {}
      }

      const url = new URL(location.href);
      url.searchParams.set('s', String(n));
      url.searchParams.set('session', sid);
      url.searchParams.set('view', qs('view', 'mobile'));
      location.href = url.toString();
    };

    window.LessonRouteCarouselForce.__guardPatched = true;
  }

  function patchCards() {
    const shell = document.getElementById('lessonRouteCarouselForce');
    if (!shell) return;

    shell.querySelectorAll('.route-force-card').forEach(function (card) {
      if (card.dataset.guardBound === '1') return;
      card.dataset.guardBound = '1';

      card.addEventListener('dblclick', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();

        const sid = card.dataset.session || 'S01';

        if (window.LessonRouteCarouselForce && typeof window.LessonRouteCarouselForce.open === 'function') {
          window.LessonRouteCarouselForce.open(sid);
        }
      }, true);
    });
  }

  function keepOnScreen() {
    const shell = document.getElementById('lessonRouteCarouselForce');
    if (!shell) return;

    setI(shell, 'display', 'block');
    setI(shell, 'visibility', 'visible');
    setI(shell, 'opacity', '1');
    setI(shell, 'z-index', '999990');
    setI(shell, 'pointer-events', 'auto');

    shell.querySelectorAll('button').forEach(function (btn) {
      setI(btn, 'pointer-events', 'auto');
      setI(btn, 'touch-action', 'manipulation');
    });
  }

  function runGuard() {
    injectStyle();
    ensureCarousel();
    ensureFloatNav();
    patchOpenSession();
    patchCards();
    keepOnScreen();
  }

  window.LessonRouteCarouselGuard = {
    run: runGuard,
    debug: function () {
      const shell = document.getElementById('lessonRouteCarouselForce');
      return {
        patch: PATCH_ID,
        shell: !!shell,
        floatNav: !!document.getElementById('lessonRouteFloatNav'),
        forceApi: !!window.LessonRouteCarouselForce,
        currentSession: window.LESSON_SESSION || window.currentSession || window.currentS || null
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runGuard, { once: true });
  } else {
    runGuard();
  }

  let tries = 0;
  const timer = setInterval(function () {
    tries += 1;
    runGuard();

    if (tries >= 30) clearInterval(timer);
  }, 500);

  try {
    const mo = new MutationObserver(function () {
      runGuard();
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(function () {
      try { mo.disconnect(); } catch (e) {}
    }, 20000);
  } catch (e) {}
})();
