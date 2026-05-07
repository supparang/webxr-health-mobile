/* =========================================================
 * /english/js/lesson-route-scroll-rebuild.js
 * PATCH v20260507-ROUTE-SCROLL-REBUILD
 *
 * แก้กรณี S01–S15 เลื่อนไม่ได้แม้ใส่ overflow-x แล้ว
 * วิธีนี้จะ rebuild เฉพาะ Mission Route row ใหม่
 *
 * ✅ ย้าย card S01–S15 ตัวจริงเข้า scroller ใหม่
 * ✅ ไม่ให้ทั้งหน้า scroll ขวา
 * ✅ เลื่อนด้วยนิ้ว / mouse drag / ปุ่ม ← →
 * ✅ ถ้า card เดิมมี event listener จะยังอยู่ เพราะ move node จริง ไม่ clone
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'lesson-route-scroll-rebuild-v20260507';

  function setI(el, prop, value) {
    if (!el || !el.style) return;
    el.style.setProperty(prop, value, 'important');
  }

  function txt(el) {
    return String(el && el.textContent ? el.textContent : '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m];
    });
  }

  function getSessionNoFromText(s) {
    const m = String(s || '').match(/\bS(0[1-9]|1[0-5])\b/i);
    return m ? Number(m[1]) : null;
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    return r.width > 20 && r.height > 20;
  }

  function isSessionCardCandidate(el) {
    const t = txt(el);
    const n = getSessionNoFromText(t);
    if (!n) return false;

    if (!/(SPEAKING|READING|WRITING|LISTENING|PLAY|BOSS|FINAL)/i.test(t)) {
      return false;
    }

    if (!isVisible(el)) return false;

    const r = el.getBoundingClientRect();

    // card ใน route ควรไม่ใหญ่เท่าทั้ง section
    if (r.width < 60 || r.width > 260) return false;
    if (r.height < 70 || r.height > 320) return false;

    return true;
  }

  function findCards() {
    const all = Array.from(document.querySelectorAll(
      'a, button, div, article, li, section, [role="button"], [data-session], [data-session-no]'
    ));

    const map = new Map();

    all.forEach(function (el) {
      if (!isSessionCardCandidate(el)) return;

      const n = getSessionNoFromText(txt(el));
      if (!n) return;

      const r = el.getBoundingClientRect();
      const area = r.width * r.height;

      const old = map.get(n);

      // เลือกตัวที่เป็น card ที่สุด: ใหญ่พอดี ไม่ใช่ตัวหนังสือเล็ก ๆ
      if (!old || area > old.area) {
        map.set(n, { n, el, area });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.n - b.n)
      .map(x => x.el);
  }

  function findRouteRoot() {
    const candidates = Array.from(document.querySelectorAll(
      'section, article, main > div, .card, .panel, .glass, .screen, .page-section, div'
    ));

    let best = null;
    let bestArea = Infinity;

    candidates.forEach(function (el) {
      const t = txt(el);
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

      #lessonRouteRebuildShell {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        margin-top: 14px !important;
        position: relative !important;
      }

      #lessonRouteRebuildControls {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 10px !important;
        margin: 4px 0 8px !important;
      }

      #lessonRouteRebuildControls button {
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

      #lessonRouteRebuildControls .hint {
        flex: 1 !important;
        min-width: 0 !important;
        text-align: center !important;
        color: rgba(226,246,255,.88) !important;
        font: 900 12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif !important;
      }

      #lessonRouteRebuildTrack {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;

        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: stretch !important;
        justify-content: flex-start !important;
        gap: 14px !important;

        overflow-x: auto !important;
        overflow-y: hidden !important;

        padding: 10px 10px 24px !important;
        margin: 0 !important;

        scroll-snap-type: x proximity !important;
        scroll-padding-inline: 14px !important;
        overscroll-behavior-x: contain !important;
        -webkit-overflow-scrolling: touch !important;
        touch-action: pan-x pinch-zoom !important;

        cursor: grab !important;
        scrollbar-width: thin !important;
        scrollbar-color: rgba(105,232,255,.7) rgba(255,255,255,.08) !important;
      }

      #lessonRouteRebuildTrack::-webkit-scrollbar {
        height: 8px !important;
      }

      #lessonRouteRebuildTrack::-webkit-scrollbar-track {
        background: rgba(255,255,255,.08) !important;
        border-radius: 999px !important;
      }

      #lessonRouteRebuildTrack::-webkit-scrollbar-thumb {
        background: rgba(105,232,255,.72) !important;
        border-radius: 999px !important;
      }

      #lessonRouteRebuildTrack.is-dragging {
        cursor: grabbing !important;
        user-select: none !important;
      }

      #lessonRouteRebuildTrack > * {
        flex: 0 0 auto !important;
        scroll-snap-align: center !important;
        touch-action: pan-x pinch-zoom !important;
      }

      @media (max-width: 820px) {
        #lessonRouteRebuildShell {
          width: calc(100vw - 52px) !important;
          max-width: calc(100vw - 52px) !important;
        }

        #lessonRouteRebuildTrack {
          width: calc(100vw - 52px) !important;
          max-width: calc(100vw - 52px) !important;
        }

        #lessonRouteRebuildTrack > * {
          min-width: 126px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function hideOldEmptyParents(cards) {
    const parents = new Set();

    cards.forEach(function (card) {
      let p = card.parentElement;
      let guard = 0;

      while (p && p !== document.body && guard < 4) {
        guard += 1;
        parents.add(p);
        p = p.parentElement;
      }
    });

    parents.forEach(function (p) {
      if (!p || p.id === 'lessonRouteRebuildTrack' || p.id === 'lessonRouteRebuildShell') return;

      const t = txt(p);
      const hasMissionTitle = /Mission Route/i.test(t);

      // อย่าซ่อน root ใหญ่ที่มี title
      if (hasMissionTitle) return;

      // ถ้า parent เดิมเหลือว่างหรือเหลือแค่ช่องว่าง ให้ยุบ
      setTimeout(function () {
        const remain = txt(p);
        if (!remain || !/\bS(0[1-9]|1[0-5])\b/i.test(remain)) {
          setI(p, 'display', 'none');
        }
      }, 50);
    });
  }

  function bindDrag(track) {
    if (!track || track.dataset.rebuildDragBound === '1') return;
    track.dataset.rebuildDragBound = '1';

    let down = false;
    let sx = 0;
    let sy = 0;
    let sl = 0;
    let horizontal = false;
    let moved = false;

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
      horizontal = false;
      moved = false;
      sx = ev.clientX;
      sy = ev.clientY;
      sl = track.scrollLeft;

      track.classList.add('is-dragging');

      try {
        track.setPointerCapture(ev.pointerId);
      } catch (e) {}
    }, { passive: true, capture: true });

    track.addEventListener('pointermove', function (ev) {
      if (!down) return;

      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;

      if (!horizontal && Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy)) {
        horizontal = true;
      }

      if (horizontal) {
        moved = true;
        track.scrollLeft = sl - dx;
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, { passive: false, capture: true });

    function end(ev) {
      if (!down) return;

      down = false;
      horizontal = false;
      track.classList.remove('is-dragging');

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

    // Touch fallback
    let touchDown = false;
    let tx = 0;
    let ty = 0;
    let tl = 0;
    let th = false;

    track.addEventListener('touchstart', function (ev) {
      if (!ev.touches || !ev.touches.length) return;

      const t = ev.touches[0];
      touchDown = true;
      th = false;
      tx = t.clientX;
      ty = t.clientY;
      tl = track.scrollLeft;
    }, { passive: true, capture: true });

    track.addEventListener('touchmove', function (ev) {
      if (!touchDown || !ev.touches || !ev.touches.length) return;

      const t = ev.touches[0];
      const dx = t.clientX - tx;
      const dy = t.clientY - ty;

      if (!th && Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy)) {
        th = true;
      }

      if (th) {
        track.scrollLeft = tl - dx;
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, { passive: false, capture: true });

    track.addEventListener('touchend', function () {
      touchDown = false;
      th = false;
    }, { passive: true, capture: true });

    track.addEventListener('wheel', function (ev) {
      const max = track.scrollWidth - track.clientWidth;
      if (max <= 0) return;

      const delta = Math.abs(ev.deltaX) > Math.abs(ev.deltaY)
        ? ev.deltaX
        : ev.deltaY;

      track.scrollLeft += delta;
      ev.preventDefault();
    }, { passive: false });
  }

  function createShell(routeRoot, cards) {
    let shell = document.getElementById('lessonRouteRebuildShell');

    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'lessonRouteRebuildShell';

      shell.innerHTML = `
        <div id="lessonRouteRebuildControls">
          <button type="button" id="lessonRouteRebuildLeft">←</button>
          <div class="hint">ลากแถวนี้ซ้าย–ขวาเพื่อเลือก S01–S15</div>
          <button type="button" id="lessonRouteRebuildRight">→</button>
        </div>
        <div id="lessonRouteRebuildTrack" aria-label="Mission Route S01 to S15"></div>
      `;
    }

    const track = shell.querySelector('#lessonRouteRebuildTrack');

    // วางหลัง legend ถ้ามี ไม่งั้นวางท้าย routeRoot
    const legend = Array.from(routeRoot.querySelectorAll('div, nav, section'))
      .find(function (el) {
        const t = txt(el);
        return /Normal/i.test(t) && /Boss/i.test(t) && /Final/i.test(t);
      });

    if (!shell.parentElement) {
      if (legend && legend.parentElement) {
        legend.insertAdjacentElement('afterend', shell);
      } else {
        routeRoot.appendChild(shell);
      }
    }

    cards.forEach(function (card) {
      card.dataset.routeRebuildMoved = '1';
      card.classList.add('lesson-route-rebuild-card');

      setI(card, 'flex', '0 0 auto');
      setI(card, 'min-width', '126px');
      setI(card, 'max-width', '156px');
      setI(card, 'touch-action', 'pan-x pinch-zoom');

      track.appendChild(card);
    });

    bindDrag(track);

    const left = document.getElementById('lessonRouteRebuildLeft');
    const right = document.getElementById('lessonRouteRebuildRight');

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

    return track;
  }

  function makeDebug(track, cards) {
    window.LessonRouteRebuildDebug = function () {
      const info = {
        cards: cards.length,
        clientWidth: track ? track.clientWidth : 0,
        scrollWidth: track ? track.scrollWidth : 0,
        scrollLeft: track ? track.scrollLeft : 0,
        canScroll: track ? track.scrollWidth > track.clientWidth : false
      };

      console.log('[LessonRouteRebuildDebug]', info);
      return info;
    };

    window.LessonRouteRebuildRight = function () {
      if (track) track.scrollBy({ left: 320, behavior: 'smooth' });
    };

    window.LessonRouteRebuildLeft = function () {
      if (track) track.scrollBy({ left: -320, behavior: 'smooth' });
    };
  }

  function fix() {
    injectStyle();

    if (document.documentElement.dataset.lessonRouteRebuilt === '1') {
      const track = document.getElementById('lessonRouteRebuildTrack');
      if (track) {
        bindDrag(track);
        return true;
      }
    }

    const routeRoot = findRouteRoot();
    const cards = findCards();

    if (!routeRoot || cards.length < 3) {
      return false;
    }

    const oldParents = cards.map(c => c.parentElement).filter(Boolean);

    const track = createShell(routeRoot, cards);

    hideOldEmptyParents(cards);

    document.documentElement.dataset.lessonRouteRebuilt = '1';

    makeDebug(track, cards);

    setTimeout(function () {
      if (track) track.scrollLeft = 0;
    }, 60);

    console.log('[LessonRouteScrollRebuild] rebuilt', {
      cards: cards.length,
      oldParents: oldParents.length,
      scrollWidth: track.scrollWidth,
      clientWidth: track.clientWidth
    });

    return true;
  }

  function run() {
    let tries = 0;

    const tick = function () {
      tries += 1;
      const ok = fix();

      if (ok) return true;
      return false;
    };

    if (tick()) return;

    const timer = setInterval(function () {
      if (tick() || tries >= 50) {
        clearInterval(timer);
      }
    }, 250);

    try {
      const mo = new MutationObserver(function () {
        fix();
      });

      mo.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(function () {
        try { mo.disconnect(); } catch (e) {}
      }, 15000);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
