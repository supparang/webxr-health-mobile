// === /english/js/lesson-scene-scroll-fix.js ===
// PATCH v20260426a-LESSON-SCENE-SCROLL-PAN-FIX
// Fix: 3D S1-S15 selector scene cannot scroll/pan.
// ✅ Allows dragging scene left/right from visible background edges
// ✅ Allows mouse wheel / touchpad pan over A-Frame canvas
// ✅ Adds small floating scene pan controls
// ✅ Keeps HTML panels usable
// ✅ Does not open old gameplay
// ✅ Works with lesson-scene-selector-router-fix.js

(function () {
  'use strict';

  const VERSION = 'v20260426a-LESSON-SCENE-SCROLL-PAN-FIX';

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
      // ถ้ามีกลุ่มครอบ camera ให้หมุน parent ก่อน เพื่อไม่ชน look-controls โดยตรง
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

    // ลากขวา = มองซ้าย/ขวาตามธรรมชาติ ปรับทิศเล็กน้อย
    panBy(-dx * CONFIG.dragSensitivity, 'drag');
  }

  function onPointerUp(ev) {
    if (!state.dragging) return;

    if (state.pointerId != null && ev.pointerId !== state.pointerId) return;

    state.dragging = false;
    state.pointerId = null;

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
        bottom: max(16px, env(safe-area-inset-bottom));
        z-index: 2147483646;
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 8px;
        border-radius: 999px;
        background: rgba(15,23,42,.86);
        border: 1px solid rgba(125,211,252,.46);
        box-shadow: 0 14px 38px rgba(0,0,0,.30);
        backdrop-filter: blur(10px);
      }

      #lessonScenePanControls button {
        border: 0;
        border-radius: 999px;
        padding: 9px 12px;
        background: rgba(14,165,233,.92);
        color: white;
        font: 1000 12px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        cursor: pointer;
      }

      #lessonScenePanControls button.secondary {
        background: rgba(255,255,255,.16);
        color: #e0faff;
        border: 1px solid rgba(255,255,255,.18);
      }

      #lessonScenePanControls .label {
        color: #e0faff;
        font: 900 12px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        white-space: nowrap;
      }

      html.lesson-mode-cardboard #lessonScenePanControls {
        display: none !important;
      }

      @media (max-width: 680px) {
        #lessonScenePanControls {
          left: 8px;
          right: 8px;
          justify-content: center;
          border-radius: 18px;
        }

        #lessonScenePanControls .label {
          display: none;
        }

        #lessonScenePanControls button {
          flex: 1;
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
    box.innerHTML = `
      <button type="button" id="lessonScenePanLeft">◀ เลื่อนฉาก</button>
      <button type="button" class="secondary" id="lessonScenePanReset">ตรงกลาง</button>
      <button type="button" id="lessonScenePanRight">เลื่อนฉาก ▶</button>
      <span class="label">ลาก/เลื่อนที่ฉากได้</span>
    `;

    document.body.appendChild(box);

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
