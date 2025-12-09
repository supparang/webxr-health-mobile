// === /herohealth/vr/mode-factory.js ===
// Generic VR target spawner + shared timer (hha:time)
// ใช้ร่วมกับโหมดต่าง ๆ เช่น GoodJunkVR, HydrationVR, FoodGroupsVR ฯลฯ

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// --------------------------------------------------
//  Helper: หา config จาก HHA_DIFF_TABLE (ถ้ามี)
// --------------------------------------------------
function pickEngineConfig(modeKey, diffKey) {
  const safe = {
    SPAWN_INTERVAL: 900,   // ms ระยะห่างการ spawn เป้า
    ITEM_LIFETIME: 2200,   // ms อายุเป้า
    MAX_ACTIVE: 4,         // จำนวนเป้าสูงสุดพร้อมกัน
    SIZE_FACTOR: 1.0
  };

  try {
    const table = ROOT.HHA_DIFF_TABLE;
    if (!table) return safe;

    const mode = table[modeKey];
    if (!mode) return safe;

    const diff = mode[diffKey];
    if (!diff || !diff.engine) return safe;

    const eng = diff.engine;
    return {
      SPAWN_INTERVAL: Number(eng.SPAWN_INTERVAL) || safe.SPAWN_INTERVAL,
      ITEM_LIFETIME: Number(eng.ITEM_LIFETIME) || safe.ITEM_LIFETIME,
      MAX_ACTIVE: Number(eng.MAX_ACTIVE) || safe.MAX_ACTIVE,
      SIZE_FACTOR:  Number(eng.SIZE_FACTOR)  || safe.SIZE_FACTOR
    };
  } catch (err) {
    console.warn('[HHA] pickEngineConfig error:', err);
    return safe;
  }
}

// --------------------------------------------------
//  Helper: หา root สำหรับวางเป้า (ผูกกับกล้อง)
// --------------------------------------------------
function ensureVrRoot() {
  const scene = document.querySelector('a-scene');
  if (!scene) {
    console.warn('[HHA] No <a-scene> found for VR root');
    return null;
  }

  let cam =
    scene.querySelector('[camera]') ||
    scene.querySelector('#cameraRig') ||
    scene.querySelector('a-entity[camera]');

  if (!cam) {
    console.warn('[HHA] No camera found in scene');
    return null;
  }

  let root = cam.querySelector('.hha-vr-root');
  if (!root) {
    root = document.createElement('a-entity');
    root.classList.add('hha-vr-root');
    // ให้ root อยู่หน้าเล็กน้อย (เป้าแต่ละอันจะ offset เพิ่มเอง)
    root.setAttribute('position', '0 0 0');
    cam.appendChild(root);
  }
  return root;
}

// --------------------------------------------------
//  Helper: สร้างเป้า VR (emoji ชัด ๆ หันเข้าหากล้อง)
// --------------------------------------------------
function createVrTarget(root, targetCfg, handlers = {}) {
  const {
    ch,
    lifeMs,
    isGood,
    sizeFactor = 1.0
  } = targetCfg;

  const { onHit, onExpire } = handlers;

  if (!root || !ch) return null;

  const holder = document.createElement('a-entity');
  holder.classList.add('hha-target-vr');

  // แผ่นรองโปร่งใส (ช่วยให้ emoji อ่านง่ายขึ้น)
  const plane = document.createElement('a-entity');
  const w = 0.7 * sizeFactor;
  const h = 0.7 * sizeFactor;

  plane.setAttribute('geometry', `primitive: plane; width: ${w}; height: ${h}`);
  plane.setAttribute(
    'material',
    'color: #020617; transparent: true; opacity: 0.15; side: double'
  );

  // emoji ขนาดใหญ่ตรงกลาง
  const text = document.createElement('a-entity');
  const textW = 4 * sizeFactor;
  text.setAttribute(
    'text',
    `value: ${ch}; align: center; width: ${textW}; color: #ffffff; anchor: center; baseline: center`
  );
  text.setAttribute('position', '0 0 0.01');

  plane.appendChild(text);
  holder.appendChild(plane);

  // ตำแหน่งด้านหน้าในมุมมองกล้อง (ระนาบ Z ติดลบ)
  const x = -0.9 + Math.random() * 1.8; // กระจายซ้าย-ขวา
  const y = -0.3 + Math.random() * 0.9; // กระจายบน-ล่าง
  const z = -2.4;                       // ระยะห่างจากกล้อง
  holder.setAttribute('position', `${x} ${y} ${z}`);

  // ⭐ จุดสำคัญ: หมุน 180° ให้เป้าหันหน้ามาหากล้อง
  holder.setAttribute('rotation', '0 180 0');

  root.appendChild(holder);

  let killed = false;
  const bornAt = performance.now();

  const cleanup = (reason) => {
    if (killed) return;
    killed = true;
    if (holder.parentNode) holder.parentNode.removeChild(holder);

    if (reason === 'expire' && typeof onExpire === 'function') {
      try {
        onExpire({ ch, isGood, bornAt, lifeMs });
      } catch (err) {
        console.warn('[HHA] onExpire error:', err);
      }
    }
  };

  // คลิก/จิ้มในโหมด PC/Mobile หรือยิง raycaster ใน VR
  const handleHit = () => {
    if (killed) return;

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const ctx = { clientX: cx, clientY: cy, cx, cy };

    if (typeof onHit === 'function') {
      try {
        onHit({ ch, isGood, ctx, kill: () => cleanup('hit') });
      } catch (err) {
        console.warn('[HHA] onHit error:', err);
      }
    } else {
      cleanup('hit');
    }
  };

  holder.addEventListener('click', handleHit);

  // หมดเวลา → หายไปเอง
  const ttl = Number(lifeMs) > 0 ? Number(lifeMs) : 2200;
  const timeoutId = setTimeout(() => {
    cleanup('expire');
  }, ttl);

  return {
    el: holder,
    ch,
    isGood,
    kill: () => {
      clearTimeout(timeoutId);
      cleanup('manual');
    }
  };
}

// --------------------------------------------------
//  Helper: random เลือก emoji ตาม good / bad / powerups
// --------------------------------------------------
function pickChar(pools, goodRate, powerups, powerRate, powerEvery, spawnCount) {
  const good = pools.good || [];
  const bad  = pools.bad  || [];

  const hasPower = Array.isArray(powerups) && powerups.length > 0;

  // ทุก ๆ powerEvery ครั้งมีโอกาสสุ่ม power-up
  if (
    hasPower &&
    powerEvery > 0 &&
    spawnCount > 0 &&
    spawnCount % powerEvery === 0 &&
    Math.random() < powerRate
  ) {
    const idx = Math.floor(Math.random() * powerups.length);
    return { ch: powerups[idx], isGood: true, isPower: true };
  }

  const r = Math.random();
  if (r < goodRate && good.length > 0) {
    const idx = Math.floor(Math.random() * good.length);
    return { ch: good[idx], isGood: true, isPower: false };
  }

  if (bad.length > 0) {
    const idx = Math.floor(Math.random() * bad.length);
    return { ch: bad[idx], isGood: false, isPower: false };
  }

  // fallback: ถ้า bad ว่าง ให้ดึงจาก good
  if (good.length > 0) {
    const idx = Math.floor(Math.random() * good.length);
    return { ch: good[idx], isGood: true, isPower: false };
  }

  return { ch: '❓', isGood: false, isPower: false };
}

// --------------------------------------------------
//  boot(cfg) — entry หลักใช้จาก goodjunk.safe / hydration.safe ฯลฯ
// --------------------------------------------------
export async function boot(cfg = {}) {
  const diffRaw = String(cfg.difficulty || 'normal').toLowerCase();
  const diff =
    diffRaw === 'easy' || diffRaw === 'hard' || diffRaw === 'normal'
      ? diffRaw
      : 'normal';

  let dur = Number(cfg.duration || 60);
  if (!Number.isFinite(dur) || dur <= 0) dur = 60;
  if (dur < 20) dur = 20;
  if (dur > 180) dur = 180;

  const modeKey = String(cfg.modeKey || 'generic').toLowerCase();

  const pools = cfg.pools || { good: [], bad: [] };
  const goodRate = Number(cfg.goodRate ?? 0.7);
  const powerups = cfg.powerups || [];
  const powerRate = Number(cfg.powerRate ?? 0.12);
  const powerEvery = Number(cfg.powerEvery ?? 6);

  const spawnStyle = cfg.spawnStyle || 'pop'; // ตอนนี้ใช้ pop เป็นหลัก

  const judgeFn = typeof cfg.judge === 'function' ? cfg.judge : null;
  const onExpireFn =
    typeof cfg.onExpire === 'function' ? cfg.onExpire : () => {};

  const vrRoot = ensureVrRoot();
  if (!vrRoot) {
    console.error('[HHA] VR root not found — abort mode-factory boot');
    return {
      stop() {}
    };
  }

  // อ่าน config จาก HHA_DIFF_TABLE (ถ้ามี)
  const eng = pickEngineConfig(modeKey, diff);
  const SPAWN_INTERVAL = eng.SPAWN_INTERVAL;
  const ITEM_LIFETIME = eng.ITEM_LIFETIME;
  const MAX_ACTIVE = eng.MAX_ACTIVE;

  // ขนาดเป้า: จาก SIZE_FACTOR หรือ fallback ตามระดับ
  const baseSize =
    eng.SIZE_FACTOR ||
    (diff === 'easy' ? 1.25 : diff === 'hard' ? 0.9 : 1.05);

  let spawnCount = 0;
  let stopped = false;
  let spawnTimer = null;
  let secTimer = null;
  let secLeft = dur;

  let activeTargets = [];

  // ส่ง hha:time ครั้งแรก (sec เริ่มต้น)
  try {
    ROOT.dispatchEvent(
      new CustomEvent('hha:time', { detail: { sec: secLeft } })
    );
  } catch {}

  // ---------- ฟังก์ชัน spawn เป้า ----------
  function spawnOne() {
    if (stopped) return;
    if (activeTargets.length >= MAX_ACTIVE) return;

    const pick = pickChar(
      pools,
      goodRate,
      powerups,
      powerRate,
      powerEvery,
      spawnCount
    );
    spawnCount++;

    const tCfg = {
      ch: pick.ch,
      isGood: pick.isGood,
      lifeMs: ITEM_LIFETIME,
      sizeFactor: baseSize
    };

    let target = null;

    target = createVrTarget(vrRoot, tCfg, {
      onHit: ({ ch, isGood, ctx, kill }) => {
        if (judgeFn) {
          try {
            judgeFn(ch, ctx);
          } catch (err) {
            console.warn('[HHA] judgeFn error:', err);
          }
        }
        kill();
        activeTargets = activeTargets.filter((t) => t !== target);
      },
      onExpire: (ev) => {
        activeTargets = activeTargets.filter((t) => t !== target);
        onExpireFn && onExpireFn(ev);
      }
    });

    if (target) {
      activeTargets.push(target);
    }
  }

  // ---------- Timer วินาที (hha:time) ----------
  secTimer = setInterval(() => {
    if (stopped) return;
    secLeft -= 1;

    if (secLeft < 0) secLeft = 0;

    try {
      ROOT.dispatchEvent(
        new CustomEvent('hha:time', { detail: { sec: secLeft } })
      );
    } catch {}

    if (secLeft <= 0) {
      // หมดเวลา → หยุดเอง
      stop('timeout');
    }
  }, 1000);

  // ---------- Timer spawn เป้า ----------
  spawnTimer = setInterval(() => {
    if (stopped) return;
    spawnOne();
  }, SPAWN_INTERVAL);

  // spawn รอบแรกไวหน่อย
  setTimeout(() => {
    if (!stopped) spawnOne();
  }, 400);

  // ---------- ฟังก์ชัน stop ทำความสะอาด ----------
  function stop(reason = 'manual') {
    if (stopped) return;
    stopped = true;

    if (spawnTimer) {
      clearInterval(spawnTimer);
      spawnTimer = null;
    }
    if (secTimer) {
      clearInterval(secTimer);
      secTimer = null;
    }

    activeTargets.forEach((t) => {
      try {
        t.kill && t.kill();
      } catch {}
    });
    activeTargets = [];

    // ส่งสัญญาณเวลาจบ (sec = 0) อีกครั้งให้แน่ใจ
    try {
      ROOT.dispatchEvent(
        new CustomEvent('hha:time', { detail: { sec: 0, reason } })
      );
    } catch {}
  }

  return {
    stop
  };
}

export default { boot };
