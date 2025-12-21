// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (adaptive) สำหรับ HeroHealth VR/Quest
// ✅ PATCH(A+): spawnHost/spawnLayer/container → เป้าลง playfield
// ✅ NEW: crosshair shooting via shootCrosshair()
// ✅ NEW: perfect ring distance (ctx.hitPerfect, ctx.hitDistNorm)
// ✅ PATCH(Storm): spawnIntervalMul (number|fn) ทำให้ spawn ถี่ขึ้นจริง ๆ
// ✅ PATCH(LIFE): อายุเป้าปรับตาม adaptive + storm จริง
// ✅ PATCH(SAFEZONE): กัน spawn ทับ HUD
// ✅ UPGRADE VISUAL: target bubble (no more squares) + 2-layer parallax inside target + float/sway
// ✅ UPGRADE STORM: stronger sway + speedlines

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
//  Overlay fallback (global styles)
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

    /* ===== Target pulse (optional rhythm) ===== */
    .hvr-target.hvr-pulse .hvr-move{
      animation: hvrPulse .55s ease-in-out infinite;
    }
    @keyframes hvrPulse{
      0%{ transform: translate3d(0,0,0) scale(1); }
      50%{ transform: translate3d(0,0,0) scale(1.07); }
      100%{ transform: translate3d(0,0,0) scale(1); }
    }

    /* ===== BEAUTY: bubble target (fix square look) ===== */
    .hvr-target{
      border-radius:999px;
      overflow:visible;
      transform: translate(-50%, -50%);
      will-change: transform;
      user-select:none;
      -webkit-user-select:none;
      -webkit-tap-highlight-color: transparent;
    }
    .hvr-target .hvr-move{
      width:100%;
      height:100%;
      border-radius:999px;
      position:relative;
      overflow:visible;
      transform: scale(0.86);
      transition: transform 120ms ease;
      will-change: transform, filter;
    }
    .hvr-target .hvr-glint{
      position:absolute;
      inset:-2px;
      border-radius:999px;
      pointer-events:none;
      background: radial-gradient(circle at 30% 25%,
                  rgba(255,255,255,.62),
                  rgba(255,255,255,0) 58%);
      mix-blend-mode:screen;
      opacity:.72;
      filter: blur(.1px);
    }
    .hvr-target.bad .hvr-glint{ opacity:.55; }

    /* inner parallax: back glow + front icon drift */
    .hvr-target .hvr-back{
      position:absolute;
      inset:0;
      border-radius:999px;
      pointer-events:none;
      opacity:.95;
      filter: blur(.2px);
      mix-blend-mode: screen;
      transform: translate3d(var(--bx,0px), var(--by,0px), 0);
    }
    .hvr-target .hvr-front{
      position:absolute;
      inset:0;
      border-radius:999px;
      display:flex;
      align-items:center;
      justify-content:center;
      transform: translate3d(var(--fx,0px), var(--fy,0px), 0);
    }

    .hvr-target .hvr-ring{
      position:absolute;
      left:50%;
      top:50%;
      width:38%;
      height:38%;
      transform: translate(-50%,-50%);
      border-radius:999px;
      border:2px solid rgba(255,255,255,0.34);
      box-shadow: 0 0 14px rgba(255,255,255,0.18);
      pointer-events:none;
    }

    /* float/sway movement (default) */
    .hvr-target .hvr-move.hvr-float{
      animation: hvrFloat var(--fd,2.9s) ease-in-out infinite;
    }
    @keyframes hvrFloat{
      0%   { transform: translate3d(0,0,0) rotate(0deg) scale(0.90); filter:none; }
      25%  { transform: translate3d(calc(var(--ax,7px) * .70), calc(var(--ay,6px) * -.45), 0) rotate(calc(var(--ar,3deg) * .38)) scale(0.98); }
      50%  { transform: translate3d(calc(var(--ax,7px) * -.55), calc(var(--ay,6px) * .55), 0) rotate(calc(var(--ar,3deg) * -.42)) scale(1.00); }
      75%  { transform: translate3d(calc(var(--ax,7px) * .45), calc(var(--ay,6px) * .40), 0) rotate(calc(var(--ar,3deg) * .30)) scale(0.99); }
      100% { transform: translate3d(0,0,0) rotate(0deg) scale(0.90); }
    }

    /* STORM: stronger sway + speed lines */
    .hvr-storm-on .hvr-target .hvr-move.hvr-float{
      animation: hvrFloatStorm var(--sd,.75s) ease-in-out infinite;
      filter:
        drop-shadow(1.4px 0 rgba(255,0,80,.20))
        drop-shadow(-1.4px 0 rgba(0,255,255,.18))
        saturate(1.06) contrast(1.04);
    }
    @keyframes hvrFloatStorm{
      0%   { transform: translate3d(0,0,0) rotate(0deg) scale(0.94); }
      20%  { transform: translate3d(calc(var(--ax,10px) * 1.15), calc(var(--ay,9px) * -.85), 0) rotate(calc(var(--ar,4deg) * .75)) scale(1.03); }
      50%  { transform: translate3d(calc(var(--ax,10px) * -1.10), calc(var(--ay,9px) * .90), 0) rotate(calc(var(--ar,4deg) * -0.85)) scale(1.06); }
      80%  { transform: translate3d(calc(var(--ax,10px) * 0.95), calc(var(--ay,9px) * 0.75), 0) rotate(calc(var(--ar,4deg) * .60)) scale(1.02); }
      100% { transform: translate3d(0,0,0) rotate(0deg) scale(0.94); }
    }

    .hvr-target .hvr-speedlines{
      position:absolute;
      inset:-16px;
      border-radius:999px;
      pointer-events:none;
      opacity:0;
      filter: blur(.2px);
      background:
        repeating-linear-gradient(120deg,
          rgba(255,255,255,0.00) 0 10px,
          rgba(255,255,255,0.12) 10px 12px,
          rgba(255,255,255,0.00) 12px 22px);
      mask-image: radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0 44%, rgba(0,0,0,1) 60% 100%);
      mix-blend-mode: screen;
      animation: hvrSpeed 420ms linear infinite;
    }
    @keyframes hvrSpeed{
      0%{ transform: translate3d(-16px, 10px, 0) rotate(0deg); opacity:.05; }
      30%{ opacity:.18; }
      100%{ transform: translate3d(18px, -12px, 0) rotate(0deg); opacity:.05; }
    }
    .hvr-storm-on .hvr-target .hvr-speedlines{
      opacity:.60;
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
function resolveHost (rawCfg) {
  if (!DOC) return null;

  const spawnHost = rawCfg && rawCfg.spawnHost;
  if (spawnHost && typeof spawnHost === 'string') {
    const el = DOC.querySelector(spawnHost);
    if (el) return el;
  }
  if (spawnHost && spawnHost.nodeType === 1) return spawnHost;

  const spawnLayer = rawCfg && (rawCfg.spawnLayer || rawCfg.container);
  if (spawnLayer && spawnLayer.nodeType === 1) return spawnLayer;

  return ensureOverlayHost();
}

// ======================================================
//  SAFE ZONE / EXCLUSION (กันทับ HUD)
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
    '.hud',
    '#hvr-start'
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

    if (r.top <= hy1 + 2 && r.bottom > hy1) {
      m.top = Math.max(m.top, clamp(r.bottom - hy1, 0, hostRect.height));
    }
    if (r.bottom >= hy2 - 2 && r.top < hy2) {
      m.bottom = Math.max(m.bottom, clamp(hy2 - r.top, 0, hostRect.height));
    }
    if (r.left <= hx1 + 2 && r.right > hx1) {
      m.left = Math.max(m.left, clamp(r.right - hx1, 0, hostRect.width));
    }
    if (r.right >= hx2 - 2 && r.left < hx2) {
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
    spawnStyle = 'pop',
    judge,
    onExpire,

    // NEW
    allowAdaptive = true,
    rhythm = null,
    trickRate = 0.08,

    // Storm multiplier (number OR function)
    spawnIntervalMul = null,

    // Safe zone
    excludeSelectors = null
  } = rawCfg || {};

  const diffKey  = String(difficulty || 'normal').toLowerCase();
  const baseDiff = pickDiffConfig(modeKey, diffKey);

  const host = resolveHost(rawCfg);
  if (!host || !DOC) {
    console.error('[mode-factory] host not found');
    return { stop () {}, shootCrosshair(){ return false; } };
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
    try { host.classList.add('hvr-rhythm-on'); } catch {}
  }

  // Storm multiplier getter
  function getSpawnMul(){
    let m = 1;
    try{
      if (typeof spawnIntervalMul === 'function') m = Number(spawnIntervalMul()) || 1;
      else if (spawnIntervalMul != null) m = Number(spawnIntervalMul) || 1;
    }catch{}
    return clamp(m, 0.25, 2.5);
  }

  // life getter (adaptive + storm)
  function getLifeMs(){
    const mul = getSpawnMul();
    const stormLifeMul = (mul < 0.99) ? 0.86 : 1.0;
    const intervalRatio = clamp(curInterval / baseDiff.spawnInterval, 0.45, 1.4);
    const ratioLifeMul = clamp(intervalRatio * 0.98, 0.55, 1.15);

    const life = curLife * stormLifeMul * ratioLifeMul;
    return Math.round(clamp(life, 520, baseDiff.life * 1.25));
  }

  // ======================================================
  //  Helpers: perfect distance + crosshair shoot
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

  // shoot at center of safe play area
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
    try{ hostRect = host.getBoundingClientRect(); }catch{}
    if (!hostRect) hostRect = { left:0, top:0, right:(ROOT.innerWidth||1), bottom:(ROOT.innerHeight||1), width:(ROOT.innerWidth||1), height:(ROOT.innerHeight||1) };
    exState.margins = computeExclusionMargins(hostRect, exState.els);
  }

  function getCrosshairPoint(){
    let rect = null;
    try{ rect = host.getBoundingClientRect(); }catch{}
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
  //  Spawn target inside host (prettier)
  // ======================================================
  function spawnTarget () {
    if (activeTargets.size >= curMaxActive) return;

    refreshExclusions();

    const rect = computePlayRectFromHost(host, exState);

    const xLocal = rect.left + rect.width  * (0.15 + Math.random() * 0.70);
    const yLocal = rect.top  + rect.height * (0.10 + Math.random() * 0.80);

    const poolsGood  = Array.isArray(pools.good)  ? pools.good  : [];
    const poolsBad   = Array.isArray(pools.bad)   ? pools.bad   : [];
    const poolsTrick = Array.isArray(pools.trick) ? pools.trick : [];

    let ch = '💧';
    let isGood = true;
    let isPower = false;
    let itemType = 'good'; // good | bad | power | fakeGood

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
    if (!isGood && !isPower) el.classList.add('bad');

    const baseSize = 78;
    const size = baseSize * curScale;

    el.style.position = 'absolute';
    el.style.left = xLocal + 'px';
    el.style.top  = yLocal + 'px';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.touchAction = 'manipulation';
    el.style.zIndex = '35';

    // movement parameters (random per target)
    const ax = (6 + Math.random()*8) * (isPower ? 1.10 : 1.0);
    const ay = (5 + Math.random()*7) * (isGood ? 0.95 : 1.10);
    const ar = (2.2 + Math.random()*3.2);
    const fd = (2.4 + Math.random()*1.2);
    const sd = (0.62 + Math.random()*0.20); // storm duration (faster)

    el.style.setProperty('--ax', ax.toFixed(2)+'px');
    el.style.setProperty('--ay', ay.toFixed(2)+'px');
    el.style.setProperty('--ar', ar.toFixed(2)+'deg');
    el.style.setProperty('--fd', fd.toFixed(2)+'s');
    el.style.setProperty('--sd', sd.toFixed(2)+'s');

    // inner parallax offsets
    el.style.setProperty('--bx', ((Math.random()*2.2)-1.1).toFixed(2)+'px');
    el.style.setProperty('--by', ((Math.random()*2.2)-1.1).toFixed(2)+'px');
    el.style.setProperty('--fx', ((Math.random()*1.6)-0.8).toFixed(2)+'px');
    el.style.setProperty('--fy', ((Math.random()*1.6)-0.8).toFixed(2)+'px');

    // visual container
    const move = DOC.createElement('div');
    move.className = 'hvr-move hvr-float';

    // bubble gradient + rings
    let bgGrad = '';
    let ringGlow = '';
    if (isPower) {
      bgGrad = 'radial-gradient(circle at 30% 25%, #facc15, #f97316)';
      ringGlow = '0 0 0 2px rgba(250,204,21,0.85), 0 0 26px rgba(250,204,21,0.92)';
    } else if (itemType === 'fakeGood') {
      bgGrad = 'radial-gradient(circle at 30% 25%, #4ade80, #16a34a)';
      ringGlow = '0 0 0 2px rgba(167,139,250,0.90), 0 0 26px rgba(167,139,250,0.90)';
    } else if (isGood) {
      bgGrad = 'radial-gradient(circle at 30% 25%, #4ade80, #16a34a)';
      ringGlow = '0 0 0 2px rgba(74,222,128,0.78), 0 0 22px rgba(16,185,129,0.92)';
    } else {
      bgGrad = 'radial-gradient(circle at 30% 25%, #fb923c, #ea580c)';
      ringGlow = '0 0 0 2px rgba(248,113,113,0.78), 0 0 22px rgba(248,113,113,0.92)';
    }

    move.style.background = bgGrad;
    move.style.boxShadow =
      '0 22px 52px rgba(0,0,0,.52),' +
      ringGlow +
      ', inset 0 10px 20px rgba(255,255,255,.08)' +
      ', inset 0 -14px 26px rgba(0,0,0,.30)';

    // back glow (parallax layer)
    const back = DOC.createElement('div');
    back.className = 'hvr-back';
    back.style.background =
      'radial-gradient(circle at 40% 35%, rgba(255,255,255,.18), rgba(255,255,255,0) 60%),' +
      'radial-gradient(circle at 30% 25%, rgba(255,255,255,.10), rgba(255,255,255,0) 52%)';
    move.appendChild(back);

    // inner bowl
    const inner = DOC.createElement('div');
    inner.style.position = 'absolute';
    inner.style.left = '50%';
    inner.style.top  = '50%';
    inner.style.width = (size * 0.82) + 'px';
    inner.style.height = (size * 0.82) + 'px';
    inner.style.transform = 'translate(-50%,-50%)';
    inner.style.borderRadius = '999px';
    inner.style.display = 'flex';
    inner.style.alignItems = 'center';
    inner.style.justifyContent = 'center';
    inner.style.background = 'radial-gradient(circle at 30% 25%, rgba(15,23,42,0.10), rgba(15,23,42,0.38))';
    inner.style.boxShadow = 'inset 0 6px 12px rgba(15,23,42,0.90)';

    // icon (front parallax layer)
    const front = DOC.createElement('div');
    front.className = 'hvr-front';

    const icon = DOC.createElement('span');
    icon.textContent = ch;
    icon.style.fontSize = (size * 0.60) + 'px';
    icon.style.lineHeight = '1';
    icon.style.filter = 'drop-shadow(0 4px 6px rgba(15,23,42,0.9))';

    front.appendChild(icon);
    inner.appendChild(front);
    move.appendChild(inner);

    // perfect ring
    const ring = DOC.createElement('div');
    ring.className = 'hvr-ring';
    move.appendChild(ring);

    // glint
    const glint = DOC.createElement('div');
    glint.className = 'hvr-glint';
    move.appendChild(glint);

    // storm speedlines
    const sl = DOC.createElement('div');
    sl.className = 'hvr-speedlines';
    move.appendChild(sl);

    // fakeGood spark hint
    if (itemType === 'fakeGood') {
      const sp = DOC.createElement('div');
      sp.textContent = '✨';
      sp.style.position = 'absolute';
      sp.style.right = '8px';
      sp.style.top = '6px';
      sp.style.fontSize = '18px';
      sp.style.filter = 'drop-shadow(0 3px 4px rgba(15,23,42,0.9))';
      sp.style.pointerEvents = 'none';
      move.appendChild(sp);
    }

    el.appendChild(move);

    if (rhythmOn) el.classList.add('hvr-pulse');

    // “pop-in”
    ROOT.requestAnimationFrame(() => {
      move.style.transform = 'scale(1)';
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
      _hit: null
    };

    activeTargets.add(data);
    host.appendChild(el);

    function consumeHit(evOrSynth, hitInfoOpt){
      if (stopped) return;
      if (!activeTargets.has(data)) return;

      let keepRect = null;
      try{ keepRect = el.getBoundingClientRect(); }catch{}

      activeTargets.delete(data);
      try { el.removeEventListener('pointerdown', handleHit); } catch {}
      try { el.removeEventListener('click', handleHit); } catch {}
      try { el.removeEventListener('touchstart', handleHit); } catch {}
      try { host.removeChild(el); } catch {}

      let res = null;
      if (typeof judge === 'function') {
        const xy = (evOrSynth && evOrSynth.__hhaSynth)
          ? { x: evOrSynth.clientX, y: evOrSynth.clientY }
          : getEventXY(evOrSynth || {});
        const info = hitInfoOpt || (keepRect ? (function(){
          const cx = keepRect.left + keepRect.width/2;
          const cy = keepRect.top + keepRect.height/2;
          const dx = (xy.x - cx);
          const dy = (xy.y - cy);
          const dist = Math.sqrt(dx*dx + dy*dy);
          const rad  = Math.max(1, Math.min(keepRect.width, keepRect.height) / 2);
          const norm = dist / rad;
          const perfect = norm <= 0.33;
          return { cx, cy, dist, norm, perfect, rect: keepRect };
        })() : computeHitInfoFromPoint(el, xy.x, xy.y));

        const ctx = {
          clientX: xy.x, clientY: xy.y,
          cx: info.cx, cy: info.cy,
          isGood, isPower,
          itemType,
          hitPerfect: !!info.perfect,
          hitDistNorm: Number(info.norm || 1),
          targetRect: info.rect
        };
        try { res = judge(ch, ctx); } catch (err) { console.error('[mode-factory] judge error', err); }
      }

      // sample for adaptive
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
      try { host.removeChild(el); } catch {}

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

    // spawn
    if (secLeft > 0) {
      if (!lastSpawnTs) lastSpawnTs = ts;

      const mul = getSpawnMul();
      const effInterval = Math.max(35, curInterval * mul);

      try{
        if (mul < 0.99) host.classList.add('hvr-storm-on');
        else host.classList.remove('hvr-storm-on');
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
