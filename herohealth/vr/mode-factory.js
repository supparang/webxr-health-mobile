// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (adaptive) สำหรับ HeroHealth VR/Quest
// 2025-12-17 PATCH:
// ✅ รองรับ spawnHost (เช่น #hvr-playfield) เพื่อให้เป้าเลื่อนตามหน้า
// ✅ ถ้าไม่ส่ง spawnHost -> fallback เป็น overlay host (fixed fullscreen)
// ✅ compute rect ให้สัมพันธ์กับ host จริง (host rect / viewport rect)

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

function getEventXY (ev) {
  let x = ev.clientX;
  let y = ev.clientY;

  if ((x == null || y == null || (x === 0 && y === 0)) && ev.touches && ev.touches[0]) {
    x = ev.touches[0].clientX;
    y = ev.touches[0].clientY;
  }
  if ((x == null || y == null) && ev.changedTouches && ev.changedTouches[0]) {
    x = ev.changedTouches[0].clientX;
    y = ev.changedTouches[0].clientY;
  }
  return { x: x || 0, y: y || 0 };
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

// ---------- overlay host (fallback) ----------
function ensureOverlayStyle () {
  if (!DOC || DOC.getElementById('hvr-overlay-style')) return;
  const s = DOC.createElement('style');
  s.id = 'hvr-overlay-style';
  s.textContent = `
    .hvr-overlay-host{
      position:fixed;
      inset:0;
      z-index:9998;
      pointer-events:none;
    }
    .hvr-overlay-host .hvr-target{
      pointer-events:auto;
    }
  `;
  DOC.head.appendChild(s);
}

function ensureOverlayHost () {
  if (!DOC) return null;
  ensureOverlayStyle();

  let host = DOC.getElementById('hvr-overlay-host');
  if (host && host.isConnected) return host;

  host = DOC.createElement('div');
  host.id = 'hvr-overlay-host';
  host.className = 'hvr-overlay-host';
  host.setAttribute('data-hvr-host', 'overlay');
  DOC.body.appendChild(host);
  return host;
}

// ---------- choose host ----------
function resolveHost(spawnHost) {
  if (!DOC) return { host: null, hostMode: 'none' };

  // spawnHost: element หรือ selector string
  if (spawnHost) {
    let el = null;
    if (typeof spawnHost === 'string') el = DOC.querySelector(spawnHost);
    else if (spawnHost && spawnHost.nodeType === 1) el = spawnHost;

    if (el && el.isConnected) {
      // ให้เป็น relative ถ้ายังไม่ใช่ (เพื่อ absolute ใน host ทำงาน)
      const cs = ROOT.getComputedStyle(el);
      if (cs.position === 'static') el.style.position = 'relative';
      el.setAttribute('data-hvr-host', 'inline');
      return { host: el, hostMode: 'inline' };
    }
  }

  // fallback overlay
  const overlay = ensureOverlayHost();
  return { host: overlay, hostMode: 'overlay' };
}

// ---------- compute spawn rect ----------
function computePlayRect(host, hostMode) {
  const vw = Math.max(1, ROOT.innerWidth  || 1);
  const vh = Math.max(1, ROOT.innerHeight || 1);

  // overlay mode: ยึด viewport
  if (hostMode === 'overlay') {
    const top    = vh * 0.25;
    const bottom = vh * 0.82;
    const left   = vw * 0.10;
    const right  = vw * 0.90;
    return { left, top, width: right - left, height: bottom - top, offsetX: 0, offsetY: 0 };
  }

  // inline mode: ยึด host rect (เช่น #hvr-playfield)
  const r = host.getBoundingClientRect();
  // ถ้า host สูง/กว้าง 0 -> fallback viewport
  const w = Math.max(1, r.width || 0);
  const h = Math.max(1, r.height || 0);
  if (w <= 1 || h <= 1) {
    const top    = vh * 0.25;
    const bottom = vh * 0.82;
    const left   = vw * 0.10;
    const right  = vw * 0.90;
    return { left, top, width: right - left, height: bottom - top, offsetX: 0, offsetY: 0 };
  }

  // โซนเล่นใน host: เว้นขอบหน่อย
  const padX = w * 0.08;
  const padY = h * 0.08;

  // coordinate ภายใน host (absolute)
  return {
    left: padX,
    top:  padY,
    width:  w - padX * 2,
    height: h - padY * 2,
    offsetX: 0,
    offsetY: 0
  };
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
    spawnStyle = 'pop',
    judge,
    onExpire,

    // ✅ NEW: ระบุ host ที่จะ spawn target ลงไป (เช่น '#hvr-playfield')
    spawnHost  = null
  } = rawCfg || {};

  const diffKey  = String(difficulty || 'normal').toLowerCase();
  const baseDiff = pickDiffConfig(modeKey, diffKey);

  const { host, hostMode } = resolveHost(spawnHost);

  if (!host || !DOC) {
    console.error('[mode-factory] host not found');
    return { stop () {} };
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

    if (hitRate >= 0.85 && sampleMisses <= 2) next += 1;
    else if (hitRate <= 0.55 || sampleMisses >= 6) next -= 1;

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
          scale: curScale,
          hostMode
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

  function spawnTarget () {
    if (activeTargets.size >= curMaxActive) return;

    const rect = computePlayRect(host, hostMode);
    const x = rect.left + rect.width  * (0.15 + Math.random() * 0.70);
    const y = rect.top  + rect.height * (0.10 + Math.random() * 0.80);

    const poolsGood = Array.isArray(pools.good) ? pools.good : [];
    const poolsBad  = Array.isArray(pools.bad)  ? pools.bad  : [];

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
    el.className = 'hvr-target';
    el.setAttribute('data-hha-tgt', '1');

    const baseSize = 78;
    const size = baseSize * curScale;

    // สำหรับ inline host: x,y เป็นพิกัดใน host แล้ว
    el.style.position = 'absolute';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.transform = 'translate(-50%, -50%) scale(0.9)';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.borderRadius = '999px';
    el.style.border = '2px solid rgba(15,23,42,0.85)';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.userSelect = 'none';
    el.style.cursor = 'pointer';
    el.style.touchAction = 'manipulation';
    el.style.zIndex = '30';
    el.style.boxShadow = '0 14px 30px rgba(15,23,42,0.85)';
    el.style.transition = 'transform 0.15s ease-out, box-shadow 0.15s ease-out, opacity 0.12s ease-out';

    let bgGrad = '';
    let ringGlow = '';

    if (isPower) {
      bgGrad = 'radial-gradient(circle at 30% 25%, #facc15, #f97316)';
      ringGlow = '0 0 0 2px rgba(250,204,21,0.85), 0 0 22px rgba(250,204,21,0.9)';
    } else if (isGood) {
      bgGrad = 'radial-gradient(circle at 30% 25%, #4ade80, #16a34a)';
      ringGlow = '0 0 0 2px rgba(74,222,128,0.75), 0 0 18px rgba(16,185,129,0.85)';
    } else {
      bgGrad = 'radial-gradient(circle at 30% 25%, #fb923c, #ea580c)';
      ringGlow = '0 0 0 2px rgba(248,113,113,0.75), 0 0 18px rgba(248,113,113,0.9)';
      el.classList.add('bad');
    }

    el.style.background = bgGrad;
    el.style.boxShadow = '0 14px 30px rgba(15,23,42,0.9),' + ringGlow;

    const inner = DOC.createElement('div');
    inner.style.width = (size * 0.82) + 'px';
    inner.style.height = (size * 0.82) + 'px';
    inner.style.borderRadius = '999px';
    inner.style.display = 'flex';
    inner.style.alignItems = 'center';
    inner.style.justifyContent = 'center';
    inner.style.background = 'radial-gradient(circle at 30% 25%, rgba(15,23,42,0.12), rgba(15,23,42,0.36))';
    inner.style.boxShadow = 'inset 0 4px 10px rgba(15,23,42,0.9)';

    const icon = DOC.createElement('span');
    icon.textContent = ch;
    icon.style.fontSize = (size * 0.60) + 'px';
    icon.style.lineHeight = '1';
    icon.style.filter = 'drop-shadow(0 3px 4px rgba(15,23,42,0.9))';

    inner.appendChild(icon);
    el.appendChild(inner);

    ROOT.requestAnimationFrame(() => {
      el.style.transform = 'translate(-50%, -50%) scale(1)';
    });

    const data = {
      el,
      ch,
      isGood,
      isPower,
      bornAt: (performance && performance.now) ? performance.now() : Date.now(),
      life: baseDiff.life
    };

    activeTargets.add(data);
    host.appendChild(el);

    const handleHit = (ev) => {
      if (stopped) return;
      try { ev.preventDefault(); } catch {}
      try { ev.stopPropagation(); } catch {}
      if (!activeTargets.has(data)) return;

      activeTargets.delete(data);
      try { el.removeEventListener('pointerdown', handleHit); } catch {}
      try { el.removeEventListener('click', handleHit); } catch {}
      try { el.removeEventListener('touchstart', handleHit); } catch {}
      try { host.removeChild(el); } catch {}

      let res = null;
      if (typeof judge === 'function') {
        const xy = getEventXY(ev);
        const ctx = {
          clientX: xy.x, clientY: xy.y,
          cx: xy.x, cy: xy.y,
          isGood, isPower
        };
        try { res = judge(ch, ctx); } catch (err) { console.error('[mode-factory] judge error', err); }
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

    el.addEventListener('pointerdown', handleHit, { passive: false });
    el.addEventListener('click', handleHit, { passive: false });
    el.addEventListener('touchstart', handleHit, { passive: false });

    ROOT.setTimeout(() => {
      if (stopped) return;
      if (!activeTargets.has(data)) return;

      activeTargets.delete(data);
      try { el.removeEventListener('pointerdown', handleHit); } catch {}
      try { el.removeEventListener('click', handleHit); } catch {}
      try { el.removeEventListener('touchstart', handleHit); } catch {}
      try { host.removeChild(el); } catch {}

      try { if (typeof onExpire === 'function') onExpire({ ch, isGood, isPower }); } catch (err) {
        console.error('[mode-factory] onExpire error', err);
      }

      // junk หายเอง -> ถือว่า "ดี" เล็กน้อย
      if (!isGood && !isPower) addSample(true);
    }, baseDiff.life);
  }

  // ---------- clock (hha:time) ----------
  function dispatchTime (sec) {
    try { ROOT.dispatchEvent(new CustomEvent('hha:time', { detail: { sec } })); } catch {}
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

    activeTargets.forEach(t => { try { t.el.remove(); } catch {} });
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
