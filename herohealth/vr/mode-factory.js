// === /herohealth/vr/mode-factory.js ===
// Emoji Target Factory สำหรับ VR ทั้งชุด HeroHealth
// สร้างเป้าแบบ DOM (.hha-target) โผล่มาแล้วหายไป ไม่หล่นลงมาแบบ 3D mesh

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// ค่าพื้นฐานตามระดับความยาก
const DIFF_CFG = {
  easy: {
    spawnInterval: 1200, // ms ระยะห่างการเกิดเป้า
    maxActive: 4,
    lifeMs: 2300        // อายุเป้าก่อนถือว่าหลุด (expire)
  },
  normal: {
    spawnInterval: 900,
    maxActive: 5,
    lifeMs: 2100
  },
  hard: {
    spawnInterval: 720,
    maxActive: 6,
    lifeMs: 1900
  }
};

function randBetween(min, max) {
  return min + Math.random() * (max - min);
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function boot(opts = {}) {
  const diffRaw = String(opts.difficulty || 'normal').toLowerCase();
  const diffKey =
    diffRaw === 'easy' || diffRaw === 'hard' || diffRaw === 'normal'
      ? diffRaw
      : 'normal';

  const cfg = DIFF_CFG[diffKey];

  const pools = opts.pools || {};
  const goods = Array.isArray(pools.good) ? pools.good.slice() : [];
  const bads  = Array.isArray(pools.bad)  ? pools.bad.slice()  : [];

  const powerups   = Array.isArray(opts.powerups) ? opts.powerups.slice() : [];
  const goodRate   = typeof opts.goodRate === 'number' ? opts.goodRate : 0.7;
  const powerRate  = typeof opts.powerRate === 'number' ? opts.powerRate : 0; // ถ้าอยากสุ่ม power ให้ใช้ rate นี้
  const powerEvery = typeof opts.powerEvery === 'number' ? opts.powerEvery : 0;

  const judge    = typeof opts.judge === 'function'   ? opts.judge   : () => ({});
  const onExpire = typeof opts.onExpire === 'function'? opts.onExpire: () => {};

  let timerId = null;
  let idCounter = 0;
  let totalSpawned = 0;
  const active = new Map();  // id -> { el, expireTimer, ... }

  function spawnOne() {
    if (!ROOT.document) return;
    if (active.size >= cfg.maxActive) return;

    const hasGood = goods.length > 0;
    const hasBad  = bads.length > 0;
    const hasPow  = powerups.length > 0;

    if (!hasGood && !hasBad && !hasPow) return;

    let ch;
    let isGood = true;
    let isPower = false;

    // ---- เลือก power-up เป็นระยะ ๆ ----
    if (hasPow && powerEvery > 0 && totalSpawned > 0 &&
        (totalSpawned % powerEvery) === 0) {
      ch = pick(powerups);
      isGood = true;
      isPower = true;
    } else {
      const r = Math.random();
      if (r < powerRate && hasPow) {
        ch = pick(powerups);
        isGood = true;
        isPower = true;
      } else if (r < goodRate && hasGood) {
        ch = pick(goods);
        isGood = true;
      } else if (hasBad) {
        ch = pick(bads);
        isGood = false;
      } else if (hasGood) {
        ch = pick(goods);
        isGood = true;
      } else {
        ch = pick(powerups);
        isGood = true;
        isPower = true;
      }
    }

    totalSpawned++;
    const id = ++idCounter;

    // ==== สร้าง DOM เป้า ====
    const el = ROOT.document.createElement('div');
    el.className = 'hha-target ' + (isGood ? 'hha-target-good' : 'hha-target-bad');
    el.textContent = ch;

    // random ตำแหน่งบนจอ (กันชน HUD + Quest)
    const marginX = 60;
    const marginYTop = 80;
    const marginYBottom = 120;

    const vw = ROOT.innerWidth || 1024;
    const vh = ROOT.innerHeight || 768;

    const x = randBetween(marginX, vw - marginX);
    const y = randBetween(marginYTop, vh - marginYBottom);

    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    // อายุเป้า
    const lifeMs = cfg.lifeMs;
    const expireTimer = ROOT.setTimeout(() => {
      // expire (ถือว่าหลุดจอ ไม่ใช่ miss)
      if (!active.has(id)) return;
      active.delete(id);
      if (el.parentNode) el.parentNode.removeChild(el);
      try {
        onExpire({ id, char: ch, isGood, isPower });
      } catch {}
    }, lifeMs);

    // คลิก = ตีเป้า
    el.addEventListener('click', (ev) => {
      ROOT.clearTimeout(expireTimer);
      if (!active.has(id)) return;
      active.delete(id);
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;

      if (el.parentNode) el.parentNode.removeChild(el);

      try {
        judge(ch, {
          clientX: ev?.clientX ?? cx,
          clientY: ev?.clientY ?? cy,
          cx, cy,
          isGood,
          isPower,
          id
        });
      } catch (err) {
        console.warn('[mode-factory] judge error', err);
      }
    });

    ROOT.document.body.appendChild(el);
    active.set(id, { el, expireTimer, ch, isGood, isPower });
  }

  function start() {
    if (timerId != null) return;
    timerId = ROOT.setInterval(spawnOne, cfg.spawnInterval);
  }

  function stop() {
    if (timerId != null) {
      ROOT.clearInterval(timerId);
      timerId = null;
    }
    // ลบเป้าทิ้งทั้งหมด
    for (const [id, obj] of active.entries()) {
      ROOT.clearTimeout(obj.expireTimer);
      if (obj.el && obj.el.parentNode) {
        obj.el.parentNode.removeChild(obj.el);
      }
    }
    active.clear();
  }

  // เริ่มทำงานเลย
  start();

  return {
    stop,
    // debug ใช้เรียกจาก console ได้
    spawnTest: spawnOne
  };
}

export default { boot };