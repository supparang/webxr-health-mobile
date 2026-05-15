// === /herohealth/vr-groups/groups-cvr-direct-shoot-v18.js ===
// HeroHealth Groups cVR — v1.8b Direct Shoot Stable
// Fixes:
// - Old shoot handlers conflict.
// - After shooting, screen becomes blank / no target returns.
// - Uses direct core API only.
// - Adds recovery after each shot.
// PATCH v20260515-GROUPS-CVR-V18B-DIRECT-SHOOT-STABLE

(function () {
  'use strict';

  const VERSION = 'v1.8b-cvr-direct-shoot-stable-20260515';

  if (window.__HHA_GROUPS_CVR_DIRECT_SHOOT_V18B__) return;
  window.__HHA_GROUPS_CVR_DIRECT_SHOOT_V18B__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    lastShotAt: 0,
    shots: 0,
    hits: 0,
    misses: 0,
    lastTarget: '',
    aimPx: 360,
    recoveryCount: 0
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
    if ($('groups-cvr-v18b-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v18b-style';
    style.textContent = `
      .cvr-v18b-toast{
        position:fixed;
        left:50%;
        top:66%;
        transform:translate(-50%,-50%);
        z-index:2147483300;
        width:min(430px,84vw);
        border-radius:999px;
        padding:11px 15px;
        text-align:center;
        background:rgba(255,255,255,.96);
        color:#244e68;
        box-shadow:0 20px 56px rgba(35,81,107,.24);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:clamp(17px,4.4vw,26px);
        line-height:1.15;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
      }

      .cvr-v18b-toast.show{
        animation:cvrV18bToast .62s ease both;
      }

      @keyframes cvrV18bToast{
        0%{opacity:0; transform:translate(-50%,-35%) scale(.86);}
        24%{opacity:1; transform:translate(-50%,-50%) scale(1.05);}
        72%{opacity:1; transform:translate(-50%,-54%) scale(1);}
        100%{opacity:0; transform:translate(-50%,-70%) scale(.94);}
      }

      .cvr-v18b-fire{
        position:fixed;
        left:50%;
        bottom:calc(12px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        z-index:2147483250;
        border:0;
        border-radius:999px;
        min-width:148px;
        height:50px;
        padding:0 18px;
        background:linear-gradient(135deg,#ffb347,#ff8f3d);
        color:#fff;
        box-shadow:0 16px 42px rgba(35,81,107,.22);
        font:inherit;
        font-size:17px;
        line-height:1;
        font-weight:1000;
        text-shadow:0 1px 0 rgba(0,0,0,.08);
        cursor:pointer;
        display:none;
      }

      body.playing .cvr-v18b-fire{
        display:block;
      }

      body.playing #cvrV16SafeShoot{
        display:none !important;
      }

      @media (max-width:460px){
        .cvr-v18b-fire{
          min-width:128px;
          height:46px;
          font-size:15px;
          bottom:calc(8px + env(safe-area-inset-bottom,0px));
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureUi() {
    if (!$('cvrV18bToast')) {
      const t = DOC.createElement('div');
      t.id = 'cvrV18bToast';
      t.className = 'cvr-v18b-toast';
      DOC.body.appendChild(t);
    }

    if (!$('cvrV18bFireBtn')) {
      const btn = DOC.createElement('button');
      btn.id = 'cvrV18bFireBtn';
      btn.className = 'cvr-v18b-fire';
      btn.type = 'button';
      btn.textContent = '🎯 ยิง';
      DOC.body.appendChild(btn);
    }
  }

  function toast(text) {
    const el = $('cvrV18bToast');
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
      if (cur.classList && cur.classList.contains('clickable')) return cur;
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

  function raycastTarget() {
    if (!WIN.THREE) return null;

    const camEl = getCameraEntity();
    const camera = getThreeCamera();

    if (!camEl || !camEl.object3D || !camera) return null;

    const targets = clickableEntities();
    if (!targets.length) return null;

    const objects = targets
      .map(el => el.object3D || el.getObject3D('mesh'))
      .filter(Boolean);

    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3();

    camEl.object3D.getWorldPosition(origin);
    camEl.object3D.getWorldDirection(direction);

    const raycaster = new THREE.Raycaster(origin, direction, 0, 18);
    const hits = raycaster.intersectObjects(objects, true);

    if (!hits || !hits.length) return null;

    return closestClickableFromObject(hits[0].object);
  }

  function projectedTarget() {
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

    const s = gs();
    const currentKind = s.current && s.current.kind || '';

    targets.forEach(el => {
      const obj = el.object3D || el.getObject3D('mesh');
      if (!obj) return;

      const box = new THREE.Box3().setFromObject(obj);
      const center = new THREE.Vector3();

      box.getCenter(center);
      center.project(camera);

      if (center.z < -1 || center.z > 1) return;

      const x = rect.left + (center.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (-center.y * 0.5 + 0.5) * rect.height;
      const dist = Math.hypot(x - cx, y - cy);

      let bias = 0;

      if (el.dataset.role === 'item') bias -= 16;
      if (el.dataset.kind === 'power') bias -= 55;
      if (el.dataset.role === 'gate') bias -= 18;

      if ((currentKind === 'food' || currentKind === 'golden') && el.dataset.role === 'gate') {
        bias -= 34;
      }

      if (currentKind === 'power' && el.dataset.role === 'item') {
        bias -= 52;
      }

      const score = dist + bias;

      if (score < bestScore) {
        bestScore = score;
        bestDist = dist;
        best = el;
      }
    });

    if (!best) return null;

    const threshold = Math.max(
      190,
      Math.min(state.aimPx, Math.min(rect.width, rect.height) * 0.30)
    );

    if (bestDist <= threshold) return best;

    return null;
  }

  function highlightedTarget() {
    const highlighted = Array.from(DOC.querySelectorAll('.clickable')).find(el => {
      const halo = el.querySelector('.cvr-v12-halo');
      if (!halo) return false;
      const visible = halo.getAttribute('visible');
      return visible === true || visible === 'true';
    });

    return highlighted || null;
  }

  function findTarget() {
    return raycastTarget() || highlightedTarget() || projectedTarget();
  }

  function describeTarget(target) {
    if (!target || !target.dataset) return 'ไม่มีเป้า';

    const ds = target.dataset;

    if (ds.role === 'gate') return `ประตูหมู่ ${ds.id || ''}`;
    if (ds.role === 'item' && ds.kind === 'power') return 'Power';
    if (ds.role === 'item' && ds.kind === 'decoy') return 'ตัวหลอก';
    if (ds.role === 'item') return 'อาหาร';

    return 'เป้า';
  }

  function hasTargets() {
    const gates = DOC.querySelectorAll('.clickable[data-role="gate"]').length;
    const items = DOC.querySelectorAll('.clickable[data-role="item"]').length;
    return { gates, items };
  }

  function recoverIfBlank(source) {
    if (!isPlaying()) return;

    const s = gs();
    const count = hasTargets();

    const currentMissing = !s.current;
    const itemMissing = count.items < 1;
    const gateMissing = count.gates < 5;

    if (!currentMissing && !itemMissing && !gateMissing) return;

    const core = coreApi();

    if (core && typeof core.recoverArena === 'function') {
      core.recoverArena();
      state.recoveryCount += 1;
      toast('คืนเป้าหมายแล้ว');
      return;
    }

    if (core && typeof core.rebuildGates === 'function' && gateMissing) {
      core.rebuildGates();
    }

    if (core && typeof core.forceSpawn === 'function' && (currentMissing || itemMissing)) {
      core.forceSpawn();
    }

    state.recoveryCount += 1;
    toast('คืนสนามแล้ว');
  }

  function scheduleRecover() {
    setTimeout(() => recoverIfBlank('after-shot-700'), 700);
    setTimeout(() => recoverIfBlank('after-shot-1300'), 1300);
  }

  function directShoot(source) {
    if (!isPlaying()) return false;

    const now = Date.now();
    if (now - state.lastShotAt < 170) return false;

    state.lastShotAt = now;
    state.shots += 1;

    const core = coreApi();

    if (!core || typeof core.directShootTarget !== 'function') {
      state.misses += 1;
      toast('ยังไม่ได้เปิด direct API');
      return false;
    }

    const target = findTarget();

    if (!target) {
      state.misses += 1;
      toast('เล็งเป้าหมายก่อน');
      vibrate(10);
      recoverIfBlank('no-target');
      return false;
    }

    const ds = target.dataset || {};
    const role = ds.role || '';
    const label = describeTarget(target);

    let ok = false;

    try {
      ok = Boolean(core.directShootTarget(target));
    } catch (e) {
      ok = false;
    }

    if (!ok) {
      try {
        if (role === 'gate' && typeof core.directGate === 'function') {
          ok = Boolean(core.directGate(ds.group));
        } else if (role === 'item' && typeof core.directItem === 'function') {
          ok = Boolean(core.directItem());
        }
      } catch (e) {
        ok = false;
      }
    }

    if (!ok) {
      state.misses += 1;
      toast('ยิงไม่เข้า core');
      vibrate(10);
      recoverIfBlank('shoot-failed');
      return false;
    }

    state.hits += 1;
    state.lastTarget = `${role}:${ds.group || ds.kind || ds.id || ''}`;

    if (role === 'gate') {
      toast(`🎯 ยิง${label}`);
    } else if (ds.kind === 'power') {
      toast('⚡ เก็บ Power');
    } else if (ds.kind === 'decoy') {
      toast('🚫 ยิงตัวหลอก');
    } else {
      toast('🎯 ยิงแล้ว');
    }

    vibrate(18);
    scheduleRecover();

    try {
      WIN.dispatchEvent(new CustomEvent('groups-cvr:v18-direct-shoot', {
        detail: {
          version: VERSION,
          source: source || 'v18b',
          target: state.lastTarget,
          ok: true
        }
      }));
    } catch (e) {}

    return true;
  }

  function exposeShootAlias() {
    /*
      ให้ v16 Final Guard และ v12 Aim Assist เห็น shoot API ตัวใหม่
      แม้เราจะไม่โหลด v11 แล้ว
    */
    WIN.HHA_GROUPS_CVR_SHOOT_FIX_V11 = {
      version: VERSION,
      shoot: directShoot,
      getState: function () {
        return {
          version: VERSION,
          playing: isPlaying(),
          shots: state.shots,
          hits: state.hits,
          misses: state.misses,
          lastTarget: state.lastTarget,
          aimPx: state.aimPx,
          core: Boolean(coreApi()),
          aliasFromV18b: true
        };
      },
      setAimPx: function (px) {
        state.aimPx = Math.max(160, Math.min(460, Number(px) || 360));
      }
    };
  }

  function patchFinalGuard() {
    const fg = WIN.HHA_GROUPS_CVR_FINAL_GUARD_V16;
    if (!fg || fg.__v18bPatched) return;

    fg.__v18bPatched = true;

    if (typeof fg.safeShoot === 'function') {
      fg.safeShoot = function () {
        return directShoot('final-guard-v18b');
      };
    }
  }

  function installEvents() {
    WIN.addEventListener('hha:shoot', ev => {
      if (!isPlaying()) return;

      if (ev && ev.preventDefault) ev.preventDefault();
      if (ev && ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      directShoot('hha:shoot-window-v18b');
    }, true);

    DOC.addEventListener('hha:shoot', ev => {
      if (!isPlaying()) return;

      if (ev && ev.preventDefault) ev.preventDefault();
      if (ev && ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      directShoot('hha:shoot-document-v18b');
    }, true);

    DOC.addEventListener('keydown', ev => {
      if (!isPlaying()) return;

      if (ev.code === 'Space' || ev.code === 'Enter') {
        ev.preventDefault();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        directShoot('keyboard-v18b');
      }
    }, true);

    const fireBtn = $('cvrV18bFireBtn');
    if (fireBtn && !fireBtn.__v18bBound) {
      fireBtn.__v18bBound = true;

      fireBtn.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }, true);

      fireBtn.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        directShoot('v18b-fire-button');
      }, true);
    }
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_DIRECT_SHOOT_V18 = {
      version: VERSION,
      shoot: directShoot,
      findTarget: findTarget,
      recoverIfBlank: recoverIfBlank,
      getState: function () {
        return {
          version: VERSION,
          playing: isPlaying(),
          shots: state.shots,
          hits: state.hits,
          misses: state.misses,
          lastTarget: state.lastTarget,
          aimPx: state.aimPx,
          recoveryCount: state.recoveryCount,
          coreReady: Boolean(coreApi()),
          directApiReady: Boolean(coreApi() && coreApi().directShootTarget),
          targets: hasTargets()
        };
      },
      setAimPx: function (px) {
        state.aimPx = Math.max(160, Math.min(460, Number(px) || 360));
      }
    };
  }

  function init() {
    injectStyle();
    ensureUi();
    expose();
    exposeShootAlias();
    installEvents();

    patchFinalGuard();
    setInterval(() => {
      exposeShootAlias();
      patchFinalGuard();
      if (isPlaying()) recoverIfBlank('interval-check');
    }, 900);

    console.info('[Groups cVR v1.8b] direct shoot stable installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
