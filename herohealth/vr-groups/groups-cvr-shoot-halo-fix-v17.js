// === /herohealth/vr-groups/groups-cvr-shoot-halo-fix-v17.js ===
// HeroHealth Groups cVR — v1.7 Shoot Halo Fix
// Fixes:
// - Aim Assist halo/ring is hit instead of the real gate.
// - Shoot button / tap / hha:shoot does not trigger judgeGate.
// - Resolves any child mesh hit back to closest parent .clickable entity.
// PATCH v20260515-GROUPS-CVR-V17-SHOOT-HALO-FIX

(function () {
  'use strict';

  const VERSION = 'v1.7-cvr-shoot-halo-parent-resolve-20260515';

  if (window.__HHA_GROUPS_CVR_SHOOT_HALO_FIX_V17__) return;
  window.__HHA_GROUPS_CVR_SHOOT_HALO_FIX_V17__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    lastShotAt: 0,
    shots: 0,
    hits: 0,
    misses: 0,
    lastTarget: '',
    aimPx: 320
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function coreApi() {
    return WIN.HHA_GROUPS_CVR_V1 || null;
  }

  function gs() {
    try {
      const a = coreApi();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function isPlaying() {
    const s = gs();
    return s && s.mode === 'game' && !s.ended;
  }

  function injectStyle() {
    if ($('groups-cvr-v17-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v17-style';
    style.textContent = `
      .cvr-v17-toast{
        position:fixed;
        left:50%;
        top:62%;
        transform:translate(-50%,-50%);
        z-index:2147483000;
        width:min(420px,82vw);
        border-radius:999px;
        padding:10px 14px;
        text-align:center;
        background:rgba(255,255,255,.95);
        color:#244e68;
        box-shadow:0 18px 52px rgba(35,81,107,.22);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:clamp(16px,4.2vw,24px);
        line-height:1.15;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
      }

      .cvr-v17-toast.show{
        animation:cvrV17Toast .62s ease both;
      }

      @keyframes cvrV17Toast{
        0%{opacity:0; transform:translate(-50%,-35%) scale(.88);}
        24%{opacity:1; transform:translate(-50%,-50%) scale(1.05);}
        72%{opacity:1; transform:translate(-50%,-54%) scale(1);}
        100%{opacity:0; transform:translate(-50%,-70%) scale(.94);}
      }
    `;
    DOC.head.appendChild(style);
  }

  function ensureToast() {
    if ($('cvrV17Toast')) return;

    const el = DOC.createElement('div');
    el.id = 'cvrV17Toast';
    el.className = 'cvr-v17-toast';
    DOC.body.appendChild(el);
  }

  function toast(text) {
    ensureToast();

    const el = $('cvrV17Toast');
    if (!el) return;

    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {}
  }

  function getCameraEntity() {
    return $('camera');
  }

  function getThreeCamera() {
    const scene = $('scene');
    const camEl = getCameraEntity();

    if (scene && scene.camera) return scene.camera;

    try {
      if (camEl && camEl.components && camEl.components.camera) {
        return camEl.components.camera.camera;
      }
    } catch (e) {}

    return null;
  }

  function getRendererRect() {
    const scene = $('scene');
    const canvas = scene && scene.renderer && scene.renderer.domElement;

    if (canvas && canvas.getBoundingClientRect) {
      return canvas.getBoundingClientRect();
    }

    return {
      left: 0,
      top: 0,
      width: WIN.innerWidth || DOC.documentElement.clientWidth,
      height: WIN.innerHeight || DOC.documentElement.clientHeight
    };
  }

  function clickableEntities() {
    return Array.from(DOC.querySelectorAll('.clickable'))
      .filter(el => el && el.isConnected && el.getObject3D && el.getObject3D('mesh'));
  }

  function closestClickableFromEntity(el) {
    let cur = el;

    while (cur && cur !== DOC && cur !== DOC.body) {
      if (cur.classList && cur.classList.contains('clickable')) {
        return cur;
      }
      cur = cur.parentElement;
    }

    return null;
  }

  function closestClickableFromObject(obj) {
    let cur = obj;

    while (cur) {
      if (cur.el) {
        const clickable = closestClickableFromEntity(cur.el);
        if (clickable) return clickable;
      }
      cur = cur.parent;
    }

    return null;
  }

  function raycastCenterTarget() {
    if (!WIN.THREE) return null;

    const camEl = getCameraEntity();
    const camera = getThreeCamera();

    if (!camEl || !camEl.object3D || !camera) return null;

    const targets = clickableEntities();
    if (!targets.length) return null;

    const objects = targets
      .map(el => el.getObject3D('mesh'))
      .filter(Boolean);

    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3();

    camEl.object3D.getWorldPosition(origin);
    camEl.object3D.getWorldDirection(direction);

    const raycaster = new THREE.Raycaster(origin, direction, 0, 16);
    const hits = raycaster.intersectObjects(objects, true);

    if (!hits || !hits.length) return null;

    return closestClickableFromObject(hits[0].object);
  }

  function projectedFallbackTarget() {
    if (!WIN.THREE) return null;

    const camera = getThreeCamera();
    if (!camera) return null;

    const targets = clickableEntities();
    if (!targets.length) return null;

    const rect = getRendererRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let best = null;
    let bestScore = Infinity;
    let bestDist = Infinity;

    targets.forEach(el => {
      const mesh = el.getObject3D('mesh');
      if (!mesh) return;

      const box = new THREE.Box3().setFromObject(mesh);
      const center = new THREE.Vector3();
      box.getCenter(center);
      center.project(camera);

      if (center.z < -1 || center.z > 1) return;

      const x = rect.left + (center.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (-center.y * 0.5 + 0.5) * rect.height;
      const dist = Math.hypot(x - cx, y - cy);

      let bias = 0;

      if (el.dataset.role === 'item') bias -= 18;
      if (el.dataset.kind === 'power') bias -= 42;
      if (el.dataset.role === 'gate') bias -= 8;

      const score = dist + bias;

      if (score < bestScore) {
        bestScore = score;
        bestDist = dist;
        best = el;
      }
    });

    if (!best) return null;

    const threshold = Math.max(
      170,
      Math.min(state.aimPx, Math.min(rect.width, rect.height) * 0.26)
    );

    if (bestDist <= threshold) return best;

    return null;
  }

  function findTarget() {
    return raycastCenterTarget() || projectedFallbackTarget();
  }

  function fireClick(el, source) {
    if (!el) return false;

    const role = el.dataset.role || '';
    const group = el.dataset.group || '';
    const kind = el.dataset.kind || '';

    state.lastTarget = `${role}:${group || kind || el.dataset.id || ''}`;

    try {
      if (typeof el.emit === 'function') {
        el.emit('click', {
          source: source || 'cvr-v17',
          version: VERSION,
          fixedTarget: true
        }, true);
        state.hits += 1;
        return true;
      }
    } catch (e) {}

    try {
      el.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: WIN
      }));
      state.hits += 1;
      return true;
    } catch (e) {}

    try {
      el.dispatchEvent(new CustomEvent('click', {
        bubbles: true,
        cancelable: true,
        detail: {
          source: source || 'cvr-v17',
          version: VERSION,
          fixedTarget: true
        }
      }));
      state.hits += 1;
      return true;
    } catch (e) {}

    return false;
  }

  function shoot(source) {
    if (!isPlaying()) return false;

    const now = Date.now();

    if (now - state.lastShotAt < 120) return false;

    state.lastShotAt = now;
    state.shots += 1;

    const target = findTarget();

    if (!target) {
      state.misses += 1;
      toast('เล็งให้ตรงเป้าก่อน');
      vibrate(10);
      return false;
    }

    const ok = fireClick(target, source || 'cvr-v17');

    if (!ok) {
      state.misses += 1;
      toast('ยังยิงไม่เข้าเป้า');
      vibrate(10);
      return false;
    }

    const role = target.dataset.role;
    const kind = target.dataset.kind;
    const id = target.dataset.id;

    if (role === 'gate') {
      toast(`🎯 ยิงประตูหมู่ ${id || ''}`);
    } else if (kind === 'power') {
      toast('⚡ เก็บ Power!');
    } else if (kind === 'decoy') {
      toast('🚫 ยิงตัวหลอก!');
    } else {
      toast('🎯 ยิงแล้ว!');
    }

    vibrate(18);
    return true;
  }

  function patchOldShootApi() {
    const old = WIN.HHA_GROUPS_CVR_SHOOT_FIX_V11;

    if (old && !old.__v17Patched) {
      old.__v17Patched = true;
      old.shoot = shoot;
      old.getState = function () {
        return {
          version: VERSION,
          playing: isPlaying(),
          shots: state.shots,
          hits: state.hits,
          misses: state.misses,
          lastTarget: state.lastTarget,
          aimPx: state.aimPx,
          core: Boolean(coreApi()),
          patchedFromV11: true
        };
      };
      old.setAimPx = function (px) {
        state.aimPx = Math.max(140, Math.min(420, Number(px) || 320));
      };
    }
  }

  function installShootEvents() {
    WIN.addEventListener('hha:shoot', ev => {
      if (!isPlaying()) return;
      if (ev && ev.preventDefault) ev.preventDefault();
      shoot('hha:shoot-window-v17');
    }, true);

    DOC.addEventListener('hha:shoot', ev => {
      if (!isPlaying()) return;
      if (ev && ev.preventDefault) ev.preventDefault();
      shoot('hha:shoot-document-v17');
    }, true);

    DOC.addEventListener('keydown', ev => {
      if (!isPlaying()) return;

      if (ev.code === 'Space' || ev.code === 'Enter') {
        ev.preventDefault();
        shoot('keyboard-v17');
      }
    }, true);

    /*
      Patch visible safe shoot button from v1.6 too.
    */
    const safeBtn = $('cvrV16SafeShoot');
    if (safeBtn && !safeBtn.__v17Patched) {
      safeBtn.__v17Patched = true;
      safeBtn.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        shoot('safe-shoot-button-v17');
      }, true);
    }
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_SHOOT_HALO_FIX_V17 = {
      version: VERSION,
      shoot,
      findTarget,
      getState: function () {
        return {
          version: VERSION,
          playing: isPlaying(),
          shots: state.shots,
          hits: state.hits,
          misses: state.misses,
          lastTarget: state.lastTarget,
          aimPx: state.aimPx,
          core: Boolean(coreApi())
        };
      },
      setAimPx: function (px) {
        state.aimPx = Math.max(140, Math.min(420, Number(px) || 320));
      }
    };
  }

  function init() {
    injectStyle();
    ensureToast();
    expose();
    installShootEvents();

    patchOldShootApi();
    setInterval(patchOldShootApi, 500);

    console.info('[Groups cVR v1.7] shoot halo fix installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
