// === /english/js/lesson-scene-scroll-fix.js ===
// PATCH v20260426b-LESSON-SCENE-SCROLL-PAN-NON-BLOCKING
// Fix: 3D S1-S15 selector scene cannot scroll/pan, and pan controls block bottom buttons.
// ✅ Allows dragging scene left/right from visible background edges
// ✅ Allows mouse wheel / touchpad pan over A-Frame canvas
// ✅ Adds compact floating scene pan controls
// ✅ Pan controls do NOT block other buttons behind them
// ✅ Starts as mini button: ↔ เลื่อนฉาก
// ✅ Expands to ◀ กลาง ▶ only when clicked
// ✅ Suppresses scene selector routing after pan so page does not reload while dragging
// ✅ Keeps HTML panels usable
// ✅ Does not open old gameplay
// ✅ Works with lesson-scene-selector-router-fix.js

(function () {
  'use strict';

  const VERSION = 'v20260426b-LESSON-SCENE-SCROLL-PAN-NON-BLOCKING';

  const CONFIG = {
    enabled: true,
    wheelSensitivity: 0.035,
    dragSensitivity: 0.11,
    buttonStepDeg: 14,
    maxYawDeg: 110,
    minYawDeg: -110,
    edgePx: 190,
    showControls: true
  };

  const state = {
    dragging: false,
    pointerId: null,
    startX: 0,
    lastX: 0,
    yaw: 0,
    baseYaw: null,
    target: null,
    targetName: '',
    lastPanAt: 0
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function safe(v) {
    return String(v == null ? '' : v).trim();
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

    const view = safe(q().get('view')).toLowerCase();

    if (['vr', 'cvr', 'cardboard', 'cardboard-vr'].includes(view)) return 'cardboard';
    if (['mobile', 'phone'].includes(view)) return 'mobile';

    return 'pc';
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, Number(n || 0)));
  }

  function isEditable(el) {
    return !!(
      el &&
      el.closest &&
      el.closest('input, textarea, select, [contenteditable="true"]')
    );
  }

  function isProtectedUi(el) {
    if (!el || !el.closest) return false;

    return !!el.closest(
      [
        '#lessonMissionPanel',
        '#lessonSpeakingPanel',
        '#lessonPcSessionOverlay',
        '#lessonWritingAiGuide',
        '#lessonScenePanControls',
        '#lessonPcSessionOpenBtn',
        '#lessonSpeakingOpenBtn',
        '#techpath-guard-toast',
        '#source-shield',
        'button',
        'input',
        'textarea',
        'select',
        '[role="button"]'
      ].join(',')
    );
  }

  function isSceneLikeTarget(el) {
    if (!el) return false;

    const tag = safe(el.tagName).toLowerCase();

    if (tag === 'canvas') return true;
    if (tag === 'a-scene') return true;

    try {
      if (el.closest && el.closest('a-scene')) return true;
    } catch (err) {}

    return el === document.body || el === document.documentElement;
  }

  function isEdgeArea(ev) {
    const x = Number(ev.clientX || 0);
    return x <= CONFIG.edgePx || x >= window.innerWidth - CONFIG.edgePx;
  }

  function shouldHandlePointer(ev) {
    if (!CONFIG.enabled) return false;
    if (getViewMode() === 'cardboard') return false;
    if (isEditable(ev.target)) return false;
    if (isProtectedUi(ev.target)) return false;

    return isSceneLikeTarget(ev.target) || isEdgeArea(ev);
  }

  function getRotation(el) {
    if (!el) return { x: 0, y: 0, z: 0 };

    try {
      const r = el.getAttribute('rotation');

      if (r && typeof r === 'object') {
        return {
          x: Number(r.x || 0),
          y: Number(r.y || 0),
          z: Number(r.z || 0)
        };
      }

      if (typeof r === 'string') {
        const nums = r.split(/\s+/).map(Number).filter(Number.isFinite);
        return {
          x: nums[0] || 0,
          y: nums[1] || 0,
          z: nums[2] || 0
        };
      }
    } catch (err) {}

    try {
      if (el.object3D) {
        return {
          x: el.object3D.rotation.x * 180 / Math.PI,
          y: el.object3D.rotation.y * 180 / Math.PI,
          z: el.object3D.rotation.z * 180 / Math.PI
        };
      }
    } catch (err) {}

    return { x: 0, y: 0, z: 0 };
  }

  function setRotationY(el, y) {
    if (!el) return;

    const r = getRotation(el);
    r.y = y;

    try {
      el.setAttribute('rotation', `${r.x} ${r.y} ${r.z}`);
    } catch (err) {}

    try {
      if (el.object3D) {
        el.object3D.rotation.y = y * Math.PI / 180;
      }
    } catch (err) {}
  }

  function findCameraTarget() {
    const scene = $('a-scene');
    if (!scene) return null;

    const rig =
      $('#cameraRig', scene) ||
      $('#rig', scene) ||
      $('#playerRig', scene) ||
      $('#lessonCameraRig', scene) ||
      $('[id*="rig" i]', scene) ||
      $('[id*="camera-rig" i]', scene);

    if (rig) {
      state.targetName = safe(rig.id || rig.tagName || 'rig');
      return rig;
    }

    const cam =
      $('a-camera', scene) ||
      $('[camera]', scene) ||
      $('a-entity[camera]', scene);

    if (cam) {
      if (
        cam.parentElement &&
        cam.parentElement !== scene &&
        safe(cam.parentElement.tagName).toLowerCase() !== 'a-scene'
      ) {
        state.targetName = safe(cam.parentElement.id || cam.parentElement.tagName || 'camera-parent');
        return cam.parentElement;
      }

      state.targetName = safe(cam.id || cam.tagName || 'camera');
      return cam;
    }

    return null;
  }

  function ensureTarget() {
    if (state.target && document.body.contains(state.target)) return state.target;

    state.target = findCameraTarget();

    if (state.target && state.baseYaw == null) {
      const r = getRotation(state.target);
      state.baseYaw = r.y;
      state.yaw = r.y;
    }

    return state.target;
  }

  function suppressSceneSelectorClick(ms) {
    try {
      window.LESSON_SCENE_SELECTOR_ROUTER_FIX?.suppressClick?.(Number(ms || 800));
    } catch (err) {}
  }

  function panBy(deltaDeg, reason) {
    const target = ensureTarget();
    if (!target) return;

    const next = clamp(
      state.yaw + deltaDeg,
      CONFIG.minYawDeg,
      CONFIG.maxYawDeg
    );

    state.yaw = next;
    setRotationY(target, next);

    state.lastPanAt = Date.now();
    suppressSceneSelectorClick(850);

    try {
      document.documentElement.dataset.lessonSceneYaw = String(Math.round(next));
    } catch (err) {}

    console.log('[LessonSceneScroll] pan', {
      version: VERSION,
      reason,
      target: state.targetName,
      yaw: Math.round(next)
    });
  }

  function resetPan() {
    const target = ensureTarget();
    if (!target) return;

    const y = Number(state.baseYaw || 0);

    state.yaw = y;
    setRotationY(target, y);

    state.lastPanAt = Date.now();
    suppressSceneSelectorClick(850);

    console.log('[LessonSceneScroll] reset', {
      version: VERSION,
      target: state.targetName,
      yaw: y
    });
  }

  function onWheel(ev) {
    if (!shouldHandlePointer(ev)) return;

    const dx = Number(ev.deltaX || 0);
    const dy = Number(ev.deltaY || 0);

    const dominant = Math.abs(dx) > Math.abs(dy) ? dx : dy;

    if (Math.abs(dominant) < 2) return;

    ev.preventDefault();
    ev.stopPropagation();

    panBy(dominant * CONFIG.wheelSensitivity, 'wheel');
  }

  function onPointerDown(ev) {
    if (!shouldHandlePointer(ev)) return;

    state.dragging = true;
    state.pointerId = ev.pointerId;
    state.startX = Number(ev.clientX || 0);
    state.lastX = state.startX;

    suppressSceneSelectorClick(850);

    try {
      document.body.classList.add('lesson-scene-panning');
    } catch (err) {}
  }

  function onPointerMove(ev) {
    if (!state.dragging) return;

    if (state.pointerId != null && ev.pointerId !== state.pointerId) return;

    const x = Number(ev.clientX || 0);
    const dx = x - state.lastX;

    if (Math.abs(dx) < 1) return;

    state.lastX = x;

    ev.preventDefault();
    ev.stopPropagation();

    panBy(-dx * CONFIG.dragSensitivity, 'drag');
  }

  function onPointerUp(ev) {
    if (!state.dragging) return;

    if (state.pointerId != null && ev.pointerId !== state.pointerId) return;

    state.dragging = false;
    state.pointerId = null;

    suppressSceneSelectorClick(650);

    try {
      document.body.classList.remove('lesson-scene-panning');
    } catch (err) {}
  }

  function onKeydown(ev) {
    if (isEditable(ev.target)) return;

    const key = safe(ev.key);

    if (key === 'ArrowLeft') {
      ev.preventDefault();
      panBy(-CONFIG.buttonStepDeg, 'keyboard-left');
    } else if (key === 'ArrowRight') {
      ev.preventDefault();
      panBy(CONFIG.buttonStepDeg, 'keyboard-right');
    } else if (key === 'Home') {
      ev.preventDefault();
      resetPan();
    }
  }

  function ensureCSS() {
    if ($('#lesson-scene-scroll-css')) return;

    const style = document.createElement('style');
    style.id = 'lesson-scene-scroll-css';
    style.textContent = `
      body.lesson-scene-panning,
      body.lesson-scene-panning * {
        cursor: grabbing !important;
      }

      #lessonScenePanControls {
        position: fixed;
        left: 12px;
        bottom: max(78px, calc(env(safe-area-inset-bottom) + 78px));
        z-index: 2147483638;
        display: inline-flex;
        gap: 7px;
        align-items: center;
        padding: 7px;
        border-radius: 999px;
        background: rgba(15,23,42,.72);
        border: 1px solid rgba(125,211,252,.36);
        box-shadow: 0 12px 30px rgba(0,0,0,.22);
        backdrop-filter: blur(10px);
        pointer-events: none;
        max-width: min(92vw, 460px);
      }

      #lessonScenePanControls button {
        pointer-events: auto;
        border: 0;
        border-radius: 999px;
        padding: 8px 10px;
        background: rgba(14,165,233,.92);
        color: white;
        font: 1000 12px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        cursor: pointer;
        white-space: nowrap;
      }

      #lessonScenePanControls button.secondary {
        background: rgba(255,255,255,.14);
        color: #e0faff;
        border: 1px solid rgba(255,255,255,.18);
      }

      #lessonScenePanControls .label {
        color: #e0faff;
        font: 900 12px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        white-space: nowrap;
        pointer-events: none;
      }

      #lessonScenePanControls.is-mini .pan-extra {
        display: none !important;
      }

      #lessonScenePanControls.is-mini {
        padding: 6px;
        background: rgba(15,23,42,.60);
      }

      html.lesson-mode-cardboard #lessonScenePanControls {
        display: none !important;
      }

      @media (max-width: 680px) {
        #lessonScenePanControls {
          left: 8px;
          bottom: max(74px, calc(env(safe-area-inset-bottom) + 74px));
          right: auto;
          max-width: calc(100vw - 16px);
          border-radius: 999px;
        }

        #lessonScenePanControls button {
          padding: 8px 9px;
          font-size: 11px;
        }

        #lessonScenePanControls .label {
          display: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureControls() {
    if (!CONFIG.showControls) return;
    if (getViewMode() === 'cardboard') return;
    if ($('#lessonScenePanControls')) return;

    ensureCSS();

    const box = document.createElement('div');
    box.id = 'lessonScenePanControls';
    box.className = 'is-mini';
    box.innerHTML = `
      <button type="button" class="secondary" id="lessonScenePanToggle">↔ เลื่อนฉาก</button>
      <button type="button" class="pan-extra" id="lessonScenePanLeft">◀</button>
      <button type="button" class="secondary pan-extra" id="lessonScenePanReset">กลาง</button>
      <button type="button" class="pan-extra" id="lessonScenePanRight">▶</button>
      <span class="label pan-extra">ลาก/เลื่อนฉากได้</span>
    `;

    document.body.appendChild(box);

    $('#lessonScenePanToggle')?.addEventListener('click', () => {
      box.classList.toggle('is-mini');
      suppressSceneSelectorClick(500);
    });

    $('#lessonScenePanLeft')?.addEventListener('click', () => {
      panBy(-CONFIG.buttonStepDeg, 'button-left');
    });

    $('#lessonScenePanRight')?.addEventListener('click', () => {
      panBy(CONFIG.buttonStepDeg, 'button-right');
    });

    $('#lessonScenePanReset')?.addEventListener('click', () => {
      resetPan();
    });
  }

  function bindEvents() {
    window.addEventListener('wheel', onWheel, {
      capture: true,
      passive: false
    });

    window.addEventListener('pointerdown', onPointerDown, {
      capture: true,
      passive: false
    });

    window.addEventListener('pointermove', onPointerMove, {
      capture: true,
      passive: false
    });

    window.addEventListener('pointerup', onPointerUp, {
      capture: true,
      passive: true
    });

    window.addEventListener('pointercancel', onPointerUp, {
      capture: true,
      passive: true
    });

    window.addEventListener('keydown', onKeydown, true);
  }

  function boot() {
    ensureCSS();
    ensureTarget();
    ensureControls();
    bindEvents();

    setTimeout(() => {
      ensureTarget();
      ensureControls();
    }, 500);

    setTimeout(() => {
      ensureTarget();
      ensureControls();
    }, 1500);

    setTimeout(() => {
      ensureTarget();
      ensureControls();
    }, 3000);

    window.LESSON_SCENE_SCROLL_FIX = {
      version: VERSION,
      config: CONFIG,
      state,
      panBy,
      resetPan,
      ensureTarget,
      enable() {
        CONFIG.enabled = true;
      },
      disable() {
        CONFIG.enabled = false;
      },
      expandControls() {
        $('#lessonScenePanControls')?.classList.remove('is-mini');
      },
      collapseControls() {
        $('#lessonScenePanControls')?.classList.add('is-mini');
      }
    };

    console.log('[LessonSceneScroll]', VERSION, {
      mode: getViewMode(),
      target: state.targetName || '(not found yet)'
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
