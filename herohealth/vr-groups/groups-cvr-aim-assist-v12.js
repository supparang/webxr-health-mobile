// === /herohealth/vr-groups/groups-cvr-aim-assist-v12.js ===
// HeroHealth Groups cVR — v1.2 Aim Assist + Target Highlight
// Purpose:
// - Show clearly what the crosshair is aiming at.
// - Highlight gate / power / decoy / item under crosshair.
// - Give child-friendly instruction before shooting.
// - Slightly increase Cardboard aim tolerance.
// Safe add-on: does not change scoring logic.
// PATCH v20260515-GROUPS-CVR-V12-AIM-ASSIST

(function () {
  'use strict';

  const VERSION = 'v1.2-cvr-aim-assist-highlight-20260515';

  if (window.__HHA_GROUPS_CVR_AIM_ASSIST_V12__) return;
  window.__HHA_GROUPS_CVR_AIM_ASSIST_V12__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    activeTarget: null,
    activeTargetKey: '',
    lastHint: '',
    lastKind: '',
    poll: null,
    aimPx: 280,
    targetConfidence: 0
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function coreApi() {
    return WIN.HHA_GROUPS_CVR_V1 || null;
  }

  function shootFixApi() {
    return WIN.HHA_GROUPS_CVR_SHOOT_FIX_V11 || null;
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
    if ($('groups-cvr-v12-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v12-style';
    style.textContent = `
      .cvr-v12-aim-card{
        position:fixed;
        left:50%;
        top:calc(92px + env(safe-area-inset-top,0px));
        transform:translateX(-50%);
        z-index:2147482100;
        width:min(520px,calc(100vw - 24px));
        border-radius:999px;
        padding:9px 13px;
        background:rgba(255,255,255,.92);
        color:#244e68;
        box-shadow:0 16px 44px rgba(35,81,107,.18);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:clamp(15px,4vw,22px);
        line-height:1.15;
        font-weight:1000;
        text-align:center;
        pointer-events:none;
        opacity:.96;
      }

      .cvr-v12-aim-card.good{
        background:rgba(245,255,241,.94);
        color:#31724b;
      }

      .cvr-v12-aim-card.power{
        background:rgba(232,248,255,.94);
        color:#245c78;
      }

      .cvr-v12-aim-card.decoy{
        background:rgba(255,240,240,.94);
        color:#9b3d3d;
        animation:cvrV12Warn .38s ease-in-out infinite alternate;
      }

      .cvr-v12-aim-card.golden{
        background:rgba(255,249,217,.94);
        color:#806000;
      }

      .cvr-v12-aim-card.neutral{
        background:rgba(255,255,255,.86);
        color:#7193a8;
      }

      @keyframes cvrV12Warn{
        from{ transform:translateX(-50%) scale(1); }
        to{ transform:translateX(-50%) scale(1.035); }
      }

      .cvr-v12-lock{
        position:fixed;
        left:50%;
        top:50%;
        transform:translate(-50%,-50%);
        z-index:2147482000;
        width:82px;
        height:82px;
        border-radius:999px;
        border:4px solid rgba(126,217,87,.72);
        box-shadow:
          0 0 0 8px rgba(126,217,87,.14),
          0 0 32px rgba(126,217,87,.45);
        pointer-events:none;
        display:none;
      }

      body.cvr-v12-has-target .cvr-v12-lock{
        display:block;
        animation:cvrV12Lock .5s ease-in-out infinite alternate;
      }

      body.cvr-v12-target-decoy .cvr-v12-lock{
        border-color:rgba(255,125,125,.82);
        box-shadow:
          0 0 0 8px rgba(255,125,125,.14),
          0 0 32px rgba(255,125,125,.45);
      }

      body.cvr-v12-target-power .cvr-v12-lock{
        border-color:rgba(97,187,255,.82);
        box-shadow:
          0 0 0 8px rgba(97,187,255,.14),
          0 0 32px rgba(97,187,255,.45);
      }

      body.cvr-v12-target-golden .cvr-v12-lock{
        border-color:rgba(255,217,102,.9);
        box-shadow:
          0 0 0 8px rgba(255,217,102,.17),
          0 0 36px rgba(255,217,102,.5);
      }

      @keyframes cvrV12Lock{
        from{ transform:translate(-50%,-50%) scale(.96); opacity:.72; }
        to{ transform:translate(-50%,-50%) scale(1.08); opacity:1; }
      }

      .cvr-v12-status{
        position:fixed;
        left:50%;
        bottom:calc(66px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        z-index:2147482100;
        width:min(520px,calc(100vw - 24px));
        border-radius:22px;
        padding:8px 12px;
        background:rgba(255,255,255,.88);
        color:#426f87;
        box-shadow:0 12px 32px rgba(35,81,107,.14);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:clamp(13px,3.5vw,18px);
        line-height:1.2;
        font-weight:900;
        text-align:center;
        pointer-events:none;
      }

      @media (max-height:700px){
        .cvr-v12-aim-card{
          top:calc(76px + env(safe-area-inset-top,0px));
          padding:7px 11px;
          font-size:clamp(13px,3.8vw,18px);
        }

        .cvr-v12-status{
          bottom:calc(58px + env(safe-area-inset-bottom,0px));
          padding:7px 10px;
          font-size:clamp(12px,3.2vw,16px);
        }

        .cvr-v12-lock{
          width:70px;
          height:70px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureUi() {
    if (!$('cvrV12AimCard')) {
      const card = DOC.createElement('div');
      card.id = 'cvrV12AimCard';
      card.className = 'cvr-v12-aim-card neutral';
      card.textContent = 'เล็งเป้าหมาย แล้วแตะจอเพื่อยิง';
      DOC.body.appendChild(card);
    }

    if (!$('cvrV12Lock')) {
      const lock = DOC.createElement('div');
      lock.id = 'cvrV12Lock';
      lock.className = 'cvr-v12-lock';
      DOC.body.appendChild(lock);
    }

    if (!$('cvrV12Status')) {
      const status = DOC.createElement('div');
      status.id = 'cvrV12Status';
      status.className = 'cvr-v12-status';
      status.textContent = 'Crosshair พร้อมใช้งาน';
      DOC.body.appendChild(status);
    }
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

    return {
      el: entityFromObject(hits[0].object),
      confidence: 1,
      method: 'ray'
    };
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

      if (el.dataset && el.dataset.role === 'item') bias -= 18;
      if (el.dataset && el.dataset.kind === 'power') bias -= 35;
      if (el.dataset && el.dataset.kind === 'decoy') bias -= 8;

      const score = dist + bias;

      if (score < bestScore) {
        bestScore = score;
        bestDist = dist;
        best = el;
      }
    });

    if (!best) return null;

    const threshold = Math.max(
      150,
      Math.min(state.aimPx, Math.min(rect.width, rect.height) * 0.24)
    );

    if (bestDist > threshold) return null;

    const confidence = Math.max(0.15, Math.min(1, 1 - bestDist / threshold));

    return {
      el: best,
      confidence,
      method: 'projected',
      dist: bestDist
    };
  }

  function findAimTarget() {
    const ray = raycastCenterTarget();
    if (ray && ray.el) return ray;

    const fallback = projectedFallbackTarget();
    if (fallback && fallback.el) return fallback;

    return null;
  }

  function targetKey(el) {
    if (!el) return '';

    return [
      el.dataset && el.dataset.role || '',
      el.dataset && el.dataset.group || '',
      el.dataset && el.dataset.kind || '',
      el.dataset && el.dataset.id || ''
    ].join('|');
  }

  function currentItem() {
    const s = gs();
    return s && s.current ? s.current : null;
  }

  function currentItemGroupKey() {
    const item = currentItem();
    try {
      return item && item.group && item.group.key || '';
    } catch (e) {
      return '';
    }
  }

  function currentItemGroupId() {
    const item = currentItem();
    try {
      return item && item.group && item.group.id || '';
    } catch (e) {
      return '';
    }
  }

  function targetKind(el) {
    if (!el || !el.dataset) return 'none';

    if (el.dataset.role === 'gate') {
      const currentKey = currentItemGroupKey();

      if (currentKey && el.dataset.group === currentKey) return 'good';
      return 'gate';
    }

    if (el.dataset.kind === 'power') return 'power';
    if (el.dataset.kind === 'decoy') return 'decoy';
    if (el.dataset.kind === 'golden') return 'golden';
    if (el.dataset.role === 'item') return 'item';

    return 'none';
  }

  function targetHint(el) {
    if (!el || !el.dataset) {
      return {
        kind: 'neutral',
        main: 'เล็งเป้าหมาย แล้วแตะจอเพื่อยิง',
        status: 'ยังไม่ล็อกเป้า'
      };
    }

    const item = currentItem();

    if (el.dataset.role === 'gate') {
      const gateId = el.dataset.id || '?';
      const gateGroup = el.dataset.group || '';
      const correctGroup = currentItemGroupKey();
      const correctId = currentItemGroupId();

      if (!item) {
        return {
          kind: 'neutral',
          main: `เล็งประตูหมู่ ${gateId}`,
          status: 'รอ item ถัดไป'
        };
      }

      if (item.kind === 'power') {
        return {
          kind: 'power',
          main: 'Power ต้องยิงที่ตัวพลัง',
          status: 'เล็ง 🛡️ หรือ ⏱️ ไม่ใช่ประตู'
        };
      }

      if (item.kind === 'decoy') {
        return {
          kind: 'decoy',
          main: '🚫 ตัวหลอก อย่ายิง!',
          status: 'ปล่อยให้ผ่านไป'
        };
      }

      if (gateGroup === correctGroup) {
        return {
          kind: item.kind === 'golden' ? 'golden' : 'good',
          main: `พร้อมยิง! ประตูหมู่ ${gateId}`,
          status: `ถูกต้อง → แตะจอเพื่อส่งเข้าหมู่ ${gateId}`
        };
      }

      return {
        kind: 'neutral',
        main: `ยังไม่ใช่หมู่ ${correctId}`,
        status: `ให้เล็งประตูหมู่ ${correctId}`
      };
    }

    if (el.dataset.role === 'item') {
      if (el.dataset.kind === 'power') {
        return {
          kind: 'power',
          main: '⚡ Power พร้อมเก็บ!',
          status: 'แตะจอเพื่อเก็บพลัง'
        };
      }

      if (el.dataset.kind === 'decoy') {
        return {
          kind: 'decoy',
          main: '🚫 อย่ายิงตัวหลอก!',
          status: 'ปล่อยให้ผ่านไปจะได้คะแนนหลบ'
        };
      }

      if (el.dataset.kind === 'golden') {
        return {
          kind: 'golden',
          main: `⭐ Golden ต้องยิงประตูหมู่ ${currentItemGroupId()}`,
          status: 'เล็งประตูที่ถูกด้านหน้า'
        };
      }

      return {
        kind: 'neutral',
        main: `อาหารนี้ต้องยิงประตูหมู่ ${currentItemGroupId()}`,
        status: 'เล็งประตูด้านหน้า'
      };
    }

    return {
      kind: 'neutral',
      main: 'เล็งเป้าหมาย แล้วแตะจอเพื่อยิง',
      status: 'Crosshair พร้อมใช้งาน'
    };
  }

  function setBodyKind(kind, hasTarget) {
    DOC.body.classList.toggle('cvr-v12-has-target', Boolean(hasTarget));

    DOC.body.classList.remove(
      'cvr-v12-target-good',
      'cvr-v12-target-power',
      'cvr-v12-target-decoy',
      'cvr-v12-target-golden',
      'cvr-v12-target-neutral'
    );

    if (hasTarget) {
      DOC.body.classList.add(`cvr-v12-target-${kind || 'neutral'}`);
    }
  }

  function ensureHalo(el) {
    if (!el) return null;

    let halo = el.querySelector('.cvr-v12-halo');

    if (!halo) {
      halo = DOC.createElement('a-ring');
      halo.classList.add('cvr-v12-halo');
      halo.setAttribute('position', '0 0 0.025');
      halo.setAttribute('rotation', '0 0 0');
      halo.setAttribute('radius-inner', '0.46');
      halo.setAttribute('radius-outer', '0.50');
      halo.setAttribute('material', 'shader:flat; transparent:true; opacity:.92; color:#7ed957');
      halo.setAttribute('visible', 'false');
      el.appendChild(halo);
    }

    return halo;
  }

  function hideHalo(el) {
    if (!el) return;

    const halo = el.querySelector('.cvr-v12-halo');
    if (halo) halo.setAttribute('visible', 'false');

    try {
      el.setAttribute('scale', '1 1 1');
    } catch (e) {}
  }

  function showHalo(el, kind) {
    if (!el) return;

    const halo = ensureHalo(el);
    if (!halo) return;

    let color = '#7ed957';

    if (kind === 'power') color = '#61bbff';
    if (kind === 'decoy') color = '#ff7d7d';
    if (kind === 'golden') color = '#ffd966';
    if (kind === 'gate' || kind === 'neutral') color = '#ffffff';

    halo.setAttribute('material', `shader:flat; transparent:true; opacity:.92; color:${color}`);
    halo.setAttribute('visible', 'true');

    try {
      el.setAttribute('scale', kind === 'decoy' ? '1.05 1.05 1.05' : '1.09 1.09 1.09');
    } catch (e) {}
  }

  function updateHintUi(info, hasTarget) {
    const card = $('cvrV12AimCard');
    const status = $('cvrV12Status');

    if (!card || !status) return;

    card.className = `cvr-v12-aim-card ${info.kind || 'neutral'}`;
    card.textContent = info.main;

    const confidenceText = hasTarget
      ? `ล็อกเป้า ${(state.targetConfidence * 100).toFixed(0)}%`
      : 'ยังไม่ล็อกเป้า';

    status.textContent = `${info.status} • ${confidenceText}`;
  }

  function poll() {
    if (!isPlaying()) {
      if (state.activeTarget) hideHalo(state.activeTarget);
      state.activeTarget = null;
      state.activeTargetKey = '';
      setBodyKind('', false);
      return;
    }

    ensureUi();

    const found = findAimTarget();
    const target = found && found.el ? found.el : null;
    const key = targetKey(target);

    state.targetConfidence = found && found.confidence ? found.confidence : 0;

    if (key !== state.activeTargetKey) {
      if (state.activeTarget && state.activeTarget !== target) {
        hideHalo(state.activeTarget);
      }

      state.activeTarget = target;
      state.activeTargetKey = key;
    }

    const hint = targetHint(target);
    const kind = targetKind(target);

    if (target) {
      showHalo(target, kind);
      setBodyKind(hint.kind || kind || 'neutral', true);
    } else {
      setBodyKind('', false);
    }

    updateHintUi(hint, Boolean(target));

    /*
      Keep v1.1 aim tolerance comfortable.
      This is especially important on phones in cardboard holders.
    */
    try {
      const sf = shootFixApi();
      if (sf && typeof sf.setAimPx === 'function') {
        sf.setAimPx(state.aimPx);
      }
    } catch (e) {}
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_AIM_ASSIST_V12 = {
      version: VERSION,
      getTarget: function () {
        return {
          version: VERSION,
          targetKey: state.activeTargetKey,
          confidence: state.targetConfidence,
          hint: state.lastHint,
          kind: state.lastKind
        };
      },
      setAimPx: function (px) {
        state.aimPx = Math.max(140, Math.min(390, Number(px) || 280));

        try {
          const sf = shootFixApi();
          if (sf && typeof sf.setAimPx === 'function') {
            sf.setAimPx(state.aimPx);
          }
        } catch (e) {}
      }
    };
  }

  function init() {
    injectStyle();
    ensureUi();
    expose();

    state.poll = setInterval(poll, 90);

    console.info('[Groups cVR v1.2] aim assist installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
