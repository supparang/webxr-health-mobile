// === /herohealth/vr/mode-factory.js ===
// Hero Health — DOM Target Factory (Adaptive)
// ใช้กับ GoodJunk / Hydration / Plate / Groups ฯลฯ แบบ DOM
//
// คุณสมบัติ:
// - spawn เป้า emoji ตาม pools ที่ส่งเข้ามา
// - ขนาดเป้าผูกกับระดับความยาก easy / normal / hard
// - Adaptive: แม่นต่อเนื่อง → เป้าเล็กลง & จำนวนเป้าในจอเพิ่ม
//              พลาดติด ๆ → เป้าใหญ่ขึ้น & จำนวนเป้าลดลง
//
// เรียกใช้งานจากเกมด้วย:
//   import { boot as factoryBoot } from '../vr/mode-factory.js';
//   const ctrl = await factoryBoot({ ... });
//
// options หลัก:
//   difficulty: 'easy' | 'normal' | 'hard'
//   pools: { good: [...], bad: [...] }
//   goodRate: 0–1   // โอกาสได้ good เมื่อไม่ใช่ powerup
//   powerups: [emoji...]
//   powerRate: 0–1  // โอกาสสุ่ม powerup
//   powerEvery: n   // บังคับให้มี powerup ทุก ๆ n เป้า (กันดวงกุด)
//   judge(ch, ctx)  // ฟังก์ชันของเกม (ต้อง return { good: true/false, ... })
//   onExpire(ev)    // เรียกเมื่อเป้าหมดเวลา ev = { ch, isGood }

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const DOC  = ROOT.document;

// ถ้าไม่มี DOM ก็ไม่ทำอะไร
if (!DOC) {
  console.warn('[mode-factory] document not found (non-browser env)');
}

/**
 * พรีเซ็ตความยากสำหรับ DOM target
 * - baseScale: ขนาดเป้าเริ่มต้น (1 = ขนาดปกติจาก CSS)
 * - spawnInterval: ช่วงเวลาระหว่าง spawn เป้า (ms)
 * - baseMaxActive: จำนวนเป้าในจอเริ่มต้น
 * - min/maxActive: ขอบเขต adaptive สำหรับจำนวนเป้า
 * - min/maxScale: ขอบเขต adaptive สำหรับขนาดเป้า
 */
const DIFF_PRESET = {
  easy: {
    spawnInterval: 950,
    baseScale: 1.15, // เป้าใหญ่กว่า
    minScale: 0.85,
    maxScale: 1.4,
    baseMaxActive: 3,
    minActive: 2,
    maxActive: 5
  },
  normal: {
    spawnInterval: 820,
    baseScale: 1.0,
    minScale: 0.8,
    maxScale: 1.25,
    baseMaxActive: 4,
    minActive: 2,
    maxActive: 6
  },
  hard: {
    spawnInterval: 720,
    baseScale: 0.9, // เป้าเล็กลง
    minScale: 0.75,
    maxScale: 1.1,
    baseMaxActive: 5,
    minActive: 3,
    maxActive: 7
  }
};

function pickRandom(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

// สร้างเลเยอร์สำหรับ target ถ้ายังไม่มี
function ensureTargetLayer() {
  let layer = DOC.querySelector('.hha-target-layer');
  if (!layer) {
    layer = DOC.createElement('div');
    layer.className = 'hha-target-layer';
    Object.assign(layer.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: 360,
      overflow: 'hidden'
    });
    DOC.body.appendChild(layer);
  }
  return layer;
}

/**
 * boot(config)
 * คืนค่า controller:
 *   { stop() }
 */
export async function boot(config = {}) {
  if (!DOC) return { stop() {} };

  const diffKeyRaw = String(config.difficulty || 'normal').toLowerCase();
  const diffKey = (diffKeyRaw === 'easy' || diffKeyRaw === 'hard' || diffKeyRaw === 'normal')
    ? diffKeyRaw
    : 'normal';

  const preset = DIFF_PRESET[diffKey] || DIFF_PRESET.normal;

  const goodPool = (config.pools && config.pools.good) || ['🍎'];
  const badPool  = (config.pools && config.pools.bad)  || ['🍔'];

  const goodRate   = typeof config.goodRate === 'number' ? config.goodRate : 0.7;
  const powerups   = Array.isArray(config.powerups) ? config.powerups : [];
  const powerRate  = typeof config.powerRate === 'number' ? config.powerRate : 0.1;
  const powerEvery = Number.isFinite(config.powerEvery) ? Math.max(1, config.powerEvery) : 7;

  const judgeFn   = (typeof config.judge === 'function') ? config.judge : () => ({ good: false });
  const onExpire  = (typeof config.onExpire === 'function') ? config.onExpire : null;

  const layer = ensureTargetLayer();

  // ===== Adaptive state =====
  let targetScale      = preset.baseScale;
  let maxActiveCurrent = preset.baseMaxActive;
  const minScale       = preset.minScale;
  const maxScale       = preset.maxScale;
  const minActive      = preset.minActive;
  const maxActive      = preset.maxActive;

  let hitStreak  = 0;
  let missStreak = 0;
  let totalSpawn = 0;

  // active targets ในจอ
  const activeTargets = new Set();

  let spawnTimer = null;
  let stopped    = false;

  function applyAdaptiveHit() {
    hitStreak += 1;
    missStreak = 0;

    // ทุก ๆ 5 hit ต่อเนื่อง → เพิ่มความท้าทาย
    if (hitStreak > 0 && hitStreak % 5 === 0) {
      // เป้าเล็กลง
      targetScale = Math.max(minScale, targetScale * 0.92);
      // จำนวนเป้าในจอเพิ่ม
      maxActiveCurrent = Math.min(maxActive, maxActiveCurrent + 1);

      // debug log (ถ้าต้องการดูใน console)
      if (ROOT.console && console.debug) {
        console.debug('[mode-factory] adaptive harder', {
          targetScale,
          maxActiveCurrent
        });
      }
    }
  }

  function applyAdaptiveMiss() {
    missStreak += 1;
    hitStreak = 0;

    // ถ้าพลาดติดกัน 2 ครั้ง → ผ่อนให้หน่อย
    if (missStreak >= 2) {
      targetScale = Math.min(maxScale, targetScale * 1.1);
      maxActiveCurrent = Math.max(minActive, maxActiveCurrent - 1);
      missStreak = 0;

      if (ROOT.console && console.debug) {
        console.debug('[mode-factory] adaptive easier', {
          targetScale,
          maxActiveCurrent
        });
      }
    }
  }

  function removeTarget(targetObj) {
    if (!targetObj) return;
    activeTargets.delete(targetObj);
    if (targetObj.el && targetObj.el.parentNode) {
      targetObj.el.parentNode.removeChild(targetObj.el);
    }
    if (targetObj.expireTimer != null) {
      clearTimeout(targetObj.expireTimer);
    }
  }

  function spawnTarget() {
    if (stopped) return;
    if (activeTargets.size >= maxActiveCurrent) return;

    totalSpawn += 1;

    // ตัดสินว่าจะเป็น powerup, good, หรือ bad
    let ch = null;
    let isGood = true;
    let isPower = false;

    // powerup priority: ทุก ๆ powerEvery ครั้ง หรือ random จาก powerRate
    if (powerups.length &&
        ((totalSpawn % powerEvery) === 0 || Math.random() < powerRate)) {
      ch = pickRandom(powerups);
      isGood = true;
      isPower = true;
    } else {
      const pickGood = Math.random() < goodRate;
      isGood = pickGood;
      const pool = pickGood ? goodPool : badPool;
      ch = pickRandom(pool);
    }

    if (!ch) return;

    const el = DOC.createElement('div');
    el.className = 'hha-target ' + (isGood ? 'hha-target-good' : 'hha-target-bad');
    el.textContent = ch;

    // ตำแหน่งสุ่ม (หลบ HUD ด้านบน/ล่างนิดหน่อย)
    const vw = ROOT.innerWidth  || 1280;
    const vh = ROOT.innerHeight || 720;

    const marginTop    = vh * 0.18;
    const marginBottom = vh * 0.16;
    const marginSide   = vw * 0.08;

    const x = marginSide + Math.random() * (vw - marginSide * 2);
    const y = marginTop  + Math.random() * (vh - marginTop - marginBottom);

    const baseSize = 68; // อ้างอิงจาก CSS เดิม
    const size = baseSize * targetScale;

    Object.assign(el.style, {
      left: x + 'px',
      top: y + 'px',
      width: size + 'px',
      height: size + 'px',
      fontSize: (size * 0.62) + 'px'
    });

    // ทำให้คลิกได้
    el.style.pointerEvents = 'auto';
    el.style.cursor = 'pointer';

    const targetObj = {
      el,
      ch,
      isGood,
      isPower,
      expireTimer: null
    };

    // อายุของเป้า (ms) — ยากขึ้น = มีเวลาให้น้อยลงนิดหน่อย
    const lifeBase = 1350;
    const life =
      diffKey === 'easy'   ? lifeBase + 250 :
      diffKey === 'hard'   ? lifeBase - 150 :
                             lifeBase;

    targetObj.expireTimer = ROOT.setTimeout(() => {
      // หมดเวลา
      removeTarget(targetObj);
      if (onExpire) {
        try {
          onExpire({ ch, isGood });
        } catch (err) {
          console.warn('[mode-factory] onExpire error', err);
        }
      }
    }, life);

    // handler ตอนโดนตี
    function handleHit(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      removeTarget(targetObj);

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;

      let result = null;
      try {
        result = judgeFn(ch, {
          event: ev,
          clientX: ev.clientX,
          clientY: ev.clientY,
          cx,
          cy,
          isGood,
          isPower
        });
      } catch (err) {
        console.error('[mode-factory] judge error', err);
      }

      const good = !!(result && result.good);

      if (good) {
        applyAdaptiveHit();
      } else {
        applyAdaptiveMiss();
      }
    }

    el.addEventListener('click', handleHit);
    el.addEventListener('pointerdown', handleHit);

    activeTargets.add(targetObj);
    layer.appendChild(el);
  }

  function startSpawnLoop() {
    const interval = preset.spawnInterval;
    spawnTimer = ROOT.setInterval(spawnTarget, interval);
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    if (spawnTimer != null) {
      clearInterval(spawnTimer);
      spawnTimer = null;
    }
    // ลบเป้าค้างทั้งหมด
    for (const t of activeTargets) {
      if (t.expireTimer != null) clearTimeout(t.expireTimer);
      if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
    }
    activeTargets.clear();
  }

  startSpawnLoop();

  // controller ที่เกมฝั่งบนจะใช้
  const ctrl = {
    stop,
    // debug optional: ใช้จาก console ได้
    _debugAdaptive() {
      return {
        diffKey,
        targetScale,
        maxActiveCurrent,
        hitStreak,
        missStreak
      };
    }
  };

  return ctrl;
}

export default { boot };