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
//  Overlay fallback styles
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
      user-select:none;
      -webkit-tap-highlight-color:transparent;
    }

    /* pulse (optional rhythm) */
    .hvr-target.hvr-pulse{ animation:hvrPulse .55s ease-in-out infinite; }
    @keyframes hvrPulse{
      0%{ transform:translate(-50%,-50%) scale(1); }
      50%{ transform:translate(-50%,-50%) scale(1.07); }
      100%{ transform:translate(-50%,-50%) scale(1); }
    }

    /* hit pop (remove after short) */
    .hvr-target.hvr-hit{
      transition: transform 90ms ease, opacity 90ms ease;
      transform:translate(-50%,-50%) scale(1.30) !important;
      opacity:0.0 !important;
    }

    /* Storm: make targets richer, keep original glow alive */
    .hvr-storm-on .hvr-target{
      filter:saturate(1.08) contrast(1.06);
    }

    /* internal layers */
    .hvr-bubble-film{
      position:absolute; inset:-2%;
      border-radius:999px;
      pointer-events:none;
      mix-blend-mode:screen;
      opacity:.62;
      filter: blur(.2px);
      background:
        conic-gradient(from 160deg,
          rgba(255,80,200,.00),
          rgba(255,80,200,.18),
          rgba(90,220,255,.24),
          rgba(255,240,120,.20),
          rgba(120,255,180,.18),
          rgba(255,80,200,.18),
          rgba(255,80,200,.00)
        );
      will-change:transform, opacity;
      transform:translate3d(var(--shx,0px), var(--shy,0px), 0) rotate(var(--shr,0deg));
    }

    .hvr-bubble-spec{
      position:absolute; inset:0;
      border-radius:999px;
      pointer-events:none;
      opacity:.62;
      mix-blend-mode:screen;
      background:
        radial-gradient(circle at var(--spx,28%) var(--spy,22%),
          rgba(255,255,255,.92), rgba(255,255,255,.26) 18%, rgba(255,255,255,0) 46%),
        radial-gradient(circle at var(--spx2,70%) var(--spy2,76%),
          rgba(255,255,255,.48), rgba(255,255,255,0) 52%);
    }

    .hvr-speedlines{
      position:absolute; inset:-22%;
      pointer-events:none;
      border-radius:999px;
      opacity:0;
      mix-blend-mode:screen;
      filter: blur(.1px);
      background:
        repeating-linear-gradient(115deg,
          rgba(255,255,255,.0) 0px,
          rgba(255,255,255,.0) 10px,
          rgba(255,255,255,.12) 12px,
          rgba(255,255,255,.0) 18px
        );
      transform:translate3d(0,0,0) rotate(-8deg);
      transition:opacity 120ms ease;
    }
    .hvr-storm-on .hvr-speedlines{ opacity:.38; }
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
    sel.forEach(s=>{ try{ DOC.querySelectorAll(String(s)).forEach(el=> out.push(el)); }catch{} });
  } else if (typeof sel === 'string') {
    try{ DOC.querySelectorAll(sel).forEach(el=> out.push(el)); }catch{}
  }

  const AUTO = [
    '.hud',
    '#hvr-start',
    '#hvr-end',
    '#hvr-crosshair',
    '.hvr-crosshair'
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
//  PERFECT ring distance + crosshair shoot
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

    // ✅ device tilt shimmer
    tiltShimmer = true,
    tiltIntensity = 1.0,
    tiltSmoothing = 0.88
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
    const stormLifeMul = (mul < 0.99) ? 0.86 : 1.0;  // storm → อยู่สั้นลง
    const intervalRatio = clamp(curInterval / baseDiff.spawnInterval, 0.45, 1.4);
    const ratioLifeMul = clamp(intervalRatio * 0.98, 0.55, 1.15);
    const life = curLife * stormLifeMul * ratioLifeMul;
    return Math.round(clamp(life, 520, baseDiff.life * 1.25));
  }

  // ======================================================
  //  ✅ Device Tilt (Gyro) → drives shimmer parallax
  // ======================================================
  const tilt = {
    ok:false, x:0, y:0, rx:0, ry:0, _bound:false, _cleanup:null
  };
  function setupTilt(){
    if (!tiltShimmer) return ()=>{};
    if (!('DeviceOrientationEvent' in ROOT)) return ()=>{};

    const smooth = clamp(Number(tiltSmoothing ?? 0.88), 0.70, 0.96);

    const onOri = (e)=>{
      const g = clamp(Number(e?.gamma ?? 0), -45, 45) / 45;
      const b = clamp(Number(e?.beta  ?? 0), -45, 45) / 45;

      tilt.rx = clamp(g, -1, 1);
      tilt.ry = clamp(b, -1, 1);

      tilt.x = tilt.x * smooth + tilt.rx * (1 - smooth);
      tilt.y = tilt.y * smooth + tilt.ry * (1 - smooth);

      tilt.ok = true;
    };

    if (!tilt._bound){
      tilt._bound = true;
      ROOT.addEventListener('deviceorientation', onOri, true);
    }

    let permTap = null;
    try{
      const DOE = ROOT.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === 'function'){
        permTap = async ()=>{
          try{
            const res = await DOE.requestPermission();
            if (String(res).toLowerCase() === 'granted'){
              // ok
            }
          }catch{}
          try{
            DOC.removeEventListener('pointerdown', permTap, true);
            DOC.removeEventListener('touchstart', permTap, true);
            DOC.removeEventListener('click', permTap, true);
          }catch{}
        };
        DOC.addEventListener('pointerdown', permTap, true);
        DOC.addEventListener('touchstart', permTap, true);
        DOC.addEventListener('click', permTap, true);
      }
    }catch{}

    return ()=>{
      try{ ROOT.removeEventListener('deviceorientation', onOri, true); }catch{}
      try{
        if (permTap){
          DOC.removeEventListener('pointerdown', permTap, true);
          DOC.removeEventListener('touchstart', permTap, true);
          DOC.removeEventListener('click', permTap, true);
        }
      }catch{}
      tilt.ok=false;
      tilt._bound=false;
    };
  }
  tilt._cleanup = setupTilt();

  // ======================================================
  //  Helpers: crosshair shoot
  // ======================================================
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
    try{ hostRect = host.getBoundingClientRect(); }catch{}
    if (!hostRect) hostRect = { left:0, top:0, right:(ROOT.innerWidth||1), bottom:(ROOT.innerHeight||1), width:(ROOT.innerWidth||1), height:(ROOT.innerHeight||1) };
    exState.margins = computeExclusionMargins(hostRect, exState.els);
  }

  function getCrosshairPoint(){
    let rect = null;
    try{ rect = host.getBoundingClientRect(); }catch{}
    if (!rect) rect = { left:0, top:0, width:(ROOT.innerWidth||1), height:(ROOT.innerHeight||1) };

    const ex = exState.margins || { top:0,bottom:0,left:0,right:0 };
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
  //  Reactive shimmer + float/sway (target-only)
  // ======================================================
  function startReactiveShimmer(data, sizePx){
    const el = data.el;
    const born = data.bornAt || (typeof performance!=='undefined'?performance.now():Date.now());
    const seed = Math.random()*1000;

    let raf = 0;
    function tick(ts){
      if (stopped) return;
      if (!el || !el.isConnected) return;

      const t = ((ts || 0) - born) * 0.001;
      const storm = host.classList && host.classList.contains('hvr-storm-on');

      // base sway (float)
      const sp = storm ? (1.65 + (seed%0.3)) : (1.05 + (seed%0.25));
      const amp = (storm ? 7.2 : 4.6) * (0.85 + (sizePx/92));
      const ampY = amp * 0.72;

      const x = Math.sin((t*sp) + seed) * amp;
      const y = Math.cos((t*sp*0.92) + seed*1.2) * ampY;

      // ✅ add device tilt parallax
      let tx=0, ty=0;
      if (tiltShimmer && tilt.ok){
        const inten = clamp(Number(tiltIntensity ?? 1.0), 0, 2.0);
        const tAmpX = amp  * 0.95 * inten * (storm ? 1.18 : 1.0);
        const tAmpY = ampY * 0.70 * inten * (storm ? 1.10 : 1.0);
        tx = tilt.x * tAmpX;
        ty = (-tilt.y) * tAmpY;
      }

      const xx = x + tx;
      const yy = y + ty;

      const tiltMag = Math.min(1, Math.sqrt((tilt.x*tilt.x)+(tilt.y*tilt.y)));
      const hue = (storm ? 14 : 9) + (Math.sin(t*0.9 + seed)*10) + tiltMag*(storm?18:10);

      // drive CSS vars used by film/spec
      el.style.setProperty('--shx', xx.toFixed(2)+'px');
      el.style.setProperty('--shy', yy.toFixed(2)+'px');
      el.style.setProperty('--shh', hue.toFixed(1)+'deg');
      el.style.setProperty('--shr', ((storm? (t*42):(t*26)) + seed).toFixed(1)+'deg');

      // spec points
      const spx  = clamp(26 + (xx * 1.25), 14, 42);
      const spy  = clamp(22 + (yy * 1.10), 12, 40);
      const spx2 = clamp(62 - (xx * 0.95), 52, 82);
      const spy2 = clamp(76 - (yy * 0.85), 56, 88);

      el.style.setProperty('--spx',  spx.toFixed(1)+'%');
      el.style.setProperty('--spy',  spy.toFixed(1)+'%');
      el.style.setProperty('--spx2', spx2.toFixed(1)+'%');
      el.style.setProperty('--spy2', spy2.toFixed(1)+'%');

      // subtle float (no filter wrapper)
      const rot = (storm ? 3.2 : 2.0) * Math.sin(t*0.8 + seed);
      el.style.transform = `translate(-50%,-50%) translate3d(${(xx*0.18).toFixed(2)}px, ${(yy*0.18).toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;

      raf = ROOT.requestAnimationFrame(tick);
    }

    raf = ROOT.requestAnimationFrame(tick);
    return ()=>{ try{ if (raf) ROOT.cancelAnimationFrame(raf); }catch{} };
  }

  // ======================================================
  //  Spawn target inside host
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

    const baseSize = 78;
    const size = baseSize * curScale;

    el.style.position = 'absolute';
    el.style.left = xLocal + 'px';
    el.style.top  = yLocal + 'px';
    el.style.transform = 'translate(-50%, -50%) scale(0.92)';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.borderRadius = '999px';
    el.style.touchAction = 'manipulation';
    el.style.zIndex = '35';

    // ✅ bubble base (ใสขึ้น + มิติมากขึ้น)
    let baseGrad = '';
    let ringGlow = '';

    if (isPower) {
      baseGrad = 'radial-gradient(circle at 30% 25%, rgba(250,204,21,.95), rgba(249,115,22,.88) 55%, rgba(2,6,23,.25) 100%)';
      ringGlow = '0 0 0 2px rgba(250,204,21,0.78), 0 0 26px rgba(250,204,21,0.90)';
    } else if (itemType === 'fakeGood') {
      baseGrad = 'radial-gradient(circle at 30% 25%, rgba(74,222,128,.78), rgba(22,163,74,.72) 55%, rgba(2,6,23,.25) 100%)';
      ringGlow = '0 0 0 2px rgba(167,139,250,0.78), 0 0 24px rgba(167,139,250,0.88)';
    } else if (isGood) {
      baseGrad = 'radial-gradient(circle at 30% 25%, rgba(74,222,128,.72), rgba(22,163,74,.68) 55%, rgba(2,6,23,.24) 100%)';
      ringGlow = '0 0 0 2px rgba(74,222,128,0.62), 0 0 20px rgba(16,185,129,0.78)';
    } else {
      baseGrad = 'radial-gradient(circle at 30% 25%, rgba(251,146,60,.78), rgba(234,88,12,.70) 55%, rgba(2,6,23,.25) 100%)';
      ringGlow = '0 0 0 2px rgba(248,113,113,0.64), 0 0 22px rgba(248,113,113,0.86)';
      el.classList.add('bad');
    }

    el.style.background = baseGrad;
    el.style.boxShadow = `0 16px 34px rgba(15,23,42,0.90), ${ringGlow}`;

    // ✅ inner glass (bubble clarity)
    const inner = DOC.createElement('div');
    inner.style.position='absolute';
    inner.style.left='50%';
    inner.style.top='50%';
    inner.style.transform='translate(-50%,-50%)';
    inner.style.width = (size * 0.84) + 'px';
    inner.style.height = (size * 0.84) + 'px';
    inner.style.borderRadius='999px';
    inner.style.display='flex';
    inner.style.alignItems='center';
    inner.style.justifyContent='center';
    inner.style.background =
      'radial-gradient(circle at 30% 25%, rgba(255,255,255,.18), rgba(255,255,255,.06) 28%, rgba(15,23,42,.16) 62%, rgba(15,23,42,.28))';
    inner.style.boxShadow='inset 0 8px 18px rgba(2,6,23,.75), inset 0 -10px 20px rgba(255,255,255,.06)';

    // ✅ perfect ring (visual)
    const ring = DOC.createElement('div');
    ring.style.position='absolute';
    ring.style.left='50%';
    ring.style.top='50%';
    ring.style.width  = (size * 0.36) + 'px';
    ring.style.height = (size * 0.36) + 'px';
    ring.style.transform='translate(-50%,-50%)';
    ring.style.borderRadius='999px';
    ring.style.border='2px solid rgba(255,255,255,0.34)';
    ring.style.boxShadow='0 0 14px rgba(255,255,255,0.20)';
    ring.style.pointerEvents='none';
    el.appendChild(ring);

    // ✅ thin-film iridescence + spec layers
    const film = DOC.createElement('div');
    film.className='hvr-bubble-film';
    el.appendChild(film);

    const spec = DOC.createElement('div');
    spec.className='hvr-bubble-spec';
    el.appendChild(spec);

    const speed = DOC.createElement('div');
    speed.className='hvr-speedlines';
    el.appendChild(speed);

    // fakeGood marker
    if (itemType === 'fakeGood') {
      const sp = DOC.createElement('div');
      sp.textContent = '✨';
      sp.style.position = 'absolute';
      sp.style.right = '8px';
      sp.style.top = '6px';
      sp.style.fontSize = '18px';
      sp.style.filter = 'drop-shadow(0 3px 4px rgba(15,23,42,0.9))';
      sp.style.pointerEvents = 'none';
      el.appendChild(sp);
    }

    // icon
    const icon = DOC.createElement('span');
    icon.textContent = ch;
    icon.style.fontSize = (size * 0.60) + 'px';
    icon.style.lineHeight = '1';
    icon.style.filter = 'drop-shadow(0 4px 7px rgba(15,23,42,0.85))';

    inner.appendChild(icon);
    el.appendChild(inner);

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
      _stopShimmer: null
    };

    activeTargets.add(data);
    host.appendChild(el);

    // start shimmer/float
    data._stopShimmer = startReactiveShimmer(data, size);

    function consumeHit(evOrSynth, hitInfoOpt){
      if (stopped) return;
      if (!activeTargets.has(data)) return;

      // compute rect before remove
      let keepRect = null;
      try{ keepRect = el.getBoundingClientRect(); }catch{}

      // disable further input
      try { el.style.pointerEvents='none'; } catch {}

      // ✅ hit pop animation (เอฟเฟกต์ไม่หาย)
      try { el.classList.add('hvr-hit'); } catch {}

      // prepare ctx before remove
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

      // cleanup after short delay so "hit pop" ได้เห็น
      ROOT.setTimeout(()=>{
        activeTargets.delete(data);
        try{ if (data._stopShimmer) data._stopShimmer(); }catch{}
        try { el.removeEventListener('pointerdown', handleHit); } catch {}
        try { el.removeEventListener('click', handleHit); } catch {}
        try { el.removeEventListener('touchstart', handleHit); } catch {}
        try { host.removeChild(el); } catch {}
      }, 90);
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
      try{ if (data._stopShimmer) data._stopShimmer(); }catch{}
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

    activeTargets.forEach(t => {
      try{ if (t._stopShimmer) t._stopShimmer(); }catch{}
      try { t.el.remove(); } catch {}
    });
    activeTargets.clear();

    try { dispatchTime(0); } catch {}

    // ✅ cleanup tilt listener
    try{ if (tilt && typeof tilt._cleanup === 'function') tilt._cleanup(); }catch{}
    tilt._cleanup = null;
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
