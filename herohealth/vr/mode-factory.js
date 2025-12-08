// === /herohealth/vr/mode-factory.js ===
// Generic emoji-target engine (DOM overlay) สำหรับโหมด VR แบบง่าย
// ใช้กับ Hydration / Balanced Plate ที่เรียก factoryBoot({ judge, onExpire, ... })

'use strict';

import { HHA_DIFF_TABLE } from './hha-diff-table.js';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const DOC  = ROOT.document;

// ------- helper -------
function rand(min, max) {
  return min + Math.random() * (max - min);
}
function pick(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

// เลือก engine config จาก HHA_DIFF_TABLE
function pickEngineConfig(modeKey, diffKey) {
  const table = HHA_DIFF_TABLE[modeKey] || {};
  const row =
    table[diffKey] ||
    table.normal ||
    Object.values(table)[0] || {};
  return row.engine || {};
}

/**
 * boot(opts)
 * opts:
 *  - modeKey: 'hydration-vr' | 'plate-vr' ฯลฯ
 *  - difficulty: 'easy' | 'normal' | 'hard'
 *  - duration: sec (เอาไปใช้แค่ส่งกลับใน controller)
 *  - pools: { good:[], bad:[] }
 *  - goodRate: 0–1 (อัตรา good vs bad)
 *  - powerups: []
 *  - powerRate: 0–1 (โอกาสออก power แทน good/bad)
 *  - powerEvery: จำนวน hit ต่อ 1 power (ตอนนี้ยังไม่ใช้ ละไว้ก่อน)
 *  - judge(ch, ctx) → { good, scoreDelta }   (required)
 *  - onExpire(info)                          (optional)
 */
export async function boot(opts = {}) {
  const modeKey = String(opts.modeKey || 'goodjunk').toLowerCase();
  const diffKey = String(opts.difficulty || 'normal').toLowerCase();

  const engCfg = pickEngineConfig(modeKey, diffKey);

  // ===== ค่าจาก HHA_DIFF_TABLE (มี default กันพลาด) =====
  const SPAWN_INTERVAL = Number(engCfg.SPAWN_INTERVAL ?? 950);   // ms
  const ITEM_LIFETIME  = Number(engCfg.ITEM_LIFETIME  ?? 2300);  // ms
  const MAX_ACTIVE     = Number(engCfg.MAX_ACTIVE     ?? 4);
  const SIZE_FACTOR    = Number(engCfg.SIZE_FACTOR    ?? 1.0);

  const GOOD_RATIO     = Number(engCfg.GOOD_RATIO     ?? opts.goodRate ?? 0.65);
  const POWER_RATIO    = Number(engCfg.POWER_RATIO    ?? opts.powerRate ?? 0.10);

  const pools    = opts.pools    || {};
  const GOOD     = pools.good    || [];
  const BAD      = pools.bad     || [];
  const POWERUPS = opts.powerups || [];

  const judge    = typeof opts.judge   === 'function' ? opts.judge   : null;
  const onExpire = typeof opts.onExpire === 'function' ? opts.onExpire : null;

  // ถ้าไม่มี judge หรือไม่มีเป้าให้ spawn เลย → ยังไงก็เล่นไม่ได้
  if (!judge || (!GOOD.length && !BAD.length && !POWERUPS.length)) {
    console.warn('[mode-factory] missing judge() or pools.good/bad/powerups – engine ไม่สร้างเป้า');
    return {
      stop () {}
    };
  }

  // ===== สร้างเลเยอร์ DOM สำหรับเป้า =====
  const layer = DOC.createElement('div');
  layer.className = 'hha-target-layer';
  Object.assign(layer.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',       // ให้ HUD อื่นยังรับอีเวนต์ได้
    zIndex: '480'                // ใต้ HUD (500+) เหนือฉาก VR
  });
  DOC.body.appendChild(layer);

  // ที่ว่างให้สุ่มตำแหน่งเป้า (กัน HUD บน / Fever / ปุ่ม VR)
  const PAD_TOP    = 150;
  const PAD_BOTTOM = 190;
  const PAD_SIDE   = 40;

  const targets = new Set();
  let running = true;
  let lastTs  = performance.now();
  let spawnAcc = 0;

  function removeTarget(obj, expired) {
    targets.delete(obj);
    if (obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);
    if (expired && onExpire) {
      try {
        onExpire({
          char: obj.char,
          type: obj.type,
          isGood: obj.type === 'good',
          isBad: obj.type === 'bad',
          isPower: obj.type === 'power'
        });
      } catch (e) {
        console.error('[mode-factory] onExpire error', e);
      }
    }
  }

  function spawnOne() {
    const now = performance.now();
    if (targets.size >= MAX_ACTIVE) return;

    let type = 'good';
    let ch   = '💧';

    // power-up?
    const hasPower = POWERUPS.length && POWER_RATIO > 0;
    if (hasPower && Math.random() < POWER_RATIO) {
      type = 'power';
      ch   = pick(POWERUPS);
    } else {
      // good / bad
      if (Math.random() < GOOD_RATIO && GOOD.length) {
        type = 'good';
        ch   = pick(GOOD);
      } else if (BAD.length) {
        type = 'bad';
        ch   = pick(BAD);
      } else if (GOOD.length) {
        type = 'good';
        ch   = pick(GOOD);
      } else if (POWERUPS.length) {
        type = 'power';
        ch   = pick(POWERUPS);
      }
    }

    const vw = ROOT.innerWidth  || 1280;
    const vh = ROOT.innerHeight || 720;
    const x  = rand(PAD_SIDE, vw - PAD_SIDE);
    const y  = rand(PAD_TOP,  vh - PAD_BOTTOM);

    const baseSize = 52; // px
    const size = Math.max(32, baseSize * (SIZE_FACTOR || 1));

    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'hha-target';
    el.textContent = ch;
    Object.assign(el.style, {
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      margin: '0',
      padding: '0',
      transform: 'translate(-50%,-50%)',
      fontSize: `${size * 0.86}px`,
      lineHeight: '1',
      borderRadius: '999px',
      border: 'none',
      outline: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.92), rgba(15,23,42,0.95))',
      boxShadow: '0 12px 32px rgba(15,23,42,0.65)',
      color: '#fff',
      pointerEvents: 'auto',
      cursor: 'pointer'
    });

    layer.appendChild(el);

    const obj = {
      el,
      char: ch,
      type,
      bornAt: now,
      dieAt: now + ITEM_LIFETIME,
      hit: false
    };
    targets.add(obj);

    function handleHit(ev) {
      if (!running || obj.hit) return;
      obj.hit = true;
      ev.preventDefault();
      ev.stopPropagation();

      const ctx = {
        clientX: ev.clientX,
        clientY: ev.clientY,
        target: el,
        type
      };

      try {
        judge(ch, ctx);
      } catch (e) {
        console.error('[mode-factory] judge() error', e);
      }

      removeTarget(obj, false);
    }

    el.addEventListener('pointerdown', handleHit, { passive: false });
    el.addEventListener('click', handleHit, { passive: false });
  }

  function loop(ts) {
    if (!running) return;

    const dt = ts - lastTs;
    lastTs = ts;

    // spawn
    spawnAcc += dt;
    const interval = Math.max(250, SPAWN_INTERVAL); // กันพลาด
    while (spawnAcc >= interval) {
      spawnAcc -= interval;
      spawnOne();
    }

    // expiry
    const now = ts;
    for (const obj of Array.from(targets)) {
      if (now >= obj.dieAt) {
        removeTarget(obj, true);
      }
    }

    ROOT.requestAnimationFrame(loop);
  }

  ROOT.requestAnimationFrame(loop);

  // controller
  function stop() {
    running = false;
    for (const obj of Array.from(targets)) {
      removeTarget(obj, false);
    }
    targets.clear();
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
  }

  return { stop };
}

export default { boot };
