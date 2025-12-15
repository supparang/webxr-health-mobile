// === /herohealth/vr/mode-factory.js ===
// Generic target spawner (DOM + A-Frame) สำหรับ HeroHealth VR/Quest

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

// ---------- Emoji texture cache (ใช้กับ Hydration 3D) ----------
const EMOJI_TEX_CACHE = ROOT.HHA_EMOJI_TEX || (ROOT.HHA_EMOJI_TEX = {});

function getEmojiTexture (ch) {
  if (EMOJI_TEX_CACHE[ch]) return EMOJI_TEX_CACHE[ch];

  if (!DOC) return null;
  const canvas = DOC.createElement('canvas');
  const size = 256;
  canvas.width = canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // วาด emoji ใหญ่ ๆ กลางรูป
  ctx.font = '200px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  ctx.fillText(ch, size / 2, size * 0.60);

  const url = canvas.toDataURL('image/png');
  EMOJI_TEX_CACHE[ch] = url;
  return url;
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

  if (ROOT.HHA_DIFF_TABLE && modeKey && ROOT.HHA_DIFF_TABLE[modeKey]) {
    const table = ROOT.HHA_DIFF_TABLE[modeKey];
    if (table && table[diffKey]) base = table[diffKey];
  }

  if (!base) base = DEFAULT_DIFF[diffKey] || DEFAULT_DIFF.normal;

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

// ---------- DOM host (GoodJunk / Plate) ----------
function findHostElement () {
  if (!DOC) return null;
  return (
    DOC.getElementById('hvr-playfield') ||
    DOC.getElementById('hvr-scene') ||
    DOC.querySelector('[data-hvr-host]') ||
    DOC.body
  );
}

// ---------- A-Frame root (Hydration) ----------
function findAframeTargetRoot () {
  if (!DOC || !ROOT.AFRAME) return null;
  const scene = DOC.querySelector('a-scene');
  if (!scene) return null;

  let root = scene.querySelector('#hvr-target-root');
  if (!root) {
    root = DOC.createElement('a-entity');
    root.setAttribute('id', 'hvr-target-root');
    // ตำแหน่งประมาณกลางหน้าผู้เล่น
    root.setAttribute('position', '0 0 0');
    scene.appendChild(root);
  }
  return root;
}

// ======================================================
//  boot(cfg)
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
    spawnStyle = 'pop',
    judge,
    onExpire
  } = rawCfg || {};

  const diffKey  = String(difficulty || 'normal').toLowerCase();
  const baseDiff = pickDiffConfig(modeKey, diffKey);

  // Hydration ใช้ A-Frame เป้า 3D + emoji texture
  const useAframeTargets = (modeKey === 'hydration' || modeKey === 'hydration-vr');

  const hostDom = useAframeTargets ? null : findHostElement();
  if (!useAframeTargets && (!hostDom || !DOC)) {
    console.error('[mode-factory] host element not found');
    return { stop () {} };
  }

  if (!useAframeTargets) {
    try {
      const cs = ROOT.getComputedStyle(hostDom);
      if (cs && cs.position === 'static') hostDom.style.position = 'relative';
    } catch {}
    hostDom.classList.add('hvr-host-ready');
  }

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
      next += 1;
    } else if (hitRate <= 0.55 || sampleMisses >= 6) {
      next -= 1;
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
    if (sampleTotal >= ADAPT_WINDOW) recalcAdaptive();
  }

  // ---------- DOM play rect ----------
  function computePlayRect () {
    const w = hostDom.clientWidth;
    const h = hostDom.clientHeight;

    const top    = h * 0.25;
    const bottom = h * 0.80;
    const left   = w * 0.10;
    const right  = w * 0.90;

    return {
      left,
      top,
      width: right - left,
      height: bottom - top
    };
  }

  // ======================================================
  //  Spawn target: A-Frame (Hydration)
  // ======================================================
  function spawnTargetAframe () {
    if (activeTargets.size >= curMaxActive) return;

    const root = findAframeTargetRoot();
    if (!root) return;

    // กระจายเป้าในกรอบด้านหน้า
    const px = (Math.random() * 2.8 - 1.4).toFixed(2);   // -1.4 .. 1.4
    const py = (Math.random() * 1.3 + 0.9).toFixed(2);   // 0.9 .. 2.2
    const pz = -3;

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

    const el = DOC.createElement('a-entity');
    el.classList.add('hha-target');
    el.setAttribute('data-hha-tgt', '');
    el.setAttribute('position', `${px} ${py} ${pz}`);
    el.setAttribute('geometry', `primitive: circle; radius: ${(0.35 * curScale).toFixed(2)}`);
    el.setAttribute(
      'material',
      isGood
        ? 'shader: flat; color: #22c55e; opacity: 0.96'
        : 'shader: flat; color: #f97316; opacity: 0.96'
    );

    // emoji texture plane
    const tex = getEmojiTexture(ch);
    if (tex) {
      const emojiPlane = DOC.createElement('a-image');
      emojiPlane.setAttribute('src', tex);
      emojiPlane.setAttribute('width', (0.55 * curScale).toFixed(2));
      emojiPlane.setAttribute('height', (0.55 * curScale).toFixed(2));
      emojiPlane.setAttribute('position', '0 0 0.03');
      emojiPlane.setAttribute('transparent', 'true');
      el.appendChild(emojiPlane);
    }

    root.appendChild(el);

    const data = {
      el,
      ch,
      isGood,
      isPower,
      bornAt: performance.now(),
      life: baseDiff.life
    };
    activeTargets.add(data);

    const handleHit = (ev) => {
      if (stopped) return;
      if (!activeTargets.has(data)) return;

      activeTargets.delete(data);
      try { el.removeEventListener('click', handleHit); } catch {}
      try { root.removeChild(el); } catch {}

      let res = null;
      if (typeof judge === 'function') {
        const inter = ev.detail && ev.detail.intersection;
        const ctx = {
          clientX: inter ? inter.point.x : 0,
          clientY: inter ? inter.point.y : 0,
          cx: 0,
          cy: 0,
          isGood,
          isPower
        };
        try {
          res = judge(ch, ctx);
        } catch (err) {
          console.error('[mode-factory] judge error (aframe)', err);
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

    el.addEventListener('click', handleHit);

    ROOT.setTimeout(() => {
      if (stopped) return;
      if (!activeTargets.has(data)) return;

      activeTargets.delete(data);
      try { el.removeEventListener('click', handleHit); } catch {}
      try { root.removeChild(el); } catch {}

      try {
        if (typeof onExpire === 'function') {
          onExpire({ ch, isGood, isPower });
        }
      } catch (err) {
        console.error('[mode-factory] onExpire error (aframe)', err);
      }

      if (!isGood && !isPower) addSample(true);
    }, baseDiff.life);
  }

  // ======================================================
  //  Spawn target: DOM (GoodJunk / Plate)
  // ======================================================
  function spawnTargetDom () {
    if (activeTargets.size >= curMaxActive) return;

    const rect = computePlayRect();
    const x = rect.left + rect.width  * (0.15 + Math.random() * 0.70);
    const y = rect.top  + rect.height * (0.10 + Math.random() * 0.80);

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

    const el = DOC.createElement('div');
    el.className = 'hvr-target hha-target';
    el.setAttribute('data-hha-tgt', '');

    const baseSize = 74;
    const size = baseSize * curScale;

    el.textContent = ch;
    el.style.position = 'absolute';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.borderRadius = '999px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontSize = (size * 0.55) + 'px';
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
    hostDom.appendChild(el);

    const handleHit = (ev) => {
      if (stopped) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (!activeTargets.has(data)) return;

      activeTargets.delete(data);
      try { el.removeEventListener('pointerdown', handleHit); } catch {}
      try { hostDom.removeChild(el); } catch {}

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
          console.error('[mode-factory] judge error (dom)', err);
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

    ROOT.setTimeout(() => {
      if (stopped) return;
      if (!activeTargets.has(data)) return;

      activeTargets.delete(data);
      try { el.removeEventListener('pointerdown', handleHit); } catch {}
      try { hostDom.removeChild(el); } catch {}

      try {
        if (typeof onExpire === 'function') {
          onExpire({ ch, isGood, isPower });
        }
      } catch (err) {
        console.error('[mode-factory] onExpire error (dom)', err);
      }

      if (!isGood && !isPower) addSample(true);
    }, baseDiff.life);
  }

  // ---------- clock ----------
  function dispatchTime (sec) {
    try {
      ROOT.dispatchEvent(new CustomEvent('hha:time', { detail: { sec } }));
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
    }

    if (secLeft > 0) {
      if (!lastSpawnTs) lastSpawnTs = ts;
      const dtSpawn = ts - lastSpawnTs;
      if (dtSpawn >= curInterval) {
        if (useAframeTargets) spawnTargetAframe();
        else spawnTargetDom();
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

    try { dispatchTime(0); } catch {}
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