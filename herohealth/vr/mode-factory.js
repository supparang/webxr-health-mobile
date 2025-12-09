// === /herohealth/vr/mode-factory.js ===
// ศูนย์กลางการ spawn เป้า (DOM / VR) + clock กลาง (hha:time)

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// ---------- Utils ----------
function dispatch(name, detail) {
  try { ROOT.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
}

function clamp(v, min, max) {
  v = Number(v) || 0;
  return Math.min(Math.max(v, min), max);
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

// ---------- VR Target Root (ผูกกับกล้องให้เป้าหมุนตาม) ----------
function ensureVrRoot() {
  const scene = document.querySelector('a-scene');
  if (!scene) return null;

  let cam = scene.querySelector('[camera]');
  if (!cam) cam = scene.querySelector('#cam') || scene.querySelector('#camera');
  if (!cam) return null;

  let root = cam.querySelector('[hha-target-root]');
  if (!root) {
    root = document.createElement('a-entity');
    root.setAttribute('hha-target-root', 'true');
    root.setAttribute('position', '0 0 0');
    cam.appendChild(root);
  }
  return root;
}

// ---------- สุ่ม emoji ----------
function pickChar(cfg, spawnCount) {
  const { pools, goodRate, powerups, powerRate, powerEvery } = cfg;

  if (powerups?.length && powerEvery > 0 &&
      spawnCount > 0 && spawnCount % powerEvery === 0) {
    const idx = Math.floor(Math.random() * powerups.length);
    return { ch: powerups[idx], type: 'power' };
  }

  if (powerups?.length && powerRate > 0 && Math.random() < powerRate) {
    const idx = Math.floor(Math.random() * powerups.length);
    return { ch: powerups[idx], type: 'power' };
  }

  const useGood = Math.random() < goodRate;
  const pool = useGood ? (pools.good || []) : (pools.bad || []);
  if (!pool.length) {
    return { ch: '❔', type: useGood ? 'good' : 'bad' };
  }
  const idx = Math.floor(Math.random() * pool.length);
  return { ch: pool[idx], type: useGood ? 'good' : 'bad' };
}

// ---------- DOM Target ----------
function createDomTarget(layer, targetCfg, onHit, onExpire) {
  const { ch, lifeMs, isGood, sizeFactor = 1 } = targetCfg;

  const el = document.createElement('div');
  el.className = 'hha-target';
  el.textContent = ch;

  const baseFont = 3;
  Object.assign(el.style, {
    position: 'absolute',
    fontSize: `${baseFont * sizeFactor}rem`,
    lineHeight: '1',
    userSelect: 'none',
    pointerEvents: 'auto',
    cursor: 'pointer',
    opacity: '0',
    transform: 'scale(0.6)',
    transition: 'transform .18s ease-out, opacity .18s ease-out'
  });

  const w = window.innerWidth;
  const h = window.innerHeight;
  el.style.left = (0.2 + Math.random() * 0.6) * w + 'px';
  el.style.top  = (0.2 + Math.random() * 0.6) * h + 'px';

  layer.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'scale(1)';
  });

  let killed = false;
  const bornAt = performance.now();

  const cleanup = (reason) => {
    if (killed) return;
    killed = true;
    el.style.opacity = '0';
    el.style.transform = 'scale(0.4)';
    setTimeout(() => el.remove(), 180);
    if (reason === 'expire') {
      onExpire?.({ ch, isGood, bornAt, lifeMs });
    }
  };

  const hit = (ev) => {
    if (killed) return;
    const rect = el.getBoundingClientRect();
    const ctx = {
      clientX: ev.clientX,
      clientY: ev.clientY,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2
    };
    onHit?.(ctx, cleanup);
  };

  el.addEventListener('click', hit);
  setTimeout(() => cleanup('expire'), lifeMs);

  return {
    el,
    ch,
    isGood,
    kill: () => cleanup('manual')
  };
}

// ---------- VR Target (emoji ชัด ๆ หน้าแค่กล้อง) ----------
function createVrTarget(root, targetCfg, onHit, onExpire) {
  const { ch, lifeMs, isGood, sizeFactor = 1 } = targetCfg;
  if (!root) return null;

  const holder = document.createElement('a-entity');
  holder.classList.add('hha-target-vr');

  const plane = document.createElement('a-entity');
  const w = 0.7 * sizeFactor;
  const h = 0.7 * sizeFactor;

  plane.setAttribute('geometry', `primitive: plane; width: ${w}; height: ${h}`);
  // ให้เห็นเป็นกรอบบาง ๆ โปร่งใส ไม่บัง emoji
  plane.setAttribute(
    'material',
    'color: #020617; transparent: true; opacity: 0.18; side: double'
  );

  const text = document.createElement('a-entity');
  const textW = 4 * sizeFactor;
  text.setAttribute(
    'text',
    `value: ${ch}; align: center; width: ${textW}; color: #ffffff; anchor: center; baseline: center`
  );
  text.setAttribute('position', '0 0 0.01'); // ลอยเลย plane นิดเดียว

  plane.appendChild(text);
  holder.appendChild(plane);

  const x = -0.9 + Math.random() * 1.8;
  const y = -0.3 + Math.random() * 0.9;
  const z = -2.4;
  holder.setAttribute('position', `${x} ${y} ${z}`);

  root.appendChild(holder);

  let killed = false;
  const bornAt = performance.now();

  const cleanup = (reason) => {
    if (killed) return;
    killed = true;
    holder.parentNode && holder.parentNode.removeChild(holder);
    if (reason === 'expire') {
      onExpire?.({ ch, isGood, bornAt, lifeMs });
    }
  };

  const hit = () => {
    if (killed) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const ctx = { clientX: cx, clientY: cy, cx, cy };
    onHit?.(ctx, cleanup);
  };

  holder.addEventListener('click', hit);
  setTimeout(() => cleanup('expire'), lifeMs);

  return {
    el: holder,
    ch,
    isGood,
    kill: () => cleanup('manual')
  };
}

// ======================================================
//  boot(cfg)
// ======================================================

export async function boot(cfg = {}) {
  const diffKey = String(cfg.difficulty || 'normal').toLowerCase();
  const modeKey = String(cfg.modeKey || 'goodjunk');

  const engineCfg = pickEngineConfig(modeKey, diffKey);

  const SIZE_FACTOR =
    typeof cfg.sizeFactor === 'number'
      ? cfg.sizeFactor
      : (engineCfg.SIZE_FACTOR || 1.0);

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
  const baseGood =
    (TYPE_WEIGHTS.good || 0) +
    (TYPE_WEIGHTS.star || 0) +
    (TYPE_WEIGHTS.diamond || 0) +
    (TYPE_WEIGHTS.shield || 0);
  const baseBad = (TYPE_WEIGHTS.junk || 0);
  const total = baseGood + baseBad;

  const goodRate =
    typeof cfg.goodRate === 'number'
      ? clamp(cfg.goodRate, 0, 1)
      : (total > 0 ? baseGood / total : 0.6);

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

  const judge =
    typeof cfg.judge === 'function'
      ? cfg.judge
      : () => ({ good: false, scoreDelta: 0 });

  const onExpire =
    typeof cfg.onExpire === 'function' ? cfg.onExpire : null;

  const pools = {
    good: Array.isArray(cfg.pools?.good) ? cfg.pools.good.slice() : [],
    bad: Array.isArray(cfg.pools?.bad) ? cfg.pools.bad.slice() : []
  };

  const scene = document.querySelector('a-scene');
  const isVR = !!scene;
  const domLayer = !isVR ? ensureDomLayer() : null;
  const vrRoot = isVR ? ensureVrRoot() : null;

  const targets = new Set();
  let spawnCount = 0;
  let stopped = false;

  function clearAllTargets() {
    for (const t of targets) {
      try { t.kill?.(); } catch {}
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
      isGood,
      sizeFactor: SIZE_FACTOR
    };

    let targetObj = null;

    const onHit = (ctx, cleanup) => {
      if (stopped) return;
      const res =
        judge(pick.ch, {
          ...ctx,
          isGood,
          modeKey,
          difficulty: diffKey
        }) || {};
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
    };

    if (isVR && vrRoot) {
      targetObj = createVrTarget(vrRoot, baseCfg, onHit, onExpire);
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

  const spawnTimer = setInterval(spawnOne, SPAWN_INTERVAL);
  spawnOne();

  let timeRemain = durationSec;
  dispatch('hha:time', { sec: timeRemain });

  const timeTimer = setInterval(() => {
    if (stopped) return;
    timeRemain--;
    if (timeRemain > 0) {
      dispatch('hha:time', { sec: timeRemain });
    } else {
      dispatch('hha:time', { sec: 0 });
      clearInterval(spawnTimer);
      clearInterval(timeTimer);
      stopped = true;
      clearAllTargets();
      dispatch('hha:stop', {
        reason: 'timeup',
        modeKey,
        difficulty: diffKey
      });
    }
  }, 1000);

  function stop(reason = 'manual') {
    if (stopped) return;
    stopped = true;
    clearInterval(spawnTimer);
    clearInterval(timeTimer);
    clearAllTargets();
    dispatch('hha:stop', { reason, modeKey, difficulty: diffKey });
  }

  return { stop };
}

export default { boot };
