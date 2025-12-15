// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (adaptive) สำหรับ HeroHealth VR/Quest

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

// ---------- Base difficulty ----------
const DEFAULT_DIFF = {
  easy:   { spawnInterval: 900, maxActive: 3, life: 1900, scale: 1.15 },
  normal: { spawnInterval: 800, maxActive: 4, life: 1700, scale: 1.00 },
  hard:   { spawnInterval: 650, maxActive: 5, life: 1500, scale: 0.90 }
};

function pickDiffConfig (modeKey, diffKey) {
  diffKey = String(diffKey || 'normal').toLowerCase();
  let base = null;

  // ถ้ามี HHA_DIFF_TABLE ใช้ก่อน
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

// หา host กลางจอ
function findHostElement () {
  return (
    DOC.getElementById('hvr-playfield') ||
    DOC.getElementById('hvr-scene') ||
    DOC.querySelector('[data-hvr-host]') ||
    DOC.body
  );
}

// ---------- event helper ----------
function dispatchCustom (type, detail) {
  try {
    ROOT.dispatchEvent(new CustomEvent(type, { detail }));
  } catch (err) {
    // เงียบ ๆ ไม่ให้เกมพัง
  }
}

// ======================================================
//  boot(cfg) — main entry
// ======================================================
export async function boot (rawCfg = {}) {
  const {
    difficulty = 'normal',
    duration   = 60,
    modeKey    = 'hydration',
    pools      = {},
    goodRate   = 0.6,
    powerups   = [],
    powerRate  = 0.10,
    powerEvery = 7,
    spawnStyle = 'pop',       // ตอนนี้รองรับ pop เป็นหลัก
    judge,
    onExpire
  } = rawCfg || {};

  const diffKey  = String(difficulty || 'normal').toLowerCase();
  const baseDiff = pickDiffConfig(modeKey, diffKey);

  const host = findHostElement();
  if (!host || !DOC) {
    console.error('[mode-factory] host element not found');
    return { stop () {} };
  }

  // ให้ host เป็น relative เพื่อใช้ absolute ภายใน + กัน gesture แปลก ๆ
  try {
    const cs = ROOT.getComputedStyle(host);
    if (cs && cs.position === 'static') {
      host.style.position = 'relative';
    }
    host.style.touchAction = 'none';
  } catch {}
  host.classList.add('hvr-host-ready');

  // ---------- Game state ----------
  let stopped = false;

  let totalDuration = clamp(duration, 20, 180);
  let secLeft       = totalDuration;
  let lastClockTs   = null;

  let activeTargets = new Set();
  let lastSpawnTs   = 0;
  let spawnCounter  = 0;

  // ---------- Adaptive ----------
  let adaptLevel   = 0; // -1 .. 3
  let curInterval  = baseDiff.spawnInterval;
  let curMaxActive = baseDiff.maxActive;
  let curScale     = baseDiff.scale;

  let sampleHits   = 0;
  let sampleMisses = 0;
  let sampleTotal  = 0;
  const ADAPT_WINDOW = 12;

  function recalcAdaptive () {
    if (sampleTotal < ADAPT_WINDOW) return;

    const hitRate = sampleHits / sampleTotal;
    let next = adaptLevel;

    if (hitRate >= 0.85 && sampleMisses <= 2) {
      next += 1; // เก่ง → ยากขึ้น
    } else if (hitRate <= 0.55 || sampleMisses >= 6) {
      next -= 1; // พลาดเยอะ → ง่ายลง
    }

    adaptLevel = clamp(next, -1, 3);

    const intervalMul = 1 - (adaptLevel * 0.12);
    const scaleMul    = 1 - (adaptLevel * 0.10);
    const bonusActive = adaptLevel;

    curInterval  = clamp(baseDiff.spawnInterval * intervalMul,
                         baseDiff.spawnInterval * 0.45,
                         baseDiff.spawnInterval * 1.4);
    curScale     = clamp(baseDiff.scale * scaleMul,
                         baseDiff.scale * 0.6,
                         baseDiff.scale * 1.4);
    curMaxActive = clamp(baseDiff.maxActive + bonusActive, 2, 10);

    sampleHits = sampleMisses = sampleTotal = 0;

    dispatchCustom('hha:adaptive', {
      modeKey,
      difficulty: diffKey,
      level: adaptLevel,
      spawnInterval: curInterval,
      maxActive: curMaxActive,
      scale: curScale
    });
  }

  function addSample (isHit) {
    if (isHit) sampleHits++;
    else sampleMisses++;
    sampleTotal++;
    if (sampleTotal >= ADAPT_WINDOW) {
      recalcAdaptive();
    }
  }

  // ---------- ตำแหน่ง spawn (ภายใน host) ----------
  function computePlayRect () {
    const w = host.clientWidth;
    const h = host.clientHeight;

    const top    = h * 0.25;  // ตัด HUD ด้านบน
    const bottom = h * 0.80;  // เหลือที่ให้ fever bar ด้านล่าง
    const left   = w * 0.10;
    const right  = w * 0.90;

    return {
      left,
      top,
      width: right - left,
      height: bottom - top
    };
  }

  function spawnTarget () {
    if (activeTargets.size >= curMaxActive) return;

    const rect = computePlayRect();
    const x = rect.left + rect.width  * (0.15 + Math.random() * 0.70);
    const y = rect.top  + rect.height * (0.10 + Math.random() * 0.80);

    // เลือก emoji
    const poolsGood = Array.isArray(pools.good) ? pools.good : [];
    const poolsBad  = Array.isArray(pools.bad) ? pools.bad  : [];

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

    // ใช้ div + inline style ให้สวยไม่ง้อ CSS ภายนอก
    const el = DOC.createElement('div');
    el.className = 'hvr-target';

    const baseSize = 74; // px
    const size = baseSize * curScale;

    el.textContent = ch;
    el.style.position = 'absolute';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.transform = 'translate(-50%, -50%)';

    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.borderRadius = '999px';
    el.style.border = '0';
    el.style.padding = '0';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontSize = (size * 0.55) + 'px';
    el.style.lineHeight = '1';
    el.style.userSelect = 'none';
    el.style.cursor = 'pointer';
    el.style.zIndex = '30';

    if (isGood) {
      el.style.background = 'radial-gradient(circle at 30% 30%, #4ade80, #16a34a)';
    } else {
      el.style.background = 'radial-gradient(circle at 30% 30%, #fb923c, #ea580c)';
    }
    el.style.boxShadow = '0 10px 25px rgba(0,0,0,0.45)';

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

      let isHit = false;
      if (res && typeof res.scoreDelta === 'number') {
        if (res.scoreDelta > 0) isHit = true;
        else if (res.scoreDelta < 0) isHit = false;
        else isHit = isGood;
      } else if (res && typeof res.good === 'boolean') {
        isHit = !!res.good;
      } else {
        isHit = isGood;
      }
      addSample(isHit);
    };

    el.addEventListener('pointerdown', handleHit);

    // expire
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

      // ปล่อย junk หายไปเอง → ถือว่าเป็นผลดีเล็กน้อย
      if (!isGood && !isPower) {
        addSample(true);
      }
    }, baseDiff.life);
  }

  // ---------- clock (hha:time) ----------
  function dispatchTime (sec) {
    dispatchCustom('hha:time', { sec });
  }

  let rafId = null;

  // CLUTCH TIME: ปลายเกมเร้าใจ
  const clutchThreshold = Math.max(8, Math.floor(totalDuration * 0.25));
  let clutchFired = false;

  function loop (ts) {
    if (stopped) return;

    if (lastClockTs == null) lastClockTs = ts;
    const dt = ts - lastClockTs;

    if (dt >= 1000 && secLeft > 0) {
      const steps = Math.floor(dt / 1000);
      for (let i = 0; i < steps; i++) {
        secLeft--;
        dispatchTime(secLeft);
        if (secLeft <= 0) break;
      }
      lastClockTs += steps * 1000;
    }

    // ยิง CLUTCH TIME event เมื่อเข้าโซนท้ายเกมครั้งแรก
    if (!clutchFired && secLeft > 0 && secLeft <= clutchThreshold) {
      clutchFired = true;
      dispatchCustom('hha:clutch', {
        modeKey,
        difficulty: diffKey,
        secLeft,
        totalDuration
      });
    }

    if (secLeft > 0) {
      if (!lastSpawnTs) lastSpawnTs = ts;
      const dtSpawn = ts - lastSpawnTs;
      if (dtSpawn >= curInterval) {
        spawnTarget();
        lastSpawnTs = ts;
      }
    } else {
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

    activeTargets.forEach(t => {
      try { t.el.remove(); } catch {}
    });
    activeTargets.clear();

    try {
      dispatchTime(0);
    } catch {}
  }

  const onStopEvent = () => stop();
  ROOT.addEventListener('hha:stop', onStopEvent);

  rafId = ROOT.requestAnimationFrame(loop);

  return {
    stop () {
      ROOT.removeEventListener('hha:stop', onStopEvent);
      stop();
    }
  };
}

export default { boot };