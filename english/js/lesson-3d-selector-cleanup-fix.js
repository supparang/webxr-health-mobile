// === /english/js/lesson-3d-selector-cleanup-fix.js ===
// PATCH v20260426d-LESSON-3D-SELECTOR-CLEANUP-FINAL
// ✅ remove leftover blue/white scene blockers
// ✅ safe null checks
// ✅ remove old big planes / selector blockers / backdrop walls
// ✅ keep scene cleaner for S1-S15 selection
// ✅ mobile/pc safe

(function () {
  'use strict';

  const VERSION = 'v20260426d-LESSON-3D-SELECTOR-CLEANUP-FINAL';

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function safe(v) {
    return String(v == null ? '' : v).trim();
  }

  function lc(v) {
    return safe(v).toLowerCase();
  }

  function getScene() {
    return $('a-scene');
  }

  function removeNode(el) {
    if (!el) return false;
    try {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
        return true;
      }
    } catch (err) {
      console.warn('[Lesson3DSelectorCleanup] removeNode error', err);
    }
    return false;
  }

  function hideNode(el) {
    if (!el) return;
    try {
      el.setAttribute('visible', 'false');
    } catch (err) {}
    try {
      el.object3D.visible = false;
    } catch (err) {}
    try {
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
    } catch (err) {}
  }

  function removeByIdOrClass() {
    const selectors = [
      '#lessonSelectorBackdrop',
      '#lessonSelectorWall',
      '#lessonSelectorBlocker',
      '#lessonSelectorBluePanel',
      '#lessonSelectorWhitePanel',
      '#selectorBackdrop',
      '#selectorWall',
      '#selectorBlocker',
      '#oldSelectorRoot',
      '#oldLessonSelector',
      '#legacySelectorRoot',
      '#legacyScenePanels',
      '.lesson-selector-backdrop',
      '.lesson-selector-wall',
      '.lesson-selector-blocker',
      '.old-selector',
      '.legacy-selector',
      '.legacy-panel',
      '.legacy-wall',
      '.legacy-blocker'
    ];

    let removed = 0;

    selectors.forEach((sel) => {
      $all(sel).forEach((el) => {
        hideNode(el);
        if (removeNode(el)) removed++;
      });
    });

    return removed;
  }

  function getMaterialLike(el) {
    if (!el) return null;

    try {
      const c = el.getAttribute('material');
      if (c) return c;
    } catch (err) {}

    try {
      if (el.components && el.components.material && el.components.material.attrValue) {
        return el.components.material.attrValue;
      }
    } catch (err) {}

    return null;
  }

  function colorTextOf(el) {
    const mat = getMaterialLike(el);
    if (!mat) return '';

    if (typeof mat === 'string') return lc(mat);

    return [
      mat.color,
      mat.src,
      mat.shader,
      mat.opacity,
      mat.transparent
    ].map(safe).join(' ').toLowerCase();
  }

  function isBlueWhiteBlock(el) {
    if (!el) return false;

    const id = lc(el.id);
    const cls = lc(el.className);
    const tag = lc(el.tagName);

    const matText = colorTextOf(el);

    const pos = (function () {
      try { return el.getAttribute('position') || {}; } catch (err) { return {}; }
    })();

    const scale = (function () {
      try { return el.getAttribute('scale') || {}; } catch (err) { return {}; }
    })();

    const geo = (function () {
      try { return el.getAttribute('geometry') || {}; } catch (err) { return {}; }
    })();

    const width = Number(geo.width || scale.x || 0);
    const height = Number(geo.height || scale.y || 0);

    const nameHit =
      id.includes('blocker') ||
      id.includes('backdrop') ||
      id.includes('wall') ||
      id.includes('panel') ||
      id.includes('selector') ||
      cls.includes('blocker') ||
      cls.includes('backdrop') ||
      cls.includes('wall') ||
      cls.includes('panel') ||
      cls.includes('selector');

    const colorHit =
      matText.includes('#fff') ||
      matText.includes('white') ||
      matText.includes('#ffffff') ||
      matText.includes('#eaf') ||
      matText.includes('#dfe') ||
      matText.includes('#00f') ||
      matText.includes('#1d4ed8') ||
      matText.includes('#2563eb') ||
      matText.includes('#3b82f6') ||
      matText.includes('#60a5fa') ||
      matText.includes('blue');

    const sizeHit =
      (width >= 3 && height >= 2) ||
      (width >= 2.5 && height >= 2.5);

    const nearFront =
      Number(pos.z || 0) > -8 && Number(pos.z || 0) < 2;

    const planeLike =
      tag === 'a-plane' ||
      tag === 'a-entity';

    return planeLike && nearFront && (nameHit || (colorHit && sizeHit));
  }

  function removeBigBlueWhitePlanes() {
    const scene = getScene();
    if (!scene) return 0;

    let removed = 0;

    $all('a-plane, a-entity', scene).forEach((el) => {
      if (!el || el.id === 'lessonHudRoot') return;

      if (isBlueWhiteBlock(el)) {
        hideNode(el);
        if (removeNode(el)) removed++;
      }
    });

    return removed;
  }

  function removeObviousTextBillboards() {
    const scene = getScene();
    if (!scene) return 0;

    let removed = 0;

    $all('a-text, a-entity[text], a-image', scene).forEach((el) => {
      const id = lc(el.id);
      const cls = lc(el.className);
      const value =
        lc(el.getAttribute('value')) +
        ' ' +
        lc(el.getAttribute('text') && JSON.stringify(el.getAttribute('text')));

      const hit =
        id.includes('old') ||
        id.includes('legacy') ||
        id.includes('selector') ||
        cls.includes('old') ||
        cls.includes('legacy') ||
        cls.includes('selector') ||
        value.includes('listen') ||
        value.includes('voice') ||
        value.includes('screen') ||
        value.includes('answer') ||
        value.includes('vr lesson ready');

      if (hit) {
        hideNode(el);
        if (removeNode(el)) removed++;
      }
    });

    return removed;
  }

  function makeSceneCleaner() {
    const scene = getScene();
    if (!scene) return;

    try {
      scene.setAttribute('background', 'color: #07111f');
    } catch (err) {}

    try {
      document.documentElement.classList.add('lesson-scene-cleaned');
    } catch (err) {}
  }

  function boot() {
    const r1 = removeByIdOrClass();
    const r2 = removeBigBlueWhitePlanes();
    const r3 = removeObviousTextBillboards();

    makeSceneCleaner();

    console.log('[Lesson3DSelectorCleanup]', VERSION, {
      removedBySelector: r1,
      removedBlueWhitePlanes: r2,
      removedLegacyText: r3
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener('load', () => {
    setTimeout(boot, 300);
    setTimeout(boot, 1200);
    setTimeout(boot, 2500);
  });
})();