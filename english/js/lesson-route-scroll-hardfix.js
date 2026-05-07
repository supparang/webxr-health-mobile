/* =========================================================
 * /english/js/lesson-route-scroll-hardfix.js
 * PATCH v20260507-ROUTE-SCROLL-HARDFIX
 *
 * แก้ปัญหา:
 * ✅ Mission Route S01–S15 เลื่อนซ้าย/ขวาไม่ได้บนมือถือ
 * ✅ จับ card S01–S15 โดยตรง ไม่พึ่ง class เดิม
 * ✅ บังคับ parent row ให้เป็น horizontal scroll จริง
 * ✅ รองรับ touch drag / mouse drag / wheel / ปุ่ม ← →
 * ✅ ไม่ทำให้ทั้งหน้าเลื่อนไปขวา
 *
 * ต้องโหลดเป็น script ตัวสุดท้ายก่อน </body>
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'lesson-route-scroll-hardfix-v20260507';

  let fixedTrack = null;
  let fixedCards = [];

  function setImportant(el, prop, value) {
    if (!el || !el.style) return;
    el.style.setProperty(prop, value, 'important');
  }

  function textOf(el) {
    return String(el && el.textContent ? el.textContent : '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    return r.width > 20 && r.height > 20;
  }

  function sessionNoFromText(text) {
    const m = String(text || '').match(/\bS(0[1-9]|1[0-5])\b/i);
    if (!m) return null;
    return Number(m[1]);
  }

  function sessionKey(n) {
    return 'S' + String(n).padStart(2, '0');
  }

  function countSessionMarks(text) {
    const found = String(text || '').match(/\bS(0[1-9]|1[0-5])\b/gi) || [];
    return new Set(found.map(s => s.toUpperCase())).size;
  }

  function isCardLike(el) {
    const t = textOf(el);
    const n = sessionNoFromText(t);
    if (!n) return false;

    // กันไม่ให้ไปจับทั้ง section ที่มี S01 S02 S03 หลายใบ
    if (countSessionMarks(t) !== 1) return false;

    if (!/(SPEAKING|READING|WRITING|LISTENING|PLAY|BOSS|FINAL)/i.test(t)) {
      return false;
    }

    if (!visible(el)) return false;

    const r = el.getBoundingClientRect();

    // ขนาด card ในภาพประมาณนี้ ถ้ากว้าง/สูงเกินมากคือ parent section ไม่ใช่ card
    if (r.width < 70 || r.width > 240) return false;
    if (r.height < 80 || r.height > 280) return false;

    return true;
  }

  function findSessionCards() {
    const all = Array.from(document.querySelectorAll(
      'a, button, div, article, li, section, [role="button"], [data-session], [data-session-no]'
    ));

    const bySession = new Map();

    all.forEach(function (el) {
      if (!isCardLike(el)) return;

      const t = textOf(el);
      const n = sessionNoFromText(t);
      if (!n) return;

      const r = el.getBoundingClientRect();
      const area = r.width * r.height;

      const current = bySession.get(n);

      // เลือกใบที่ดูเป็น card ที่สุด: พื้นที่ใหญ่กว่า แต่ไม่ใช่ parent ใหญ่เกิน
      if (!current || area > current.area) {
        bySession.set(n, {
          n,
          el,
          area
        });
      }
    });

    return Array.from(bySession.values())
      .sort((a, b) => a.n - b.n)
      .map(x => x.el);
  }

  function findMissionRouteRoot() {
    const candidates = Array.from(document.querySelectorAll(
      'section, article, main > div, .card, .panel, .glass, .screen, .page-section, div'
    ));

    let best = null;
    let bestArea = Infinity;

    candidates.forEach(function (el) {
      const t = textOf(el);

      if (!/Mission Route/i.test(t)) return;
      if (!/\bS01\b/i.test(t)) return;
      if (!/\bS03\b/i.test(t)) return;

      const r = el.getBoundingClientRect();
      const area = r.width * r.height;

      if (area > 10000 && area < bestArea) {
        best = el;
        bestArea = area;
      }
    });

    return best;
  }

  function containsManyCards(el, cards) {
    if (!el) return 0;
    return cards.filter(card => el.contains(card)).length;
  }

  function findBestTrack(cards) {
    if (!cards || cards.length < 3) return null;

    const first = cards[0];
    let best = null;
    let bestScore = Infinity;

    let a = first.parentElement;

    while (a && a !== document.body && a !== document.documentElement) {
      const count = containsManyCards(a, cards);

      if (count >= Math.min(cards.length, 4)) {
        const r = a.getBoundingClientRect();

        const directCardChildren = Array.from(a.children || []).filter(child => {
          return cards.some(card => child === card || child.contains(card));
        }).length;

        // track จริงควรมีการ์ดหลายใบ และสูงไม่มากเกิน
        const goodHeight = r.height >= 90 && r.height <= 360;
        const goodChildren = directCardChildren >= 3;

        if (goodHeight && goodChildren) {
          const score = (r.width * r.height) - (directCardChildren * 10000);
          if (score < bestScore) {
            best = a;
            bestScore = score;
          }
        }
      }

      a = a.parentElement;
    }

    if (best) return best;

    // fallback: หา ancestor ที่เล็กที่สุดที่ครอบ card หลายใบ
    a = first.parentElement;
    best = null;
    bestScore = Infinity;

    while (a && a !== document.body && a !== document.documentElement) {
      const count = containsManyCards(a, cards);

      if (count >= Math.min(cards.length, 4)) {
        const r = a.getBoundingClientRect();
        const area = r.width * r.height;

        if (area < bestScore) {
          best = a;
          bestScore = area;
        }
      }

      a = a.parentElement;
    }

    return best;
  }

  function forceTrackStyle(track, cards) {
    if (!track) return;

    track.classList.add('lesson-route-hard-scroll-track');

    setImportant(track, 'display', 'flex');
    setImportant(track, 'flex-direction', 'row');
    setImportant(track, 'flex-wrap', 'nowrap');
    setImportant(track, 'align-items', 'stretch');
    setImportant(track, 'justify-content', 'flex-start');

    setImportant(track, 'gap', '14px');
    setImportant(track, 'overflow-x', 'auto');
    setImportant(track, 'overflow-y', 'hidden');

    setImportant(track, 'width', '100%');
    setImportant(track, 'max-width', '100%');
    setImportant(track, 'min-width', '0');

    setImportant(track, 'padding-left', '10px');
    setImportant(track, 'padding-right', '28px');
    setImportant(track, 'padding-top', '10px');
    setImportant(track, 'padding-bottom', '22px');

    setImportant(track, 'scroll-snap-type', 'x proximity');
    setImportant(track, 'scroll-padding-inline', '16px');
    setImportant(track, 'overscroll-behavior-x', 'contain');
    setImportant(track, '-webkit-overflow-scrolling', 'touch');
    setImportant(track, 'touch-action', 'pan-x pinch-zoom');
    setImportant(track, 'cursor', 'grab');

    // สำคัญสำหรับมือถือ: ถ้า parent ใหญ่เกิน viewport ให้ track จำกัดตามจอจริง
    if (window.innerWidth <= 820) {
      setImportant(track, 'width', 'calc(100vw - 52px)');
      setImportant(track, 'max-width', 'calc(100vw - 52px)');
    }

    cards.forEach(function (card) {
      card.classList.add('lesson-route-hard-scroll-card');

      setImportant(card, 'flex', '0 0 auto');
      setImportant(card, 'scroll-snap-align', 'center');
      setImportant(card, 'touch-action', 'pan-x pinch-zoom');

      const r = card.getBoundingClientRect();
      if (r.width < 110) {
        setImportant(card, 'min-width', '126px');
      }
    });

    // parent chain ต้องไม่บีบ track
    let p = track.parentElement;
    let guard = 0;

    while (p && p !== document.body && guard < 8) {
      guard += 1;

      setImportant(p, 'min-width', '0');

      if (window.innerWidth <= 820) {
        setImportant(p, 'max-width', '100vw');
      } else {
        setImportant(p, 'max-width', '100%');
      }

      p = p.parentElement;
    }

    setImportant(document.documentElement, 'overflow-x', 'hidden');
    setImportant(document.body, 'overflow-x', 'hidden');
    setImportant(document.body, 'max-width', '100%');
  }

  function injectStyle() {
    if (document.getElementById(PATCH_ID + '-style')) return;

    const style = document.createElement('style');
    style.id = PATCH_ID + '-style';
    style.textContent = `
      html,
      body {
        overflow-x: hidden !important;
        max-width: 100% !important;
      }

      .lesson-route-hard-scroll-track {
        scrollbar-width: thin !important;
        scrollbar-color: rgba(105,232,255,.7) rgba(255,255,255,.08) !important;
      }

      .lesson-route-hard-scroll-track::-webkit-scrollbar {
        height: 8px !important;
      }

      .lesson-route-hard-scroll-track::-webkit-scrollbar-track {
        background: rgba(255,255,255,.08) !important;
        border-radius: 999px !important;
      }

      .lesson-route-hard-scroll-track::-webkit-scrollbar-thumb {
        background: rgba(105,232,255,.72) !important;
        border-radius: 999px !important;
      }

      .lesson-route-hard-scroll-track.is-route-dragging {
        cursor: grabbing !important;
        user-select: none !important;
      }

      .lesson-route-hard-scroll-card {
        flex-shrink: 0 !important;
      }

      #lessonRouteHardControls {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 10px !important;
        margin: 8px auto 2px !important;
        width: 100% !important;
        max-width: calc(100vw - 52px) !important;
      }

      #lessonRouteHardControls button {
        appearance: none !important;
        border: 1px solid rgba(125,235,255,.45) !important;
        background: rgba(255,255,255,.12) !important;
        color: #eaffff !important;
        border-radius: 999px !important;
        min-width: 58px !important;
        height: 40px !important;
        padding: 0 16px !important;
        font: 1000 18px/1 system-ui,-apple-system,Segoe UI,sans-serif !important;
        box-shadow: 0 10px 28px rgba(0,0,0,.25) !important;
      }

      #lessonRouteHardControls .route-hint {
        flex: 1 !important;
        min-width: 0 !important;
        text-align: center !important;
        color: rgba(226,246,255,.88) !important;
        font: 900 12px/1.3 system-ui,-apple-system,Segoe UI,sans-serif !important;
      }

      @media (max-width: 820px) {
        .lesson-route-hard-scroll-track {
          width: calc(100vw - 52px) !important;
          max-width: calc(100vw - 52px) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function bindDrag(track) {
    if (!track || track.dataset.lessonRouteHardDrag === '1') return;

    track.dataset.lessonRouteHardDrag = '1';

    let down = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let moved = false;
    let horizontal = false;

    track.addEventListener('pointerdown', function (ev) {
      const target = ev.target;

      if (
        target &&
        target.closest &&
        target.closest('button, input, textarea, select, label')
      ) {
        return;
      }

      down = true;
      moved = false;
      horizontal = false;
      startX = ev.clientX;
      startY = ev.clientY;
      startLeft = track.scrollLeft;

      track.classList.add('is-route-dragging');

      try {
        track.setPointerCapture(ev.pointerId);
      } catch (e) {}
    }, { passive: true, capture: true });

    track.addEventListener('pointermove', function (ev) {
      if (!down) return;

      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!horizontal && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        horizontal = true;
      }

      if (horizontal) {
        moved = true;
        track.scrollLeft = startLeft - dx;
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, { passive: false, capture: true });

    function end(ev) {
      if (!down) return;

      down = false;
      horizontal = false;
      track.classList.remove('is-route-dragging');

      try {
        track.releasePointerCapture(ev.pointerId);
      } catch (e) {}

      if (moved) {
        track.dataset.justDragged = '1';
        setTimeout(function () {
          track.dataset.justDragged = '0';
        }, 220);
      }
    }

    track.addEventListener('pointerup', end, { passive: true, capture: true });
    track.addEventListener('pointercancel', end, { passive: true, capture: true });
    track.addEventListener('pointerleave', end, { passive: true, capture: true });

    track.addEventListener('click', function (ev) {
      if (track.dataset.justDragged === '1') {
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);

    // touch fallback สำหรับบาง Android WebView/Chrome
    let touchDown = false;
    let tx = 0;
    let ty = 0;
    let tLeft = 0;
    let tHorizontal = false;

    track.addEventListener('touchstart', function (ev) {
      if (!ev.touches || !ev.touches.length) return;

      const t = ev.touches[0];
      touchDown = true;
      tHorizontal = false;
      tx = t.clientX;
      ty = t.clientY;
      tLeft = track.scrollLeft;
    }, { passive: true, capture: true });

    track.addEventListener('touchmove', function (ev) {
      if (!touchDown || !ev.touches || !ev.touches.length) return;

      const t = ev.touches[0];
      const dx = t.clientX - tx;
      const dy = t.clientY - ty;

      if (!tHorizontal && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        tHorizontal = true;
      }

      if (tHorizontal) {
        track.scrollLeft = tLeft - dx;
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, { passive: false, capture: true });

    track.addEventListener('touchend', function () {
      touchDown = false;
      tHorizontal = false;
    }, { passive: true, capture: true });

    track.addEventListener('wheel', function (ev) {
      const max = track.scrollWidth - track.clientWidth;
      if (max <= 0) return;

      const before = track.scrollLeft;
      const delta = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;

      track.scrollLeft += delta;

      if (track.scrollLeft !== before) {
        ev.preventDefault();
      }
    }, { passive: false });
  }

  function addControls(routeRoot, track) {
    if (!routeRoot || !track) return;

    let controls = document.getElementById('lessonRouteHardControls');

    if (!controls) {
      controls = document.createElement('div');
      controls.id = 'lessonRouteHardControls';
      controls.innerHTML = `
        <button type="button" id="lessonRouteLeftBtn" aria-label="เลื่อนไปซ้าย">←</button>
        <div class="route-hint">ลากแถว S01–S15 ซ้าย–ขวา หรือกดปุ่มลูกศร</div>
        <button type="button" id="lessonRouteRightBtn" aria-label="เลื่อนไปขวา">→</button>
      `;
    }

    // วางปุ่มใกล้ track มากที่สุด
    if (controls.parentElement !== routeRoot) {
      try {
        routeRoot.insertBefore(controls, track);
      } catch (e) {
        routeRoot.appendChild(controls);
      }
    }

    const left = document.getElementById('lessonRouteLeftBtn');
    const right = document.getElementById('lessonRouteRightBtn');

    if (left && left.dataset.bound !== '1') {
      left.dataset.bound = '1';
      left.addEventListener('click', function () {
        track.scrollBy({ left: -320, behavior: 'smooth' });
      });
    }

    if (right && right.dataset.bound !== '1') {
      right.dataset.bound = '1';
      right.addEventListener('click', function () {
        track.scrollBy({ left: 320, behavior: 'smooth' });
      });
    }
  }

  function addDebugToast(track, cards) {
    if (document.getElementById('lessonRouteHardDebug')) return;

    const toast = document.createElement('div');
    toast.id = 'lessonRouteHardDebug';
    toast.style.cssText = [
      'position:fixed',
      'left:12px',
      'right:12px',
      'bottom:82px',
      'z-index:999999',
      'display:none',
      'padding:10px 12px',
      'border-radius:14px',
      'background:rgba(5,17,32,.95)',
      'color:#eaffff',
      'border:1px solid rgba(105,232,255,.45)',
      'font:800 12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif',
      'box-shadow:0 14px 40px rgba(0,0,0,.35)'
    ].join(';');

    document.body.appendChild(toast);

    window.LessonRouteScrollDebug = function () {
      toast.innerHTML =
        '✅ Route scroll hardfix<br>' +
        'cards: <b>' + cards.length + '</b><br>' +
        'clientWidth: <b>' + Math.round(track.clientWidth) + '</b><br>' +
        'scrollWidth: <b>' + Math.round(track.scrollWidth) + '</b><br>' +
        'scrollLeft: <b>' + Math.round(track.scrollLeft) + '</b>';

      toast.style.display = 'block';

      clearTimeout(toast._t);
      toast._t = setTimeout(function () {
        toast.style.display = 'none';
      }, 5200);

      return {
        track,
        cards,
        clientWidth: track.clientWidth,
        scrollWidth: track.scrollWidth,
        scrollLeft: track.scrollLeft
      };
    };
  }

  function fixRoute() {
    injectStyle();

    const routeRoot = findMissionRouteRoot();
    const cards = findSessionCards();

    if (!routeRoot || cards.length < 3) {
      return false;
    }

    const track = findBestTrack(cards);

    if (!track) {
      return false;
    }

    fixedTrack = track;
    fixedCards = cards;

    forceTrackStyle(track, cards);
    bindDrag(track);
    addControls(routeRoot, track);
    addDebugToast(track, cards);

    // เปิดให้เริ่มที่ S01
    if (!track.dataset.lessonRouteHardInitialized) {
      track.dataset.lessonRouteHardInitialized = '1';
      track.scrollLeft = 0;
    }

    return true;
  }

  function run() {
    fixRoute();

    let tries = 0;
    const timer = setInterval(function () {
      tries += 1;
      const ok = fixRoute();

      if (ok && fixedTrack && fixedTrack.scrollWidth > fixedTrack.clientWidth) {
        clearInterval(timer);
      }

      if (tries >= 40) {
        clearInterval(timer);
      }
    }, 250);

    try {
      const mo = new MutationObserver(function () {
        fixRoute();
      });

      mo.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(function () {
        try {
          mo.disconnect();
        } catch (e) {}
      }, 15000);
    } catch (e) {}
  }

  window.LessonRouteScrollHardFix = {
    run: fixRoute,
    getTrack: function () {
      return fixedTrack;
    },
    getCards: function () {
      return fixedCards;
    },
    right: function () {
      if (fixedTrack) fixedTrack.scrollBy({ left: 320, behavior: 'smooth' });
    },
    left: function () {
      if (fixedTrack) fixedTrack.scrollBy({ left: -320, behavior: 'smooth' });
    },
    debug: function () {
      if (typeof window.LessonRouteScrollDebug === 'function') {
        return window.LessonRouteScrollDebug();
      }
      return {
        track: fixedTrack,
        cards: fixedCards
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();