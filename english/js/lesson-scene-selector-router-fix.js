// === /english/js/lesson-scene-selector-router-fix.js ===
// PATCH v20260426b-LESSON-SCENE-SELECTOR-ROUTER-NO-RELOAD-ON-PAN
// Fix: dragging / scrolling the 3D scene reloads the page.
// ✅ Scene S1-S15 selector remains usable
// ✅ Route only on real click/tap, not drag / wheel / pan
// ✅ Do not listen to mousedown/touchstart for routing
// ✅ Ignore route shortly after scene pan
// ✅ Forces new mission panel flow
// ✅ Prevents old scene selector from opening old native gameplay

(function () {
  'use strict';

  const VERSION = 'v20260426b-LESSON-SCENE-SELECTOR-ROUTER-NO-RELOAD-ON-PAN';

  const SID_RE = /\bS\s*([1-9]|1[0-5])\b/i;

  const CONFIG = {
    maxClickMovePx: 10,
    suppressAfterPanMs: 650,
    debounceRouteMs: 600
  };

  const state = {
    bound: false,
    lastRouteAt: 0,
    pointerDownX: 0,
    pointerDownY: 0,
    pointerMoved: false,
    pointerCandidateSid: '',
    suppressUntil: 0
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function safe(v) {
    return String(v == null ? '' : v).trim();
  }

  function q() {
    return new URLSearchParams(location.search || '');
  }

  function normalizeSid(v) {
    const raw = safe(v).toUpperCase();

    if (/^S\d+$/.test(raw)) {
      const n = Math.max(1, Math.min(15, parseInt(raw.replace('S', ''), 10) || 1));
      return `S${n}`;
    }

    const n = Math.max(1, Math.min(15, parseInt(raw, 10) || 1));
    return `S${n}`;
  }

  function sidNumber(sid) {
    return Math.max(1, Math.min(15, parseInt(String(sid).replace('S', ''), 10) || 1));
  }

  function getTextValue(el) {
    if (!el) return '';

    try {
      const value = el.getAttribute('value');
      if (value) return String(value);
    } catch (err) {}

    try {
      const text = el.getAttribute('text');

      if (text && typeof text === 'object' && text.value) return String(text.value);
      if (typeof text === 'string') return text;
    } catch (err) {}

    try {
      return safe(el.textContent || el.innerText || '');
    } catch (err) {}

    return '';
  }

  function getAttrText(el) {
    if (!el) return '';

    const parts = [];

    try { parts.push(safe(el.id)); } catch (err) {}
    try { parts.push(safe(el.getAttribute('id'))); } catch (err) {}
    try { parts.push(safe(el.getAttribute('class'))); } catch (err) {}
    try { parts.push(safe(el.getAttribute('data-sid'))); } catch (err) {}
    try { parts.push(safe(el.getAttribute('data-session'))); } catch (err) {}
    try { parts.push(safe(el.getAttribute('data-lesson'))); } catch (err) {}
    try { parts.push(safe(el.getAttribute('name'))); } catch (err) {}
    try { parts.push(getTextValue(el)); } catch (err) {}

    return parts.filter(Boolean).join(' ');
  }

  function parseSidFromText(text) {
    const s = safe(text);

    const m = s.match(SID_RE);
    if (m) return normalizeSid(m[1]);

    const lower = s.toLowerCase();

    const titleMap = [
      ['self', 'S1'],
      ['intro', 'S1'],
      ['academic', 'S2'],
      ['background', 'S2'],
      ['boss 1', 'S3'],
      ['tech jobs', 'S4'],
      ['jobs', 'S4'],
      ['emails', 'S5'],
      ['chat', 'S5'],
      ['boss 2', 'S6'],
      ['system', 'S7'],
      ['problems', 'S8'],
      ['bugs', 'S8'],
      ['boss 3', 'S9'],
      ['client', 'S10'],
      ['data', 'S11'],
      ['ai communication', 'S11'],
      ['boss 4', 'S12'],
      ['interview', 'S13'],
      ['pitch', 'S14'],
      ['final', 'S15'],
      ['capstone', 'S15']
    ];

    const found = titleMap.find(([needle]) => lower.includes(needle));
    return found ? found[1] : '';
  }

  function parseSidFromEntity(el) {
    if (!el) return '';

    let cur = el;

    for (let i = 0; i < 5 && cur; i++) {
      try {
        const direct =
          safe(cur.dataset?.lessonSceneSid) ||
          safe(cur.getAttribute?.('data-lesson-scene-sid')) ||
          safe(cur.getAttribute?.('data-sid')) ||
          safe(cur.getAttribute?.('data-session'));

        if (direct) return normalizeSid(direct);
      } catch (err) {}

      const text = getAttrText(cur);
      const sid = parseSidFromText(text);
      if (sid) return sid;

      cur = cur.parentElement;
    }

    return '';
  }

  function findSidFromEvent(ev) {
    const scene = $('a-scene');
    if (!scene) return '';

    const path = typeof ev.composedPath === 'function'
      ? ev.composedPath()
      : [];

    for (const node of path) {
      if (!node || node === window || node === document) continue;

      const sid = parseSidFromEntity(node);
      if (sid) return sid;

      if (node === scene) break;
    }

    return parseSidFromEntity(ev.target);
  }

  function markSceneSelectors(reason) {
    const scene = $('a-scene');
    if (!scene) return 0;

    let count = 0;

    $all('a-text, [text], a-entity, a-box, a-plane', scene).forEach((el) => {
      const sid = parseSidFromEntity(el);
      if (!sid) return;

      try {
        el.dataset.lessonSceneSid = sid;
        el.setAttribute('data-lesson-scene-sid', sid);
        el.setAttribute('data-new-mission-router', VERSION);
        el.classList.add('lesson-scene-sid-router');
      } catch (err) {}

      try {
        const parent = el.parentElement;
        if (parent && parent !== scene) {
          parent.dataset.lessonSceneSid = sid;
          parent.setAttribute('data-lesson-scene-sid', sid);
          parent.setAttribute('data-new-mission-router', VERSION);
          parent.classList.add('lesson-scene-sid-router');
        }
      } catch (err) {}

      count += 1;
    });

    if (count) {
      console.log('[LessonSceneSelectorRouter] marked selectors', {
        version: VERSION,
        reason,
        count
      });
    }

    return count;
  }

  function currentViewMode() {
    try {
      if (window.LESSON_VIEW_MODE) return String(window.LESSON_VIEW_MODE);
    } catch (err) {}

    const p = q();
    const view = safe(p.get('view')).toLowerCase();

    if (view) return view;
    return 'pc';
  }

  function buildUrlForSid(sid) {
    sid = normalizeSid(sid);
    const n = sidNumber(sid);

    const url = new URL(location.href);

    url.searchParams.set('s', String(n));
    url.searchParams.set('sid', sid);
    url.searchParams.set('ai', 'auto');

    if (!url.searchParams.get('view')) {
      url.searchParams.set('view', currentViewMode());
    }

    [
      'skill',
      'stage',
      'mission',
      'type',
      'old',
      'native',
      'question',
      'prompt',
      'modeSkill'
    ].forEach((k) => url.searchParams.delete(k));

    url.searchParams.delete('difficulty');
    url.searchParams.delete('level');
    url.searchParams.delete('diff');

    return url.toString();
  }

  function stopOldSceneEvent(ev) {
    try { ev.preventDefault(); } catch (err) {}
    try { ev.stopPropagation(); } catch (err) {}
    try { ev.stopImmediatePropagation(); } catch (err) {}
  }

  function wasSceneRecentlyPanned() {
    const now = Date.now();

    if (now < state.suppressUntil) return true;

    try {
      const scrollState = window.LESSON_SCENE_SCROLL_FIX?.state;
      const lastPanAt = Number(scrollState?.lastPanAt || 0);

      if (lastPanAt && now - lastPanAt < CONFIG.suppressAfterPanMs) {
        return true;
      }
    } catch (err) {}

    return false;
  }

  function routeToSid(sid, source) {
    sid = normalizeSid(sid);

    const now = Date.now();
    if (now - state.lastRouteAt < CONFIG.debounceRouteMs) return;

    state.lastRouteAt = now;

    try {
      sessionStorage.setItem('TECHPATH_LAST_SCENE_SELECTED_SID', sid);
    } catch (err) {}

    console.log('[LessonSceneSelectorRouter] route', {
      version: VERSION,
      sid,
      source
    });

    location.href = buildUrlForSid(sid);
  }

  function onPointerDown(ev) {
    const sid = findSidFromEvent(ev);

    state.pointerDownX = Number(ev.clientX || 0);
    state.pointerDownY = Number(ev.clientY || 0);
    state.pointerMoved = false;
    state.pointerCandidateSid = sid || '';
  }

  function onPointerMove(ev) {
    if (!state.pointerCandidateSid) return;

    const dx = Math.abs(Number(ev.clientX || 0) - state.pointerDownX);
    const dy = Math.abs(Number(ev.clientY || 0) - state.pointerDownY);

    if (dx > CONFIG.maxClickMovePx || dy > CONFIG.maxClickMovePx) {
      state.pointerMoved = true;
      state.suppressUntil = Date.now() + CONFIG.suppressAfterPanMs;
    }
  }

  function onPointerUp(ev) {
    const sid = state.pointerCandidateSid || findSidFromEvent(ev);

    const moved = state.pointerMoved;
    const suppressed = wasSceneRecentlyPanned();

    state.pointerCandidateSid = '';
    state.pointerMoved = false;

    if (!sid) return;

    if (moved || suppressed) {
      console.log('[LessonSceneSelectorRouter] skip route after pan/drag', {
        version: VERSION,
        sid,
        moved,
        suppressed
      });
      return;
    }

    stopOldSceneEvent(ev);
    routeToSid(sid, 'scene-pointerup-click');
  }

  function onClick(ev) {
    const sid = findSidFromEvent(ev);
    if (!sid) return;

    if (wasSceneRecentlyPanned()) {
      console.log('[LessonSceneSelectorRouter] skip click after pan', {
        version: VERSION,
        sid
      });
      return;
    }

    stopOldSceneEvent(ev);
    routeToSid(sid, 'scene-click');
  }

  function bindSceneClick() {
    const scene = $('a-scene');
    if (!scene || state.bound) return;

    state.bound = true;

    // สำคัญ: ไม่ใช้ mousedown/touchstart route แล้ว
    // เพราะมันทำให้ลาก/เลื่อนฉากแล้ว reload
    scene.addEventListener('pointerdown', onPointerDown, true);
    scene.addEventListener('pointermove', onPointerMove, true);
    scene.addEventListener('pointerup', onPointerUp, true);
    scene.addEventListener('click', onClick, true);

    console.log('[LessonSceneSelectorRouter] bound safe click router', VERSION);
  }

  function boot() {
    markSceneSelectors('boot');
    bindSceneClick();

    setTimeout(() => {
      markSceneSelectors('t500');
      bindSceneClick();
    }, 500);

    setTimeout(() => {
      markSceneSelectors('t1500');
      bindSceneClick();
    }, 1500);

    setTimeout(() => {
      markSceneSelectors('t3000');
      bindSceneClick();
    }, 3000);

    [
      'loaded',
      'renderstart',
      'lesson:view-mode-ready',
      'lesson:router-ready',
      'lesson:data-skill-ready',
      'lesson:item-ready'
    ].forEach((name) => {
      window.addEventListener(name, () => {
        markSceneSelectors(name);
        bindSceneClick();
      });

      document.addEventListener(name, () => {
        markSceneSelectors(`document:${name}`);
        bindSceneClick();
      });
    });

    window.LESSON_SCENE_SELECTOR_ROUTER_FIX = {
      version: VERSION,
      mark: markSceneSelectors,
      routeToSid,
      buildUrlForSid,
      parseSidFromEntity,
      suppressClick(ms) {
        state.suppressUntil = Date.now() + Number(ms || CONFIG.suppressAfterPanMs);
      }
    };

    console.log('[LessonSceneSelectorRouter]', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
