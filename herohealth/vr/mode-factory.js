// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (adaptive) สำหรับ HeroHealth VR/Quest
// เพิ่ม: Drag-pan + pop-in animation + burst wave + clutch time

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

  // ให้ host เป็น relative เพื่อใช้ absolute ภายใน
  try {
    const cs = ROOT.getComputedStyle(host);
    if (cs && cs.position === 'static') {
      host.style.position = 'relative';
    }
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

  // ---------- Drag / Pan: เลื่อนจอแล้วเป้าเลื่อนตาม ----------
  let dragActive = false;
  let dragLastX  = 0;
  let dragLastY  = 0;

  function onPanStart (ev) {
    if (stopped) return;
    // mouse: ซ้ายเท่านั้น, touch/pointer ไม่มี button
    if (typeof ev.button === 'number' && ev.button !== 0) return;

    // ถ้าเริ่มลากบนเป้า ไม่ถือว่าเป็นการแพน (กันไปชนกับการตีเป้า)
    if (ev.target && ev.target.closest && ev.target.closest('.hvr-target')) {
      return;
    }

    dragActive = true;
    dragLastX  = ev.clientX;
    dragLastY  = ev.clientY;
  }

  function onPanMove (ev) {
    if (!dragActive || stopped) return;

    const dx = ev.clientX - dragLastX;
    const dy = ev.clientY - dragLastY;
    dragLastX = ev.clientX;
    dragLastY = ev.clientY;

    // เลื่อนโลกของเป้าในทิศทาง "ตรงข้าม" กับนิ้ว
    // (นิ้วลากไปทางไหน เหมือนหันกล้องไปทางนั้น)
    activeTargets.forEach((t) => {
      if (!t || !t.el) return;
      t.x = (t.x || 0) - dx;
      t.y = (t.y || 0) - dy;
      t.el.style.left = t.x + 'px';
      t.el.style.top  = t.y + 'px';
    });
  }

  function onPanEnd () {
    dragActive = false;
  }

  host.addEventListener('pointerdown', onPanStart);
  ROOT.addEventListener('pointermove', onPanMove);
  ROOT.addEventListener('pointerup', onPanEnd);
  ROOT.addEventListener('pointercancel', onPanEnd);

  // ---------- Clutch time (ช่วงท้ายเกม) ----------
  const clutchThresholdSec = Math.max(10, Math.floor(totalDuration * 0.18)); // ~18% สุดท้าย
  let clutchMode = false;

  function enterClutchIfNeeded () {
    if (clutchMode) return;
    if (secLeft > clutchThresholdSec) return;
    clutchMode = true;

    // เร่งเกมขึ้นหน่อย + เป้าหดลง
    curInterval = clamp(curInterval * 0.75, baseDiff.spawnInterval * 0.45, baseDiff.spawnInterval);
    curScale    = clamp(curScale * 0.88, baseDiff.scale * 0.7, baseDiff.scale);

    host.classList.add('hvr-clutch');
    try {
      ROOT.dispatchEvent(new CustomEvent('hha:clutch', {
        detail: {
          modeKey,
          difficulty: diffKey,
          remainingSec: secLeft
        }
      }));
    } catch {}
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

  // ---------- สร้างเป้าเดี่ยว (ใช้ pop-in + เก็บตำแหน่งไว้แพน) ----------
  function spawnSingleTarget () {
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

    // pop-in เริ่มจาก scale เล็กหน่อย
    el.textContent = ch;
    el.style.position = 'absolute';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.transform = 'translate(-50%, -50%) scale(0.72)';
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
    el.style.transition = 'transform .18s ease-out, box-shadow .18s ease-out';

    if (isGood) {
      el.style.background = 'radial-gradient(circle at 30% 30%, #4ade80, #16a34a)';
    } else {
      el.style.background = 'radial-gradient(circle at 30% 30%, #fb923c, #ea580c)';
    }
    el.style.boxShadow = clutchMode
      ? '0 0 16px rgba(248,113,113,0.9), 0 10px 25px rgba(0,0,0,0.45)'
      : '0 10px 25px rgba(0,0,0,0.45)';

    const data = {
      el,
      ch,
      isGood,
      isPower,
      bornAt: performance.now(),
      life: baseDiff.life,
      x,
      y
    };

    activeTargets.add(data);
    host.appendChild(el);

    // pop-in animation จริง ๆ
    requestAnimationFrame(() => {
      el.style.transform = 'translate(-50%, -50%) scale(1)';
    });

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

  // ---------- Burst wave: มีโอกาสเกิดคลื่นเป้ารัว ๆ ----------
  function spawnTargetsWithBurst () {
    if (activeTargets.size >= curMaxActive) return;

    // ปกติ spawn อย่างน้อย 1
    let toSpawn = 1;

    // มีโอกาสเกิด burst wave ถ้าไม่เกิน maxActive
    const canBurst = activeTargets.size < (curMaxActive - 1);
    const burstChance = clutchMode ? 0.45 : 0.22; // ช่วงท้ายเกมเร้าใจกว่า

    if (canBurst && Math.random() < burstChance) {
      // spawn 2–3 เป้าในทีเดียว แต่ไม่เกิน maxActive
      const extra = (Math.random() < 0.5) ? 1 : 2;
      toSpawn = clamp(1 + extra, 1, curMaxActive - activeTargets.size);
    }

    for (let i = 0; i < toSpawn; i++) {
      spawnSingleTarget();
      if (activeTargets.size >= curMaxActive) break;
    }
  }

  // ---------- clock (hha:time) ----------
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

    if (dt >= 1000 && secLeft > 0) {
      const steps = Math.floor(dt / 1000);
      for (let i = 0; i < steps; i++) {
        secLeft--;
        dispatchTime(secLeft);
        if (secLeft <= 0) break;
      }
      lastClockTs += steps * 1000;

      // เช็ก clutch time ทุก ๆ รอบที่เวลาเดิน
      if (secLeft > 0) {
        enterClutchIfNeeded();
      }
    }

    if (secLeft > 0) {
      if (!lastSpawnTs) lastSpawnTs = ts;
      const dtSpawn = ts - lastSpawnTs;
      if (dtSpawn >= curInterval) {
        spawnTargetsWithBurst();
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

    // cleanup drag + clutch
    host.removeEventListener('pointerdown', onPanStart);
    ROOT.removeEventListener('pointermove', onPanMove);
    ROOT.removeEventListener('pointerup', onPanEnd);
    ROOT.removeEventListener('pointercancel', onPanEnd);
    host.classList.remove('hvr-clutch');
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