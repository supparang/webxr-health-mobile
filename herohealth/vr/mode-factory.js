// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (adaptive) สำหรับ HeroHealth VR/Quest
// ✅ spawnHost/spawnLayer/container
// ✅ crosshair shooting
// ✅ perfect ring distance (ctx.hitPerfect, ctx.hitDistNorm)
// ✅ rhythm spawn (bpm)
// ✅ trick/fake targets
// ✅ adaptive
// ✅ storm spawnIntervalMul + adaptive life
// ✅ safezone exclude selectors
// ✅ VISUAL: bubble glass + thin-film iridescence (2 layers)
// ✅ NEW: REACTIVE SHIMMER (film/spec respond to target sway in real-time)
// ✅ PERFECT: iridescent starburst + ring flash (heavy)

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
//  Overlay fallback + VISUAL (Reactive Shimmer)
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

    .hvr-target{
      border-radius:999px;
      user-select:none;
      -webkit-tap-highlight-color: transparent;
      transition: transform 180ms cubic-bezier(.2,.9,.2,1), filter 140ms ease;
      will-change: transform, filter;
      transform: translate(-50%,-50%) scale(0.92);
      border: 1px solid rgba(255,255,255,.14);
      overflow:hidden;
      backdrop-filter: blur(1.6px) saturate(1.35);
      -webkit-backdrop-filter: blur(1.6px) saturate(1.35);
      filter: saturate(1.03) contrast(1.01);

      /* ✅ reactive shimmer vars (defaults) */
      --shx: 0px;
      --shy: 0px;
      --shrot: 0deg;
      --shh: 0deg;     /* hue-rotate */
      --shalpha: 1;    /* film opacity scale */

      --spx: 26%;
      --spy: 22%;
      --spx2: 62%;
      --spy2: 76%;
    }

    .hvr-target.hvr-pulse{ animation:hvrPulse .55s ease-in-out infinite; }
    @keyframes hvrPulse{
      0%{ transform:translate(-50%,-50%) scale(1); }
      50%{ transform:translate(-50%,-50%) scale(1.08); }
      100%{ transform:translate(-50%,-50%) scale(1); }
    }

    .hvr-storm-on .hvr-target{
      filter: saturate(1.08) contrast(1.05);
    }

    /* ====================================================
       ✅ THIN-FILM IRIDESCENCE (2 layers + reactive parallax)
       ==================================================== */

    .hvr-film{
      position:absolute;
      inset:-18%;
      border-radius:999px;
      pointer-events:none;
      opacity: calc(.22 * var(--shalpha));
      mix-blend-mode: screen;
      will-change: transform, opacity, filter;
      transform: translateZ(0)
        translate(calc(var(--shx) * .55), calc(var(--shy) * .55))
        rotate(calc(var(--shrot) * .65))
        scale(1.05);
      filter: hue-rotate(var(--shh)) saturate(1.18) contrast(1.08);
      background:
        conic-gradient(
          from 210deg,
          rgba(255,  0,180,.00) 0deg,
          rgba( 72, 99,255,.30) 55deg,
          rgba(  0,255,214,.26) 110deg,
          rgba(255,255, 80,.22) 165deg,
          rgba(255,120,  0,.26) 220deg,
          rgba(255, 60,180,.28) 290deg,
          rgba( 72, 99,255,.30) 360deg
        );
    }

    .hvr-rimfilm{
      opacity: calc(.34 * var(--shalpha));
      filter: hue-rotate(calc(var(--shh) * 1.15)) saturate(1.28) contrast(1.12);
      transform: translateZ(0)
        translate(calc(var(--shx) * .95), calc(var(--shy) * .95))
        rotate(calc(var(--shrot) * 1.05))
        scale(1.10);
      background:
        conic-gradient(
          from 250deg,
          rgba( 84,103,255,.34) 0deg,
          rgba(255, 75,210,.30) 70deg,
          rgba(255,210, 80,.28) 140deg,
          rgba( 60,255,220,.30) 210deg,
          rgba(255,130, 40,.30) 290deg,
          rgba( 84,103,255,.34) 360deg
        ),
        radial-gradient(circle at 30% 22%, rgba(255,255,255,.22), rgba(255,255,255,0) 52%);
      -webkit-mask-image: radial-gradient(circle, rgba(0,0,0,0) 56%, rgba(0,0,0,1) 64%, rgba(0,0,0,1) 100%);
      mask-image: radial-gradient(circle, rgba(0,0,0,0) 56%, rgba(0,0,0,1) 64%, rgba(0,0,0,1) 100%);
    }

    /* specular highlight (reactive) */
    .hvr-spec{
      position:absolute;
      inset:0;
      border-radius:999px;
      pointer-events:none;
      opacity:.50;
      mix-blend-mode: screen;
      background:
        radial-gradient(circle at var(--spx) var(--spy), rgba(255,255,255,.56), rgba(255,255,255,0) 46%),
        radial-gradient(circle at var(--spx2) var(--spy2), rgba(255,255,255,.14), rgba(255,255,255,0) 62%);
      filter: blur(.12px) hue-rotate(calc(var(--shh) * .35));
      transform: translateZ(0)
        translate(calc(var(--shx) * .22), calc(var(--shy) * .22))
        rotate(calc(var(--shrot) * .25));
      will-change: transform, filter;
    }

    /* Storm boost */
    .hvr-storm-on .hvr-film{ opacity: calc(.28 * var(--shalpha)); }
    .hvr-storm-on .hvr-rimfilm{ opacity: calc(.44 * var(--shalpha)); }

    /* ====================================================
       ✅ PERFECT FX (heavy): iridescent starburst + ring flash
       ==================================================== */
    .hvr-perfect-layer{
      position:fixed;
      inset:0;
      pointer-events:none;
      z-index:99990;
      overflow:visible;
    }

    .hvr-perfect-star{
      position:absolute;
      left:0; top:0;
      width:10px; height:10px;
      border-radius:999px;
      transform: translate(-50%,-50%) scale(.8);
      opacity:0;
      mix-blend-mode: screen;
      filter: saturate(1.35) contrast(1.15);
      background:
        conic-gradient(from 180deg,
          rgba(84,103,255,.95),
          rgba(255,75,210,.95),
          rgba(255,210,80,.95),
          rgba(60,255,220,.95),
          rgba(255,130,40,.95),
          rgba(84,103,255,.95)
        );
      box-shadow:
        0 0 18px rgba(255,255,255,.22),
        0 0 30px rgba(120,200,255,.18);
      animation: hvrStarPop .52s ease-out forwards;
    }

    @keyframes hvrStarPop{
      0%{ opacity:0; transform: translate(-50%,-50%) scale(.65); }
      15%{ opacity:1; transform: translate(-50%,-50%) scale(1.05); }
      100%{ opacity:0; transform: translate(-50%,-50%) scale(1.55); }
    }

    .hvr-perfect-ringflash{
      position:absolute;
      left:0; top:0;
      width:12px; height:12px;
      border-radius:999px;
      transform: translate(-50%,-50%) scale(.55);
      opacity:.0;
      pointer-events:none;
      mix-blend-mode: screen;
      background:
        radial-gradient(circle,
          rgba(255,255,255,.55) 0%,
          rgba(255,255,255,.18) 28%,
          rgba(255,255,255,0) 62%
        );
      box-shadow:
        0 0 30px rgba(255,255,255,.20),
        0 0 70px rgba(80,200,255,.12);
      animation: hvrRingFlash .42s ease-out forwards;
    }
    @keyframes hvrRingFlash{
      0%{ opacity:0; transform: translate(-50%,-50%) scale(.55); }
      20%{ opacity:1; }
      100%{ opacity:0; transform: translate(-50%,-50%) scale(5.0); }
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
    '.hud',
    '#hvr-start',
    '#hvr-end',
    '.hvr-end',
    '#hha-water-header',
    '.hha-water-bar',
    '.hha-main-row',
    '#hha-card-left',
    '#hha-card-right',
    '.hha-bottom-row',
    '.hha-fever-card',
    '#hvr-crosshair',
    '.hvr-crosshair'
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
//  PERFECT FX helpers
// ======================================================
function ensurePerfectLayer(){
  if (!DOC) return null;
  let layer = DOC.querySelector('.hvr-perfect-layer');
  if (layer && layer.isConnected) return layer;
  layer = DOC.createElement('div');
  layer.className = 'hvr-perfect-layer';
  DOC.body.appendChild(layer);
  return layer;
}

function perfectBurstAt(x, y, intensity = 1){
  const layer = ensurePerfectLayer();
  if (!layer) return;

  const rf = DOC.createElement('div');
  rf.className = 'hvr-perfect-ringflash';
  rf.style.left = x + 'px';
  rf.style.top  = y + 'px';
  rf.style.width = (12 * (1 + intensity*0.25)) + 'px';
  rf.style.height = (12 * (1 + intensity*0.25)) + 'px';
  layer.appendChild(rf);
  ROOT.setTimeout(()=>{ try{ rf.remove(); }catch{} }, 520);

  const N = Math.round(16 + intensity*10);
  for (let i=0;i<N;i++){
    const st = DOC.createElement('div');
    st.className = 'hvr-perfect-star';

    const ang = Math.random() * Math.PI * 2;
    const dist = (18 + Math.random()*36) * (1 + intensity*0.40);
    const sx = x + Math.cos(ang) * dist;
    const sy = y + Math.sin(ang) * dist;

    const sz = (8 + Math.random()*16) * (1 + intensity*0.18);
    st.style.left = sx + 'px';
    st.style.top  = sy + 'px';
    st.style.width = sz + 'px';
    st.style.height = sz + 'px';
    st.style.animationDelay = (Math.random()*80) + 'ms';

    layer.appendChild(st);
    ROOT.setTimeout(()=>{ try{ st.remove(); }catch{} }, 680);
  }
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

  // ✅ Storm multiplier getter
  function getSpawnMul(){
    let m = 1;
    try{
      if (typeof spawnIntervalMul === 'function') m = Number(spawnIntervalMul()) || 1;
      else if (spawnIntervalMul != null) m = Number(spawnIntervalMul) || 1;
    }catch{}
    return clamp(m, 0.25, 2.5);
  }

  // ✅ life getter (adaptive + storm)
  function getLifeMs(){
    const mul = getSpawnMul();
    const stormLifeMul = (mul < 0.99) ? 0.88 : 1.0;
    const intervalRatio = clamp(curInterval / baseDiff.spawnInterval, 0.45, 1.4);
    const ratioLifeMul = clamp(intervalRatio * 0.98, 0.55, 1.15);

    const life = curLife * stormLifeMul * ratioLifeMul;
    return Math.round(clamp(life, 520, baseDiff.life * 1.25));
  }

  // ======================================================
  //  Hit info + crosshair
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

  // ======================================================
  //  Exclusion cache
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
  //  Iridescence layers helper
  // ======================================================
  function addIridescenceLayers(el){
    try{
      const film = DOC.createElement('div');
      film.className = 'hvr-film';
      el.appendChild(film);

      const rim = DOC.createElement('div');
      rim.className = 'hvr-film hvr-rimfilm';
      el.appendChild(rim);

      const spec = DOC.createElement('div');
      spec.className = 'hvr-spec';
      el.appendChild(spec);
    }catch{}
  }

  // ======================================================
  //  ✅ Reactive shimmer animator per target
  // ======================================================
  function startReactiveShimmer(data, sizePx){
    const el = data.el;
    if (!el) return;

    const seed = Math.random() * 9999;
    const born = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    // base amplitude scales with size
    const baseAmp = clamp(sizePx * 0.045, 2.2, 6.8); // px
    const baseRot = clamp(sizePx * 0.06, 3.5, 9.5);  // deg-ish

    // tweak by type
    const typeAmpMul =
      data.isPower ? 1.12 :
      (data.itemType === 'fakeGood' ? 1.08 :
        (data.isGood ? 1.00 : 1.18));

    function tick(ts){
      if (stopped) return;
      if (!el.isConnected) return;
      if (!activeTargets.has(data)) return;

      const mul = getSpawnMul();
      const storm = (mul < 0.99);
      const stormK = storm ? clamp(1 / mul, 1.1, 2.4) : 1.0;

      // time
      const t = (ts - born);

      // sway: 2-wave blend (smooth)
      const spd = (0.00115 * stormK) + (data.isPower ? 0.00035 : 0);
      const spd2 = (0.00195 * stormK);

      const amp = baseAmp * typeAmpMul * (storm ? 1.35 : 1.0);
      const ampY = amp * (storm ? 1.10 : 0.95);

      const x = (Math.sin(t*spd + seed) + 0.55*Math.sin(t*spd2 + seed*1.7)) * amp;
      const y = (Math.cos(t*(spd*0.92) + seed*0.7) + 0.60*Math.sin(t*(spd2*0.86) + seed*2.1)) * ampY;

      // rotation for film parallax
      const rot = (Math.sin(t*(0.00075*stormK) + seed*0.9) + 0.65*Math.cos(t*(0.00105*stormK) + seed*1.3)) * baseRot * (storm ? 1.20 : 1.0);

      // hue shimmer
      const hue = (Math.sin(t*(0.00062*stormK) + seed*0.33) * 45) + (storm ? 18 : 8); // deg
      const alpha = storm ? 1.18 : 1.0;

      // spec highlight positions (percent)
      const spx  = clamp(26 + (x * 1.25), 14, 42);  // 14..42
      const spy  = clamp(22 + (y * 1.10), 12, 40);
      const spx2 = clamp(62 - (x * 0.95), 52, 82);
      const spy2 = clamp(76 - (y * 0.85), 56, 88);

      // apply vars
      try{
        el.style.setProperty('--shx', x.toFixed(2) + 'px');
        el.style.setProperty('--shy', y.toFixed(2) + 'px');
        el.style.setProperty('--shrot', rot.toFixed(2) + 'deg');
        el.style.setProperty('--shh', hue.toFixed(2) + 'deg');
        el.style.setProperty('--shalpha', String(alpha));

        el.style.setProperty('--spx',  spx.toFixed(1) + '%');
        el.style.setProperty('--spy',  spy.toFixed(1) + '%');
        el.style.setProperty('--spx2', spx2.toFixed(1) + '%');
        el.style.setProperty('--spy2', spy2.toFixed(1) + '%');
      }catch{}

      data._animId = ROOT.requestAnimationFrame(tick);
    }

    data._animId = ROOT.requestAnimationFrame(tick);
  }

  function stopReactiveShimmer(data){
    try{
      if (data && data._animId != null) ROOT.cancelAnimationFrame(data._animId);
    }catch{}
    if (data) data._animId = null;
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

    el.style.position = 'absolute';
    el.style.left = xLocal + 'px';
    el.style.top  = yLocal + 'px';
    el.style.transform = 'translate(-50%, -50%) scale(0.9)';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.touchAction = 'manipulation';
    el.style.zIndex = '35';

    // palette (transparent bubble)
    let coreA = 'rgba(74,222,128,0.28)';
    let coreB = 'rgba(16,185,129,0.40)';
    let rim   = 'rgba(255,255,255,0.18)';
    let glow  = '0 0 18px rgba(16,185,129,0.16), 0 0 0 2px rgba(74,222,128,0.14)';

    if (isPower) {
      coreA = 'rgba(250,204,21,0.26)';
      coreB = 'rgba(249,115,22,0.40)';
      rim   = 'rgba(255,255,255,0.20)';
      glow  = '0 0 24px rgba(250,204,21,0.18), 0 0 0 2px rgba(250,204,21,0.14)';
    } else if (itemType === 'fakeGood') {
      coreA = 'rgba(167,139,250,0.22)';
      coreB = 'rgba(34,197,94,0.34)';
      rim   = 'rgba(255,255,255,0.18)';
      glow  = '0 0 22px rgba(167,139,250,0.18), 0 0 0 2px rgba(167,139,250,0.14)';
    } else if (!isGood) {
      coreA = 'rgba(251,146,60,0.26)';
      coreB = 'rgba(239,68,68,0.36)';
      rim   = 'rgba(255,255,255,0.16)';
      glow  = '0 0 22px rgba(248,113,113,0.18), 0 0 0 2px rgba(248,113,113,0.14)';
      el.classList.add('bad');
    }

    el.style.background =
      `radial-gradient(circle at 28% 22%, rgba(255,255,255,.44), rgba(255,255,255,0) 46%),
       radial-gradient(circle at 62% 78%, rgba(15,23,42,.16), rgba(15,23,42,0) 62%),
       radial-gradient(circle at 42% 50%, ${coreA}, ${coreB})`;

    el.style.boxShadow =
      `0 18px 44px rgba(2,6,23,.62),
       0 0 0 2px rgba(255,255,255,.09),
       ${glow}`;

    // ✅ iridescence layers + reactive vars
    addIridescenceLayers(el);

    // inner lens
    const inner = DOC.createElement('div');
    inner.style.width = (size * 0.82) + 'px';
    inner.style.height = (size * 0.82) + 'px';
    inner.style.borderRadius = '999px';
    inner.style.display = 'flex';
    inner.style.alignItems = 'center';
    inner.style.justifyContent = 'center';
    inner.style.position = 'absolute';
    inner.style.left = '50%';
    inner.style.top  = '50%';
    inner.style.transform = 'translate(-50%, -50%)';
    inner.style.background =
      'radial-gradient(circle at 30% 25%, rgba(255,255,255,.08), rgba(15,23,42,.24))';
    inner.style.boxShadow =
      'inset 0 10px 26px rgba(2,6,23,.58), inset 0 0 0 1px rgba(255,255,255,.10)';

    // perfect ring
    const ring = DOC.createElement('div');
    ring.style.position = 'absolute';
    ring.style.left = '50%';
    ring.style.top  = '50%';
    ring.style.width  = (size * 0.36) + 'px';
    ring.style.height = (size * 0.36) + 'px';
    ring.style.transform = 'translate(-50%, -50%)';
    ring.style.borderRadius = '999px';
    ring.style.border = '2px solid rgba(255,255,255,0.30)';
    ring.style.boxShadow = '0 0 12px rgba(255,255,255,0.12)';
    ring.style.pointerEvents = 'none';

    // rim outline
    const rimEl = DOC.createElement('div');
    rimEl.style.position = 'absolute';
    rimEl.style.inset = '0';
    rimEl.style.borderRadius = '999px';
    rimEl.style.pointerEvents = 'none';
    rimEl.style.boxShadow =
      `inset 0 0 0 2px ${rim},
       inset 0 10px 22px rgba(255,255,255,.06)`;

    // icon
    const icon = DOC.createElement('span');
    icon.textContent = ch;
    icon.style.fontSize = (size * 0.60) + 'px';
    icon.style.lineHeight = '1';
    icon.style.filter = 'drop-shadow(0 3px 4px rgba(15,23,42,0.9))';
    icon.style.position = 'relative';
    icon.style.zIndex = '2';

    if (itemType === 'fakeGood') {
      const sp = DOC.createElement('div');
      sp.textContent = '✨';
      sp.style.position = 'absolute';
      sp.style.right = '8px';
      sp.style.top = '6px';
      sp.style.fontSize = '18px';
      sp.style.filter = 'drop-shadow(0 3px 4px rgba(15,23,42,0.9))';
      sp.style.pointerEvents = 'none';
      sp.style.zIndex = '3';
      el.appendChild(sp);
    }

    inner.appendChild(icon);
    el.appendChild(inner);
    el.appendChild(ring);
    el.appendChild(rimEl);

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
      _animId: null
    };

    activeTargets.add(data);
    host.appendChild(el);

    // ✅ start reactive shimmer (this is the key)
    startReactiveShimmer(data, size);

    function consumeHit(evOrSynth, hitInfoOpt){
      if (stopped) return;
      if (!activeTargets.has(data)) return;

      let keepRect = null;
      try{ keepRect = el.getBoundingClientRect(); }catch{}

      let infoForFx = hitInfoOpt || null;
      if (!infoForFx) {
        try{
          const xy = (evOrSynth && evOrSynth.__hhaSynth)
            ? { x: evOrSynth.clientX, y: evOrSynth.clientY }
            : getEventXY(evOrSynth || {});
          infoForFx = computeHitInfoFromPoint(el, xy.x, xy.y);
        }catch{}
      }

      // ✅ PERFECT => heavy burst
      if (infoForFx && infoForFx.perfect) {
        const cx = infoForFx.rect ? (infoForFx.rect.left + infoForFx.rect.width/2) : (keepRect ? keepRect.left + keepRect.width/2 : null);
        const cy = infoForFx.rect ? (infoForFx.rect.top  + infoForFx.rect.height/2) : (keepRect ? keepRect.top + keepRect.height/2 : null);
        if (cx != null && cy != null) {
          const mul = getSpawnMul();
          const stormBoost = (mul < 0.99) ? 1.25 : 1.0;
          perfectBurstAt(cx, cy, 1.0 * stormBoost);
        }
      }

      // stop shimmer loop
      stopReactiveShimmer(data);

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

      // stop shimmer loop
      stopReactiveShimmer(data);

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

    activeTargets.forEach(t => {
      try { stopReactiveShimmer(t); } catch {}
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
    },
    shootCrosshair
  };
}

export default { boot };
