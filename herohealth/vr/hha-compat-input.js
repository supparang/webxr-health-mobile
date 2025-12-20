// === /herohealth/vr/hha-compat-input.js ===
// HeroHealth — Cross-device input/permission helper (PC/Mobile/iOS/VR Shinecon)
// IIFE → window.HHACompat
(function (root) {
  'use strict';

  const H = {};
  let __ac = null;

  function ac() {
    if (__ac) return __ac;
    const Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx) return null;
    __ac = new Ctx();
    return __ac;
  }
  H.resumeAudio = function () {
    try { ac()?.resume?.(); } catch (_) {}
  };

  // iOS motion permission (must be called from gesture)
  let asked = false;
  let granted = false;
  H.ensureMotionPermission = async function (force) {
    if (granted) return true;
    if (asked && !force) return false;
    asked = true;
    let ok = true;

    try {
      if (root.DeviceOrientationEvent && typeof root.DeviceOrientationEvent.requestPermission === 'function') {
        const res = await root.DeviceOrientationEvent.requestPermission();
        ok = ok && (res === 'granted');
      }
    } catch (_) { ok = false; }

    try {
      if (root.DeviceMotionEvent && typeof root.DeviceMotionEvent.requestPermission === 'function') {
        const res = await root.DeviceMotionEvent.requestPermission();
        ok = ok && (res === 'granted');
      }
    } catch (_) { /* ignore */ }

    granted = !!ok;
    return granted;
  };

  // Bind first gesture to request permission + resume audio (keeps listening if denied)
  H.bindFirstGesture = function (onDeniedMsg) {
    if (root.__HHA_FIRST_GESTURE__) return;
    root.__HHA_FIRST_GESTURE__ = true;

    const once = async () => {
      H.resumeAudio();
      const ok = await H.ensureMotionPermission(false);
      if (!ok) {
        if (typeof onDeniedMsg === 'function') onDeniedMsg();
        return; // keep listeners so user can tap again
      }
      root.removeEventListener('pointerdown', once, true);
      root.removeEventListener('touchstart', once, true);
      root.removeEventListener('click', once, true);
    };

    root.addEventListener('pointerdown', once, true);
    root.addEventListener('touchstart', once, true);
    root.addEventListener('click', once, true);
  };

  // Attach a root entity under camera so targets follow device rotation (magic-window/VR)
  H.attachRootToCamera = function (camEl, rootEl, zDist) {
    try {
      if (!camEl || !rootEl) return;
      if (rootEl.parentElement !== camEl) camEl.appendChild(rootEl);
      rootEl.setAttribute('position', `0 0 ${-(Math.abs(zDist || 1.35))}`);
      rootEl.setAttribute('rotation', '0 0 0');
    } catch (_) {}
  };

  // Prevent double fire on same target quickly
  const recentHits = new Map();
  H.wasRecentlyHit = function (id, ms) {
    const now = performance.now();
    const ttl = 1000;
    for (const [k, t] of recentHits.entries()) if (now - t > ttl) recentHits.delete(k);
    const t = recentHits.get(id);
    if (t && now - t < (ms || 240)) return true;
    recentHits.set(id, now);
    return false;
  };

  // Raycast fallback: click/touch canvas → intersect objects under rootEl.object3D
  H.bindPointerRaycast = function (sceneEl, rootEl, acceptFn, onHitFn) {
    if (!sceneEl || !rootEl || !onHitFn) return;
    if (root.__HHA_RAYCAST_BOUND__) return;
    root.__HHA_RAYCAST_BOUND__ = true;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let lastShot = 0;

    function doCast(ev) {
      const now = performance.now();
      if (now - lastShot < 180) return;
      lastShot = now;

      if (!sceneEl.camera || !sceneEl.canvas) return;

      const tag = String(ev.target?.tagName || '').toUpperCase();
      if (tag !== 'CANVAS') return;

      H.resumeAudio();

      const rect = sceneEl.canvas.getBoundingClientRect();
      let cx, cy;
      if (ev.touches && ev.touches.length) {
        cx = ev.touches[0].clientX; cy = ev.touches[0].clientY;
      } else {
        cx = ev.clientX; cy = ev.clientY;
      }

      mouse.x = ((cx - rect.left) / rect.width) * 2 - 1;
      mouse.y = -(((cy - rect.top) / rect.height) * 2 - 1);

      raycaster.setFromCamera(mouse, sceneEl.camera);

      const root3D = rootEl.object3D;
      if (!root3D) return;
      const hits = raycaster.intersectObjects(root3D.children, true);
      if (!hits || !hits.length) return;

      let el = hits[0].object?.el;
      while (el && el !== sceneEl) {
        if (!acceptFn || acceptFn(el)) break;
        el = el.parentEl;
      }
      if (!el || (acceptFn && !acceptFn(el))) return;

      onHitFn(el, 'raycast');
    }

    root.addEventListener('pointerdown', doCast, { passive: true });
    root.addEventListener('touchstart', doCast, { passive: true });
  };

  // FX nudge: push a point away from HUD rectangles
  H.nudgeAwayFromHUD = function (px, py, selectors, padPx) {
    const W = Math.max(1, root.innerWidth || 1);
    const Hh = Math.max(1, root.innerHeight || 1);
    const pad = padPx ?? 14;

    let x = Math.max(pad, Math.min(W - pad, px));
    let y = Math.max(pad, Math.min(Hh - pad, py));

    const sels = selectors || [
      '#hudTop', '#hudLeft', '#hudRight', '#hudBottom',
      '.hud-top', '.hud-left', '.hud-right', '.hud-bottom',
      '#questPanel', '#miniPanel', '#resultCard'
    ].join(',');

    const els = Array.from(document.querySelectorAll(sels));
    for (const el of els) {
      if (!el?.getBoundingClientRect) continue;
      const r = el.getBoundingClientRect();
      if (!r || r.width < 20 || r.height < 20) continue;

      const inside = (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad);
      if (!inside) continue;

      const cand = [
        { x, y: r.bottom + pad, c: Math.abs((r.bottom + pad) - y) },
        { x, y: r.top - pad,    c: Math.abs((r.top - pad) - y) },
        { x: r.right + pad, y,  c: Math.abs((r.right + pad) - x) },
        { x: r.left - pad,  y,  c: Math.abs((r.left - pad) - x) }
      ].map(o => ({ x: Math.max(pad, Math.min(W - pad, o.x)), y: Math.max(pad, Math.min(Hh - pad, o.y)), c: o.c }));

      cand.sort((a,b)=>a.c-b.c);
      x = cand[0].x; y = cand[0].y;
    }
    return { x, y };
  };

  root.HHACompat = H;
})(window);
