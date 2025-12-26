// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (adaptive) สำหรับ HeroHealth VR/Quest — PRODUCTION
// ✅ spawnHost / boundsHost
// ✅ SAFEZONE (exclusion auto)
// ✅ EDGE-FIX: ignore spawnHost transform (ใช้ boundsHost rect)
// ✅ FULL-SPREAD: spawnAroundCrosshair:false -> uniform in playRect
// ✅ GRID9 spread: spawnStrategy:'grid9'
// ✅ randomRing: dashed/dotted rotate
// ✅ NEW: Seeded RNG (cfg.seed) + cfg.rng override (สำคัญสำหรับ research)
// ✅ crosshair shooting + perfect distance
// ✅ PATCH: auto-relax safezone เมื่อ playRect เล็กเกิน (กันอาการ "เป้าเกิดที่เดียว")
// ✅ PATCH B2: Laser warning overlay (BAD only) + hha:tick laser-warn/laser-fire

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp (v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// ---------- Seeded RNG (xmur3 + sfc32) ----------
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for (let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= (h >>> 16);
    return h >>> 0;
  };
}
function sfc32(a,b,c,d){
  return function(){
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
function makeSeededRng(seedStr){
  const seed = String(seedStr || '').trim();
  if (!seed) return null;
  const h = xmur3(seed);
  const a = h(), b = h(), c = h(), d = h();
  const rnd = sfc32(a,b,c,d);
  return { random: () => rnd() };
}

// ---------- random helpers (use rng) ----------
function pickOne (arr, fallback = null, rnd = Math.random) {
  if (!Array.isArray(arr) || !arr.length) return fallback;
  const i = Math.floor(rnd() * arr.length);
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

function rectFromWHLT(left, top, width, height){
  width = Math.max(1, width||1);
  height = Math.max(1, height||1);
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function getRectSafe(el){
  try{
    const r = el.getBoundingClientRect();
    if (r && Number.isFinite(r.left) && Number.isFinite(r.top) && r.width > 0 && r.height > 0) return r;
  }catch{}
  return null;
}

function hasTransform(el){
  try{
    const cs = ROOT.getComputedStyle ? ROOT.getComputedStyle(el) : null;
    const t = cs && cs.transform;
    return !!(t && t !== 'none');
  }catch{ return false; }
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
    .hvr-overlay-host .hvr-target{ pointer-events:auto; }
    .hvr-target{ pointer-events:auto; } /* ✅ PATCH: เผื่อ spawnHost ไม่ใช่ overlay */
    .hvr-target.hvr-pulse{ animation:hvrPulse .55s ease-in-out infinite; }
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
    .hvr-ring{
      position:absolute;
      left:50%; top:50%;
      transform:translate(-50%,-50%);
      border-radius:999px;
      pointer-events:none;
      opacity:.95;
      filter: drop-shadow(0 0 10px rgba(255,255,255,.10));
    }
    .hvr-ring.spin{ animation: hvrSpin var(--spin,1.25s) linear infinite; }
    .hvr-ring.spin.rev{ animation-direction: reverse; }
    @keyframes hvrSpin{
      from{ transform:translate(-50%,-50%) rotate(0deg); }
      to  { transform:translate(-50%,-50%) rotate(360deg); }
    }

    /* === PATCH B2: Laser warning overlay (BAD only) === */
    .hvr-laser{
      position:absolute;
      left:50%; top:50%;
      width:140%;
      height:10px;
      transform: translate(-50%,-50%) rotate(var(--laserRot, -18deg));
      border-radius:999px;
      opacity:0;
      pointer-events:none;
      will-change: transform, opacity, filter;
      background: linear-gradient(90deg,
        rgba(255,0,0,0),
        rgba(255,80,96,.18),
        rgba(255,80,96,.85),
        rgba(255,80,96,.18),
        rgba(255,0,0,0)
      );
      box-shadow:
        0 0 0 1px rgba(255,80,96,.10),
        0 0 18px rgba(255,80,96,.38),
        0 0 34px rgba(255,80,96,.22);
      filter: drop-shadow(0 0 14px rgba(255,80,96,.22));
    }
    .hvr-target.hvr-laser-warn .hvr-laser{
      opacity: .95;
      animation: hvrLaserScan .22s ease-in-out infinite;
    }
    .hvr-target.hvr-laser-fire .hvr-laser{
      height: 12px;
      opacity: 1;
      animation: hvrLaserFire .14s ease-in-out infinite;
      box-shadow:
        0 0 0 1px rgba(255,80,96,.18),
        0 0 28px rgba(255,80,96,.55),
        0 0 54px rgba(255,80,96,.35);
    }
    @keyframes hvrLaserScan{
      0%   { transform: translate(-50%,-50%) rotate(var(--laserRot, -18deg)) translateX(-10%); opacity:.65; }
      50%  { transform: translate(-50%,-50%) rotate(var(--laserRot, -18deg)) translateX(10%);  opacity:1; }
      100% { transform: translate(-50%,-50%) rotate(var(--laserRot, -18deg)) translateX(-10%); opacity:.70; }
    }
    @keyframes hvrLaserFire{
      0%   { opacity:.65; filter: brightness(1.0) saturate(1.1); }
      50%  { opacity:1;   filter: brightness(1.25) saturate(1.25); }
      100% { opacity:.70; filter: brightness(1.0) saturate(1.1); }
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
    console.warn('[mode-factory] selector not found:', keyName, h, '→ fallback overlay host');
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
    sel.forEach(s=>{ try{ DOC.querySelectorAll(String(s)).forEach(el=> out.push(el)); }catch{} });
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
    '.hvr-end'
  ];
  AUTO.forEach(s=>{ try{ DOC.querySelectorAll(s).forEach(el=> out.push(el)); }catch{} });

  try{ DOC.querySelectorAll('[data-hha-exclude="1"]').forEach(el=> out.push(el)); }catch{}

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

    // ข้าม wrapper เต็มจอ
    const coverW = r.width  / Math.max(1, hostRect.width);
    const coverH = r.height / Math.max(1, hostRect.height);
    if (coverW > 0.78 && coverH > 0.78) return;

    const ox1 = Math.max(hx1, r.left);
    const oy1 = Math.max(hy1, r.top);
    const ox2 = Math.min(hx2, r.right);
    const oy2 = Math.min(hy2, r.bottom);
    if (ox2 <= ox1 || oy2 <= oy1) return;

    if (r.top < hy1 + 90 && r.bottom > hy1) m.top = Math.max(m.top, clamp(r.bottom - hy1, 0, hostRect.height));
    if (r.bottom > hy2 - 90 && r.top < hy2) m.bottom = Math.max(m.bottom, clamp(hy2 - r.top, 0, hostRect.height));
    if (r.left < hx1 + 90 && r.right > hx1) m.left = Math.max(m.left, clamp(r.right - hx1, 0, hostRect.width));
    if (r.right > hx2 - 90 && r.left < hx2) m.right = Math.max(m.right, clamp(hx2 - r.left, 0, hostRect.width));
  });

  const capX = hostRect.width  * 0.42;
  const capY = hostRect.height * 0.46;
  m.left   = Math.min(m.left, capX);
  m.right  = Math.min(m.right, capX);
  m.top    = Math.min(m.top, capY);
  m.bottom = Math.min(m.bottom, capY);
  return m;
}

/**
 * ✅ PATCH: padding + relax margins
 * playPadXFrac / playPadTopFrac / playPadBotFrac : ปรับได้จาก cfg
 * relaxK 0..1 : 0=เต็ม safezone, 0.6=ผ่อน safezone 60% (พื้นที่เล่นใหญ่ขึ้น)
 */
function computePlayRectFromHost (hostEl, exState, padCfg, relaxK = 0) {
  const r = hostEl.getBoundingClientRect();
  const isOverlay = hostEl && hostEl.id === 'hvr-overlay-host';

  let w = Math.max(1, r.width  || (isOverlay ? (ROOT.innerWidth  || 1) : 1));
  let h = Math.max(1, r.height || (isOverlay ? (ROOT.innerHeight || 1) : 1));

  const px = clamp(padCfg && padCfg.xFrac != null ? padCfg.xFrac : 0.10, 0.02, 0.18);
  const pt = clamp(padCfg && padCfg.topFrac != null ? padCfg.topFrac : 0.12, 0.03, 0.20);
  const pb = clamp(padCfg && padCfg.botFrac != null ? padCfg.botFrac : 0.12, 0.03, 0.22);

  const basePadX   = w * px;
  const basePadTop = h * pt;
  const basePadBot = h * pb;

  const mm0 = exState && exState.margins ? exState.margins : { top:0,bottom:0,left:0,right:0 };
  const k = clamp(1 - Number(relaxK || 0), 0, 1);
  const mm = {
    top:    mm0.top    * k,
    bottom: mm0.bottom * k,
    left:   mm0.left   * k,
    right:  mm0.right  * k
  };

  const left   = basePadX + mm.left;
  const top    = basePadTop + mm.top;
  const width  = Math.max(1, w - (basePadX*2) - mm.left - mm.right);
  const height = Math.max(1, h - basePadTop - basePadBot - mm.top - mm.bottom);

  return { left, top, width, height, hostRect: r, isOverlay, relaxK };
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

    boundsHost = null,
    decorateTarget = null,

    // spawn behavior
    spawnAroundCrosshair = true,
    spawnRadiusX = 0.34,
    spawnRadiusY = 0.30,
    minSeparation = 0.95,
    maxSpawnTries = 14,

    spawnStrategy = 'random',   // 'random' | 'grid9'

    // ✅ NEW: rng/seed
    rng  = null,
    seed = null,

    // ✅ PATCH: play padding (optional)
    playPadXFrac = 0.10,
    playPadTopFrac = 0.12,
    playPadBotFrac = 0.12,

    // ✅ PATCH: safezone relax behavior
    autoRelaxSafezone = true,     // ถ้า playRect เล็กเกิน -> ผ่อน safezone อัตโนมัติ
    relaxThresholdMul = 1.35,     // ถ้า playRect < size*mul => ถือว่าเล็ก
    relaxStep = 0.35,             // ความแรงในการผ่อนครั้งแรก
    relaxStep2 = 0.65             // ถ้ายังเล็กอยู่ ผ่อนอีก
  } = rawCfg || {};

  // RNG selection
  const seeded = (!rng && seed) ? makeSeededRng(seed) : null;
  const RND = (rng && typeof rng.random === 'function') ? rng : seeded;
  const rand = RND ? (() => RND.random()) : Math.random;

  const diffKey  = String(difficulty || 'normal').toLowerCase();
  const baseDiff = pickDiffConfig(modeKey, diffKey);

  const hostSpawn  = resolveHost(rawCfg, 'spawnHost');
  const hostBounds = ((boundsHost != null) ? resolveHost(rawCfg, 'boundsHost') : null) || hostSpawn;

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

    curInterval  = clamp(baseDiff.spawnInterval * intervalMul, baseDiff.spawnInterval * 0.45, baseDiff.spawnInterval * 1.4);
    curScale     = clamp(baseDiff.scale * scaleMul, baseDiff.scale * 0.6, baseDiff.scale * 1.4);
    curLife      = clamp(baseDiff.life * lifeMul, baseDiff.life * 0.55, baseDiff.life * 1.15);
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

  function getSpawnMul(){
    let m = 1;
    try{
      if (typeof spawnIntervalMul === 'function') m = Number(spawnIntervalMul()) || 1;
      else if (spawnIntervalMul != null) m = Number(spawnIntervalMul) || 1;
    }catch{}
    return clamp(m, 0.25, 2.5);
  }

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
    if (!hostRect) hostRect = rectFromWHLT(0,0,(ROOT.innerWidth||1),(ROOT.innerHeight||1));
    exState.margins = computeExclusionMargins(hostRect, exState.els);
  }

  function getCrosshairPoint(){
    let rect = null;
    try{ rect = hostBounds.getBoundingClientRect(); }catch{}
    if (!rect) rect = rectFromWHLT(0,0,(ROOT.innerWidth||1),(ROOT.innerHeight||1));

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
  //  Spawn rects (EDGE-FIX: ignore transform)
  // ======================================================
  function getRectsForSpawn(){
    const bRect = getRectSafe(hostBounds) || rectFromWHLT(0,0,(ROOT.innerWidth||1),(ROOT.innerHeight||1));
    let sRect = getRectSafe(hostSpawn);
    if (!sRect) sRect = bRect;

    const spawnHasT = hasTransform(hostSpawn);
    if (spawnHasT) sRect = rectFromWHLT(bRect.left, bRect.top, bRect.width, bRect.height);

    return { bRect, sRect, spawnHasT };
  }

  const padCfg = { xFrac: playPadXFrac, topFrac: playPadTopFrac, botFrac: playPadBotFrac };

  function makePlayLocalRect(relaxK=0){
    const { bRect, sRect } = getRectsForSpawn();
    const pr = computePlayRectFromHost(hostBounds, exState, padCfg, relaxK);

    const cL = bRect.left + pr.left;
    const cT = bRect.top  + pr.top;

    const l = cL - sRect.left;
    const t = cT - sRect.top;
    const w = pr.width;
    const h = pr.height;

    return { left:l, top:t, width:w, height:h, bRect, sRect, relaxK };
  }

  function getExistingCentersLocal(sRect){
    const out = [];
    activeTargets.forEach(t=>{
      const el = t.el;
      if (!el || !el.isConnected) return;
      let r=null;
      try{ r = el.getBoundingClientRect(); }catch{}
      if (!r) return;
      out.push({ x:(r.left + r.width/2) - sRect.left, y:(r.top + r.height/2) - sRect.top });
    });
    return out;
  }

  // ✅ grid spread state
  const grid9 = { counts: new Array(9).fill(0) };
  function pickGridCell9(){
    let min = 1e9;
    for (let i=0;i<9;i++) min = Math.min(min, grid9.counts[i]);
    const ties = [];
    for (let i=0;i<9;i++) if (grid9.counts[i] === min) ties.push(i);
    return ties[Math.floor(rand()*ties.length)];
  }

  function pickSpawnPointLocal(playLocal, sizePx){
    const { sRect } = playLocal;
    const centers = getExistingCentersLocal(sRect);

    const minDist = Math.max(18, sizePx * minSeparation);
    const tries = clamp(maxSpawnTries, 6, 30);

    let ax = playLocal.left + playLocal.width * 0.50;
    let ay = playLocal.top  + playLocal.height * 0.52;

    if (spawnAroundCrosshair) {
      const cp = getCrosshairPoint();
      ax = cp.x - sRect.left;
      ay = cp.y - sRect.top;
    }

    const rx = playLocal.width  * clamp(spawnRadiusX, 0.18, 0.98);
    const ry = playLocal.height * clamp(spawnRadiusY, 0.16, 0.98);

    const maxVisualScale = 1.10;
    const pad = Math.max(12, (sizePx * maxVisualScale) * 0.62);

    const minX = playLocal.left + pad;
    const maxX = playLocal.left + playLocal.width  - pad;
    const minY = playLocal.top  + pad;
    const maxY = playLocal.top  + playLocal.height - pad;

    // ✅ PATCH: ถ้า playRect เล็กเกิน (มือถือ) จะกลับไป clamp จุดเดิม ทำให้เหมือนเกิดที่เดียว
    // เราไม่แก้ในนี้โดยตรง แต่ spawnTarget จะผ่อน safezone แล้วค่อยเรียกใหม่
    const rectOk = (playLocal.width >= sizePx*relaxThresholdMul) && (playLocal.height >= sizePx*relaxThresholdMul);
    if (!rectOk) return { x: clamp(ax, minX, maxX), y: clamp(ay, minY, maxY), ok:false };

    function tri(){ return (rand() + rand() - 1); }

    let best = null;
    let bestScore = -1;

    const useUniform = !spawnAroundCrosshair;
    const useGrid9 = (useUniform && String(spawnStrategy||'').toLowerCase() === 'grid9');

    function pointFromGrid9(){
      const idx = pickGridCell9();
      const col = idx % 3;
      const row = Math.floor(idx / 3);

      const w = (maxX - minX);
      const h = (maxY - minY);

      const cw = w / 3;
      const ch = h / 3;

      const gx1 = minX + col*cw;
      const gy1 = minY + row*ch;
      const gx2 = gx1 + cw;
      const gy2 = gy1 + ch;

      const x = gx1 + rand() * Math.max(1, (gx2 - gx1));
      const y = gy1 + rand() * Math.max(1, (gy2 - gy1));
      return { x, y, idx };
    }

    for (let i=0;i<tries;i++){
      let x, y, cellIdx = -1;

      if (useGrid9){
        const p = pointFromGrid9();
        x = p.x; y = p.y; cellIdx = p.idx;
      } else {
        x = useUniform ? (minX + rand() * (maxX - minX)) : clamp(ax + tri()*rx, minX, maxX);
        y = useUniform ? (minY + rand() * (maxY - minY)) : clamp(ay + tri()*ry, minY, maxY);
      }

      let ok = true;
      let nearest = 1e9;
      for (let k=0;k<centers.length;k++){
        const dx = x - centers[k].x;
        const dy = y - centers[k].y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        nearest = Math.min(nearest, d);
        if (d < minDist) { ok = false; break; }
      }

      const score = ok ? (100000 + nearest) : nearest;
      if (score > bestScore) { bestScore = score; best = { x, y, ok, cellIdx }; }

      if (ok){
        // ✅ PATCH: นับ cell เฉพาะตอน “ผ่านจริง”
        if (useGrid9 && cellIdx >= 0) grid9.counts[cellIdx] += 1;
        return { x, y, ok:true };
      }
    }

    if (best && best.ok && useGrid9 && best.cellIdx >= 0) grid9.counts[best.cellIdx] += 1;
    return best || { x: clamp(ax, minX, maxX), y: clamp(ay, minY, maxY), ok:false };
  }

  // ======================================================
  //  Spawn target
  // ======================================================
  function spawnTarget () {
    if (activeTargets.size >= curMaxActive) return;

    refreshExclusions();

    const baseSize = 78;
    const size = baseSize * curScale;

    // ✅ PATCH: auto-relax safezone ถ้าพื้นที่เล็กเกิน
    let playLocal = makePlayLocalRect(0);

    // ลองตำแหน่งครั้งแรก
    let p = pickSpawnPointLocal(playLocal, size);

    if (autoRelaxSafezone && p && p.ok === false){
      // ผ่อนครั้งที่ 1
      playLocal = makePlayLocalRect(relaxStep);
      p = pickSpawnPointLocal(playLocal, size);

      if (p && p.ok === false){
        // ผ่อนครั้งที่ 2 (แรงขึ้น)
        playLocal = makePlayLocalRect(relaxStep2);
        p = pickSpawnPointLocal(playLocal, size);
      }
    }

    const poolsGood  = Array.isArray(pools.good)  ? pools.good  : [];
    const poolsBad   = Array.isArray(pools.bad)   ? pools.bad   : [];
    const poolsTrick = Array.isArray(pools.trick) ? pools.trick : [];

    let ch = '💧';
    let isGood = true;
    let isPower = false;
    let itemType = 'good';

    const canPower = Array.isArray(powerups) && powerups.length > 0;
    const canTrick = poolsTrick.length > 0 && rand() < trickRate;

    if (canPower && ((spawnCounter % Math.max(1, powerEvery)) === 0) && rand() < powerRate) {
      ch = pickOne(powerups, '⭐', rand);
      isGood = true;
      isPower = true;
      itemType = 'power';
    } else if (canTrick) {
      ch = pickOne(poolsTrick, '💧', rand);
      isGood = true;
      isPower = false;
      itemType = 'fakeGood';
    } else {
      const r = rand();
      if (r < goodRate || !poolsBad.length) {
        ch = pickOne(poolsGood, '💧', rand);
        isGood = true;
        itemType = 'good';
      } else {
        ch = pickOne(poolsBad, '🥤', rand);
        isGood = false;
        itemType = 'bad';
      }
    }
    spawnCounter++;

    const el = DOC.createElement('div');
    el.className = 'hvr-target';
    el.setAttribute('data-hha-tgt', '1');
    el.setAttribute('data-item-type', itemType);

    el.style.position = 'absolute';
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
    el.style.transform = 'translate(-50%, -50%) scale(0.9)';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.touchAction = 'manipulation';
    el.style.zIndex = '35';
    el.style.borderRadius = '999px';
    el.style.pointerEvents = 'auto';

    const wiggle = DOC.createElement('div');
    wiggle.className = 'hvr-wiggle';
    wiggle.style.borderRadius = '999px';

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

    // randomRing
    const ring = DOC.createElement('div');
    ring.className = 'hvr-ring spin' + (rand()<0.35 ? ' rev' : '');
    ring.style.width  = (size * 0.92) + 'px';
    ring.style.height = (size * 0.92) + 'px';
    ring.style.border = '2px dashed rgba(255,255,255,0.42)';
    ring.style.outline = '1px solid rgba(255,255,255,0.10)';
    ring.style.outlineOffset = '-6px';
    ring.style.setProperty('--spin', (0.92 + rand()*0.9).toFixed(2) + 's');
    ring.style.borderStyle = (rand()<0.55 ? 'dashed' : 'dotted');
    ring.style.borderWidth = (rand()<0.5 ? '2px' : '3px');
    ring.style.opacity = (0.86 + rand()*0.12).toFixed(2);
    ring.style.filter = 'drop-shadow(0 0 12px rgba(255,255,255,.10))';

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

    // ✅ PATCH B2: Laser element (BAD only)
    let laser = null;
    if (itemType === 'bad') {
      laser = DOC.createElement('div');
      laser.className = 'hvr-laser';
      laser.style.setProperty('--laserRot', ((-22 + rand()*44).toFixed(1)) + 'deg');
      wiggle.appendChild(laser);
    }

    el.appendChild(wiggle);

    if (rhythmOn) el.classList.add('hvr-pulse');

    ROOT.requestAnimationFrame(() => {
      el.style.transform = 'translate(-50%, -50%) scale(1)';
    });

    const lifeMs = getLifeMs();

    // ✅ PATCH B2: laser timers (must be visible to consumeHit/expire)
    let laserWarnTimer = 0;
    let laserFireTimer = 0;

    // schedule warn/fire (BAD only)
    if (itemType === 'bad') {
      const warnAt = Math.max(120, lifeMs - 360);
      const fireAt = Math.max(80,  lifeMs - 160);

      laserWarnTimer = ROOT.setTimeout(() => {
        try { el.classList.add('hvr-laser-warn'); } catch {}
        try { ROOT.dispatchEvent(new CustomEvent('hha:tick', { detail: { kind: 'laser-warn', intensity: 1.0 } })); } catch {}
      }, warnAt);

      laserFireTimer = ROOT.setTimeout(() => {
        try {
          el.classList.remove('hvr-laser-warn');
          el.classList.add('hvr-laser-fire');
        } catch {}
        try { ROOT.dispatchEvent(new CustomEvent('hha:tick', { detail: { kind: 'laser-fire', intensity: 1.15 } })); } catch {}
      }, fireAt);
    }

    const data = {
      el, ch, isGood, isPower, itemType,
      bornAt: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
      life: lifeMs,
      _hit: null
    };

    try{
      if (typeof decorateTarget === 'function'){
        decorateTarget(el, { wiggle, inner, icon, ring, badge, laser }, data, {
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

      // ✅ clear laser timers
      try { if (laserWarnTimer) ROOT.clearTimeout(laserWarnTimer); } catch {}
      try { if (laserFireTimer) ROOT.clearTimeout(laserFireTimer); } catch {}

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

      // ✅ clear laser timers
      try { if (laserWarnTimer) ROOT.clearTimeout(laserWarnTimer); } catch {}
      try { if (laserFireTimer) ROOT.clearTimeout(laserFireTimer); } catch {}

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