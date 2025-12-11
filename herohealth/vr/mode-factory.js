// === /herohealth/vr/mode-factory.js ===
// VR Target Spawner แบบง่าย ใช้ได้กับ Hydration VR / เกมอื่น
// ไม่พึ่ง HHA_DIFF_TABLE แล้ว จะได้ไม่ล้มง่าย

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const AFRAME = ROOT.AFRAME;

// helper เล็ก ๆ -----------------------------
function clamp01(v) {
  v = Number(v);
  if (!isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function pick(arr) {
  if (!arr || !arr.length) return null;
  return arr[(Math.random() * arr.length) | 0];
}

// ------------------------------------------------
export async function boot(opts = {}) {
  if (!AFRAME) {
    console.error('[HHA-Factory] AFRAME not found');
    return { stop() {} };
  }

  const sceneEl = document.querySelector('a-scene');
  if (!sceneEl) {
    console.error('[HHA-Factory] <a-scene> not found');
    return { stop() {} };
  }

  const cameraEl =
    sceneEl.querySelector('#hydration-camera') ||
    sceneEl.querySelector('a-camera') ||
    (sceneEl.camera && sceneEl.camera.el) ||
    null;

  const THREE = AFRAME.THREE;

  // ---------- difficulty → scale / speed ----------
  const diffKey = String(opts.difficulty || 'normal').toLowerCase();
  let scale = 1.0;
  let spawnInterval = 900;   // ms
  let lifeTime = 2400;       // ms
  let maxActive = 4;

  if (diffKey === 'easy') {
    scale = 1.25;
    spawnInterval = 1050;
    lifeTime = 2800;
    maxActive = 3;
  } else if (diffKey === 'hard') {
    scale = 0.9;
    spawnInterval = 750;
    lifeTime = 2100;
    maxActive = 5;
  }

  // ---------- emoji pools ----------
  const goodPool  =
    (opts.pools && opts.pools.good && opts.pools.good.slice()) || ['💧'];
  const badPool   =
    (opts.pools && opts.pools.bad && opts.pools.bad.slice()) || ['🥤'];
  const powerPool = Array.isArray(opts.powerups) ? opts.powerups.slice() : [];

  const goodRate   = typeof opts.goodRate === 'number' ? clamp01(opts.goodRate) : 0.7;
  const powerRate  = typeof opts.powerRate === 'number' ? clamp01(opts.powerRate) : 0.12;
  const powerEvery = Number.isFinite(opts.powerEvery) && opts.powerEvery > 0
    ? opts.powerEvery
    : 7;

  const judgeFn  = typeof opts.judge === 'function' ? opts.judge : null;
  const expireFn = typeof opts.onExpire === 'function' ? opts.onExpire : null;

  // ---------- root entity ----------
  let rootEl = sceneEl.querySelector('#hha-target-root');
  if (!rootEl) {
    rootEl = document.createElement('a-entity');
    rootEl.setAttribute('id', 'hha-target-root');
    sceneEl.appendChild(rootEl);
  }

  // ---------- emoji → texture (ถ้ามี emojiImage) ----------
  let emojiImageFn = null;
  try {
    if (ROOT.GAME_MODULES && ROOT.GAME_MODULES.emojiImage) {
      emojiImageFn = ROOT.GAME_MODULES.emojiImage;
    } else if (typeof ROOT.emojiImage === 'function') {
      emojiImageFn = ROOT.emojiImage;
    }
  } catch (e) {
    // เงียบไป ไม่เป็นไร
  }

  function setEmojiVisual(entity, ch) {
    if (emojiImageFn) {
      const url = emojiImageFn(ch);
      if (url) {
        entity.setAttribute(
          'material',
          `shader: flat; src: url(${url}); transparent: true; alphaTest: 0.01`
        );
        entity.setAttribute(
          'geometry',
          `primitive: plane; height: ${0.9 * scale}; width: ${0.9 * scale}`
        );
        return;
      }
    }

    // fallback เป็นวงกลม + text emoji
    entity.setAttribute(
      'geometry',
      `primitive: circle; radius: ${0.35 * scale}`
    );
    entity.setAttribute(
      'material',
      'shader: flat; color: #020617; opacity: 0.95'
    );
    entity.setAttribute(
      'text',
      `value: ${ch}; align: center; color: #e5e7eb; width: 3;`
    );
  }

  // ---------- คำนวณตำแหน่งเป้า ----------
  function getSpawnPosition() {
    // ถ้าไม่มี THREE / camera ใช้ตำแหน่งคงที่หน้า player
    if (!THREE || !cameraEl || !cameraEl.object3D) {
      return { x: 0, y: 1.6, z: -3 };
    }

    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3(0, 0, -1);

    cameraEl.object3D.getWorldPosition(origin);
    cameraEl.object3D.getWorldDirection(dir);
    dir.normalize();

    const dist = 3.0;
    origin.addScaledVector(dir, dist);

    // กระจายซ้ายขวา + สูงต่ำเล็กน้อยรอบจุดศูนย์กลาง
    origin.x += (Math.random() - 0.5) * 1.8; // -0.9..0.9
    origin.y += (Math.random() - 0.2) * 1.4; // ประมาณ 0.3..1.1

    return { x: origin.x, y: origin.y, z: origin.z };
  }

  // ---------- State ----------
  let running = true;
  let spawnTimer = null;
  let shotCount = 0;
  const active = []; // { el, ch, kind, lifeTimer, hit }

  function cleanupDead() {
    for (let i = active.length - 1; i >= 0; i--) {
      const rec = active[i];
      if (!rec.el || !rec.el.parentNode) {
        if (rec.lifeTimer) ROOT.clearTimeout(rec.lifeTimer);
        active.splice(i, 1);
      }
    }
  }

  function destroyTarget(rec, byExpire) {
    if (!rec) return;
    if (rec.lifeTimer) {
      ROOT.clearTimeout(rec.lifeTimer);
      rec.lifeTimer = null;
    }
    const idx = active.indexOf(rec);
    if (idx >= 0) active.splice(idx, 1);
    if (rec.el && rec.el.parentNode) {
      rec.el.parentNode.removeChild(rec.el);
    }

    if (byExpire && expireFn) {
      try {
        expireFn({ ch: rec.ch, isGood: rec.kind === 'good' });
      } catch (e) {
        console.warn('[HHA-Factory] onExpire error', e);
      }
    }
  }

  function handleHit(rec, ev) {
    // หา screen coordinate คร่าว ๆ สำหรับ effect 2D
    let cx = ROOT.innerWidth / 2;
    let cy = ROOT.innerHeight / 2;

    const srcEvt =
      (ev && ev.detail && ev.detail.srcEvent) ||
      (ev && ev.detail && ev.detail.originalEvent) ||
      null;

    if (srcEvt && typeof srcEvt.clientX === 'number') {
      cx = srcEvt.clientX;
      cy = srcEvt.clientY;
    }

    const ctx = {
      entity: rec.el,
      ch: rec.ch,
      kind: rec.kind,
      clientX: cx,
      clientY: cy,
      cx,
      cy
    };

    if (judgeFn) {
      try {
        judgeFn(rec.ch, ctx);
      } catch (e) {
        console.warn('[HHA-Factory] judge error', e);
      }
    }

    destroyTarget(rec, false);
  }

  // ---------- สร้างเป้า 1 ลูก ----------
  function spawnOne() {
    if (!running) return;

    cleanupDead();
    if (active.length >= maxActive) return;

    // เลือกชนิด good / bad / power
    let kind = 'good';
    const r = Math.random();

    if (powerPool.length && (r < powerRate || (shotCount + 1) % powerEvery === 0)) {
      kind = 'power';
    } else if (r < powerRate + goodRate) {
      kind = 'good';
    } else {
      kind = 'bad';
    }

    let ch = null;
    if (kind === 'power') {
      ch = pick(powerPool) || pick(goodPool) || pick(badPool);
    } else if (kind === 'good') {
      ch = pick(goodPool) || pick(powerPool) || pick(badPool);
    } else {
      ch = pick(badPool) || pick(goodPool) || pick(powerPool);
    }
    if (!ch) return;

    const pos = getSpawnPosition();

    const el = document.createElement('a-entity');
    el.setAttribute('data-hha-tgt', '1');        // ให้ raycaster ยิงเจอ
    el.setAttribute('data-hha-kind', kind);
    el.setAttribute('data-hha-ch', ch);
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    el.setAttribute('rotation', '0 0 0');

    setEmojiVisual(el, ch);

    rootEl.appendChild(el);

    const rec = {
      el,
      ch,
      kind,
      hit: false,
      lifeTimer: null
    };
    active.push(rec);

    // อายุของเป้า
    rec.lifeTimer = ROOT.setTimeout(() => {
      if (!running || rec.hit) return;
      destroyTarget(rec, true);
    }, lifeTime);

    // ฟัง click จาก A-Frame cursor
    el.addEventListener('click', (ev) => {
      if (!running || rec.hit) return;
      rec.hit = true;
      handleHit(rec, ev);
    });

    shotCount++;
  }

  function startLoop() {
    if (spawnTimer) ROOT.clearInterval(spawnTimer);
    spawnTimer = ROOT.setInterval(spawnOne, spawnInterval);
  }

  startLoop();

  console.log('[HHA-Factory] started with diff =', diffKey);

  return {
    stop(reason = 'manual') {
      running = false;
      if (spawnTimer) {
        ROOT.clearInterval(spawnTimer);
        spawnTimer = null;
      }
      while (active.length) {
        destroyTarget(active.pop(), false);
      }
      console.log('[HHA-Factory] stopped:', reason);
    }
  };
}

export default { boot };