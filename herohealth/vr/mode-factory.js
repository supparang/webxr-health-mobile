// === /herohealth/vr/mode-factory.js ===
// Generic VR target spawner + shared timer (hha:time)

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// --------------------------------------------------
//  Helper: อ่าน config จาก HHA_DIFF_TABLE (ถ้ามี)
// --------------------------------------------------
function pickEngineConfig(modeKey, diffKey) {
  const safe = {
    SPAWN_INTERVAL: 900,
    ITEM_LIFETIME: 2200,
    MAX_ACTIVE: 4,
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
      SIZE_FACTOR: Number(eng.SIZE_FACTOR) || safe.SIZE_FACTOR
    };
  } catch (err) {
    console.warn('[HHA] pickEngineConfig error:', err);
    return safe;
  }
}

// --------------------------------------------------
//  หา root สำหรับวางเป้า (ผูกกับกล้อง)
// --------------------------------------------------
function ensureVrRoot() {
  const scene = document.querySelector('a-scene');
  if (!scene) {
    console.warn('[HHA] No <a-scene> found');
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
    root.setAttribute('position', '0 0 0');
    cam.appendChild(root);
  }
  return root;
}

// --------------------------------------------------
//  วาด emoji ลง canvas → dataURL
// --------------------------------------------------
function makeEmojiTexture(ch, sizePx = 256) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = sizePx;
    canvas.height = sizePx;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, sizePx, sizePx);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, sizePx, sizePx);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${sizePx * 0.72}px system-ui, "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(ch, sizePx / 2, sizePx / 2);

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[HHA] makeEmojiTexture error:', err);
    return null;
  }
}

// --------------------------------------------------
//  สร้างเป้า VR (emoji ชัด ๆ)
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

  // ===== แผ่นพื้นหลังเบา ๆ =====
  const baseSize = 0.9 * sizeFactor;
  const bg = document.createElement('a-plane');
  bg.setAttribute('width', baseSize);
  bg.setAttribute('height', baseSize);
  bg.setAttribute(
    'material',
    [
      'color: #020617',
      'transparent: true',
      'opacity: 0.28',
      'side: double'
    ].join('; ')
  );
  holder.appendChild(bg);

  // ===== emoji เป็น texture =====
  const texUrl = makeEmojiTexture(ch, 256);
  if (texUrl) {
    const img = document.createElement('a-image');
    img.setAttribute('src', texUrl);
    img.setAttribute('width', baseSize * 0.92);
    img.setAttribute('height', baseSize * 0.92);
    img.setAttribute('position', '0 0 0.01');
    img.setAttribute(
      'material',
      [
        'transparent: true',
        'alphaTest: 0.01',
        'side: double'
      ].join('; ')
    );
    holder.appendChild(img);
  }

  // ===== ตำแหน่งหน้า player =====
  const x = -0.8 + Math.random() * 1.6;  // กึ่งกลางหน้ากล้อง
  const y = -0.25 + Math.random() * 0.9;
  const z = -1.6;                         // ใกล้ขึ้นให้เห็นชัด

  holder.setAttribute('position', `${x} ${y} ${z}`);
  // ❌ ไม่ต้องหัน 180 แล้ว เดี๋ยวหันหลังให้กล้อง
  // holder.setAttribute('rotation', '0 180 0');

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

  // === hit (คลิก / tap / raycaster) ===
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
//  random เลือก emoji ตาม good / bad / power-ups
// --------------------------------------------------
function pickChar(pools, goodRate, powerups, powerRate, powerEvery, spawnCount) {
  const good = pools.good || [];
  const bad  = pools.bad  || [];

  const hasPower = Array.isArray(powerups) && powerups.length > 0;

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

  if (good.length > 0) {
    const idx = Math.floor(Math.random() * good.length);
    return { ch: good[idx], isGood: true, isPower: false };
  }

  return { ch: '❓', isGood: false, isPower: false };
}

// --------------------------------------------------
//  boot(cfg) — entry หลัก
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

  const judgeFn = typeof cfg.judge === 'function' ? cfg.judge : null;
  const onExpireFn =
    typeof cfg.onExpire === 'function' ? cfg.onExpire : () => {};

  const vrRoot = ensureVrRoot();
  if (!vrRoot) {
    console.error('[HHA] VR root not found — abort boot');
    return { stop() {} };
  }

  const eng = pickEngineConfig(modeKey, diff);
  const SPAWN_INTERVAL = eng.SPAWN_INTERVAL;
  const ITEM_LIFETIME = eng.ITEM_LIFETIME;
  const MAX_ACTIVE = eng.MAX_ACTIVE;

  const baseSize =
    eng.SIZE_FACTOR ||
    (diff === 'easy' ? 1.25 : diff === 'hard' ? 0.9 : 1.05);

  let spawnCount = 0;
  let stopped = false;
  let spawnTimer = null;
  let secTimer = null;
  let secLeft = dur;

  let activeTargets = [];

  // แจ้งเวลาเริ่ม
  try {
    ROOT.dispatchEvent(
      new CustomEvent('hha:time', { detail: { sec: secLeft } })
    );
  } catch {}

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

    const target = createVrTarget(vrRoot, tCfg, {
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

    if (target) activeTargets.push(target);
  }

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
      stop('timeout');
    }
  }, 1000);

  spawnTimer = setInterval(() => {
    if (stopped) return;
    spawnOne();
  }, SPAWN_INTERVAL);

  setTimeout(() => {
    if (!stopped) spawnOne();
  }, 400);

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

    try {
      ROOT.dispatchEvent(
        new CustomEvent('hha:time', { detail: { sec: 0, reason } })
      );
    } catch {}
  }

  return { stop };
}

export default { boot };
