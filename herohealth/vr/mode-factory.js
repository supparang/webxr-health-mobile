// === /herohealth/vr/mode-factory.js ===
// Generic target spawner for Hero Health VR (Hydration VR ฯลฯ)
// - ใช้กับ A-Frame (VR) ได้ และ fallback เป็น DOM ได้
// - อ่านค่าความยากจาก HHA_DIFF_TABLE ถ้ามี
// - เรียก cfg.judge(ch, ctx) ทุกครั้งที่ผู้เล่นตีเป้าโดน

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const A = ROOT.AFRAME || null;

// -------------------------------------------------------
// 1) เลือก config ด้าน engine ตาม diff + modeKey
// -------------------------------------------------------
function pickEngineConfig(cfg) {
  const diff = String(cfg.difficulty || 'normal').toLowerCase();
  const modeKey = cfg.modeKey || 'hydration';

  const base = {
    SPAWN_INTERVAL: 900,   // ms
    ITEM_LIFETIME: 2400,   // ms
    MAX_ACTIVE: 4,
    SIZE_FACTOR: 1.0,
    TYPE_WEIGHTS: { good: 70, bad: 30 }
  };

  try {
    const table = ROOT.HHA_DIFF_TABLE && ROOT.HHA_DIFF_TABLE[modeKey];
    const row   = table && table[diff];
    const eng   = row && row.engine;
    if (!eng) return base;

    return {
      SPAWN_INTERVAL: eng.SPAWN_INTERVAL ?? base.SPAWN_INTERVAL,
      ITEM_LIFETIME:  eng.ITEM_LIFETIME  ?? base.ITEM_LIFETIME,
      MAX_ACTIVE:     eng.MAX_ACTIVE     ?? base.MAX_ACTIVE,
      SIZE_FACTOR:    eng.SIZE_FACTOR    ?? base.SIZE_FACTOR,
      TYPE_WEIGHTS:   eng.TYPE_WEIGHTS   || base.TYPE_WEIGHTS
    };
  } catch (err) {
    console.warn('[HHA mode-factory] pickEngineConfig error', err);
    return base;
  }
}

// -------------------------------------------------------
// 2) random ตาม weight + เลือก emoji จริง
// -------------------------------------------------------
function pickFromWeights(weights, fallbackList, rnd = Math.random) {
  if (!weights) {
    const list = fallbackList || [];
    if (!list.length) return null;
    return list[Math.floor(rnd() * list.length)];
  }
  let total = 0;
  for (const k in weights) total += Math.max(0, Number(weights[k]) || 0);
  if (total <= 0) return null;

  let r = rnd() * total;
  for (const k in weights) {
    const w = Math.max(0, Number(weights[k]) || 0);
    if (!w) continue;
    if (r < w) return k;
    r -= w;
  }
  return null;
}

// type key -> actual char (ใช้ pools จาก cfg)
function pickCharForType(type, cfg) {
  const pools = cfg.pools || {};
  if (type === 'good') {
    const arr = pools.good || [];
    if (!arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }
  if (type === 'bad' || type === 'junk') {
    const arr = pools.bad || [];
    if (!arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }
  const powerups = cfg.powerups || [];
  if (!powerups.length) return null;
  return powerups[Math.floor(Math.random() * powerups.length)];
}

// -------------------------------------------------------
// 3) สร้างเป้าแบบ VR (A-Frame entity)
// -------------------------------------------------------
function createVrTarget(sceneEl, ch, cfg, engineCfg) {
  const goodPool = cfg.pools?.good || [];
  const badPool  = cfg.pools?.bad  || [];

  const sizeBase = 0.9; // หน่วยเป็นเมตร
  const size = sizeBase * (engineCfg.SIZE_FACTOR || 1.0);

  const el = document.createElement('a-entity');
  el.classList.add('hha-target-vr');
  el.setAttribute('data-hha-tgt', '1');
  el.setAttribute('data-char', ch);

  // ตำแหน่งสุ่มด้านหน้า player
  const x = (Math.random() * 2 - 1) * 1.4;   // -1.4..1.4
  const y = 1.4 + (Math.random() * 0.8 - 0.4);
  const z = -3.0;
  el.setAttribute('position', `${x} ${y} ${z}`);

  // ทำ plane + emoji text ให้เห็นใน VR ชัด ๆ
  el.setAttribute('geometry',
    `primitive: plane; width: ${size}; height: ${size}`);
  el.setAttribute(
    'material',
    'shader: flat; color: #ffffff; transparent: true; opacity: 0.0'
  );
  el.setAttribute('text', {
    value: ch,
    align: 'center',
    color: '#ffffff',
    width: 4,
    baseline: 'center',
  });

  // เงาด้านหลังนิดหน่อย (optional)
  const plate = document.createElement('a-plane');
  plate.setAttribute('width', size * 1.08);
  plate.setAttribute('height', size * 1.08);
  plate.setAttribute('position', '0 0 -0.01');
  plate.setAttribute(
    'material',
    'color: #020617; opacity: 0.0; shader: flat'
  );
  el.appendChild(plate);

  // === คลิกแล้วเรียก judge() ===
  const judgeFn = cfg.judge || (() => {});
  el.addEventListener('click', (ev) => {
    const intersection = ev.detail && ev.detail.intersection;
    const p = intersection && intersection.point;
    const ctx = {
      char: ch,
      isGood: goodPool.includes(ch),
      isBad:  badPool.includes(ch),
      // พิกัดสำหรับ effect 2D (ถ้า Particles ใช้ clientX/clientY)
      clientX: ROOT.innerWidth  / 2,
      clientY: ROOT.innerHeight / 2,
      cx: ROOT.innerWidth  / 2,
      cy: ROOT.innerHeight / 2,
      worldX: p?.x,
      worldY: p?.y,
      worldZ: p?.z
    };
    judgeFn(ch, ctx);
  });

  sceneEl.appendChild(el);
  return el;
}

// -------------------------------------------------------
// 4) Fallback DOM target (เผื่อใช้ในหน้า non-VR)
// -------------------------------------------------------
function createDomTarget(ch, cfg, engineCfg) {
  const goodPool = cfg.pools?.good || [];
  const badPool  = cfg.pools?.bad  || [];

  const wrap = document.body;
  const size = 96 * (engineCfg.SIZE_FACTOR || 1.0);

  const el = document.createElement('div');
  el.className = 'hha-target-dom';
  el.dataset.char = ch;

  el.style.position = 'fixed';
  el.style.width = el.style.height = size + 'px';
  el.style.fontSize = size * 0.75 + 'px';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.borderRadius = '999px';
  el.style.background = 'rgba(15,23,42,0.9)';
  el.style.boxShadow = '0 18px 35px rgba(0,0,0,0.55)';
  el.style.zIndex = 400;

  const x = 0.5 + (Math.random() * 0.6 - 0.3);
  const y = 0.4 + (Math.random() * 0.4 - 0.2);
  el.style.left = (x * 100) + '%';
  el.style.top  = (y * 100) + '%';
  el.style.transform = 'translate(-50%, -50%)';

  el.textContent = ch;

  const judgeFn = cfg.judge || (() => {});
  el.addEventListener('click', (ev) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;
    const ctx = {
      char: ch,
      isGood: goodPool.includes(ch),
      isBad:  badPool.includes(ch),
      clientX: ev.clientX,
      clientY: ev.clientY,
      cx,
      cy
    };
    judgeFn(ch, ctx);
  });

  wrap.appendChild(el);
  return el;
}

// -------------------------------------------------------
// 5) main boot()
// -------------------------------------------------------
export async function boot(cfg = {}) {
  const engineCfg = pickEngineConfig(cfg);
  const onExpire  = cfg.onExpire || (() => {});

  const isVr   = !!(A && document.querySelector('a-scene'));
  const sceneEl = isVr ? document.querySelector('a-scene') : null;

  const active = new Set();
  let stopped  = false;

  function destroyTarget(el, reason) {
    if (!el) return;
    active.delete(el);

    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }

    if (reason === 'expire') {
      const ch = el.getAttribute
        ? (el.getAttribute('data-char') || el.dataset?.char)
        : (el.dataset && el.dataset.char);
      const pools = cfg.pools || {};
      const isGood = (pools.good || []).includes(ch);
      onExpire({ char: ch, isGood });
    }
  }

  function spawnOne() {
    if (stopped) return;
    if (active.size >= (engineCfg.MAX_ACTIVE || 4)) return;

    // เลือกประเภทเป้า
    let typeKey = pickFromWeights(engineCfg.TYPE_WEIGHTS, null);
    if (!typeKey) typeKey = 'good';
    if (typeKey === 'junk') typeKey = 'bad';

    const ch = pickCharForType(typeKey, cfg);
    if (!ch) return;

    const el = isVr
      ? createVrTarget(sceneEl, ch, cfg, engineCfg)
      : createDomTarget(ch, cfg, engineCfg);

    active.add(el);

    // อายุของเป้า
    const life = engineCfg.ITEM_LIFETIME || 2400;
    setTimeout(() => {
      if (!stopped && active.has(el)) {
        destroyTarget(el, 'expire');
      }
    }, life);
  }

  const interval = engineCfg.SPAWN_INTERVAL || 900;
  const timerId = setInterval(spawnOne, interval);

  function stop(reason = 'manual') {
    if (stopped) return;
    stopped = true;

    clearInterval(timerId);
    active.forEach(el => destroyTarget(el, 'cleanup'));
    active.clear();
  }

  // คืน object ให้ GameEngine เก็บไว้เรียก stop()
  return { stop };
}

export default { boot };
