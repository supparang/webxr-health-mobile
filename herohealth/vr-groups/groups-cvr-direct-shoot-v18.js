// === /herohealth/vr-groups/groups-cvr-direct-shoot-v18.js ===
// HeroHealth Groups cVR — v1.8c Direct Shoot Lock Target
// Fixes:
// - Shooting 1–2 times then game ends.
// - Wrong gate / food item / decoy should not instantly punish in cVR.
// - Only correct gate and power item are sent to core.
// - Old DOM click shooting must be disabled in groups-cvr.html.
// PATCH v20260515-GROUPS-CVR-V18C-DIRECT-SHOOT-LOCK-TARGET

(function () {
  'use strict';

  const VERSION = 'v1.8c-cvr-direct-shoot-lock-target-20260515';

  if (window.__HHA_GROUPS_CVR_DIRECT_SHOOT_V18C__) return;
  window.__HHA_GROUPS_CVR_DIRECT_SHOOT_V18C__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    lastShotAt: 0,
    shots: 0,
    hits: 0,
    blocked: 0,
    misses: 0,
    lastTarget: '',
    aimPx: 380,
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

  function currentItem() {
    const s = gs();
    return s && s.current ? s.current : null;
  }

  function currentKind() {
    const item = currentItem();
    return item && item.kind ? item.kind : '';
  }

  function currentGroupKey() {
    const item = currentItem();
    return item && item.group && item.group.key ? item.group.key : '';
  }

  function currentGroupId() {
    const item = currentItem();
    return item && item.group && item.group.id ? item.group.id : '';
  }

  function currentGroupLabel() {
    const item = currentItem();
    return item && item.group && item.group.label ? item.group.label : '';
  }

  function injectStyle() {
    if ($('groups-cvr-v18c-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v18c-style';
    style.textContent = `
      .cvr-v18c-toast{
        position:fixed;
        left:50%;
        top:66%;
        transform:translate(-50%,-50%);
        z-index:2147483300;
        width:min(460px,86vw);
        border-radius:999px;
        padding:11px 16px;
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

      .cvr-v18c-toast.warn{
        background:#fff5ca;
        color:#806000;
      }

      .cvr-v18c-toast.bad{
        background:#fff0f0;
        color:#9b3d3d;
      }

      .cvr-v18c-toast.good{
        background:#f5fff1;
        color:#31724b;
      }

      .cvr-v18c-toast.show{
        animation:cvrV18cToast .62s ease both;
      }

      @keyframes cvrV18cToast{
        0%{opacity:0; transform:translate(-50%,-35%) scale(.86);}
        24%{opacity:1; transform:translate(-50%,-50%) scale(1.05);}
        72%{opacity:1; transform:translate(-50%,-54%) scale(1);}
        100%{opacity:0; transform:translate(-50%,-70%) scale(.94);}
      }

      .cvr-v18c-fire{
        position:fixed;
        left:50%;
        bottom:calc(12px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        z-index:2147483250;
        border:0;
        border-radius:999px;
        min-width:154px;
        height:52px;
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

      body.playing .cvr-v18c-fire{
        display:block;
      }

      body.playing #cvrV16SafeShoot,
      body.playing #cvrV18bFireBtn,
      body.playing #cvrV18FireBtn{
        display:none !important;
      }

      @media (max-width:460px){
        .cvr-v18c-fire{
          min-width:132px;
          height:46px;
          font-size:15px;
          bottom:calc(8px + env(safe-area-inset-bottom,0px));
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureUi() {
    if (!$('cvrV18cToast')) {
      const t = DOC.createElement('div');
      t.id = 'cvrV18cToast';
      t.className = 'cvr-v18c-toast';
      DOC.body.appendChild(t);
    }

    if (!$('cvrV18cFireBtn')) {
      const btn = DOC.createElement('button');
      btn.id = 'cvrV18cFireBtn';
      btn.className = 'cvr-v18c-fire';
      btn.type = 'button';
      btn.textContent = '🎯 ยิง';
      DOC.body.appendChild(btn);
    }
  }

  function toast(text, kind) {
    const el = $('cvrV18cToast');
    if (!el) return;

    el.className = 'cvr-v18c-toast ' + (kind || '');
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

  function highlightedTarget() {
    const highlighted = Array.from(DOC.querySelectorAll('.clickable')).find(el => {
      const halo = el.querySelector('.cvr-v12-halo');
      if (!halo) return false;
      const visible = halo.getAttribute('visible');
      return visible === true || visible === 'true';
    });

    return highlighted || null;
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

    const kind = currentKind();
    const needKey = currentGroupKey();

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

      if (el.dataset.role === 'item') bias -= 12;
      if (el.dataset.kind === 'power') bias -= 58;
      if (el.dataset.role === 'gate') bias -= 18;

      if ((kind === 'food' || kind === 'golden') && el.dataset.role === 'gate') {
        bias -= 38;
      }

      if ((kind === 'food' || kind === 'golden') && el.dataset.role === 'gate' && el.dataset.group === needKey) {
        bias -= 46;
      }

      if (kind === 'power' && el.dataset.role === 'item') {
        bias -= 60;
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
      200,
      Math.min(state.aimPx, Math.min(rect.width, rect.height) * 0.32)
    );

    if (bestDist <= threshold) return best;

    return null;
  }

  function findTarget() {
    return raycastTarget() || highlightedTarget() || projectedTarget();
  }

  function hasTargets() {
    return {
      gates: DOC.querySelectorAll('.clickable[data-role="gate"]').length,
      items: DOC.querySelectorAll('.clickable[data-role="item"]').length
    };
  }

  function recoverIfBlank() {
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
      return;
    }

    if (core && typeof core.rebuildGates === 'function' && gateMissing) {
      core.rebuildGates();
    }

    if (core && typeof core.forceSpawn === 'function' && (currentMissing || itemMissing)) {
      core.forceSpawn();
    }

    state.recoveryCount += 1;
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

  function blockedInstruction(target) {
    const item = currentItem();
    const kind = currentKind();
    const needId = currentGroupId();
    const needLabel = currentGroupLabel();

    if (!item) return 'รออาหารตัวถัดไป';
    if (!target) return 'เล็งเป้าหมายก่อน';

    const ds = target.dataset || {};

    if ((kind === 'food' || kind === 'golden') && ds.role === 'item') {
      return `เล็งประตูหมู่ ${needId} ${needLabel}`;
    }

    if ((kind === 'food' || kind === 'golden') && ds.role === 'gate' && ds.group !== currentGroupKey()) {
      return `ยังไม่ใช่หมู่ ${needId}`;
    }

    if (kind === 'power' && ds.role === 'gate') {
      return 'Power ต้องยิงที่ตัวพลัง';
    }

    if (kind === 'decoy') {
      return 'ตัวหลอก อย่ายิง';
    }

    return 'เล็งเป้าให้ตรงก่อน';
  }

  function shouldBlockInsteadOfPunish(target) {
    const item = currentItem();
    if (!item || !target || !target.dataset) return true;

    const ds = target.dataset || {};
    const kind = item.kind;

    if ((kind === 'food' || kind === 'golden') && ds.role === 'item') return true;
    if ((kind === 'food' || kind === 'golden') && ds.role === 'gate' && ds.group !== item.group.key) return true;
    if (kind === 'power' && ds.role !== 'item') return true;
    if (kind === 'decoy') return true;

    return false;
  }

  function safeDirectCore(target) {
    const core = coreApi();
    if (!core || typeof core.directShootTarget !== 'function') return false;

    try {
      return Boolean(core.directShootTarget(target));
    } catch (e) {
      return false;
    }
  }

  function directShoot(source) {
    if (!isPlaying()) return false;

    const now = Date.now();
    if (now - state.lastShotAt < 240) return false;

    state.lastShotAt = now;
    state.shots += 1;

    const core = coreApi();

    if (!core || typeof core.directShootTarget !== 'function') {
      state.misses += 1;
      toast('ยังไม่ได้เปิด direct API', 'bad');
      return false;
    }

    const target = findTarget();

    if (!target) {
      state.blocked += 1;
      toast('เล็งเป้าหมายก่อน', 'warn');
      vibrate(10);
      recoverIfBlank();
      return false;
    }

    if (shouldBlockInsteadOfPunish(target)) {
      state.blocked += 1;
      toast(blockedInstruction(target), 'warn');
      vibrate(8);
      recoverIfBlank();
      return false;
    }

    const ok = safeDirectCore(target);

    if (!ok) {
      state.blocked += 1;
      toast('ยิงไม่เข้า core', 'bad');
      vibrate(10);
      recoverIfBlank();
      return false;
    }

    const ds = target.dataset || {};
    const role = ds.role || '';
    const label = describeTarget(target);

    state.hits += 1;
    state.lastTarget = `${role}:${ds.group || ds.kind || ds.id || ''}`;

    if (role === 'gate') {
      toast(`🎯 ยิง${label}`, 'good');
    } else if (ds.kind === 'power') {
      toast('⚡ เก็บ Power', 'good');
    } else {
      toast('🎯 ยิงแล้ว', 'good');
    }

    vibrate(18);

    setTimeout(recoverIfBlank, 700);
    setTimeout(recoverIfBlank, 1300);

    try {
      WIN.dispatchEvent(new CustomEvent('groups-cvr:v18c-direct-shoot', {
        detail: {
          version: VERSION,
          source: source || 'v18c',
          target: state.lastTarget,
          ok: true
        }
      }));
    } catch (e) {}

    return true;
  }

  function exposeShootAlias() {
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
          blocked: state.blocked,
          lastTarget: state.lastTarget,
          aimPx: state.aimPx,
          core: Boolean(coreApi()),
          aliasFromV18c: true
        };
      },
      setAimPx: function (px) {
        state.aimPx = Math.max(180, Math.min(480, Number(px) || 380));
      }
    };
  }

  function patchFinalGuard() {
    const fg = WIN.HHA_GROUPS_CVR_FINAL_GUARD_V16;
    if (!fg || fg.__v18cPatched) return;

    fg.__v18cPatched = true;

    if (typeof fg.safeShoot === 'function') {
      fg.safeShoot = function () {
        return directShoot('final-guard-v18c');
      };
    }
  }

  function isBlockedUi(ev) {
    const t = ev && ev.target;
    if (!t || !t.closest) return false;

    return Boolean(
      t.closest('#intro.active') ||
      t.closest('#summary.active') ||
      t.closest('.screen.active') ||
      t.closest('input') ||
      t.closest('select') ||
      t.closest('#cvrV13Controls') ||
      t.closest('#cvrV13ComfortCard') ||
      t.closest('#cvrV16Rescue') ||
      t.closest('.a-enter-vr-button') ||
      t.closest('.a-orientation-modal')
    );
  }

  function installEvents() {
    WIN.addEventListener('hha:shoot', ev => {
      if (!isPlaying()) return;
      ev.preventDefault && ev.preventDefault();
      ev.stopImmediatePropagation && ev.stopImmediatePropagation();
      directShoot('hha-window-v18c');
    }, true);

    DOC.addEventListener('hha:shoot', ev => {
      if (!isPlaying()) return;
      ev.preventDefault && ev.preventDefault();
      ev.stopImmediatePropagation && ev.stopImmediatePropagation();
      directShoot('hha-document-v18c');
    }, true);

    DOC.addEventListener('keydown', ev => {
      if (!isPlaying()) return;

      if (ev.code === 'Space' || ev.code === 'Enter') {
        ev.preventDefault();
        ev.stopImmediatePropagation && ev.stopImmediatePropagation();
        directShoot('keyboard-v18c');
      }
    }, true);

    const fireBtn = $('cvrV18cFireBtn');

    if (fireBtn && !fireBtn.__v18cBound) {
      fireBtn.__v18cBound = true;

      fireBtn.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation && ev.stopImmediatePropagation();
      }, true);

      fireBtn.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation && ev.stopImmediatePropagation();
        directShoot('button-v18c');
      }, true);
    }

    WIN.addEventListener('pointerup', ev => {
      if (!isPlaying()) return;
      if (isBlockedUi(ev)) return;

      ev.preventDefault && ev.preventDefault();
      ev.stopImmediatePropagation && ev.stopImmediatePropagation();

      directShoot('screen-pointerup-v18c');
    }, {
      capture: true,
      passive: false
    });
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_DIRECT_SHOOT_V18 = {
      version: VERSION,
      shoot: directShoot,
      findTarget,
      recoverIfBlank,
      getState: function () {
        return {
          version: VERSION,
          playing: isPlaying(),
          shots: state.shots,
          hits: state.hits,
          blocked: state.blocked,
          misses: state.misses,
          lastTarget: state.lastTarget,
          aimPx: state.aimPx,
          recoveryCount: state.recoveryCount,
          coreReady: Boolean(coreApi()),
          directApiReady: Boolean(coreApi() && coreApi().directShootTarget),
          targets: hasTargets(),
          current: currentItem()
        };
      },
      setAimPx: function (px) {
        state.aimPx = Math.max(180, Math.min(480, Number(px) || 380));
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
      if (isPlaying()) recoverIfBlank();
    }, 900);

    console.info('[Groups cVR v1.8c] direct shoot lock target installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
