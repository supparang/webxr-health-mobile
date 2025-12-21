// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (adaptive) สำหรับ HeroHealth VR/Quest
// ✅ spawnHost = #hvr-playfield (targets เลื่อนตาม drag)
// ✅ crosshair shooting via shootCrosshair()
// ✅ perfect ring distance (ctx.hitPerfect, ctx.hitDistNorm)
// ✅ rhythm spawn + pulse
// ✅ trick targets (fakeGood)
// ✅ Storm: spawnIntervalMul + host class .hvr-storm-on
// ✅ SAFEZONE: excludeSelectors กันทับ HUD
//
// ✅ UPDATE (SOAP BUBBLE v2):
// - “Clear core (almost invisible) + strong rainbow rim”
// - Thin-film iridescence จำกัดอยู่ที่ขอบ (edge mask)
// - Micro-banding (ฟองสบู่จริง ๆ)
// - Tilt shimmer ใช้ CSS vars: --tilt-x / --tilt-y (hydration.safe.js ตั้งไว้แล้ว)

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
//  Overlay fallback + Styles
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

    /* pulse for rhythm */
    .hvr-target.hvr-pulse .hvr-bubble{
      animation: hvrPulse .55s ease-in-out infinite;
    }
    @keyframes hvrPulse{
      0%{ transform: scale(1); }
      50%{ transform: scale(1.07); }
      100%{ transform: scale(1); }
    }

    /* ====== SOAP BUBBLE (CLEAR CORE + RAINBOW RIM) ====== */
    .hvr-target{ will-change: transform; }
    .hvr-bubble{
      position:absolute;
      inset:0;
      border-radius:999px;
      display:flex;
      align-items:center;
      justify-content:center;
      transform: translateZ(0);
      overflow:hidden;
      will-change: transform, filter;

      /* แกนกลาง “ใสเกือบไม่เห็น” */
      background:
        radial-gradient(circle at 30% 22%, rgba(255,255,255,.14), rgba(255,255,255,0) 36%),
        radial-gradient(circle at 72% 80%, rgba(255,255,255,.06), rgba(255,255,255,0) 52%),
        radial-gradient(circle at 50% 55%, rgba(255,255,255,.015), rgba(255,255,255,0) 72%);

      box-shadow:
        0 16px 44px rgba(0,0,0,.20),
        0 0 0 1px rgba(255,255,255,.10),
        inset 0 0 0 1.15px rgba(255,255,255,.10);

      filter: saturate(1.06) contrast(1.06);
      animation: hvrFloat 1.75s ease-in-out infinite;
    }

    @keyframes hvrFloat{
      0%{ transform: translate3d(0,0,0) rotate(0deg); }
      25%{ transform: translate3d(calc(var(--sx,1) * 1.8px), -3.6px, 0) rotate(calc(var(--rx,1) * 1.15deg)); }
      50%{ transform: translate3d(calc(var(--sx,1) * -1.35px), 1.65px, 0) rotate(calc(var(--rx,1) * -1.05deg)); }
      75%{ transform: translate3d(calc(var(--sx,1) * 1.15px), 3.75px, 0) rotate(calc(var(--rx,1) * 0.85deg)); }
      100%{ transform: translate3d(0,0,0) rotate(0deg); }
    }

    /* Fresnel rim (คม/ชัดขึ้น) */
    .hvr-bubble .hvr-fresnel{
      position:absolute;
      inset:-2px;
      border-radius:999px;
      pointer-events:none;
      background:
        radial-gradient(circle at 50% 56%,
          rgba(255,255,255,0) 0 54%,
          rgba(255,255,255,.06) 62%,
          rgba(255,255,255,.18) 76%,
          rgba(255,255,255,.16) 88%,
          rgba(255,255,255,.08) 100%);
      mix-blend-mode: screen;
      opacity: .98;
      filter: contrast(1.12);
    }

    /* Specular highlights */
    .hvr-bubble::before{
      content:"";
      position:absolute;
      inset:-10%;
      border-radius:999px;
      pointer-events:none;
      background:
        radial-gradient(circle at 26% 18%, rgba(255,255,255,.40), rgba(255,255,255,0) 36%),
        radial-gradient(circle at 37% 33%, rgba(255,255,255,.16), rgba(255,255,255,0) 44%),
        radial-gradient(circle at 78% 82%, rgba(255,255,255,.11), rgba(255,255,255,0) 56%);
      opacity:.70;
      mix-blend-mode: screen;
      filter: blur(0.2px);
    }

    /*
      Thin-film iridescence:
      - จำกัดอยู่ที่ “ขอบ” (edge mask)
      - สีรุ้งชัดขึ้น + micro-banding
      - reactive tilt shimmer: ใช้ --tilt-x / --tilt-y (ตั้งไว้ที่ playfield)
    */
    .hvr-bubble::after{
      content:"";
      position:absolute;
      inset:-22%;
      border-radius:999px;
      pointer-events:none;

      /* derive tilt -> angle/shift (no JS needed) */
      --tx: var(--tilt-x, 0);
      --ty: var(--tilt-y, 0);
      --tilt-ang: calc(145deg + (var(--tx) * 46deg) + (var(--ty) * 26deg));
      --tilt-shift-x: calc(var(--tx) * 10px);
      --tilt-shift-y: calc(var(--ty) * 6px);

      background:
        /* Micro-banding (เหมือนฟองจริง) */
        repeating-conic-gradient(from var(--tilt-ang) at 50% 50%,
          rgba(255,255,255,0) 0 6deg,
          rgba(255,255,255,.05) 6deg 7deg,
          rgba(255,255,255,0) 7deg 12deg
        ),
        /* Rainbow film (boosted) */
        conic-gradient(from var(--tilt-ang) at 50% 50%,
          rgba(255,  50, 120, .22),
          rgba(  0, 210, 255, .22),
          rgba( 80, 255, 210, .18),
          rgba(255, 235, 120, .22),
          rgba(190, 120, 255, .18),
          rgba(255,  50, 120, .22)
        ),
        /* Edge glow assist */
        radial-gradient(circle at 50% 55%,
          rgba(255,255,255,0) 0 56%,
          rgba(255,255,255,.06) 66%,
          rgba(255,255,255,.00) 100%
        );

      transform: translate3d(var(--tilt-shift-x), var(--tilt-shift-y), 0);

      opacity: var(--film-op, .90);
      mix-blend-mode: screen;
      filter: blur(0.28px) saturate(1.38) contrast(1.20);

      /* mask ให้ไปอยู่ “ขอบ” จริง ๆ (core clear) */
      -webkit-mask-image:
        radial-gradient(circle at 50% 55%,
          rgba(0,0,0,0) 0 58%,
          rgba(0,0,0,.55) 70%,
          rgba(0,0,0,1) 82%,
          rgba(0,0,0,1) 100%);
              mask-image:
        radial-gradient(circle at 50% 55%,
          rgba(0,0,0,0) 0 58%,
          rgba(0,0,0,.55) 70%,
          rgba(0,0,0,1) 82%,
          rgba(0,0,0,1) 100%);
    }

    /* Rim line (บางแต่คม + นิดๆ chroma edge) */
    .hvr-rim{
      position:absolute;
      inset:0;
      border-radius:999px;
      pointer-events:none;
      box-shadow:
        inset 0 0 0 1.25px rgba(255,255,255,.18),
        0 0 0 1px rgba(255,255,255,.10),
        0 0 18px var(--glow, rgba(255,255,255,.12));
      opacity:1;
      filter:
        drop-shadow(1.3px 0 rgba(255, 60, 120, .22))
        drop-shadow(-1.1px 0 rgba(0, 200, 255, .18));
    }

    /* Perfect ring marker */
    .hvr-ring{
      position:absolute;
      left:50%;
      top:50%;
      transform: translate(-50%,-50%);
      border-radius:999px;
      pointer-events:none;
      box-shadow: 0 0 12px rgba(255,255,255,0.16);
      opacity:.85;
    }

    /* Emoji icon */
    .hvr-icon{
      line-height:1;
      user-select:none;
      pointer-events:none;
      filter: drop-shadow(0 3px 5px rgba(0,0,0,.34));
    }

    /* Type tuning (bubble stays clear; glow only) */
    .hvr-target.hvr-good  { --glow: rgba(34,197,94,.22); }
    .hvr-target.hvr-bad   { --glow: rgba(239,68,68,.22); }
    .hvr-target.hvr-power { --glow: rgba(250,204,21,.26); }
    .hvr-target.hvr-trick { --glow: rgba(167,139,250,.22); }

    /* Storm => sway faster + film stronger + rim brighter */
    .hvr-storm-on .hvr-bubble{
      animation-duration: 0.62s;
      filter: saturate(1.10) contrast(1.10);
    }
    .hvr-storm-on .hvr-bubble{ --film-op: 1.05; }
    .hvr-storm-on .hvr-rim{ opacity:1; }
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
    '.hud',
    '#hvr-start',
    '#hvr-end',
    '#hvr-screen-blink',
    '#hvr-postfx'
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
    judge,
    onExpire,

    allowAdaptive = true,
    rhythm = null,
    trickRate = 0.08,
    spawnIntervalMul = null,
    excludeSelectors = null
  } = rawCfg || {};

  const diffKey  = String(difficulty || 'normal').toLowerCase();
  const baseDiff = pickDiffConfig(modeKey, diffKey);

  const host = resolveHost(rawCfg);
  if (!host || !DOC) {
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
    try { host.classList.add('hvr-rhythm-on'); } catch {}
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
    const stormLifeMul = (mul < 0.99) ? 0.85 : 1.0;
    const intervalRatio = clamp(curInterval / baseDiff.spawnInterval, 0.45, 1.4);
    const ratioLifeMul = clamp(intervalRatio * 0.98, 0.55, 1.15);

    const life = curLife * stormLifeMul * ratioLifeMul;
    return Math.round(clamp(life, 520, baseDiff.life * 1.25));
  }

  // ======================================================
  //  Hit info + Crosshair shoot
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

  // crosshair = center of usable host rect (exclude HUD margins)
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
    refreshExclusions();
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
  //  Spawn target
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
        ch = pickOne(poolsBad, '🍟');
        isGood = false;
        itemType = 'bad';
      }
    }
    spawnCounter++;

    const el = DOC.createElement('div');
    el.className = 'hvr-target';
    el.setAttribute('data-hha-tgt', '1');
    el.setAttribute('data-item-type', itemType);

    if (itemType === 'power') el.classList.add('hvr-power');
    else if (itemType === 'fakeGood') el.classList.add('hvr-trick');
    else if (!isGood) el.classList.add('hvr-bad');
    else el.classList.add('hvr-good');

    const baseSize = 84;
    const size = baseSize * curScale;

    el.style.position = 'absolute';
    el.style.left = xLocal + 'px';
    el.style.top  = yLocal + 'px';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.transform = 'translate(-50%, -50%) scale(0.88)';
    el.style.touchAction = 'manipulation';
    el.style.zIndex = '35';

    el.style.setProperty('--sx', (Math.random()<0.5?-1:1) * (0.85 + Math.random()*1.15));
    el.style.setProperty('--rx', (Math.random()<0.5?-1:1) * (0.85 + Math.random()*1.15));

    const bubble = DOC.createElement('div');
    bubble.className = 'hvr-bubble';

    const fres = DOC.createElement('div');
    fres.className = 'hvr-fresnel';
    bubble.appendChild(fres);

    const rim = DOC.createElement('div');
    rim.className = 'hvr-rim';
    bubble.appendChild(rim);

    const ring = DOC.createElement('div');
    ring.className = 'hvr-ring';
    ring.style.width  = (size * 0.36) + 'px';
    ring.style.height = (size * 0.36) + 'px';
    ring.style.border = '2px solid rgba(255,255,255,0.30)';
    bubble.appendChild(ring);

    if (itemType === 'fakeGood') {
      const sp = DOC.createElement('div');
      sp.textContent = '✨';
      sp.style.position = 'absolute';
      sp.style.right = '8px';
      sp.style.top = '6px';
      sp.style.fontSize = '18px';
      sp.style.opacity = '0.9';
      sp.style.filter = 'drop-shadow(0 3px 4px rgba(15,23,42,0.65))';
      sp.style.pointerEvents = 'none';
      bubble.appendChild(sp);
    }

    const icon = DOC.createElement('span');
    icon.className = 'hvr-icon';
    icon.textContent = ch;
    icon.style.fontSize = (size * 0.62) + 'px';
    bubble.appendChild(icon);

    el.appendChild(bubble);

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
      try { host.removeChild(el); } catch {}

      try { if (typeof onExpire === 'function') onExpire({ ch, isGood, isPower, itemType }); } catch (err) {
        console.error('[mode-factory] onExpire error', err);
      }
    }, lifeMs);
  }

  // ---------- clock ----------
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

  ensureOverlayStyle(); // ✅ make sure style exists
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
