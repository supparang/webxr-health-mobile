// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner for Hero Health VR / Quest games
// - ใช้ร่วมกับ safe.js ของแต่ละโหมด (เช่น hydration.safe.js, plate.safe.js)
// - สร้าง event hha:time ทุก 1 วินาที (sec นับถอยหลัง)
// - spawnStyle: 'pop' (โผล่แล้วหายเอง) หรือ 'fall' (ถ้าจะทำภายหลัง)
// - มี adaptive เป้า: ขนาด / จำนวนเป้า ปรับตามฝีมือผู้เล่น
//
// ใช้จาก safe.js:
//   import { boot as factoryBoot } from '../vr/mode-factory.js'
//   const inst = await factoryBoot({ ...config... })
//   inst.stop()   // ถ้าต้องการหยุดเอง (เช่นจบเควสต์ก่อนหมดเวลา)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

// ---------- Helpers ----------
function clamp (v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function pickOne (arr, fallback = null) {
  if (!Array.isArray(arr) || !arr.length) return fallback;
  const i = Math.floor(Math.random() * arr.length);
  return arr[i];
}

// ---------- Difficulty base config ----------
const DEFAULT_DIFF = {
  easy:   { spawnInterval: 900, maxActive: 3, life: 1900, scale: 1.15 },
  normal: { spawnInterval: 800, maxActive: 4, life: 1700, scale: 1.00 },
  hard:   { spawnInterval: 650, maxActive: 5, life: 1500, scale: 0.90 }
};

// อ่านค่าจาก HHA_DIFF_TABLE ถ้ามี
function pickDiffConfig (modeKey, diffKey) {
  diffKey = String(diffKey || 'normal').toLowerCase();
  let base = null;

  if (ROOT.HHA_DIFF_TABLE && modeKey && ROOT.HHA_DIFF_TABLE[modeKey]) {
    const table = ROOT.HHA_DIFF_TABLE[modeKey];
    if (table && table[diffKey]) {
      base = table[diffKey];
    }
  }

  if (!base) {
    base = DEFAULT_DIFF[diffKey] || DEFAULT_DIFF.normal;
  }

  const cfg = {
    spawnInterval: Number(base.spawnInterval ?? base.interval ?? 800),
    maxActive:     Number(base.maxActive ?? base.active ?? 4),
    life:          Number(base.life ?? base.targetLife ?? 1700),
    scale:         Number(base.scale ?? base.size ?? 1)
  };

  if (!Number.isFinite(cfg.spawnInterval) || cfg.spawnInterval <= 0) cfg.spawnInterval = 800;
  if (!Number.isFinite(cfg.maxActive)     || cfg.maxActive <= 0)     cfg.maxActive = 4;
  if (!Number.isFinite(cfg.life)          || cfg.life <= 0)          cfg.life = 1700;
  if (!Number.isFinite(cfg.scale)         || cfg.scale <= 0)         cfg.scale = 1;

  return cfg;
}

// หา host ของเป้าใน DOM
function findHostElement () {
  return (
    DOC.getElementById('hvr-playfield') ||
    DOC.getElementById('hvr-scene') ||
    DOC.querySelector('[data-hvr-host]') ||
    DOC.body
  );
}

// ---------- Main factory ----------
export async function boot (rawCfg = {}) {
  const {
    difficulty = 'normal',
    duration   = 60,
    modeKey    = 'hydration',     // ใช้เป็น key ใน HHA_DIFF_TABLE
    pools      = {},
    goodRate   = 0.6,
    powerups   = [],
    powerRate  = 0.10,
    powerEvery = 7,
    spawnStyle = 'pop',
    judge,
    onExpire
  } = rawCfg || {};

  const diffKey = String(difficulty || 'normal').toLowerCase();
  const baseDiff = pickDiffConfig(modeKey, diffKey);

  const host = findHostElement();
  if (!host) {
    console.error('[mode-factory] host element not found');
    return {
      stop () {}
    };
  }

  host.classList.add('hvr-host-ready');

  // ---------- State ----------
  let stopped = false;

  // เวลา
  let totalDuration = clamp(duration, 20, 180);
  let secLeft       = totalDuration;
  let lastClockTs   = null;

  // spawn
  let activeTargets = new Set();
  let lastSpawnTs   = 0;
  let spawnCounter  = 0;

  // Adaptive
  let adaptLevel     = 0;   // -1..3
  let curInterval    = baseDiff.spawnInterval;
  let curMaxActive   = baseDiff.maxActive;
  let curScale       = baseDiff.scale;

  let sampleHits   = 0;
  let sampleMisses = 0;
  let sampleTotal  = 0;
  const ADAPT_WINDOW = 12; // เก็บสถิติทีละ ~12 event

  function recalcAdaptive () {
    if (sampleTotal < ADAPT_WINDOW) return;

    const hitRate = sampleHits / sampleTotal;

    let next = adaptLevel;
    if (hitRate >= 0.85 && sampleMisses <= 2) {
      next += 1; // เล่นแม่น → ยากขึ้น
    } else if (hitRate <= 0.55 || sampleMisses >= 6) {
      next -= 1; // พลาดเยอะ → ง่ายลง
    }

    adaptLevel = clamp(next, -1, 3);

    // ปรับค่าตามระดับ
    const intervalMul = 1 - (adaptLevel * 0.12);   // ยิ่ง adapt สูง → interval สั้นลง
    const scaleMul    = 1 - (adaptLevel * 0.10);   // ยิ่ง adapt สูง → เป้าเล็กลง
    const bonusActive = adaptLevel;               // เพิ่มจำนวนเป้า

    curInterval  = clamp(baseDiff.spawnInterval * intervalMul,
                         baseDiff.spawnInterval * 0.45,
                         baseDiff.spawnInterval * 1.4);
    curScale     = clamp(baseDiff.scale * scaleMul,
                         baseDiff.scale * 0.6,
                         baseDiff.scale * 1.4);
    curMaxActive = clamp(baseDiff.maxActive + bonusActive, 2, 10);

    // reset window
    sampleHits = sampleMisses = sampleTotal = 0;

    try {
      ROOT.dispatchEvent(new CustomEvent('hha:adaptive', {
        detail: {
          modeKey,
          difficulty: diffKey,
          level: adaptLevel,
          spawnInterval: curInterval,
          maxActive: curMaxActive,
          scale: curScale
        }
      }));
    } catch {}
  }

  function addSample (isHit) {
    if (isHit) sampleHits++;
    else sampleMisses++;
    sampleTotal++;
    if (sampleTotal >= ADAPT_WINDOW) {
      recalcAdaptive();
    }
  }

  // ---------- Geometry / spawn pos ----------
  function computePlayRect () {
    const rect = host.getBoundingClientRect();
    // กัน HUD ด้านบน / ล่าง: ใช้เฉพาะ 30–80% ของความสูง
    const top  = rect.top + rect.height * 0.30;
    const bot  = rect.top + rect.height * 0.80;
    const left = rect.left + rect.width * 0.08;
    const right = rect.left + rect.width * 0.92;
    return { top, bot, left, right, width: right - left, height: bot - top };
  }

  function spawnTarget () {
    if (activeTargets.size >= curMaxActive) return;

    const rect = computePlayRect();
    const x = rect.left + rect.width * (0.2 + Math.random() * 0.6);
    const y = rect.top  + rect.height * (0.1 + Math.random() * 0.8);

    // เลือก emoji
    const poolsGood = Array.isArray(pools.good) ? pools.good : [];
    const poolsBad  = Array.isArray(pools.bad) ? pools.bad : [];

    let ch = '💧';
    let isGood = true;
    let isPower = false;

    const canPower = Array.isArray(powerups) && powerups.length > 0;
    if (canPower && ((spawnCounter % Math.max(1, powerEvery)) === 0) && Math.random() < powerRate) {
      ch = pickOne(powerups, '⭐');
      isGood = true;
      isPower = true;
    } else {
      const r = Math.random();
      if (r < goodRate || !poolsBad.length) {
        ch = pickOne(poolsGood, '💧');
        isGood = true;
      } else {
        ch = pickOne(poolsBad, '🥤');
        isGood = false;
      }
    }

    spawnCounter++;

    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'hvr-target';
    el.textContent = ch;
    el.style.position = 'fixed';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.transform = `translate(-50%, -50%) scale(${curScale})`;
    el.style.cursor = 'pointer';

    const data = {
      el,
      ch,
      isGood,
      isPower,
      bornAt: performance.now(),
      life: baseDiff.life
    };

    activeTargets.add(data);
    host.appendChild(el);

    const handleHit = (ev) => {
      if (stopped) return;
      ev.preventDefault();
      ev.stopPropagation();

      if (!activeTargets.has(data)) return;

      activeTargets.delete(data);
      try { el.removeEventListener('pointerdown', handleHit); } catch {}
      try { host.removeChild(el); } catch {}

      let res = null;
      if (typeof judge === 'function') {
        const ctx = {
          clientX: ev.clientX,
          clientY: ev.clientY,
          cx: ev.clientX,
          cy: ev.clientY,
          isGood,
          isPower
        };
        try {
          res = judge(ch, ctx);
        } catch (err) {
          console.error('[mode-factory] judge error', err);
        }
      }

      // ตัดสิน hit/miss สำหรับ adaptive
      let isHit = false;
      if (res && typeof res.scoreDelta === 'number') {
        if (res.scoreDelta > 0) isHit = true;
        else if (res.scoreDelta < 0) isHit = false;
        else isHit = isGood; // คะแนน 0 → เอียงไปทางเป้าดี
      } else if (res && typeof res.good === 'boolean') {
        isHit = !!res.good;
      } else {
        isHit = isGood;
      }
      addSample(isHit);
    };

    el.addEventListener('pointerdown', handleHit);

    // expire ตามเวลา
    ROOT.setTimeout(() => {
      if (stopped) return;
      if (!activeTargets.has(data)) return;

      activeTargets.delete(data);
      try { el.removeEventListener('pointerdown', handleHit); } catch {}
      try { host.removeChild(el); } catch {}

      try {
        if (typeof onExpire === 'function') {
          onExpire({ ch, isGood, isPower });
        }
      } catch (err) {
        console.error('[mode-factory] onExpire error', err);
      }

      // ปล่อยเป้าน้ำไม่ดีหายไปเอง ถือว่า "ดี" ต่อสุขภาพ → นับเป็น hit เล็กน้อย
      if (!isGood && !isPower) {
        addSample(true);
      }
    }, baseDiff.life);
  }

  // ---------- Clock ----------
  function dispatchTime (sec) {
    try {
      ROOT.dispatchEvent(new CustomEvent('hha:time', {
        detail: { sec }
      }));
    } catch {}
  }

  let rafId = null;

  function loop (ts) {
    if (stopped) return;

    if (lastClockTs == null) lastClockTs = ts;
    const dt = ts - lastClockTs;

    // clock: ทุก 1 วินาที → ลด secLeft, ส่ง event
    if (dt >= 1000 && secLeft > 0) {
      const steps = Math.floor(dt / 1000);
      for (let i = 0; i < steps; i++) {
        secLeft--;
        dispatchTime(secLeft);
        if (secLeft <= 0) break;
      }
      lastClockTs += steps * 1000;
    }

    // spawn เป้า
    if (secLeft > 0) {
      if (!lastSpawnTs) lastSpawnTs = ts;
      const dtSpawn = ts - lastSpawnTs;
      if (dtSpawn >= curInterval) {
        spawnTarget();
        lastSpawnTs = ts;
      }
    } else {
      // หมดเวลา → หยุดเกม (ให้ safe.js เป็นคนสรุปผลต่อ)
      stop();
      return;
    }

    rafId = ROOT.requestAnimationFrame(loop);
  }

  function stop () {
    if (stopped) return;
    stopped = true;

    try { if (rafId != null) ROOT.cancelAnimationFrame(rafId); } catch {}
    rafId = null;

    // ลบเป้าที่เหลือ
    activeTargets.forEach(t => {
      try { t.el.remove(); } catch {}
    });
    activeTargets.clear();

    // ปิดท้าย clock ด้วย sec = 0 อีกที เผื่อ safe.js ยังไม่ได้ finish()
    try {
      dispatchTime(0);
    } catch {}
  }

  // รองรับ external stop ผ่าน event (เช่นจาก safe.js ถ้าทำเควสต์ครบก่อนหมดเวลา)
  const onStopEvent = () => stop();
  ROOT.addEventListener('hha:stop', onStopEvent);

  // เริ่ม loop
  rafId = ROOT.requestAnimationFrame(loop);

  return {
    stop () {
      ROOT.removeEventListener('hha:stop', onStopEvent);
      stop();
    }
  };
}

export default { boot };