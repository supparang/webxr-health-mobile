// === /herohealth/vr/mode-factory.js ===
'use strict';

import { HHA_DIFF_TABLE } from './hha-diff-table.js';

// เลือก engine config จากตารางกลาง
function pickEngineConfig (modeKey, diffKey) {
  const table = HHA_DIFF_TABLE[modeKey] || {};
  const row =
    table[diffKey] ||
    table.normal ||
    Object.values(table)[0] || {};   // fallback แถวแรกถ้าไม่เจอ

  return row.engine || {};
}

/**
 * factoryBoot สำหรับเกมตระกูล emoji target
 * safe.js แต่ละโหมดจะเรียกแบบ:
 *
 *   const ctrl = await factoryBoot({
 *     modeKey: 'hydration-vr',
 *     difficulty: diff,
 *     duration: 60,
 *     pools: { good: [...], bad: [...] },
 *     goodRate: 0.65,
 *     powerups: [...],
 *     powerRate: 0.1,
 *     powerEvery: 7,
 *     judge: (ch, ctx) => { ... },
 *     onExpire: (ev) => { ... }
 *   });
 *
 * factory นี้จะไม่ยุ่งกับ rendering โดยตรง
 * แต่จะจัด timing / random เป้า และเรียก callback ที่ส่งมา
 */
export async function boot (opts = {}) {
  const modeKey = String(opts.modeKey || 'goodjunk').toLowerCase();
  const diffKey = String(opts.difficulty || 'normal').toLowerCase();

  const engCfg = pickEngineConfig(modeKey, diffKey);

  const SPAWN_INTERVAL = engCfg.SPAWN_INTERVAL ?? 1000;
  const ITEM_LIFETIME  = engCfg.ITEM_LIFETIME  ?? 2200;
  const MAX_ACTIVE     = engCfg.MAX_ACTIVE     ?? 4;
  const SIZE_FACTOR    = engCfg.SIZE_FACTOR    ?? 1.0;

  const GOOD_RATIO     = engCfg.GOOD_RATIO     ?? (opts.goodRate ?? 0.65);
  const POWER_RATIO    = engCfg.POWER_RATIO    ?? (opts.powerRate ?? 0.10);
  const FEVER_GAIN_HIT = engCfg.FEVER_GAIN_HIT ?? 6;
  const FEVER_DECAY_SEC= engCfg.FEVER_DECAY_SEC?? 5;

  const durationSec = Number(opts.duration || 60) | 0;

  const pools = opts.pools || {};
  const goodPool   = pools.good || [];
  const badPool    = pools.bad  || [];
  const powerups   = opts.powerups || [];
  const powerEvery = opts.powerEvery ?? 7;

  const judge     = typeof opts.judge === 'function' ? opts.judge : () => ({});
  const onExpire  = typeof opts.onExpire === 'function' ? opts.onExpire : () => {};

  // ---------- state ภายใน engine ----------
  let running = true;
  let activeTargets = [];
  let spawnTimer = 0;
  let timeMs = 0;
  let goodCount = 0;
  let powerCount = 0;

  // spawn target ใหม่ (ให้ renderer ฝั่ง safe.js/อื่น ๆ ดัก event เอง)
  function spawnOne () {
    if (activeTargets.length >= MAX_ACTIVE) return;

    const usePower =
      powerups.length &&
      (powerCount % powerEvery === 0) &&
      Math.random() < POWER_RATIO;

    let ch;
    if (usePower) {
      ch = powerups[(Math.random() * powerups.length) | 0];
      powerCount++;
    } else if (Math.random() < GOOD_RATIO) {
      ch = goodPool[(Math.random() * goodPool.length) | 0];
    } else {
      ch = badPool[(Math.random() * badPool.length) | 0];
    }

    if (!ch) return;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const target = {
      id,
      ch,
      born: timeMs,
      life: ITEM_LIFETIME,
      size: SIZE_FACTOR,
      isGood: goodPool.includes(ch),
      isPower: powerups.includes(ch)
    };

    activeTargets.push(target);

    // broadcast event ให้ renderer ถ้าอยากใช้
    try {
      window.dispatchEvent(
        new CustomEvent('hha:spawn', {
          detail: {
            modeKey,
            difficulty: diffKey,
            target
          }
        })
      );
    } catch {}
  }

  // ใช้เวลาจริงจาก requestAnimationFrame
  let lastTime = performance.now();

  function tick () {
    if (!running) return;
    const now = performance.now();
    const dt = now - lastTime;
    lastTime = now;

    timeMs += dt;
    spawnTimer += dt;

    // spawn
    if (spawnTimer >= SPAWN_INTERVAL) {
      spawnTimer -= SPAWN_INTERVAL;
      spawnOne();
    }

    // expire
    const nowMs = timeMs;
    const keep = [];
    for (const t of activeTargets) {
      if (nowMs - t.born >= t.life) {
        // หมดอายุ
        onExpire(t);
      } else {
        keep.push(t);
      }
    }
    activeTargets = keep;

    // fever decay ต่อวินาที (เลือกใช้ตามต้องการ)
    // ถ้าอยากใช้ FEVER_DECAY_SEC ให้ไปจัดการใน safe.js ผ่าน hha:time อยู่แล้ว

    if (timeMs < durationSec * 1000) {
      requestAnimationFrame(tick);
    } else {
      running = false;
    }
  }

  requestAnimationFrame(tick);

  // controller สำหรับ safe.js
  return {
    stop () {
      running = false;
      activeTargets.length = 0;
    },
    hit (targetId, ctx) {
      const idx = activeTargets.findIndex(t => t.id === targetId);
      if (idx === -1) return null;
      const t = activeTargets[idx];
      activeTargets.splice(idx, 1);
      if (t.isGood) goodCount++;
      return judge(t.ch, { ...ctx, target: t });
    }
  };
}

export default { boot };
