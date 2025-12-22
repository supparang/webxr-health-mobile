// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (adaptive) สำหรับ HeroHealth VR/Quest
// ✅ spawnHost: ที่ “append เป้า”
// ✅ boundsHost: ที่ใช้คำนวณ safe zone / crosshair (สำคัญสำหรับ drag view)
// ✅ decorateTarget(el, parts, data, meta): ปรับสกิน/อนิเมชันให้แต่ละเกมทำได้
// ✅ wiggle layer: ขยับ “ลอย/ส่าย” โดยไม่ทำพิกัดคลิกเพี้ยน
// ✅ crosshair shooting (tap ยิงกลางจอ) via shootCrosshair()
// ✅ perfect ring distance (ctx.hitPerfect, ctx.hitDistNorm)
// ✅ rhythm spawn (bpm) + pulse class
// ✅ trick/fake targets (itemType='fakeGood')
// ✅ Storm: spawnIntervalMul ทำให้ถี่ขึ้นจริง + life sync
// ✅ SAFEZONE: กัน spawn ทับ HUD ด้วย exclusion auto + cfg.excludeSelectors
// ✅ A3: Anti-Overlap + Center-first then spread (polar) so ไม่กองทับกันเป็นพวง

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

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

// --- center bias helper (Triangular distribution) ---
function centerBiasedRand () {
  return (Math.random() + Math.random()) * 0.5;
}

// ✅ A3: pick spawn point (center-first, then spread) + anti-overlap
function pickSpawnPoint(rect, size, activeTargets){
  const W = Math.max(1, rect.width);
  const H = Math.max(1, rect.height);

  const minDist = size * 1.05; // กันกองเป็นพวง
  const tries   = 18;

  const toLocal = (nx, ny) => ({
    x: rect.left + W * nx,
    y: rect.top  + H * ny
  });

  const ok = (x, y) => {
    let pass = true;
    activeTargets.forEach(t=>{
      if (!t) return;
      const tx = Number(t._x);
      const ty = Number(t._y);
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
      const dx = x - tx, dy = y - ty;
      if ((dx*dx + dy*dy) < (minDist*minDist)) pass = false;
    });
    return pass;
  };

  const hasAny = activeTargets.size > 0;

  for (let i=0; i<tries; i++){
    let nx, ny;

    if (!hasAny && i < 8){
      // ลูกแรก ๆ: bias กลางจอ (หาเจอง่าย)
      const rx = centerBiasedRand();
      const ry = centerBiasedRand();
      nx = 0.18 + rx * 0.64;
      ny = 0.22 + ry * 0.62;
    } else {
      // ลูกต่อ ๆ ไป: กระจายรอบกลางจอด้วย polar
      const ang = Math.random() * Math.PI * 2;
      const rMin = 0.12;
      const rMax = 0.46;
      const rr = rMin + (Math.random() * Math.random()) * (rMax - rMin);
      nx = 0.50 + Math.cos(ang) * rr;
      ny = 0.52 + Math.sin(ang) * rr;

      nx = clamp(nx, 0.14, 0.86);
      ny = clamp(ny, 0.18, 0.86);
    }

    const p = toLocal(nx, ny);
    if (ok(p.x, p.y)) return p;
  }

  // fallback
  return toLocal(0.18 + Math.random()*0.64, 0.22 + Math.random()*0.62);
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

// ======================================================
//  Overlay fallback
// ======================================================
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
    .hvr-target.hvr-pulse{
      animation:hvrPulse .55s ease-in-out infinite;
    }
    @keyframes hvrPulse{
      0%{ transform:translate(-50%,-50%) scale(1); }
      50%{ transform:translate(-50%,-50%) scale(1.08); }
      100%{ transform:translate(-50%,-50%) scale(1); }
    }
    .hvr-wiggle{
      position:absolute;
      inset:0;
      border-radius:999px;
      display:flex;
      align-items:center;
      justify-content:center;
      pointer-events:none;
      transform: translate3d(0,0,0);
      will-change: transform;
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
  host.setAttribute('data-hvr-host', '1');
  DOC.body.appendChild(host);
  return host;
}

// ======================================================
//  Host resolver
// ======================================================
function resolveHost (rawCfg, keyName = 'spawnHost') {
  if (!DOC) return null;

  const h = rawCfg && rawCfg[keyName];
  if (h && typeof h === 'string') {
    const el = DOC.querySelector(h);
    if (el) return el;
  }
  if (h && h.nodeType === 1) return h;

  const spawnLayer = rawCfg && (rawCfg.spawnLayer || rawCfg.container);
  if (keyName === 'spawnHost' && spawnLayer && spawnLayer.nodeType === 1) return spawnLayer;

  return ensureOverlayHost();
}

// ======================================================
//  SAFE ZONE / EXCLUSION
// ======================================================
function collectExclusionElements(rawCfg){
  if (!DOC) return [];
  const out = [];

  const sel = rawCfg && rawCfg.excludeSelectors;
  if (Array.isArray(sel)) {
    sel.forEach(s=>{
      try{ DOC.querySelectorAll(String(s)).forEach(el=> out.push(el)); }catch{}
    });
  } else if (typeof sel === 'string') {
    try{ DOC.querySelectorAll(sel).forEach(el=> out.push(el)); }catch{}
  }

  const AUTO = [
    '#hha-water-header',
    '.hha-water-bar',
    '.hha-main-row',
    '#hha-card-left',
    '#hha-card-right',
    '.hha-bottom-row',
    '.hha-fever-card',
    '#hvr-crosshair',
    '.hvr-crosshair',
    '#hvr-end',
    '.hvr-end',
    '.hud'
  ];
  AUTO.forEach(s=>{
    try{ DOC.querySelectorAll(s).forEach(el=> out.push(el)); }catch{}
  });

  try{
    DOC.querySelectorAll('[data-hha-exclude="1"]').forEach(el=> out.push(el));
  }catch{}

  const uniq = [];
  const seen = new Set();
  out.forEach(el=>{
    if (!el || !el.isConnected) return;
    if (seen.has(el)) return;
    seen.add(el);
    uniq.push(el);
  });
  return uniq;
}

function computeExclusionMargins(hostRect, exEls){
  const m = { top:0, bottom:0, left:0, right:0 };
  if (!hostRect || !exEls || !exEls.length) return m;

  const hx1 = hostRect.left, hy1 = hostRect.top;
  const hx2 = hostRect.right, hy2 = hostRect.bottom;

  exEls.forEach(el=>{
    let r = null;
    try{ r = el.getBoundingClientRect(); }catch{}
    if (!r) return;

    const ox1 = Math.max(hx1, r.left);
    const oy1 = Math.max(hy1, r.top);
    const ox2 = Math.min(hx2, r.right);
    const oy2 = Math.min(hy2, r.bottom);
    if (ox2 <= ox1 || oy2 <= oy1) return;

    // reserve margin if exclusion overlaps edge zone (robust)
    if (r.top < hy1 + 80 && r.bottom > hy1) {
      m.top = Math.max(m.top, clamp(r.bottom - hy1, 0, hostRect.height));
    }
    if (r.bottom > hy2 - 80 && r.top < hy2) {
      m.bottom = Math.max(m.bottom, clamp(hy2 - r.top, 0, hostRect.height));
    }
    if (r.left < hx1 + 80 && r.right > hx1) {
      m.left = Math.max(m.left, clamp(r.right - hx1, 0, hostRect.width));
    }
    if (r.right > hx2 - 80 && r.left < hx2) {
      m.right = Math.max(m.right, clamp(hx2 - r.left, 0, hostRect.width));
    }
  });

  return m;
}

function computePlayRectFromHost (hostEl, exState) {
  const r = hostEl.getBoundingClientRect();
  const isOverlay = hostEl && hostEl.id === 'hvr-overlay-host';

  let w = Math.max(1, r.width  || (isOverlay ? (ROOT.innerWidth  || 1) : 1));
  let h = Math.max(1, r.height || (isOverlay ? (ROOT.innerHeight || 1) : 1));

  const basePadX = w * 0.10;
  const basePadTop = h * 0.12;
  const basePadBot = h * 0.12;

  const m = exState && exState.margins ? exState.margins : { top:0,bottom:0,left:0,right:0 };

  const left   = basePadX + m.left;
  const top    = basePadTop + m.top;
  const width  = Math.max(1, w - (basePadX*2) - m.left - m.right);
  const height = Math.max(1, h - basePadTop - basePadBot - m.top - m.bottom);

  return { left, top, width, height, hostRect: r, isOverlay };
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
    judge,
    onExpire,

    allowAdaptive = true,
    rhythm = null,
    trickRate = 0.08,

    spawnIntervalMul = null,
    excludeSelectors = null,

    // ✅ NEW
    boundsHost = null,
    decorateTarget = null
  } = rawCfg || {};

  const diffKey  = String(difficulty || 'normal').toLowerCase();
  const baseDiff = pickDiffConfig(modeKey, diffKey);

  const hostSpawn = resolveHost(rawCfg, 'spawnHost');
  const hostBounds = (boundsHost ? resolveHost(rawCfg, 'boundsHost') : null) || hostSpawn;

  if (!hostSpawn || !hostBounds || !DOC) {
    console.error('[mode-factory] host not found');
    return { stop () {}, shootCrosshair(){ return false; } };
  }

  let stopped = false;

  let totalDuration = clamp(duration, 20, 180);
  let secLeft       = totalDuration;
  let lastClockTs   = null;

  let activeTargets = new Set();
  let lastSpawnTs   = 0;
  let spawnCounter  = 0;

  // ---------- Adaptive ----------
  let adaptLevel   = 0;
  let curInterval  = baseDiff.spawnInterval;
  let curMaxActive = baseDiff.maxActive;
  let curScale     = baseDiff.scale;
  let curLife      = baseDiff.life;

  let sampleHits   = 0;
  let sampleMisses = 0;
  let sampleTotal  = 0;
  const ADAPT_WINDOW = 12;

  function recalcAdaptive () {
    if (!allowAdaptive) return;
    if (sampleTotal < ADAPT_WINDOW) return;

    const hitRate = sampleHits / sampleTotal;
    let next = adaptLevel;

    if (hitRate >= 0.85 && sampleMisses <= 2) next += 1;
    else if (hitRate <= 0.55 || sampleMisses >= 6) next -= 1;

    adaptLevel = clamp(next, -1, 3);

    const intervalMul = 1 - (adaptLevel * 0.12);
    const scaleMul    = 1 - (adaptLevel * 0.10);
    const lifeMul     = 1 - (adaptLevel * 0.08);
    const bonusActive = adaptLevel;

    curInterval  = clamp(baseDiff.spawnInterval * intervalMul,
                         baseDiff.spawnInterval * 0.45,
                         baseDiff.spawnInterval * 1.4);
    curScale     = clamp(baseDiff.scale * scaleMul,
                         baseDiff.scale * 0.6,
                         baseDiff.scale * 1.4);
    curLife      = clamp(baseDiff.life * lifeMul,
                         baseDiff.life * 0.55,
                         baseDiff.life * 1.15);
    curMaxActive = clamp(baseDiff.maxActive + bonusActive, 2, 10);

    sampleHits = sampleMisses = sampleTotal = 0;

    try {
      ROOT.dispatchEvent(new CustomEvent('hha:adaptive', {
        detail: { modeKey, difficulty: diffKey, level: adaptLevel, spawnInterval: curInterval, maxActive: curMaxActive, scale: curScale, life: curLife }
      }));
    } catch {}
  }

  function addSample (isHit) {
    if (!allowAdaptive) return;
    if (isHit) sampleHits++;
    else sampleMisses++;
    sampleTotal++;
    if (sampleTotal >= ADAPT_WINDOW) recalcAdaptive();
  }

  // ---------- Rhythm ----------
  let rhythmOn = false;
  let beatMs = 0;
  let lastBeatTs = 0;

  if (typeof rhythm === 'boolean') rhythmOn = rhythm;
  else if (rhythm && rhythm.enabled) rhythmOn = true;

  if (rhythmOn) {
    const bpm = clamp((rhythm && rhythm.bpm) ? rhythm.bpm : 110, 70, 160);
    beatMs = Math.round(60000 / bpm);
    try { hostBounds.classList.add('hvr-rhythm-on'); } catch {}
  }

  // ✅ Storm multiplier getter
  function getSpawnMul(){
    let m = 1;
    try{
      if (typeof spawnIntervalMul === 'function') m = Number(spawnIntervalMul()) || 1;
      else if (spawnIntervalMul != null) m = Number(spawnIntervalMul) || 1;
    }catch{}
    return clamp(m, 0.25, 2.5);
  }

  // ✅ life getter
  function getLifeMs(){
    const mul = getSpawnMul();
    const stormLifeMul = (mul < 0.99) ? 0.88 : 1.0;
    const intervalRatio = clamp(curInterval / baseDiff.spawnInterval, 0.45, 1.4);
    const ratioLifeMul = clamp(intervalRatio * 0.98, 0.55, 1.15);

    const life = curLife * stormLifeMul * ratioLifeMul;
    return Math.round(clamp(life, 520, baseDiff.life * 1.25));
  }

  // ======================================================
  //  perfect distance + crosshair shoot
  // ======================================================
  function computeHitInfoFromPoint(el, clientX, clientY){
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    const dx = (clientX - cx);
    const dy = (clientY - cy);
    const dist = Math.sqrt(dx*dx + dy*dy);
    const rad  = Math.max(1, Math.min(r.width, r.height) / 2);
    const norm = dist / rad;
    const perfect = norm <= 0.33;
    return { cx, cy, dist, norm, perfect, rect:r };
  }

  function findTargetAtPoint(clientX, clientY){
    let best = null;
    let bestD = 999999;

    activeTargets.forEach(t => {
      const el = t.el;
      if (!el || !el.isConnected) return;
      const r = el.getBoundingClientRect();
      const inside = (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom);
      if (!inside) return;
      const info = computeHitInfoFromPoint(el, clientX, clientY);
      if (info.dist < bestD) { bestD = info.dist; best = { t, info }; }
    });

    return best;
  }

  // crosshair uses bounds host (stable even if spawn layer moves)
  function getCrosshairPoint(){
    let rect = null;
    try{ rect = hostBounds.getBoundingClientRect(); }catch{}
    if (!rect) rect = { left:0, top:0, width:(ROOT.innerWidth||1), height:(ROOT.innerHeight||1) };

    const ex = exState && exState.margins ? exState.margins : { top:0,bottom:0,left:0,right:0 };
    const padX = rect.width * 0.08;
    const padY = rect.height * 0.10;

    const x = rect.left + ex.left + padX + (rect.width  - ex.left - ex.right - padX*2) * 0.50;
    const y = rect.top  + ex.top  + padY + (rect.height - ex.top  - ex.bottom - padY*2) * 0.52;
    return { x: Math.round(x), y: Math.round(y) };
  }

  function shootCrosshair(){
    if (stopped) return false;
    const p = getCrosshairPoint();
    const hit = findTargetAtPoint(p.x, p.y);
    if (!hit) return false;

    const data = hit.t;
    const info = hit.info;

    if (typeof data._hit === 'function') {
      data._hit({ __hhaSynth:true, clientX:p.x, clientY:p.y }, info);
      return true;
    }
    return false;
  }

  // ======================================================
  //  Exclusions cache (computed from boundsHost)
  // ======================================================
  const exState = {
    els: collectExclusionElements({ excludeSelectors }),
    margins: { top:0,bottom:0,left:0,right:0 },
    lastRefreshTs: 0
  };

  function refreshExclusions(ts){
    if (!DOC) return;
    if (!ts) ts = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (ts - exState.lastRefreshTs < 600) return;
    exState.lastRefreshTs = ts;

    exState.els = collectExclusionElements({ excludeSelectors });
    let hostRect = null;
    try{ hostRect = hostBounds.getBoundingClientRect(); }catch{}
    if (!hostRect) hostRect = { left:0, top:0, right:(ROOT.innerWidth||1), bottom:(ROOT.innerHeight||1), width:(ROOT.innerWidth||1), height:(ROOT.innerHeight||1) };
    exState.margins = computeExclusionMargins(hostRect, exState.els);
  }

  // ======================================================
  //  Spawn target inside hostSpawn using bounds from hostBounds
  // ======================================================
  function spawnTarget () {
    if (activeTargets.size >= curMaxActive) return;

    refreshExclusions();

    const rect = computePlayRectFromHost(hostBounds, exState);

    const poolsGood  = Array.isArray(pools.good)  ? pools.good  : [];
    const poolsBad   = Array.isArray(pools.bad)   ? pools.bad   : [];
    const poolsTrick = Array.isArray(pools.trick) ? pools.trick : [];

    let ch = '💧';
    let isGood = true;
    let isPower = false;
    let itemType = 'good';

    const canPower = Array.isArray(powerups) && powerups.length > 0;
    const canTrick = poolsTrick.length > 0 && Math.random() < trickRate;

    if (canPower && ((spawnCounter % Math.max(1, powerEvery)) === 0) && Math.random() < powerRate) {
      ch = pickOne(powerups, '⭐');
      isGood = true;
      isPower = true;
      itemType = 'power';
    } else if (canTrick) {
      ch = pickOne(poolsTrick, '💧');
      isGood = true;
      isPower = false;
      itemType = 'fakeGood';
    } else {
      const r = Math.random();
      if (r < goodRate || !poolsBad.length) {
        ch = pickOne(poolsGood, '💧');
        isGood = true;
        itemType = 'good';
      } else {
        ch = pickOne(poolsBad, '🥤');
        isGood = false;
        itemType = 'bad';
      }
    }
    spawnCounter++;

    const el = DOC.createElement('div');
    el.className = 'hvr-target';
    el.setAttribute('data-hha-tgt', '1');
    el.setAttribute('data-item-type', itemType);

    const baseSize = 78;
    const size = baseSize * curScale;

    // ✅ A3: pick point with anti-overlap
    const p = pickSpawnPoint(rect, size, activeTargets);
    const xLocal = p.x;
    const yLocal = p.y;

    el.style.position = 'absolute';
    el.style.left = xLocal + 'px';
    el.style.top  = yLocal + 'px';
    el.style.transform = 'translate(-50%, -50%) scale(0.9)';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.touchAction = 'manipulation';
    el.style.zIndex = '35';
    el.style.borderRadius = '999px';

    // wiggle layer (animated visuals)
    const wiggle = DOC.createElement('div');
    wiggle.className = 'hvr-wiggle';
    wiggle.style.borderRadius = '999px';

    // default look (can be overridden by decorateTarget)
    let bgGrad = '';
    let ringGlow = '';

    if (isPower) {
      bgGrad = 'radial-gradient(circle at 30% 25%, #facc15, #f97316)';
      ringGlow = '0 0 0 2px rgba(250,204,21,0.85), 0 0 22px rgba(250,204,21,0.9)';
    } else if (itemType === 'fakeGood') {
      bgGrad = 'radial-gradient(circle at 30% 25%, #4ade80, #16a34a)';
      ringGlow = '0 0 0 2px rgba(167,139,250,0.85), 0 0 22px rgba(167,139,250,0.9)';
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

    // ring (perfect hint)
    const ring = DOC.createElement('div');
    ring.style.position = 'absolute';
    ring.style.left = '50%';
    ring.style.top  = '50%';
    ring.style.width  = (size * 0.36) + 'px';
    ring.style.height = (size * 0.36) + 'px';
    ring.style.transform = 'translate(-50%, -50%)';
    ring.style.borderRadius = '999px';
    ring.style.border = '2px solid rgba(255,255,255,0.35)';
    ring.style.boxShadow = '0 0 12px rgba(255,255,255,0.18)';
    ring.style.pointerEvents = 'none';

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

    // trick badge
    let badge = null;
    if (itemType === 'fakeGood') {
      badge = DOC.createElement('div');
      badge.textContent = '✨';
      badge.style.position = 'absolute';
      badge.style.right = '8px';
      badge.style.top = '6px';
      badge.style.fontSize = '18px';
      badge.style.filter = 'drop-shadow(0 3px 4px rgba(15,23,42,0.9))';
      badge.style.pointerEvents = 'none';
    }

    wiggle.appendChild(ring);
    wiggle.appendChild(inner);
    if (badge) wiggle.appendChild(badge);
    el.appendChild(wiggle);

    if (rhythmOn) el.classList.add('hvr-pulse');

    ROOT.requestAnimationFrame(() => {
      el.style.transform = 'translate(-50%, -50%) scale(1)';
    });

    const lifeMs = getLifeMs();

    const data = {
      el,
      ch,
      isGood,
      isPower,
      itemType,
      bornAt: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
      life: lifeMs,
      _hit: null,

      // ✅ A3: keep center for overlap check
      _x: xLocal,
      _y: yLocal
    };

    // allow per-game decorate
    try{
      if (typeof decorateTarget === 'function'){
        decorateTarget(el, { wiggle, inner, icon, ring, badge }, data, {
          size,
          modeKey,
          difficulty: diffKey,
          spawnMul: getSpawnMul(),
          curScale,
          adaptLevel
        });
      }
    }catch(err){
      console.warn('[mode-factory] decorateTarget error', err);
    }

    activeTargets.add(data);
    hostSpawn.appendChild(el);

    function consumeHit(evOrSynth, hitInfoOpt){
      if (stopped) return;
      if (!activeTargets.has(data)) return;

      let keepRect = null;
      try{ keepRect = el.getBoundingClientRect(); }catch{}

      activeTargets.delete(data);
      try { el.removeEventListener('pointerdown', handleHit); } catch {}
      try { el.removeEventListener('click', handleHit); } catch {}
      try { el.removeEventListener('touchstart', handleHit); } catch {}
      try { hostSpawn.removeChild(el); } catch {}

      let res = null;
      if (typeof judge === 'function') {
        const xy = (evOrSynth && evOrSynth.__hhaSynth)
          ? { x: evOrSynth.clientX, y: evOrSynth.clientY }
          : getEventXY(evOrSynth || {});
        const info = hitInfoOpt || (keepRect ? (function(){
          const cx = keepRect.left + keepRect.width/2;
          const cy = keepRect.top  + keepRect.height/2;
          const dx = (xy.x - cx);
          const dy = (xy.y - cy);
          const dist = Math.sqrt(dx*dx + dy*dy);
          const rad  = Math.max(1, Math.min(keepRect.width, keepRect.height) / 2);
          const norm = dist / rad;
          const perfect = norm <= 0.33;
          return { cx, cy, dist, norm, perfect, rect: keepRect };
        })() : computeHitInfoFromPoint(el, xy.x, xy.y));

        const ctx = {
          clientX: xy.x, clientY: xy.y, cx: xy.x, cy: xy.y,
          isGood, isPower,
          itemType,
          hitPerfect: !!info.perfect,
          hitDistNorm: Number(info.norm || 1),
          targetRect: info.rect
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
    }

    const handleHit = (ev) => {
      if (stopped) return;
      ev.preventDefault();
      ev.stopPropagation();
      consumeHit(ev, null);
    };

    data._hit = consumeHit;

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
      try { hostSpawn.removeChild(el); } catch {}

      try { if (typeof onExpire === 'function') onExpire({ ch, isGood, isPower, itemType }); } catch (err) {
        console.error('[mode-factory] onExpire error', err);
      }
    }, lifeMs);
  }

  // ---------- clock (hha:time) ----------
  function dispatchTime (sec) {
    try { ROOT.dispatchEvent(new CustomEvent('hha:time', { detail: { sec } })); } catch {}
  }

  let rafId = null;

  function loop (ts) {
    if (stopped) return;

    refreshExclusions(ts);

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

      const mul = getSpawnMul();
      const effInterval = Math.max(35, curInterval * mul);

      try{
        if (mul < 0.99) { hostBounds.classList.add('hvr-storm-on'); hostSpawn.classList.add('hvr-storm-on'); }
        else { hostBounds.classList.remove('hvr-storm-on'); hostSpawn.classList.remove('hvr-storm-on'); }
      }catch{}

      if (rhythmOn && beatMs > 0) {
        if (!lastBeatTs) lastBeatTs = ts;
        const dtBeat = ts - lastBeatTs;
        if (dtBeat >= beatMs) {
          spawnTarget();
          lastBeatTs += Math.floor(dtBeat / beatMs) * beatMs;
        }
      } else {
        const dtSpawn = ts - lastSpawnTs;
        if (dtSpawn >= effInterval) {
          spawnTarget();
          lastSpawnTs = ts;
        }
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
    },
    shootCrosshair
  };
}

export default { boot };