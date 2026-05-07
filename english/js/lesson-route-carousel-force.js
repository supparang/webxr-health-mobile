/* =========================================================
 * /english/js/lesson-route-carousel-force.js
 * PATCH v20260507-CAROUSEL-FORCE
 *
 * แก้ปัญหา Mission Route S01–S15 เลื่อนไม่ได้
 *
 * วิธีแก้:
 * ✅ ไม่ใช้ native overflow scroll เป็นหลัก
 * ✅ ใช้ carousel transform translateX แทน
 * ✅ กด ← → ได้แน่นอน
 * ✅ ปัดซ้าย/ขวาได้
 * ✅ สร้างแถว S01–S15 ใหม่จากข้อมูลตรง ๆ
 * ✅ ซ่อน route card เดิมที่เลื่อนไม่ได้
 * ✅ ถ้ากด card ใหม่ จะพยายาม click card เดิมให้ engine เดิมทำงานต่อ
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'lesson-route-carousel-force-v20260507';

  const ROUTE = [
    { id: 'S01', skill: 'SPEAKING',  icon: '🎙️', type: 'normal', label: 'PLAY' },
    { id: 'S02', skill: 'READING',   icon: '📖', type: 'normal', label: 'PLAY' },
    { id: 'S03', skill: 'WRITING',   icon: '👾', type: 'boss',   label: 'BOSS' },
    { id: 'S04', skill: 'SPEAKING',  icon: '🎙️', type: 'normal', label: 'PLAY' },
    { id: 'S05', skill: 'LISTENING', icon: '🎧', type: 'normal', label: 'PLAY' },
    { id: 'S06', skill: 'READING',   icon: '👾', type: 'boss',   label: 'BOSS' },
    { id: 'S07', skill: 'WRITING',   icon: '⌨️', type: 'normal', label: 'PLAY' },
    { id: 'S08', skill: 'LISTENING', icon: '🎧', type: 'normal', label: 'PLAY' },
    { id: 'S09', skill: 'SPEAKING',  icon: '👾', type: 'boss',   label: 'BOSS' },
    { id: 'S10', skill: 'READING',   icon: '📖', type: 'normal', label: 'PLAY' },
    { id: 'S11', skill: 'LISTENING', icon: '🎧', type: 'normal', label: 'PLAY' },
    { id: 'S12', skill: 'WRITING',   icon: '👾', type: 'boss',   label: 'BOSS' },
    { id: 'S13', skill: 'READING',   icon: '📖', type: 'normal', label: 'PLAY' },
    { id: 'S14', skill: 'SPEAKING',  icon: '🎙️', type: 'normal', label: 'PLAY' },
    { id: 'S15', skill: 'FINAL',     icon: '🏆', type: 'final',  label: 'FINAL' }
  ];

  let activeIndex = 0;
  let originalMap = new Map();
  let routeRoot = null;
  let shell = null;
  let rail = null;
  let viewport = null;
  let progressText = null;
  let didDrag = false;

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

  function txt(el) {
    return String(el && el.textContent ? el.textContent : '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function setI(el, prop, value) {
    if (!el || !el.style) return;
    el.style.setProperty(prop, value, 'important');
  }

  function getSessionIdFromText(s) {
    const m = String(s || '').match(/\bS(0[1-9]|1[0-5])\b/i);
    return m ? ('S' + m[1]).toUpperCase() : '';
  }

  function routeLabel(item) {
    if (item.type === 'boss') return 'Boss Mission';
    if (item.type === 'final') return 'Final Mission';
    return 'Normal Mission';
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

  function collectOriginalCards() {
    originalMap = new Map();

    const all = Array.from(document.querySelectorAll(
      'a, button, div, article, li, section, [role="button"], [data-session], [data-session-no]'
    ));

    all.forEach(function (el) {
      const t = txt(el);
      const sid = getSessionIdFromText(t);
      if (!sid) return;

      if (!/(SPEAKING|READING|WRITING|LISTENING|PLAY|BOSS|FINAL)/i.test(t)) return;

      const r = el.getBoundingClientRect();
      const area = r.width * r.height;

      if (area < 1000 || area > 90000) return;

      const old = originalMap.get(sid);

      if (!old || area > old.area) {
        originalMap.set(sid, {
          el,
          area
        });
      }
    });
  }

  function hideOldRouteCards() {
    originalMap.forEach(function (info) {
      const el = info.el;
      if (!el) return;

      if (el.closest && el.closest('#lessonRouteCarouselForce')) return;

      setI(el, 'display', 'none');
    });

    [
      'lessonRouteRebuildShell',
      'lessonRouteHardControls',
      'lessonRouteHardDebug',
      'lessonRouteRebuildControls'
    ].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) setI(el, 'display', 'none');
    });
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

      #lessonRouteCarouselForce {
        position: relative !important;
        z-index: 9999 !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        margin: 14px 0 2px !important;
        pointer-events: auto !important;
      }

      #lessonRouteCarouselForce .route-force-controls {
        display: grid !important;
        grid-template-columns: 52px 1fr 52px !important;
        gap: 10px !important;
        align-items: center !important;
        margin: 0 0 10px !important;
      }

      #lessonRouteCarouselForce .route-force-btn {
        appearance: none !important;
        width: 52px !important;
        height: 42px !important;
        border-radius: 999px !important;
        border: 1px solid rgba(111,232,255,.48) !important;
        background: rgba(255,255,255,.13) !important;
        color: #eaffff !important;
        font: 1000 20px/1 system-ui,-apple-system,Segoe UI,sans-serif !important;
        box-shadow: 0 10px 26px rgba(0,0,0,.28) !important;
        touch-action: manipulation !important;
      }

      #lessonRouteCarouselForce .route-force-btn:active {
        transform: translateY(1px) scale(.97) !important;
      }

      #lessonRouteCarouselForce .route-force-progress {
        min-width: 0 !important;
        text-align: center !important;
        color: rgba(231,248,255,.92) !important;
        font: 900 12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif !important;
        padding: 9px 10px !important;
        border-radius: 999px !important;
        border: 1px solid rgba(111,232,255,.25) !important;
        background: rgba(255,255,255,.08) !important;
      }

      #lessonRouteCarouselForce .route-force-viewport {
        width: 100% !important;
        max-width: 100% !important;
        overflow: hidden !important;
        position: relative !important;
        border-radius: 24px !important;
        padding: 4px 0 16px !important;
        touch-action: none !important;
        pointer-events: auto !important;
      }

      #lessonRouteCarouselForce .route-force-rail {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        gap: 14px !important;
        align-items: stretch !important;
        justify-content: flex-start !important;
        will-change: transform !important;
        transition: transform .28s cubic-bezier(.2,.9,.2,1) !important;
        padding: 0 8px !important;
        pointer-events: auto !important;
      }

      #lessonRouteCarouselForce.dragging .route-force-rail {
        transition: none !important;
      }

      #lessonRouteCarouselForce .route-force-card {
        flex: 0 0 132px !important;
        width: 132px !important;
        min-width: 132px !important;
        max-width: 132px !important;
        height: 172px !important;
        border-radius: 26px !important;
        border: 1px solid rgba(196,234,255,.24) !important;
        background:
          radial-gradient(circle at 50% 18%, rgba(121,232,255,.18), transparent 38%),
          linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.07)) !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.22),
          0 14px 34px rgba(0,0,0,.26) !important;
        color: #f1fbff !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
        text-align: center !important;
        font-family: system-ui,-apple-system,Segoe UI,sans-serif !important;
        cursor: pointer !important;
        user-select: none !important;
        pointer-events: auto !important;
        touch-action: none !important;
        position: relative !important;
        overflow: hidden !important;
      }

      #lessonRouteCarouselForce .route-force-card::before {
        content: "" !important;
        position: absolute !important;
        left: 0 !important;
        right: 0 !important;
        top: 52px !important;
        height: 40px !important;
        background: rgba(112,230,255,.10) !important;
        border-top: 1px solid rgba(255,255,255,.08) !important;
        border-bottom: 1px solid rgba(255,255,255,.08) !important;
      }

      #lessonRouteCarouselForce .route-force-card.boss {
        border-color: rgba(255,100,145,.48) !important;
        background:
          radial-gradient(circle at 50% 18%, rgba(255,100,145,.24), transparent 42%),
          linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.07)) !important;
      }

      #lessonRouteCarouselForce .route-force-card.final {
        border-color: rgba(255,215,98,.58) !important;
        background:
          radial-gradient(circle at 50% 18%, rgba(255,215,98,.30), transparent 42%),
          linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.07)) !important;
      }

      #lessonRouteCarouselForce .route-force-card.active {
        border-color: rgba(105,232,255,.78) !important;
        box-shadow:
          0 0 0 2px rgba(105,232,255,.16),
          0 16px 40px rgba(0,0,0,.34),
          0 0 32px rgba(105,232,255,.16) !important;
      }

      #lessonRouteCarouselForce .route-force-icon {
        position: relative !important;
        z-index: 1 !important;
        width: 56px !important;
        height: 56px !important;
        border-radius: 999px !important;
        display: grid !important;
        place-items: center !important;
        background: rgba(4,18,32,.28) !important;
        font-size: 28px !important;
      }

      #lessonRouteCarouselForce .route-force-id {
        position: relative !important;
        z-index: 1 !important;
        font-size: 22px !important;
        font-weight: 1000 !important;
        letter-spacing: .5px !important;
        line-height: 1 !important;
      }

      #lessonRouteCarouselForce .route-force-skill {
        position: relative !important;
        z-index: 1 !important;
        font-size: 13px !important;
        font-weight: 1000 !important;
        opacity: .86 !important;
        letter-spacing: .4px !important;
        line-height: 1 !important;
      }

      #lessonRouteCarouselForce .route-force-label {
        position: relative !important;
        z-index: 1 !important;
        margin-top: 2px !important;
        padding: 5px 10px !important;
        border-radius: 999px !important;
        background: rgba(255,255,255,.15) !important;
        color: #f7fbff !important;
        font-size: 12px !important;
        font-weight: 1000 !important;
        line-height: 1 !important;
      }

      #lessonRouteCarouselForce .route-force-dots {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 5px !important;
        margin-top: 8px !important;
        flex-wrap: wrap !important;
      }

      #lessonRouteCarouselForce .route-dot {
        width: 7px !important;
        height: 7px !important;
        border-radius: 999px !important;
        border: 0 !important;
        padding: 0 !important;
        background: rgba(255,255,255,.25) !important;
      }

      #lessonRouteCarouselForce .route-dot.active {
        width: 18px !important;
        background: rgba(105,232,255,.9) !important;
      }

      @media (max-width: 820px) {
        #lessonRouteCarouselForce {
          width: calc(100vw - 52px) !important;
          max-width: calc(100vw - 52px) !important;
        }

        #lessonRouteCarouselForce .route-force-card {
          flex-basis: 126px !important;
          width: 126px !important;
          min-width: 126px !important;
          max-width: 126px !important;
          height: 164px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function buildShell() {
    if (document.getElementById('lessonRouteCarouselForce')) {
      shell = document.getElementById('lessonRouteCarouselForce');
      rail = shell.querySelector('.route-force-rail');
      viewport = shell.querySelector('.route-force-viewport');
      progressText = shell.querySelector('.route-force-progress');
      return;
    }

    shell = document.createElement('div');
    shell.id = 'lessonRouteCarouselForce';

    shell.innerHTML = `
      <div class="route-force-controls">
        <button class="route-force-btn" id="routeForcePrev" type="button" aria-label="Previous session">←</button>
        <div class="route-force-progress">S01 / S15 • ปัดซ้าย–ขวา หรือกดลูกศร</div>
        <button class="route-force-btn" id="routeForceNext" type="button" aria-label="Next session">→</button>
      </div>

      <div class="route-force-viewport">
        <div class="route-force-rail">
          ${ROUTE.map(function (item, index) {
            return `
              <button
                type="button"
                class="route-force-card ${esc(item.type)}"
                data-index="${index}"
                data-session="${esc(item.id)}"
                aria-label="${esc(item.id + ' ' + item.skill)}"
              >
                <div class="route-force-icon">${esc(item.icon)}</div>
                <div class="route-force-id">${esc(item.id)}</div>
                <div class="route-force-skill">${esc(item.skill)}</div>
                <div class="route-force-label">${esc(item.label)}</div>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <div class="route-force-dots">
        ${ROUTE.map(function (_, index) {
          return `<button type="button" class="route-dot" data-dot="${index}" aria-label="Go to ${index + 1}"></button>`;
        }).join('')}
      </div>
    `;

    rail = shell.querySelector('.route-force-rail');
    viewport = shell.querySelector('.route-force-viewport');
    progressText = shell.querySelector('.route-force-progress');

    const legend = Array.from(routeRoot.querySelectorAll('div, nav, section'))
      .find(function (el) {
        const t = txt(el);
        return /Normal/i.test(t) && /Boss/i.test(t) && /Final/i.test(t);
      });

    if (legend && legend.parentElement) {
      legend.insertAdjacentElement('afterend', shell);
    } else {
      routeRoot.appendChild(shell);
    }
  }

  function getStep() {
    const card = rail ? rail.querySelector('.route-force-card') : null;
    if (!card) return 140;

    const r = card.getBoundingClientRect();
    return Math.round(r.width + 14);
  }

  function clampIndex(i) {
    return Math.max(0, Math.min(ROUTE.length - 1, Number(i) || 0));
  }

  function update(instant) {
    if (!rail) return;

    activeIndex = clampIndex(activeIndex);

    const step = getStep();
    const x = -activeIndex * step;

    if (instant) {
      setI(rail, 'transition', 'none');
      rail.style.transform = `translate3d(${x}px,0,0)`;
      requestAnimationFrame(function () {
        rail.style.removeProperty('transition');
      });
    } else {
      rail.style.transform = `translate3d(${x}px,0,0)`;
    }

    const item = ROUTE[activeIndex];

    if (progressText && item) {
      progressText.textContent = `${item.id} / S15 • ${routeLabel(item)} • ${item.skill}`;
    }

    shell.querySelectorAll('.route-force-card').forEach(function (card) {
      const idx = Number(card.dataset.index || 0);
      card.classList.toggle('active', idx === activeIndex);
    });

    shell.querySelectorAll('.route-dot').forEach(function (dot) {
      const idx = Number(dot.dataset.dot || 0);
      dot.classList.toggle('active', idx === activeIndex);
    });
  }

  function go(delta) {
    activeIndex = clampIndex(activeIndex + delta);
    update(false);
  }

  function goTo(index) {
    activeIndex = clampIndex(index);
    update(false);
  }

  function openSession(sid) {
    const info = originalMap.get(sid);

    window.dispatchEvent(new CustomEvent('lesson:route-select', {
      detail: {
        session: sid,
        source: PATCH_ID
      }
    }));

    // 1) พยายามกด card เดิม เพื่อให้ engine เดิมทำงาน
    if (info && info.el && typeof info.el.click === 'function') {
      try {
        info.el.click();
        return;
      } catch (e) {}
    }

    // 2) พยายามเรียก global function ที่อาจมีใน lesson engine
    const n = Number(String(sid).replace('S', ''));

    const fnNames = [
      'selectSession',
      'startSession',
      'loadSession',
      'chooseSession',
      'openSession',
      'playSession',
      'goSession'
    ];

    for (const name of fnNames) {
      if (typeof window[name] === 'function') {
        try {
          window[name](sid, n);
          return;
        } catch (e) {
          try {
            window[name](n);
            return;
          } catch (e2) {}
        }
      }
    }

    // 3) fallback: เปลี่ยน URL param แล้ว reload หน้า
    try {
      const url = new URL(location.href);
      url.searchParams.set('session', sid);
      url.searchParams.set('s', sid);
      location.href = url.toString();
    } catch (e) {}
  }

  function bindControls() {
    const prev = document.getElementById('routeForcePrev');
    const next = document.getElementById('routeForceNext');

    if (prev && prev.dataset.bound !== '1') {
      prev.dataset.bound = '1';
      prev.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        go(-1);
      }, true);
    }

    if (next && next.dataset.bound !== '1') {
      next.dataset.bound = '1';
      next.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        go(1);
      }, true);
    }

    shell.querySelectorAll('.route-force-card').forEach(function (card) {
      if (card.dataset.bound === '1') return;
      card.dataset.bound = '1';

      card.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();

        if (didDrag) return;

        const idx = Number(card.dataset.index || 0);
        const sid = card.dataset.session || ROUTE[idx].id;

        if (idx !== activeIndex) {
          goTo(idx);
          return;
        }

        openSession(sid);
      }, true);
    });

    shell.querySelectorAll('.route-dot').forEach(function (dot) {
      if (dot.dataset.bound === '1') return;
      dot.dataset.bound = '1';

      dot.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        goTo(Number(dot.dataset.dot || 0));
      }, true);
    });
  }

  function bindSwipe() {
    if (!viewport || viewport.dataset.swipeBound === '1') return;
    viewport.dataset.swipeBound = '1';

    let down = false;
    let sx = 0;
    let sy = 0;
    let baseX = 0;
    let moved = false;

    function currentX() {
      return -activeIndex * getStep();
    }

    viewport.addEventListener('pointerdown', function (ev) {
      down = true;
      moved = false;
      didDrag = false;
      sx = ev.clientX;
      sy = ev.clientY;
      baseX = currentX();

      shell.classList.add('dragging');

      try {
        viewport.setPointerCapture(ev.pointerId);
      } catch (e) {}
    }, { passive: true, capture: true });

    viewport.addEventListener('pointermove', function (ev) {
      if (!down) return;

      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;

      if (Math.abs(dx) < 4 || Math.abs(dx) < Math.abs(dy)) return;

      moved = true;
      didDrag = true;

      rail.style.transform = `translate3d(${baseX + dx}px,0,0)`;

      ev.preventDefault();
      ev.stopPropagation();
    }, { passive: false, capture: true });

    function end(ev) {
      if (!down) return;

      down = false;
      shell.classList.remove('dragging');

      const dx = ev.clientX ? ev.clientX - sx : 0;

      try {
        viewport.releasePointerCapture(ev.pointerId);
      } catch (e) {}

      if (moved && Math.abs(dx) > 36) {
        if (dx < 0) go(1);
        else go(-1);
      } else {
        update(false);
      }

      setTimeout(function () {
        didDrag = false;
      }, 180);
    }

    viewport.addEventListener('pointerup', end, { passive: true, capture: true });
    viewport.addEventListener('pointercancel', end, { passive: true, capture: true });
    viewport.addEventListener('pointerleave', end, { passive: true, capture: true });

    // Touch fallback สำหรับ Android บางเครื่อง
    let tDown = false;
    let tx = 0;
    let ty = 0;
    let tBase = 0;
    let tMoved = false;

    viewport.addEventListener('touchstart', function (ev) {
      if (!ev.touches || !ev.touches.length) return;

      const t = ev.touches[0];
      tDown = true;
      tMoved = false;
      didDrag = false;
      tx = t.clientX;
      ty = t.clientY;
      tBase = currentX();

      shell.classList.add('dragging');
    }, { passive: true, capture: true });

    viewport.addEventListener('touchmove', function (ev) {
      if (!tDown || !ev.touches || !ev.touches.length) return;

      const t = ev.touches[0];
      const dx = t.clientX - tx;
      const dy = t.clientY - ty;

      if (Math.abs(dx) < 4 || Math.abs(dx) < Math.abs(dy)) return;

      tMoved = true;
      didDrag = true;

      rail.style.transform = `translate3d(${tBase + dx}px,0,0)`;

      ev.preventDefault();
      ev.stopPropagation();
    }, { passive: false, capture: true });

    viewport.addEventListener('touchend', function (ev) {
      if (!tDown) return;

      tDown = false;
      shell.classList.remove('dragging');

      let dx = 0;

      if (ev.changedTouches && ev.changedTouches.length) {
        dx = ev.changedTouches[0].clientX - tx;
      }

      if (tMoved && Math.abs(dx) > 36) {
        if (dx < 0) go(1);
        else go(-1);
      } else {
        update(false);
      }

      setTimeout(function () {
        didDrag = false;
      }, 180);
    }, { passive: true, capture: true });
  }

  function exposeDebug() {
    window.LessonRouteCarouselForce = {
      next: function () {
        go(1);
      },
      prev: function () {
        go(-1);
      },
      goTo: function (sessionOrIndex) {
        if (typeof sessionOrIndex === 'string') {
          const sid = sessionOrIndex.toUpperCase();
          const idx = ROUTE.findIndex(x => x.id === sid);
          if (idx >= 0) goTo(idx);
          return;
        }
        goTo(Number(sessionOrIndex || 0));
      },
      open: openSession,
      debug: function () {
        const info = {
          patch: PATCH_ID,
          activeIndex,
          activeSession: ROUTE[activeIndex],
          routeRootFound: !!routeRoot,
          shellFound: !!shell,
          railFound: !!rail,
          originalCards: Array.from(originalMap.keys()),
          railTransform: rail ? rail.style.transform : '',
          viewportWidth: viewport ? viewport.clientWidth : 0,
          step: getStep()
        };

        console.log('[LessonRouteCarouselForce]', info);
        return info;
      }
    };
  }

  function init() {
    injectStyle();

    routeRoot = findRouteRoot();

    if (!routeRoot) {
      console.warn('[LessonRouteCarouselForce] Mission Route root not found yet.');
      return false;
    }

    collectOriginalCards();
    buildShell();
    hideOldRouteCards();
    bindControls();
    bindSwipe();
    exposeDebug();
    update(true);

    console.log('[LessonRouteCarouselForce] ready', {
      originalCards: Array.from(originalMap.keys())
    });

    return true;
  }

  function run() {
    let tries = 0;

    const timer = setInterval(function () {
      tries += 1;

      const ok = init();

      if (ok || tries >= 40) {
        clearInterval(timer);
      }
    }, 250);

    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
