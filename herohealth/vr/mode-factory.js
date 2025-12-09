// === /herohealth/vr/mode-factory.js ===
// ศูนย์กลางการ spawn เป้า (DOM / VR) + clock กลาง (hha:time)
// ใช้ร่วมกับ goodjunk.safe.js / plate.safe.js / hydration.safe.js ฯลฯ
//
// API:
//   import { boot } from '../vr/mode-factory.js';
//
//   const inst = await boot({
//     difficulty: 'easy' | 'normal' | 'hard',
//     duration:   60,              // วินาที
//     modeKey:    'goodjunk' | 'plate' | 'hydration' | ...,
//     pools:      { good: [...], bad: [...] },
//     goodRate:   0.6,
//     powerups:   [...],           // emoji power-up
//     powerRate:  0.1,
//     powerEvery: 7,
//     spawnStyle: 'pop' | 'fall',  // ตอนนี้เน้น 'pop'
//     judge(ch, ctx) => { ... },   // คืน { good:bool, scoreDelta:number }
//     onExpire(ev)                // เรียกเมื่อเป้าหายเอง (ไม่กด)
//   });
//
//   inst.stop(reason?)

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// ---------- Utils ----------
function dispatch(name, detail) {
  try {
    ROOT.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (e) {
    // noop
  }
}

function clamp(v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function pickEngineConfig(modeKey, diffKey) {
  const table = ROOT.HHA_DIFF_TABLE || null;
  if (!table) return {};
  const byMode = table[modeKey] || null;
  if (!byMode) return {};
  const byDiff = byMode[diffKey] || null;
  if (!byDiff) return {};
  return byDiff.engine || {};
}

// ---------- DOM Target Layer ----------
function ensureDomLayer() {
  let layer = document.querySelector('.hha-target-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'hha-target-layer';
    Object.assign(layer.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: 20
    });
    document.body.appendChild(layer);
  }
  return layer;
}

// ---------- VR Target Root (ติดกับกล้อง) ----------
function ensureVrRoot() {
  const scene = document.querySelector('a-scene');
  if (!scene) return null;

  // กล้องหลัก
  let cam = scene.querySelector('[camera]');
  if (!cam) cam = scene.querySelector('#cam') || scene.querySelector('#camera');
  if (!cam) return null;

  let root = cam.querySelector('[hha-target-root]');
  if (!root) {
    root = document.createElement('a-entity');
    root.setAttribute('hha-target-root', 'true');
    // ให้เป้าอยู่หน้ากล้องเสมอ (local space ของกล้อง)
    root.setAttribute('position', '0 0 0');
    cam.appendChild(root);
  }
  return root;
}

// ---------- สุ่ม emoji / ประเภท ----------
function pickChar(cfg, spawnCount) {
  const { pools, goodRate, powerups, powerRate, powerEvery } = cfg;

  // powerEvery มี priority สูงสุด
  if (powerups && powerups.length && powerEvery > 0 && spawnCount > 0 &&
      spawnCount % powerEvery === 0) {
    const idx = Math.floor(Math.random() * powerups.length);
    return { ch: powerups[idx], type: 'power' };
  }

  // powerRate (โอกาสสุ่ม power-up แบบเปอร์เซนต์)
  if (powerups && powerups.length && powerRate > 0) {
    if (Math.random() < powerRate) {
      const idx = Math.floor(Math.random() * powerups.length);
      return { ch: powerups[idx], type: 'power' };
    }
  }

  const useGood = Math.random() < goodRate;
  const pool = useGood ? (pools.good || []) : (pools.bad || []);
  if (!pool.length) {
    return { ch: '?', type: 'neutral' };
  }
  const idx = Math.floor(Math.random() * pool.length);
  return { ch: pool[idx], type: useGood ? 'good' : 'bad' };
}

// ---------- สร้างเป้าแบบ DOM ----------
function createDomTarget(layer, targetCfg, onHit, onExpire) {
  const { ch, lifeMs, isGood } = targetCfg;

  const el = document.createElement('div');
  el.className = 'hha-target';
  el.textContent = ch;
  Object.assign(el.style, {
    position: 'absolute',
    fontSize: '3rem',
    lineHeight: '1',
    userSelect: 'none',
    touchAction: 'manipulation',
    pointerEvents: 'auto',
    cursor: 'pointer',
    transition: 'transform 0.18s ease-out, opacity 0.18s ease-out',
    opacity: '0'
  });

  // สุ่มตำแหน่ง 20–80% ของจอ
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = 0.2 + Math.random() * 0.6;
  const cy = 0.2 + Math.random() * 0.6;

  el.style.left = (cx * w - 24) + 'px';
  el.style.top  = (cy * h - 24) + 'px';

  layer.appendChild(el);

  // animate in
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'scale(1.0)';
  });

  const bornAt = performance.now();
  let killed = false;
  let expireTimer = null;

  function cleanup(reason) {
    if (killed) return;
    killed = true;
    if (expireTimer) clearTimeout(expireTimer);

    el.style.opacity = '0';
    el.style.transform = 'scale(0.5)';
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 180);

    if (reason === 'expire' && typeof onExpire === 'function') {
      onExpire({ ch, isGood, bornAt, lifeMs });
    }
  }

  function handleClick(ev) {
    if (killed) return;
    const rect = el.getBoundingClientRect();
    const ctx = {
      clientX: ev.clientX,
      clientY: ev.clientY,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2
    };
    onHit && onHit(ctx, cleanup);
  }

  el.addEventListener('click', handleClick);
  el.addEventListener('pointerdown', handleClick);

  expireTimer = setTimeout(() => cleanup('expire'), lifeMs);

  return {
    type: 'dom',
    el,
    ch,
    isGood,
    bornAt,
    lifeMs,
    kill: () => cleanup('manual')
  };
}

// ---------- สร้างเป้าแบบ VR (ติดกับกล้อง) ----------
function createVrTarget(root, targetCfg, onHit, onExpire) {
  const { ch, lifeMs, isGood } = targetCfg;

  if (!root) {
    // ถ้าไม่มี root ให้ fallback เป็น DOM layer
    return null;
  }

  const el = document.createElement('a-entity');
  el.classList.add('hha-target-vr');

  // ให้เป็นแผ่นป้าย + text แสดง emoji
  el.setAttribute('geometry', 'primitive: plane; width: 0.6; height: 0.6');
  el.setAttribute('material', 'color: #ffffff; transparent: true; opacity: 0.0');
  el.setAttribute('text', `value: ${ch}; align: center; width: 4; color: #ffffff`);

  // สุ่มตำแหน่งใน local space ของกล้อง
  const x = -0.9 + Math.random() * 1.8; // ซ้าย–ขวา
  const y = -0.3 + Math.random() * 0.9; // ขึ้น–ลง
  const z = -2.4;                       // ระยะห่างหน้ากล้อง

  el.setAttribute('position', `${x} ${y} ${z}`);

  root.appendChild(el);

  const bornAt = performance.now();
  let killed = false;
  let expireTimer = null;

  function cleanup(reason) {
    if (killed) return;
    killed = true;
    if (expireTimer) clearTimeout(expireTimer);
    if (el.parentNode) el.parentNode.removeChild(el);

    if (reason === 'expire' && typeof onExpire === 'function') {
      onExpire({ ch, isGood, bornAt, lifeMs });
    }
  }

  function handleClick() {
    if (killed) return;
    const ctx = {
      // ไม่มี clientX/ClientY ที่ชัดเจนใน VR → ใช้กลางจอแทน
      clientX: window.innerWidth / 2,
      clientY: window.innerHeight / 2,
      cx: window.innerWidth / 2,
      cy: window.innerHeight / 2
    };
    onHit && onHit(ctx, cleanup);
  }

  // รองรับ cursor="rayOrigin: mouse" หรือ controller ที่ยิง event 'click'
  el.addEventListener('click', handleClick);
  el.addEventListener('mouseup', handleClick);

  expireTimer = setTimeout(() => cleanup('expire'), lifeMs);

  return {
    type: 'vr',
    el,
    ch,
    isGood,
    bornAt,
    lifeMs,
    kill: () => cleanup('manual')
  };
}

// ======================================================
//  boot(cfg) — main
// ======================================================

export async function boot(cfg = {}) {
  const diffKey = String(cfg.difficulty || 'normal').toLowerCase();
  const modeKey = String(cfg.modeKey || 'goodjunk');

  // ---- ค่าจาก HHA_DIFF_TABLE (ถ้ามี) + cfg ----
  const engineCfg = pickEngineConfig(modeKey, diffKey);

  const SPAWN_INTERVAL = clamp(
    cfg.spawnInterval || engineCfg.SPAWN_INTERVAL || 1100,
    250,
    4000
  );
  const ITEM_LIFETIME = clamp(
    cfg.itemLifetime || engineCfg.ITEM_LIFETIME || 2200,
    600,
    8000
  );
  const MAX_ACTIVE = clamp(
    cfg.maxActive || engineCfg.MAX_ACTIVE || 5,
    1,
    15
  );

  const TYPE_WEIGHTS = engineCfg.TYPE_WEIGHTS || {};
  const baseGoodWeight =
    (TYPE_WEIGHTS.good || 0) +
    (TYPE_WEIGHTS.star || 0) +
    (TYPE_WEIGHTS.gold || 0) +
    (TYPE_WEIGHTS.diamond || 0) +
    (TYPE_WEIGHTS.shield || 0) +
    (TYPE_WEIGHTS.fever || 0) +
    (TYPE_WEIGHTS.rainbow || 0);
  const baseBadWeight = TYPE_WEIGHTS.junk || 0;
  const baseTotal = baseGoodWeight + baseBadWeight;

  const goodRate =
    typeof cfg.goodRate === 'number'
      ? clamp(cfg.goodRate, 0, 1)
      : (baseTotal > 0 ? baseGoodWeight / baseTotal : 0.6);

  const powerups = cfg.powerups || [];
  const powerRate =
    typeof cfg.powerRate === 'number'
      ? clamp(cfg.powerRate, 0, 1)
      : (engineCfg.POWER_RATE || 0.12);

  const powerEvery =
    typeof cfg.powerEvery === 'number'
      ? Math.max(0, cfg.powerEvery | 0)
      : (engineCfg.POWER_EVERY || 0);

  const durationSec = clamp(cfg.duration || 60, 10, 300);

  const spawnStyle = cfg.spawnStyle || 'pop';
  const judge = typeof cfg.judge === 'function'
    ? cfg.judge
    : () => ({ good: false, scoreDelta: 0 });

  const onExpire = typeof cfg.onExpire === 'function'
    ? cfg.onExpire
    : null;

  const pools = {
    good: Array.isArray(cfg.pools?.good) ? cfg.pools.good.slice() : [],
    bad: Array.isArray(cfg.pools?.bad) ? cfg.pools.bad.slice() : []
  };

  // ---- ตรวจว่าอยู่ในโหมด VR หรือ DOM ----
  const scene = (typeof document !== 'undefined')
    ? document.querySelector('a-scene')
    : null;
  const isVR = !!scene;

  const domLayer = !isVR ? ensureDomLayer() : null;
  const vrRoot   = isVR ? ensureVrRoot() : null;

  const targets = new Set();
  let spawnCount = 0;
  let stopped = false;

  function clearAllTargets() {
    for (const t of targets) {
      try {
        t.kill && t.kill();
      } catch {}
    }
    targets.clear();
  }

  function spawnOne() {
    if (stopped) return;
    if (targets.size >= MAX_ACTIVE) return;

    const pick = pickChar(
      { pools, goodRate, powerups, powerRate, powerEvery },
      spawnCount++
    );

    const isGood = pick.type === 'good' || pick.type === 'power';

    const baseCfg = {
      ch: pick.ch,
      lifeMs: ITEM_LIFETIME,
      isGood
    };

    function onHit(ctx, cleanup) {
      if (stopped) return;
      const res = judge(pick.ch, {
        ...ctx,
        isGood,
        modeKey,
        difficulty: diffKey
      }) || {};

      // ให้ mode เป็นคนจัดการ miss / score เอง
      // ที่นี่แค่ยิง event ให้ logger ถ้าต้องการ
      dispatch('hha:hit', {
        ch: pick.ch,
        isGood,
        scoreDelta: res.scoreDelta || 0,
        good: !!res.good,
        modeKey,
        difficulty: diffKey
      });

      cleanup('hit');
      targets.delete(targetObj);
    }

    let targetObj = null;

    if (isVR && vrRoot) {
      targetObj = createVrTarget(vrRoot, baseCfg, onHit, onExpire);
      if (!targetObj && domLayer) {
        // fallback DOM ถ้า createVrTarget ไม่ได้
        targetObj = createDomTarget(domLayer, baseCfg, onHit, onExpire);
      }
    } else if (domLayer) {
      targetObj = createDomTarget(domLayer, baseCfg, onHit, onExpire);
    }

    if (targetObj) {
      targets.add(targetObj);
      dispatch('hha:spawn', {
        ch: pick.ch,
        isGood,
        modeKey,
        difficulty: diffKey
      });
    }
  }

  // ---------- Spawn timer ----------
  let spawnTimer = null;
  if (SPAWN_INTERVAL > 0) {
    spawnTimer = setInterval(spawnOne, SPAWN_INTERVAL);
    // เรียกครั้งแรกทันที
    spawnOne();
  }

  // ---------- Global clock: hha:time ----------
  let timeRemain = durationSec;
  dispatch('hha:time', { sec: timeRemain }); // initial

  const timeTimer = setInterval(() => {
    if (stopped) return;
    timeRemain -= 1;
    if (timeRemain > 0) {
      dispatch('hha:time', { sec: timeRemain });
    } else {
      // ส่ง 0 แล้วจบเกม
      dispatch('hha:time', { sec: 0 });
      clearInterval(timeTimer);
      if (spawnTimer) clearInterval(spawnTimer);
      stopped = true;
      clearAllTargets();
      dispatch('hha:stop', { reason: 'timeup', modeKey, difficulty: diffKey });
    }
  }, 1000);

  // ---------- Inst interface ----------
  function stop(reason = 'manual') {
    if (stopped) return;
    stopped = true;
    if (spawnTimer) clearInterval(spawnTimer);
    if (timeTimer) clearInterval(timeTimer);
    clearAllTargets();
    dispatch('hha:stop', { reason, modeKey, difficulty: diffKey });
  }

  return {
    stop
  };
}

export default { boot };
