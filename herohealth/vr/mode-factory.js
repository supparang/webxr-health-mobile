// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (adaptive) สำหรับ HeroHealth VR/Quest
// ✅ PATCH: spawnHost/spawnLayer/container → เป้าลง playfield
// ✅ NEW: VR-look (drag-to-look + deviceorientation) → เป้าเลื่อนตามมุมมองเหมือน VR
// ✅ NEW: spawnStyle 'emoji' (sticker) | 'orb' (ลูกกลมเดิม)
// ✅ NEW: tapToShoot (แตะที่ไหนก็ยิงจากกลางจอ) + crosshair point respects HUD exclusion
// ✅ NEW: fade-in/out + hit pop
// ✅ PATCH(SAFEZONE): เพิ่ม auto selector '.hud' สำหรับ hydration-vr.html

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

    /* spawn layer (สำหรับ VR-look transform) */
    .hvr-spawn-layer{
      position:absolute;
      inset:0;
      pointer-events:none;
      will-change:transform;
      transform:translate3d(0,0,0);
    }
    .hvr-spawn-layer .hvr-target{ pointer-events:auto; }

    /* pulse (rhythm) */
    .hvr-target.hvr-pulse{
      animation:hvrPulse .55s ease-in-out infinite;
    }
    @keyframes hvrPulse{
      0%{ transform:translate(-50%,-50%) scale(1); }
      50%{ transform:translate(-50%,-50%) scale(1.08); }
      100%{ transform:translate(-50%,-50%) scale(1); }
    }

    /* appear/disappear */
    .hvr-target{
      opacity:0;
      transition: transform 120ms ease, opacity 120ms ease, filter 120ms ease;
      will-change: transform, opacity;
    }
    .hvr-target.on{ opacity:1; }
    .hvr-target.off{ opacity:0; }

    /* emoji sticker look */
    .hvr-target[data-style="emoji"]{
      background:transparent !important;
      box-shadow:none !important;
      border:none !important;
      filter: drop-shadow(0 12px 18px rgba(0,0,0,.35));
    }
    .hvr-emoji{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      line-height:1;
      transform: translateZ(0);
      /* stroke-ish */
      text-shadow:
        0 2px 0 rgba(2,6,23,.35),
        0 0 12px rgba(2,6,23,.25),
        1px 0 rgba(2,6,23,.35),
        -1px 0 rgba(2,6,23,.35),
        0 1px rgba(2,6,23,.35),
        0 -1px rgba(2,6,23,.35);
      user-select:none;
    }
    .hvr-emoji-ring{
      position:absolute;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      border-radius:999px;
      pointer-events:none;
      border:2px solid rgba(226,232,240,.28);
      box-shadow: 0 0 18px rgba(96,165,250,.12);
    }

    /* storm hint (optional) */
    .hvr-storm-on .hvr-target{ filter: saturate(1.06) contrast(1.06); }
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
//  Host resolver + spawn layer
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

function ensureSpawnLayer(host){
  if (!host || !DOC) return host;
  ensureOverlayStyle();

  // ถ้า host คือ overlay-host ก็ให้มี layer เช่นกัน
  let layer = host.querySelector(':scope > .hvr-spawn-layer');
  if (layer && layer.isConnected) return layer;

  layer = DOC.createElement('div');
  layer.className = 'hvr-spawn-layer';
  layer.setAttribute('data-hvr-layer', '1');
  host.appendChild(layer);
  return layer;
}

// ======================================================
//  SAFE ZONE / EXCLUSION (กันทับ HUD)
// ======================================================
function collectExclusionElements(rawCfg){
  if (!DOC) return [];
  const out = [];

  // Explicit selectors from cfg
  const sel = rawCfg && rawCfg.excludeSelectors;
  if (Array.isArray(sel)) {
    sel.forEach(s=>{
      try{ DOC.querySelectorAll(String(s)).forEach(el=> out.push(el)); }catch{}
    });
  } else if (typeof sel === 'string') {
    try{ DOC.querySelectorAll(sel).forEach(el=> out.push(el)); }catch{}
  }

  // Auto common HUD blocks (HeroHealth patterns) + ✅ hydration HUD (.hud)
  const AUTO = [
    '.hud',
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
    '#hvr-start'
  ];
  AUTO.forEach(s=>{
    try{ DOC.querySelectorAll(s).forEach(el=> out.push(el)); }catch{}
  });

  // Any marked exclusion
  try{
    DOC.querySelectorAll('[data-hha-exclude="1"]').forEach(el=> out.push(el));
  }catch{}

  // unique + connected
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

    // ignore if no overlap with host
    const ox1 = Math.max(hx1, r.left);
    const oy1 = Math.max(hy1, r.top);
    const ox2 = Math.min(hx2, r.right);
    const oy2 = Math.min(hy2, r.bottom);
    if (ox2 <= ox1 || oy2 <= oy1) return;

    // If it touches the top edge of host, reserve top margin
    if (r.top <= hy1 + 2 && r.bottom > hy1) {
      m.top = Math.max(m.top, clamp(r.bottom - hy1, 0, hostRect.height));
    }
    // bottom
    if (r.bottom >= hy2 - 2 && r.top < hy2) {
      m.bottom = Math.max(m.bottom, clamp(hy2 - r.top, 0, hostRect.height));
    }
    // left
    if (r.left <= hx1 + 2 && r.right > hx1) {
      m.left = Math.max(m.left, clamp(r.right - hx1, 0, hostRect.width));
    }
    // right
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

  // base padding inside host
  const basePadX = w * 0.10;
  const basePadTop = h * 0.12;
  const basePadBot = h * 0.12;

  // exclusion margins from HUD (computed per loop; cached in exState)
  const m = exState && exState.margins ? exState.margins : { top:0,bottom:0,left:0,right:0 };

  const left   = basePadX + m.left;
  const top    = basePadTop + m.top;
  const width  = Math.max(1, w - (basePadX*2) - m.left - m.right);
  const height = Math.max(1, h - basePadTop - basePadBot - m.top - m.bottom);

  return { left, top, width, height, hostRect: r, isOverlay };
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
  const norm = dist / rad; // 0..1 (inside)
  const perfect = norm <= 0.33; // inner ring
  return { cx, cy, dist, norm, perfect, rect:r };
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
    spawnStyle = 'emoji',      // ✅ 'emoji' | 'orb'
    judge,
    onExpire,

    // NEW
    allowAdaptive = true,
    rhythm = null, // { enabled:true, bpm:110 } or boolean
    trickRate = 0.08, // fakeGood frequency

    // Storm multiplier (number OR function => number)
    spawnIntervalMul = null,

    // Safe zone
    excludeSelectors = null,

    // ✅ VR-look
    dragToLook = true,
    orientToLook = true,
    tapToShoot = false,
    lookMaxPx = 140,
    lookSmoothing = 0.16,
    lookInertia = 0.86,
    lookOrientStrength = 0.90
  } = rawCfg || {};

  const diffKey  = String(difficulty || 'normal').toLowerCase();
  const baseDiff = pickDiffConfig(modeKey, diffKey);

  const host = resolveHost(rawCfg);
  if (!host || !DOC) {
    console.error('[mode-factory] host not found');
    return { stop () {}, shootCrosshair(){ return false; } };
  }

  // spawn layer (transform ตรงนี้เพื่อให้ “เลื่อนโลก” โดย host rect ยังนิ่ง)
  const layer = ensureSpawnLayer(host);

  // ให้ host/ layer รองรับ gesture
  try{ host.style.touchAction = 'none'; }catch{}
  try{ layer.style.pointerEvents = 'none'; }catch{} // targets pointerEvents:auto เอง

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
  let curLife      = baseDiff.life; // adaptive life

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
    const stormLifeMul = (mul < 0.99) ? 0.88 : 1.0;
    const intervalRatio = clamp(curInterval / baseDiff.spawnInterval, 0.45, 1.4);
    const ratioLifeMul = clamp(intervalRatio * 0.98, 0.55, 1.15);

    const life = curLife * stormLifeMul * ratioLifeMul;
    return Math.round(clamp(life, 520, baseDiff.life * 1.25));
  }

  // ======================================================
  //  Exclusion cache (กันทับ HUD)
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

  // ======================================================
  //  Crosshair shooting
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
  //  ✅ VR-look (drag + orientation) -> transform layer
  // ======================================================
  const look = {
    enabledDrag: !!dragToLook,
    enabledOrient: !!orientToLook,
    max: clamp(lookMaxPx, 40, 260),
    tx: 0, ty: 0,       // current
    gx: 0, gy: 0,       // goal
    vx: 0, vy: 0,       // inertia velocity
    down: false,
    lx: 0, ly: 0,
    ox: 0, oy: 0        // orientation goal
  };

  function applyLook(){
    const s = clamp(lookSmoothing, 0.05, 0.35);
    const inertia = clamp(lookInertia, 0.50, 0.98);

    // goal = drag + orient
    const gx = clamp(look.gx + look.ox, -look.max, look.max);
    const gy = clamp(look.gy + look.oy, -look.max, look.max);

    const dx = gx - look.tx;
    const dy = gy - look.ty;

    look.vx = (look.vx + dx * s) * inertia;
    look.vy = (look.vy + dy * s) * inertia;

    look.tx = clamp(look.tx + look.vx, -look.max, look.max);
    look.ty = clamp(look.ty + look.vy, -look.max, look.max);

    try{
      layer.style.transform = `translate3d(${look.tx}px, ${look.ty}px, 0)`;
    }catch{}
  }

  function onPointerDown(ev){
    if (!look.enabledDrag) return;

    // ถ้ากดโดนเป้า → ให้เป้า handle hit เอง ไม่เริ่มลาก
    const t = ev.target;
    if (t && t.closest && t.closest('.hvr-target')) return;

    look.down = true;
    const xy = getEventXY(ev);
    look.lx = xy.x;
    look.ly = xy.y;
  }
  function onPointerMove(ev){
    if (!look.enabledDrag || !look.down) return;
    const xy = getEventXY(ev);
    const dx = xy.x - look.lx;
    const dy = xy.y - look.ly;
    look.lx = xy.x;
    look.ly = xy.y;

    // drag to move world (invert feel)
    look.gx = clamp(look.gx + dx * 0.85, -look.max, look.max);
    look.gy = clamp(look.gy + dy * 0.85, -look.max, look.max);
  }
  function onPointerUp(){
    if (!look.enabledDrag) return;
    look.down = false;
  }

  // device orientation -> look.ox/oy
  function onDeviceOrient(e){
    if (!look.enabledOrient) return;
    const gamma = Number(e?.gamma || 0); // left/right (-90..90)
    const beta  = Number(e?.beta  || 0); // front/back (-180..180)
    const k = clamp(lookOrientStrength, 0.2, 1.4);

    // map to px
    const ox = clamp((gamma / 30) * look.max * 0.55 * k, -look.max, look.max);
    const oy = clamp((beta  / 35) * look.max * 0.45 * k, -look.max, look.max);
    look.ox = ox;
    look.oy = oy;
  }

  // Bind look controls
  try{
    host.addEventListener('pointerdown', onPointerDown, { passive:false });
    host.addEventListener('pointermove', onPointerMove, { passive:false });
    host.addEventListener('pointerup', onPointerUp, { passive:true });
    host.addEventListener('pointercancel', onPointerUp, { passive:true });
    host.addEventListener('mouseleave', onPointerUp, { passive:true });
  }catch{}

  // orientation needs permission on iOS; we listen anyway
  try{
    ROOT.addEventListener('deviceorientation', onDeviceOrient, { passive:true });
  }catch{}

  // tap anywhere to shoot (optional, VR feel)
  function onHostTapShoot(ev){
    if (!tapToShoot) return;
    const t = ev.target;
    if (t && t.closest && t.closest('.hvr-target')) return;
    // ยิงจากกลางจอ
    const ok = shootCrosshair();
    if (ok) {
      try{ ev.preventDefault(); ev.stopPropagation(); }catch{}
    }
  }
  try{
    host.addEventListener('click', onHostTapShoot, { passive:false });
    host.addEventListener('touchstart', onHostTapShoot, { passive:false });
  }catch{}

  // ======================================================
  //  Spawn target inside host/layer
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
    el.setAttribute('data-style', String(spawnStyle || 'emoji'));

    const baseSize = 78;
    const size = baseSize * curScale;

    el.style.position = 'absolute';
    el.style.left = xLocal + 'px';
    el.style.top  = yLocal + 'px';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.zIndex = '35';
    el.style.touchAction = 'manipulation';

    // appearance
    el.style.transform = 'translate(-50%, -50%) scale(0.72)';
    el.classList.remove('on','off');

    // --- style: emoji sticker (recommended) ---
    if (String(spawnStyle) === 'emoji') {
      // ring
      const ring = DOC.createElement('div');
      ring.className = 'hvr-emoji-ring';
      ring.style.width  = (size * 0.92) + 'px';
      ring.style.height = (size * 0.92) + 'px';
      // ring color hint
      if (isPower) ring.style.borderColor = 'rgba(250,204,21,.35)';
      else if (!isGood) ring.style.borderColor = 'rgba(248,113,113,.28)';
      else ring.style.borderColor = 'rgba(74,222,128,.28)';
      el.appendChild(ring);

      // emoji
      const icon = DOC.createElement('span');
      icon.className = 'hvr-emoji';
      icon.textContent = ch;
      icon.style.fontSize = (size * 0.82) + 'px';
      icon.style.filter = 'drop-shadow(0 8px 10px rgba(0,0,0,.35))';
      el.appendChild(icon);

      // small badge
      if (itemType === 'fakeGood') {
        const sp = DOC.createElement('div');
        sp.textContent = '✨';
        sp.style.position = 'absolute';
        sp.style.right = '6px';
        sp.style.top = '4px';
        sp.style.fontSize = '18px';
        sp.style.pointerEvents = 'none';
        sp.style.filter = 'drop-shadow(0 3px 4px rgba(15,23,42,0.9))';
        el.appendChild(sp);
      }
    } else {
      // --- style: orb (เดิมแนวลูกกลม) ---
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

      el.style.borderRadius = '999px';
      el.style.background = bgGrad;
      el.style.boxShadow = '0 14px 30px rgba(15,23,42,0.9),' + ringGlow;

      const inner = DOC.createElement('div');
      inner.style.position = 'absolute';
      inner.style.left = '50%';
      inner.style.top = '50%';
      inner.style.transform = 'translate(-50%,-50%)';
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
    }

    if (rhythmOn) el.classList.add('hvr-pulse');

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
    layer.appendChild(el);

    // fade in
    ROOT.requestAnimationFrame(() => {
      el.classList.add('on');
      el.style.transform = 'translate(-50%, -50%) scale(1)';
    });

    function removeWithFx(ms=90){
      try{
        el.classList.add('off');
        el.style.transform = 'translate(-50%, -50%) scale(1.22)';
      }catch{}
      ROOT.setTimeout(()=>{
        try{ el.remove(); }catch{}
      }, ms);
    }

    function consumeHit(evOrSynth, hitInfoOpt){
      if (stopped) return;
      if (!activeTargets.has(data)) return;

      // เก็บ rect ก่อน remove
      let keepRect = null;
      try{ keepRect = el.getBoundingClientRect(); }catch{}

      activeTargets.delete(data);
      try { el.removeEventListener('pointerdown', handleHit); } catch {}
      try { el.removeEventListener('click', handleHit); } catch {}
      try { el.removeEventListener('touchstart', handleHit); } catch {}

      // hit pop (แสดง 1 เฟรมก่อนหาย)
      removeWithFx(80);

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
          clientX: xy.x, clientY: xy.y, cx: xy.x, cy: xy.y,
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
      try{ ev.preventDefault(); ev.stopPropagation(); }catch{}
      consumeHit(ev, null);
    };

    data._hit = consumeHit;

    el.addEventListener('pointerdown', handleHit, { passive: false });
    el.addEventListener('click', handleHit, { passive: false });
    el.addEventListener('touchstart', handleHit, { passive: false });

    // expire (fade out แล้วค่อย remove)
    ROOT.setTimeout(() => {
      if (stopped) return;
      if (!activeTargets.has(data)) return;

      activeTargets.delete(data);
      try { el.removeEventListener('pointerdown', handleHit); } catch {}
      try { el.removeEventListener('click', handleHit); } catch {}
      try { el.removeEventListener('touchstart', handleHit); } catch {}

      // fade out
      try{
        el.classList.add('off');
        el.style.transform = 'translate(-50%, -50%) scale(0.92)';
      }catch{}
      ROOT.setTimeout(()=>{
        try{ el.remove(); }catch{}
      }, 110);

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

    // ✅ apply look every frame
    applyLook();

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

      // Storm multiplier affects interval จริง
      const mul = getSpawnMul();
      const effInterval = Math.max(35, curInterval * mul);

      // storm class toggle
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
      try{ host.removeEventListener('pointerdown', onPointerDown); }catch{}
      try{ host.removeEventListener('pointermove', onPointerMove); }catch{}
      try{ host.removeEventListener('pointerup', onPointerUp); }catch{}
      try{ host.removeEventListener('pointercancel', onPointerUp); }catch{}
      try{ host.removeEventListener('mouseleave', onPointerUp); }catch{}
      try{ host.removeEventListener('click', onHostTapShoot); }catch{}
      try{ host.removeEventListener('touchstart', onHostTapShoot); }catch{}
      try{ ROOT.removeEventListener('deviceorientation', onDeviceOrient); }catch{}
      stop();
    },
    shootCrosshair
  };
}

export default { boot };
