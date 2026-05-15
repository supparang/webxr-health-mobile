// === /herohealth/vr-groups/groups-cvr-shoot-fix-v11.js ===
// HeroHealth Groups cVR — v1.1 Shoot Fix
// Fixes: tap/trigger not shooting in Cardboard VR.
// Adds:
// - direct pointer/touch/keyboard shoot capture
// - A-Frame cursor + raycaster on camera
// - center-screen aim assist fallback
// - larger tolerance for young learners using Cardboard
// PATCH v20260515-GROUPS-CVR-V11-SHOOT-FIX

(function () {
  'use strict';

  const VERSION = 'v1.1-cvr-shoot-fix-20260515';

  if (window.__HHA_GROUPS_CVR_SHOOT_FIX_V11__) return;
  window.__HHA_GROUPS_CVR_SHOOT_FIX_V11__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    lastShotAt: 0,
    lastTarget: '',
    shots: 0,
    hits: 0,
    misses: 0,
    aimPx: 230,
    installed: false
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function api() {
    return WIN.HHA_GROUPS_CVR_V1 || null;
  }

  function gs() {
    try {
      const a = api();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function isPlaying() {
    const s = gs();
    return s && s.mode === 'game' && !s.ended;
  }

  function injectStyle() {
    if ($('groups-cvr-v11-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v11-style';
    style.textContent = `
      #crosshair{
        animation:cvrV11CrosshairPulse .72s ease-in-out infinite alternate;
      }

      @keyframes cvrV11CrosshairPulse{
        from{ scale:1 1 1; opacity:.86; }
        to{ scale:1.18 1.18 1.18; opacity:1; }
      }

      .cvr-v11-shoot-tip{
        position:fixed;
        left:50%;
        top:58%;
        transform:translate(-50%,-50%);
        z-index:2147482200;
        width:min(420px,82vw);
        border-radius:999px;
        padding:10px 14px;
        text-align:center;
        background:rgba(255,255,255,.94);
        color:#244e68;
        box-shadow:0 16px 46px rgba(35,81,107,.20);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:clamp(17px,4.4vw,26px);
        line-height:1.15;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
      }

      .cvr-v11-shoot-tip.show{
        animation:cvrV11Tip .72s ease both;
      }

      @keyframes cvrV11Tip{
        0%{opacity:0; transform:translate(-50%,-36%) scale(.85);}
        22%{opacity:1; transform:translate(-50%,-50%) scale(1.06);}
        76%{opacity:1; transform:translate(-50%,-54%) scale(1);}
        100%{opacity:0; transform:translate(-50%,-70%) scale(.94);}
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureTip() {
    if ($('cvrV11ShootTip')) return;

    const tip = DOC.createElement('div');
    tip.id = 'cvrV11ShootTip';
    tip.className = 'cvr-v11-shoot-tip';
    tip.textContent = 'ยิง!';
    DOC.body.appendChild(tip);
  }

  function tip(text) {
    ensureTip();

    const el = $('cvrV11ShootTip');
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

  function isBlockedPointerTarget(ev) {
    const t = ev && ev.target;
    if (!t || !t.closest) return false;

    return Boolean(
      t.closest('button') ||
      t.closest('input') ||
      t.closest('select') ||
      t.closest('.screen.active') ||
      t.closest('.actions') ||
      t.closest('.a-enter-vr-button') ||
      t.closest('.a-orientation-modal') ||
      t.closest('.hha-vr-ui') ||
      t.closest('[data-hha-vr-ui]')
    );
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
    const canvas =
      scene &&
      scene.renderer &&
      scene.renderer.domElement;

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

  function entityFromObject(obj) {
    let o = obj;

    while (o) {
      if (o.el) return o.el;
      o = o.parent;
    }

    return null;
  }

  function triggerEntityClick(el, source) {
    if (!el) return false;

    state.lastTarget =
      (el.dataset && el.dataset.role ? el.dataset.role : 'target') +
      ':' +
      (el.dataset && (el.dataset.group || el.dataset.kind || el.dataset.id) || '');

    try {
      el.dispatchEvent(new CustomEvent('click', {
        bubbles: true,
        cancelable: true,
        detail: {
          source: source || 'cvr-v11',
          version: VERSION
        }
      }));
      state.hits += 1;
      return true;
    } catch (e) {}

    try {
      el.click();
      state.hits += 1;
      return true;
    } catch (e) {}

    return false;
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

    const raycaster = new THREE.Raycaster(origin, direction, 0, 14);
    const hits = raycaster.intersectObjects(objects, true);

    if (!hits || !hits.length) return null;

    return entityFromObject(hits[0].object);
  }

  function projectedCenterFallback() {
    if (!WIN.THREE) return null;

    const camera = getThreeCamera();
    if (!camera) return null;

    const targets = clickableEntities();
    if (!targets.length) return null;

    const rect = getRendererRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let best = null;
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

      /*
        Prefer item power if it is centered.
        Otherwise choose the nearest gate/item near crosshair.
      */
      let bias = 0;
      if (el.dataset && el.dataset.role === 'item') bias = -18;
      if (el.dataset && el.dataset.kind === 'power') bias = -36;

      const score = dist + bias;

      if (score < bestDist) {
        bestDist = score;
        best = {
          el,
          dist
        };
      }
    });

    if (!best) return null;

    const threshold = Math.max(
      150,
      Math.min(state.aimPx, Math.min(rect.width, rect.height) * 0.22)
    );

    if (best.dist <= threshold) {
      return best.el;
    }

    return null;
  }

  function shoot(source) {
    if (!isPlaying()) return false;

    const now = Date.now();

    /*
      Core has its own cooldown, but this prevents touchstart + click double-fire.
    */
    if (now - state.lastShotAt < 150) return false;

    state.lastShotAt = now;
    state.shots += 1;

    let target = raycastCenterTarget();

    if (!target) {
      target = projectedCenterFallback();
    }

    if (target) {
      const ok = triggerEntityClick(target, source || 'shoot-fix');

      if (ok) {
        const role = target.dataset && target.dataset.role;
        const kind = target.dataset && target.dataset.kind;

        if (role === 'gate') {
          tip('🎯 ยิงประตู!');
        } else if (kind === 'power') {
          tip('⚡ เก็บ Power!');
        } else if (kind === 'decoy') {
          tip('🚫 ยิงตัวหลอก!');
        } else {
          tip('🎯 ยิงแล้ว!');
        }

        vibrate(18);
        return true;
      }
    }

    /*
      Last resort: call core shoot if available.
      This helps when the original raycast works but our fallback does not.
    */
    try {
      const a = api();
      if (a && typeof a.shoot === 'function') {
        a.shoot();
        tip('ยิง!');
        vibrate(12);
        return true;
      }
    } catch (e) {}

    state.misses += 1;
    tip('เล็งให้ตรงเป้าก่อน');
    vibrate(10);
    return false;
  }

  function installAFrameCursor() {
    const camEl = getCameraEntity();
    if (!camEl) return;

    /*
      Entity-origin cursor gives Cardboard a real gaze ray.
      This also lets A-Frame click events work better in VR mode.
    */
    try {
      camEl.setAttribute('raycaster', 'objects: .clickable; far: 14; interval: 60; showLine: false');
      camEl.setAttribute('cursor', 'fuse: false; rayOrigin: entity');
    } catch (e) {}
  }

  function installShootEvents() {
    /*
      Universal VR UI normally emits hha:shoot.
      Capture both window and document to cover different implementations.
    */
    WIN.addEventListener('hha:shoot', ev => {
      if (ev && ev.preventDefault) ev.preventDefault();
      shoot('hha:shoot-window');
    }, true);

    DOC.addEventListener('hha:shoot', ev => {
      if (ev && ev.preventDefault) ev.preventDefault();
      shoot('hha:shoot-document');
    }, true);

    /*
      Important: in some mobile browsers, tapping the A-Frame canvas
      does not produce the expected A-Frame click target.
      This direct capture guarantees shooting from screen center.
    */
    ['pointerup', 'touchend'].forEach(type => {
      WIN.addEventListener(type, ev => {
        if (!isPlaying()) return;
        if (isBlockedPointerTarget(ev)) return;

        if (ev && ev.preventDefault) ev.preventDefault();
        shoot(type);
      }, {
        capture: true,
        passive: false
      });
    });

    DOC.addEventListener('keydown', ev => {
      if (!isPlaying()) return;

      if (ev.code === 'Space' || ev.code === 'Enter') {
        ev.preventDefault();
        shoot('keyboard');
      }
    }, true);
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_SHOOT_FIX_V11 = {
      version: VERSION,
      shoot,
      getState: function () {
        return {
          version: VERSION,
          playing: isPlaying(),
          shots: state.shots,
          hits: state.hits,
          misses: state.misses,
          lastTarget: state.lastTarget,
          aimPx: state.aimPx,
          core: Boolean(api())
        };
      },
      setAimPx: function (px) {
        state.aimPx = Math.max(120, Math.min(360, Number(px) || 230));
      }
    };
  }

  function init() {
    injectStyle();
    ensureTip();
    installAFrameCursor();
    installShootEvents();
    expose();

    state.installed = true;

    console.info('[Groups cVR v1.1] shoot fix installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();