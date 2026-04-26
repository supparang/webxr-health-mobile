// === /english/js/lesson-scene-hard-cleaner-fix.js ===
// PATCH v20260426a-LESSON-SCENE-HARD-CLEANER
// Final hard cleanup for leftover blue/white scene blockers.
// ✅ removes large blue/white/pale planes, boxes, meshes
// ✅ runs repeatedly after runtime creates objects
// ✅ observes scene mutations
// ✅ keeps a-text / S1-S15 text
// ✅ keeps new HTML panels
// ✅ keeps a-scene clickable
// ✅ PC/Mobile only; Cardboard untouched

(function () {
  'use strict';

  const VERSION = 'v20260426a-LESSON-SCENE-HARD-CLEANER';

  const CONFIG = {
    enabled: true,
    minLargeSize: 0.62,
    maxRuns: 18,
    intervalMs: 650,
    debug: true
  };

  const state = {
    runCount: 0,
    removed: 0,
    hiddenMeshes: 0,
    observer: null,
    intervalId: 0
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

  function lower(v) {
    return safe(v).toLowerCase();
  }

  function q() {
    return new URLSearchParams(location.search || '');
  }

  function getViewMode() {
    try {
      if (window.LESSON_VIEW_MODE) return String(window.LESSON_VIEW_MODE);
    } catch (err) {}

    const ds = document.documentElement.dataset.lessonViewMode;
    if (ds) return ds;

    const view = lower(q().get('view'));

    if (['vr', 'cvr', 'cardboard', 'cardboard-vr'].includes(view)) return 'cardboard';
    if (['mobile', 'phone'].includes(view)) return 'mobile';

    return 'pc';
  }

  function getScene() {
    return $('a-scene');
  }

  function getThree() {
    return window.THREE || window.AFRAME?.THREE || null;
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

  function looksLikeSessionText(text) {
    const s = safe(text);

    return (
      /^S([1-9]|1[0-5])\b/i.test(s) ||
      /\bS([1-9]|1[0-5])\b/i.test(s) ||
      /Self.?Introduction/i.test(s) ||
      /Academic.?Background/i.test(s) ||
      /Tech.?Jobs/i.test(s) ||
      /Emails?/i.test(s) ||
      /Chat/i.test(s) ||
      /Bug/i.test(s) ||
      /Client/i.test(s) ||
      /Career/i.test(s) ||
      /Final/i.test(s) ||
      /Capstone/i.test(s)
    );
  }

  function keepEntity(el) {
    if (!el) return true;

    const tag = lower(el.tagName);
    const id = lower(el.id);
    const cls = lower(el.getAttribute?.('class') || '');

    if (tag === 'a-text') return true;
    if (looksLikeSessionText(getTextValue(el))) return true;

    if (
      id.includes('lessonmission') ||
      id.includes('lessonspeaking') ||
      id.includes('lessonwriting') ||
      id.includes('lessonai') ||
      id.includes('lessonpcsession') ||
      id.includes('lessonclean') ||
      cls.includes('lesson-clean')
    ) {
      return true;
    }

    return false;
  }

  function colorFromMaterialObject(mat) {
    if (!mat) return '';

    const parts = [];

    try {
      if (mat.color && typeof mat.color.getHexString === 'function') {
        parts.push(`#${mat.color.getHexString()}`);
      }
    } catch (err) {}

    try {
      if (mat.emissive && typeof mat.emissive.getHexString === 'function') {
        parts.push(`#${mat.emissive.getHexString()}`);
      }
    } catch (err) {}

    try {
      if (typeof mat.opacity !== 'undefined') parts.push(`opacity:${mat.opacity}`);
    } catch (err) {}

    try {
      if (mat.name) parts.push(mat.name);
    } catch (err) {}

    return parts.join(' ').toLowerCase();
  }

  function entityColorText(el) {
    const parts = [];

    try {
      parts.push(safe(el.getAttribute('color')));
    } catch (err) {}

    try {
      const material = el.getAttribute('material');

      if (material) {
        if (typeof material === 'string') {
          parts.push(material);
        } else if (typeof material === 'object') {
          parts.push(safe(material.color));
          parts.push(safe(material.src));
          parts.push(safe(material.shader));
          parts.push(safe(material.opacity));
        }
      }
    } catch (err) {}

    try {
      if (el.object3D) {
        el.object3D.traverse((obj) => {
          if (!obj || !obj.material) return;

          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => parts.push(colorFromMaterialObject(m)));
        });
      }
    } catch (err) {}

    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  function isPaleOrBlue(colorText) {
    const s = lower(colorText);

    return (
      s.includes('#fff') ||
      s.includes('#ffffff') ||
      s.includes('#f8fafc') ||
      s.includes('#f9fafb') ||
      s.includes('#fafafa') ||
      s.includes('#f1f5f9') ||
      s.includes('#e2e8f0') ||
      s.includes('#e5e7eb') ||
      s.includes('white') ||
      s.includes('#2563eb') ||
      s.includes('#1d4ed8') ||
      s.includes('#0ea5e9') ||
      s.includes('#0284c7') ||
      s.includes('#3b82f6') ||
      s.includes('#60a5fa') ||
      s.includes('blue')
    );
  }

  function getEntitySize(el) {
    const out = { x: 0, y: 0, z: 0, max: 0 };

    try {
      out.x = Math.max(out.x, Math.abs(Number(el.getAttribute('width') || 0)));
      out.y = Math.max(out.y, Math.abs(Number(el.getAttribute('height') || 0)));
      out.z = Math.max(out.z, Math.abs(Number(el.getAttribute('depth') || 0)));
    } catch (err) {}

    try {
      const g = el.getAttribute('geometry');

      if (g && typeof g === 'object') {
        out.x = Math.max(out.x, Math.abs(Number(g.width || 0)));
        out.y = Math.max(out.y, Math.abs(Number(g.height || 0)));
        out.z = Math.max(out.z, Math.abs(Number(g.depth || 0)));
      }
    } catch (err) {}

    try {
      const s = el.getAttribute('scale');

      if (s && typeof s === 'object') {
        out.x = Math.max(out.x, Math.abs(Number(s.x || 0)));
        out.y = Math.max(out.y, Math.abs(Number(s.y || 0)));
        out.z = Math.max(out.z, Math.abs(Number(s.z || 0)));
      }
    } catch (err) {}

    try {
      if (el.object3D) {
        out.x = Math.max(out.x, Math.abs(Number(el.object3D.scale.x || 0)));
        out.y = Math.max(out.y, Math.abs(Number(el.object3D.scale.y || 0)));
        out.z = Math.max(out.z, Math.abs(Number(el.object3D.scale.z || 0)));
      }
    } catch (err) {}

    out.max = Math.max(out.x, out.y, out.z);
    return out;
  }

  function getObjectSize(obj) {
    const THREE = getThree();

    try {
      if (!THREE || !obj) return { max: 0, x: 0, y: 0, z: 0 };

      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();

      box.getSize(size);

      return {
        x: Math.abs(size.x || 0),
        y: Math.abs(size.y || 0),
        z: Math.abs(size.z || 0),
        max: Math.max(Math.abs(size.x || 0), Math.abs(size.y || 0), Math.abs(size.z || 0))
      };
    } catch (err) {
      return { max: 0, x: 0, y: 0, z: 0 };
    }
  }

  function objectBelongsToText(obj) {
    let cur = obj;

    for (let i = 0; i < 10 && cur; i++) {
      try {
        const el = cur.el;
        if (el) {
          if (lower(el.tagName) === 'a-text') return true;
          if (looksLikeSessionText(getTextValue(el))) return true;
        }
      } catch (err) {}

      cur = cur.parent;
    }

    return false;
  }

  function removeEntity(el, reason) {
    if (!el || keepEntity(el)) return false;

    try {
      el.setAttribute('visible', 'false');
      el.setAttribute('data-hard-cleaner-hidden', reason || 'removed');
    } catch (err) {}

    try {
      if (el.object3D) {
        el.object3D.visible = false;
        el.object3D.traverse((obj) => {
          if (obj) obj.visible = false;
        });
      }
    } catch (err) {}

    try {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
        state.removed += 1;
        return true;
      }
    } catch (err) {}

    return false;
  }

  function hideBlueWhiteMeshesInside(el) {
    if (!el || !el.object3D || keepEntity(el)) return 0;

    let hidden = 0;

    try {
      el.object3D.traverse((obj) => {
        if (!obj || !obj.isMesh) return;
        if (objectBelongsToText(obj)) return;
        if (!obj.material) return;

        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        const colorText = mats.map(colorFromMaterialObject).join(' ');
        const size = getObjectSize(obj);

        if (isPaleOrBlue(colorText) && size.max >= CONFIG.minLargeSize) {
          obj.visible = false;
          obj.userData.lessonHardCleaned = VERSION;

          mats.forEach((m) => {
            try {
              m.transparent = true;
              m.opacity = 0;
              m.visible = false;
              m.needsUpdate = true;
            } catch (err) {}
          });

          hidden += 1;
        }
      });
    } catch (err) {}

    state.hiddenMeshes += hidden;
    return hidden;
  }

  function isLargeBlueWhiteEntity(el) {
    if (!el || keepEntity(el)) return false;

    const tag = lower(el.tagName);
    const id = lower(el.id);
    const cls = lower(el.getAttribute?.('class') || '');

    if (!['a-plane', 'a-box', 'a-entity', 'a-image'].includes(tag)) return false;

    const role = `${id} ${cls}`;
    const colorText = entityColorText(el);
    const size = getEntitySize(el);

    const nameHit =
      role.includes('panel') ||
      role.includes('blocker') ||
      role.includes('backdrop') ||
      role.includes('wall') ||
      role.includes('board') ||
      role.includes('selector') ||
      role.includes('card') ||
      role.includes('screen') ||
      role.includes('bg') ||
      role.includes('background');

    const colorHit = isPaleOrBlue(colorText);
    const sizeHit = size.max >= CONFIG.minLargeSize || size.x >= CONFIG.minLargeSize || size.y >= CONFIG.minLargeSize;

    return sizeHit && (nameHit || colorHit);
  }

  function makeSessionTextReadable(scene) {
    let kept = 0;

    $all('a-text, [text]', scene).forEach((el) => {
      const text = getTextValue(el);

      if (!looksLikeSessionText(text)) return;

      try {
        el.setAttribute('visible', 'true');
        el.setAttribute('color', '#ffffff');
        el.setAttribute('side', 'double');
        el.setAttribute('data-session-text-kept', VERSION);

        if (el.object3D) {
          el.object3D.visible = true;
          el.object3D.renderOrder = 9999;
        }

        kept += 1;
      } catch (err) {}
    });

    return kept;
  }

  function clean(reason) {
    if (!CONFIG.enabled) return;
    if (getViewMode() === 'cardboard') return;

    const scene = getScene();
    if (!scene) return;

    let removedThisRun = 0;
    let hiddenMeshesThisRun = 0;
    let keptText = 0;

    keptText = makeSessionTextReadable(scene);

    $all('a-plane, a-box, a-entity, a-image', scene).forEach((el) => {
      hiddenMeshesThisRun += hideBlueWhiteMeshesInside(el);

      if (isLargeBlueWhiteEntity(el)) {
        if (removeEntity(el, 'large-blue-white-scene-blocker')) {
          removedThisRun += 1;
        }
      }
    });

    try {
      scene.style.pointerEvents = '';
      scene.setAttribute('data-hard-cleaner-scene-click-enabled', 'true');
    } catch (err) {}

    state.runCount += 1;

    if (CONFIG.debug) {
      console.log('[LessonSceneHardCleaner]', VERSION, {
        reason,
        runCount: state.runCount,
        removedThisRun,
        hiddenMeshesThisRun,
        totalRemoved: state.removed,
        totalHiddenMeshes: state.hiddenMeshes,
        keptText
      });
    }
  }

  function startObserver() {
    const scene = getScene();
    if (!scene || state.observer) return;

    try {
      state.observer = new MutationObserver(() => {
        setTimeout(() => clean('mutation'), 80);
      });

      state.observer.observe(scene, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['material', 'color', 'geometry', 'scale', 'visible']
      });
    } catch (err) {}
  }

  function boot() {
    clean('boot');
    startObserver();

    clearInterval(state.intervalId);

    state.intervalId = setInterval(() => {
      clean('interval');

      if (state.runCount >= CONFIG.maxRuns) {
        clearInterval(state.intervalId);
        state.intervalId = 0;
      }
    }, CONFIG.intervalMs);

    setTimeout(() => clean('t500'), 500);
    setTimeout(() => clean('t1500'), 1500);
    setTimeout(() => clean('t3000'), 3000);
    setTimeout(() => clean('t5000'), 5000);

    window.LESSON_SCENE_HARD_CLEANER_FIX = {
      version: VERSION,
      config: CONFIG,
      state,
      clean,
      enable() {
        CONFIG.enabled = true;
        clean('manual-enable');
      },
      disable() {
        CONFIG.enabled = false;
      },
      debug() {
        clean('manual-debug');
        return {
          version: VERSION,
          state: { ...state }
        };
      }
    };

    console.log('[LessonSceneHardCleaner]', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();