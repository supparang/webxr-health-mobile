// === /herohealth/vr/mode-factory.js ===
// Generic VR target spawner (Hydration VR / others)
// ใช้กับ A-Frame + cursor raycaster
// รับ config จาก *.safe.js เช่น hydration.safe.js

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

/**
 * opts:
 *  - difficulty: 'easy' | 'normal' | 'hard'
 *  - duration: seconds (ไม่ได้ใช้โดยตรง แค่เผื่อไว้)
 *  - modeKey: 'hydration' ฯลฯ (ไว้ดึงค่าจาก HHA_DIFF_TABLE ถ้ามี)
 *  - pools: { good:[], bad:[] }
 *  - goodRate: 0..1   (สัดส่วนเป้าน้ำดี)
 *  - powerups: []     (⭐ 💎 🛡️ 🔥)
 *  - powerRate: 0..1  (โอกาสเป้า power-up)
 *  - powerEvery: n    (ทุก n ลูกอย่างน้อยมี power 1 ครั้ง ประมาณ ๆ)
 *  - spawnStyle: 'pop' | 'fall' (ตอนนี้รองรับ pop เป็นหลัก)
 *  - judge(ch, ctx)   (เรียกจาก safe.js เวลาโดนตี)
 *  - onExpire(ev)     (เรียกเมื่อเป้าหายเอง)
 */
export async function boot (opts = {}) {
  const A = ROOT.AFRAME;
  if (!A) {
    console.error('[HHA-Factory] AFRAME not found');
    return dummyInstance();
  }

  const sceneEl = document.querySelector('a-scene');
  if (!sceneEl) {
    console.error('[HHA-Factory] <a-scene> not found in DOM');
    return dummyInstance();
  }

  const cameraEl =
    sceneEl.querySelector('#hydration-camera') ||
    sceneEl.querySelector('a-camera');

  if (!cameraEl) {
    console.warn('[HHA-Factory] camera element not found, use scene.camera');
  }

  const THREE = A.THREE;

  // ---------- Difficulty config (อ่านจาก HHA_DIFF_TABLE ถ้ามี) ----------
  const diffKey = String(opts.difficulty || 'normal').toLowerCase();
  const modeKey = String(opts.modeKey || 'default').toLowerCase();

  const tableRoot = ROOT.HHA_DIFF_TABLE || {};
  const modeTable = tableRoot[modeKey] || tableRoot.default || null;
  const row = modeTable ? (modeTable[diffKey] || modeTable.normal) : null;

  // ค่า default กันเหนียว
  const cfg = {
    spawnInterval: row?.spawnInterval || 950,   // ms
    lifeTime:      row?.lifeTime      || 2600,  // ms
    maxActive:     row?.maxActive     || 4,
    scale:         row?.scale         || 1.0,
    // เพิ่มจาก opts
    goodRate:      clamp01(opts.goodRate, 0.65),
    powerRate:     clamp01(opts.powerRate, 0.12),
    powerEvery:    Number.isFinite(opts.powerEvery) ? opts.powerEvery : 7,
    spawnStyle:    opts.spawnStyle || 'pop'
  };

  // ---------- Pools ----------
  const goodPool   = (opts.pools && opts.pools.good) || [];
  const badPool    = (opts.pools && opts.pools.bad)  || [];
  const powerPool  = Array.isArray(opts.powerups) ? opts.powerups.slice() : [];

  if (!goodPool.length && !badPool.length) {
    console.warn('[HHA-Factory] pools.good / pools.bad ว่างหมด – ใช้ fallback 💧 / 🥤');
    goodPool.push('💧');
    badPool.push('🥤');
  }

  const judgeFn   = typeof opts.judge === 'function' ? opts.judge : null;
  const expireFn  = typeof opts.onExpire === 'function' ? opts.onExpire : null;

  // ---------- Root entity ----------
  let rootEl = sceneEl.querySelector('#hha-target-root');
  if (!rootEl) {
    rootEl = document.createElement('a-entity');
    rootEl.setAttribute('id', 'hha-target-root');
    sceneEl.appendChild(rootEl);
  }

  // ---------- Emoji -> material helper ----------
  // ถ้ามี emojiImage แบบ global ก็ใช้ texture, ถ้าไม่มีก็ใช้ text component แทน
  let emojiImageFn = null;
  try {
    if (ROOT.GAME_MODULES && ROOT.GAME_MODULES.emojiImage) {
      emojiImageFn = ROOT.GAME_MODULES.emojiImage;
    } else if (typeof ROOT.emojiImage === 'function') {
      emojiImageFn = ROOT.emojiImage;
    }
  } catch (e) { /* ignore */ }

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
          `primitive: plane; height: ${0.72 * cfg.scale}; width: ${0.72 * cfg.scale}`
        );
        return;
      }
    }
    // fallback เป็น text
    entity.setAttribute('geometry',
      `primitive: circle; radius: ${0.32 * cfg.scale}`);
    entity.setAttribute('material',
      'color: #0f172a; opacity: 0.9; shader: flat;');
    entity.setAttribute('text',
      `value: ${ch}; align: center; color: #e5e7eb; width: 3;`);
  }

  // ---------- State ----------
  let running = true;
  let spawnTimer = null;
  let shotCount = 0;

  const active = []; // { el, ch, kind, bornAt, lifeTimer, hit }

  function dummyInstance () {
    return {
      stop () {}
    };
  }

  function clamp01 (v, fallback) {
    v = Number(v);
    if (!Number.isFinite(v)) return fallback;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  function pick (arr) {
    if (!arr || !arr.length) return null;
    return arr[(Math.random() * arr.length) | 0];
  }

  // ---------- Spawn position ----------
  function getSpawnPosition () {
    const baseDist = 3.0;
    let origin = new THREE.Vector3(0, 1.6, 0);
    let dir = new THREE.Vector3(0, 0, -1);

    const cam = cameraEl || (sceneEl.camera && sceneEl.camera.el);
    if (cam && cam.object3D) {
      cam.object3D.getWorldPosition(origin);
      cam.object3D.getWorldDirection(dir);
    }

    const center = origin.clone().add(dir.multiplyScalar(baseDist));

    // กระจายซ้าย-ขวา / บน-ล่าง นิดหน่อย
    const side = (Math.random() - 0.5) * 1.8;  // -0.9..0.9
    const up   = (Math.random() - 0.2) * 1.2;  // ประมาณ 0.4..1.0 เหนือระดับตา

    center.x += side;
    center.y += up;

    return center;
  }

  // ---------- สร้างเป้า ----------
  function spawnOne () {
    if (!running) return;

    cleanupDead();
    if (active.length >= cfg.maxActive) return;

    // เลือกชนิด: power / good / bad
    let kind = 'good';
    const r = Math.random();
    if (powerPool.length && (r < cfg.powerRate || (shotCount + 1) % cfg.powerEvery === 0)) {
      kind = 'power';
    } else if (r < cfg.powerRate + cfg.goodRate) {
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
    el.setAttribute('data-hha-tgt', '1');
    el.setAttribute('data-hha-ch', ch);

    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    el.setAttribute('rotation', '0 0 0');

    setEmojiVisual(el, ch);

    rootEl.appendChild(el);

    const bornAt = performance.now();
    const rec = { el, ch, kind, bornAt, hit: false, lifeTimer: null };
    active.push(rec);

    // อายุของเป้า
    rec.lifeTimer = ROOT.setTimeout(() => {
      if (!running || rec.hit) return;
      destroyTarget(rec, /* byExpire */ true);
    }, cfg.lifeTime);

    // รับ click จาก cursor raycaster
    el.addEventListener('click', (ev) => {
      if (!running || rec.hit) return;
      rec.hit = true;
      handleHit(rec, ev);
    });

    shotCount++;
  }

  function destroyTarget (rec, byExpire) {
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
      const isGood = rec.kind === 'good';
      try {
        expireFn({ ch: rec.ch, isGood });
      } catch (e) {
        console.warn('[HHA-Factory] onExpire error', e);
      }
    }
  }

  function cleanupDead () {
    for (let i = active.length - 1; i >= 0; i--) {
      const rec = active[i];
      if (!rec.el || !rec.el.parentNode) {
        if (rec.lifeTimer) ROOT.clearTimeout(rec.lifeTimer);
        active.splice(i, 1);
      }
    }
  }

  // ---------- เมื่อโดนตี ----------
  function handleHit (rec, ev) {
    // หา screen coord คร่าว ๆ (ใช้กลางจอถ้าหา MouseEvent ไม่ได้)
    let cx = ROOT.innerWidth / 2;
    let cy = ROOT.innerHeight / 2;

    const srcEvt = ev?.detail?.srcEvent || ev?.detail?.originalEvent || ev?.detail?.intersection?.event?.srcEvent;
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

    destroyTarget(rec, /* byExpire */ false);
  }

  // ---------- Start / Stop ----------
  function startLoop () {
    if (spawnTimer) ROOT.clearInterval(spawnTimer);
    spawnTimer = ROOT.setInterval(spawnOne, cfg.spawnInterval);
  }

  startLoop();

  return {
    stop (reason = 'manual') {
      running = false;
      if (spawnTimer) {
        ROOT.clearInterval(spawnTimer);
        spawnTimer = null;
      }
      while (active.length) {
        destroyTarget(active.pop(), false);
      }
    }
  };
}

export default { boot };