// === /herohealth/vr/mode-factory.js ===
// ULTIMATE DOM spawner for HeroHealth
// ✅ grid9 กระจายจริง + anti-stuck (ไม่ซ้ำ cell เดิมติดกัน)
// ✅ ignore exclusion เมื่อ HUD ถูกซ่อน (hud-hidden/opacity low)
// ✅ boundsHost เป็นฐานคำนวณ spawn rect (ignore transform)
// ✅ perfect-ring support (ctx.hitPerfect)
// ✅ Boss 3-hit (chip score) + reset expire
// ✅ shootCrosshair() สำหรับ Tap-anywhere fire

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
  return arr[(Math.random() * arr.length) | 0];
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

// styles
function ensureOverlayStyle () {
  if (!DOC || DOC.getElementById('hvr-overlay-style')) return;
  const s = DOC.createElement('style');
  s.id = 'hvr-overlay-style';
  s.textContent = `
    .hvr-overlay-host{ position:fixed; inset:0; z-index:9998; pointer-events:none; }
    .hvr-overlay-host .hvr-target{ pointer-events:auto; }
    .hvr-target.hvr-pulse{ animation:hvrPulse .55s ease-in-out infinite; }
    @keyframes hvrPulse{ 0%{ transform:translate(-50%,-50%) scale(1); } 50%{ transform:translate(-50%,-50%) scale(1.08);} 100%{ transform:translate(-50%,-50%) scale(1);} }
    .hvr-wiggle{ position:absolute; inset:0; border-radius:999px; display:flex; align-items:center; justify-content:center; pointer-events:none; transform: translate3d(0,0,0); will-change: transform; }
    .hvr-boss{ box-shadow: 0 18px 44px rgba(0,0,0,.72), 0 0 0 2px rgba(56,189,248,.75), 0 0 24px rgba(56,189,248,.55) !important; }
    .hvr-shake{ animation:hvrShake .16s ease-in-out 1; }
    @keyframes hvrShake{
      0%{ transform:translate(-50%,-50%) scale(1) rotate(0deg); }
      25%{ transform:translate(-50%,-50%) scale(1.02) rotate(-3deg); }
      50%{ transform:translate(-50%,-50%) scale(1.02) rotate(3deg); }
      100%{ transform:translate(-50%,-50%) scale(1) rotate(0deg); }
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
function resolveHost (rawCfg, keyName = 'spawnHost') {
  if (!DOC) return null;

  const h = rawCfg && rawCfg[keyName];
  if (h && typeof h === 'string') {
    const el = DOC.querySelector(h);
    if (el) return el;
  }
  if (h && h.nodeType === 1) return h;

  if (keyName === 'spawnHost') return ensureOverlayHost();
  return ensureOverlayHost();
}

// ---------- exclusions ----------
function isVisiblyExcluded(el){
  if (!el || !el.isConnected) return false;
  try{
    if (el.classList && el.classList.contains('hud-hidden')) return false;

    const cs = ROOT.getComputedStyle ? ROOT.getComputedStyle(el) : null;
    if (!cs) return true;

    if (cs.display === 'none') return false;
    if (cs.visibility === 'hidden') return false;

    const op = Number(cs.opacity);
    if (Number.isFinite(op) && op <= 0.06) return false;

    return true;
  }catch{
    return true;
  }
}

function collectExclusionElements(rawCfg){
  if (!DOC) return [];
  const out = [];

  const sel = rawCfg && rawCfg.excludeSelectors;
  if (Array.isArray(sel)) sel.forEach(s=>{ try{ DOC.querySelectorAll(String(s)).forEach(el=> out.push(el)); }catch{} });
  else if (typeof sel === 'string') { try{ DOC.querySelectorAll(sel).forEach(el=> out.push(el)); }catch{} }

  const AUTO = ['.hud','#hvr-crosshair','#hvr-end','.hha-bottom-row','.hha-main-row','.hha-fever-card'];
  AUTO.forEach(s=>{ try{ DOC.querySelectorAll(s).forEach(el=> out.push(el)); }catch{} });

  try{ DOC.querySelectorAll('[data-hha-exclude="1"]').forEach(el=> out.push(el)); }catch{}

  const uniq = [];
  const seen = new Set();
  out.forEach(el=>{
    if (!el || !el.isConnected) return;
    if (!isVisiblyExcluded(el)) return;
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
    if (!isVisiblyExcluded(el)) return;
    let r=null;
    try{ r = el.getBoundingClientRect(); }catch{}
    if (!r) return;

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

function computePlayRectFromHost (hostEl, exState) {
  const r = hostEl.getBoundingClientRect();
  const isOverlay = hostEl && hostEl.id === 'hvr-overlay-host';

  let w = Math.max(1, r.width  || (isOverlay ? (ROOT.innerWidth  || 1) : 1));
  let h = Math.max(1, r.height || (isOverlay ? (ROOT.innerHeight || 1) : 1));

  const basePadX   = w * 0.10;
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
    trickRate = 0.08,

    spawnIntervalMul = null,
    excludeSelectors = null,

    boundsHost = null,
    decorateTarget = null,

    spawnAroundCrosshair = true,
    spawnStrategy = null,
    spawnRadiusX = 0.34,
    spawnRadiusY = 0.30,
    minSeparation = 0.95,
    maxSpawnTries = 14,

    boss = null,
  } = rawCfg || {};

  const diffKey  = String(difficulty || 'normal').toLowerCase();
  const baseDiff = pickDiffConfig(modeKey, diffKey);

  const hostSpawn  = resolveHost(rawCfg, 'spawnHost');
  const hostBounds = ((boundsHost != null) ? resolveHost(rawCfg, 'boundsHost') : null) || hostSpawn;

  if (!hostSpawn || !hostBounds || !DOC) {
    console.error('[mode-factory] host not found');
    return { stop () {}, shootCrosshair(){ return false; } };
  }

  let stopped = false;

  const totalDuration = clamp(duration, 20, 180);
  let secLeft = totalDuration;

  let activeTargets = new Set();
  let spawnCounter  = 0;

  // adaptive (คง logic เดิมแบบย่อ)
  let adaptLevel   = 0;
  let curInterval  = baseDiff.spawnInterval;
  let curMaxActive = baseDiff.maxActive;
  let curScale     = baseDiff.scale;
  let curLife      = baseDiff.life;

  let sampleHits=0, sampleMisses=0, sampleTotal=0;
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

    curInterval  = clamp(baseDiff.spawnInterval * intervalMul, baseDiff.spawnInterval * 0.45, baseDiff.spawnInterval * 1.4);
    curScale     = clamp(baseDiff.scale * scaleMul, baseDiff.scale * 0.6, baseDiff.scale * 1.4);
    curLife      = clamp(baseDiff.life * lifeMul, baseDiff.life * 0.55, baseDiff.life * 1.15);
    curMaxActive = clamp(baseDiff.maxActive + adaptLevel, 2, 10);

    sampleHits=sampleMisses=sampleTotal=0;

    try {
      ROOT.dispatchEvent(new CustomEvent('hha:adaptive', {
        detail: { modeKey, difficulty: diffKey, level: adaptLevel, spawnInterval: curInterval, maxActive: curMaxActive, scale: curScale, life: curLife }
      }));
    } catch {}
  }

  function addSample (isHit) {
    if (!allowAdaptive) return;
    if (isHit) sampleHits++; else sampleMisses++;
    sampleTotal++;
    if (sampleTotal >= ADAPT_WINDOW) recalcAdaptive();
  }

  function getSpawnMul(){
    let m = 1;
    try{
      if (typeof spawnIntervalMul === 'function') m = Number(spawnIntervalMul()) || 1;
      else if (spawnIntervalMul != null) m = Number(spawnIntervalMul) || 1;
    }catch{}
    return clamp(m, 0.25, 999);
  }

  function getLifeMs(){
    const mul = getSpawnMul();
    const stormLifeMul = (mul < 0.99) ? 0.88 : 1.0;
    const intervalRatio = clamp(curInterval / baseDiff.spawnInterval, 0.45, 1.4);
    const ratioLifeMul = clamp(intervalRatio * 0.98, 0.55, 1.15);
    const life = curLife * stormLifeMul * ratioLifeMul;
    return Math.round(clamp(life, 520, baseDiff.life * 1.25));
  }

  // exclusions state
  const exState = {
    els: collectExclusionElements({ excludeSelectors }),
    margins: { top:0,bottom:0,left:0,right:0 },
    lastRefreshTs: 0
  };

  function refreshExclusions(ts){
    if (!ts) ts = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (ts - exState.lastRefreshTs < 450) return;
    exState.lastRefreshTs = ts;

    exState.els = collectExclusionElements({ excludeSelectors });
    let hostRect = null;
    try{ hostRect = hostBounds.getBoundingClientRect(); }catch{}
    if (!hostRect) hostRect = rectFromWHLT(0,0,(ROOT.innerWidth||1),(ROOT.innerHeight||1));
    exState.margins = computeExclusionMargins(hostRect, exState.els);
  }

  // crosshair point
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

  function shootCrosshair(){
    if (stopped) return false;
    refreshExclusions();
    const p = getCrosshairPoint();
    const hit = findTargetAtPoint(p.x, p.y);
    if (!hit) return false;
    if (typeof hit.t._hit === 'function'){
      hit.t._hit({ __hhaSynth:true, clientX:p.x, clientY:p.y }, hit.info);
      return true;
    }
    return false;
  }

  // spawn rects (ignore transform)
  function getRectsForSpawn(){
    const bRect = getRectSafe(hostBounds) || rectFromWHLT(0,0,(ROOT.innerWidth||1),(ROOT.innerHeight||1));
    let sRect = getRectSafe(hostSpawn);
    if (!sRect) sRect = bRect;

    if (hasTransform(hostSpawn)) {
      sRect = rectFromWHLT(bRect.left, bRect.top, bRect.width, bRect.height);
    }

    return { bRect, sRect };
  }

  function makePlayLocalRect(){
    const { bRect, sRect } = getRectsForSpawn();
    const pr = computePlayRectFromHost(hostBounds, exState);

    const cL = bRect.left + pr.left;
    const cT = bRect.top  + pr.top;

    return {
      left: cL - sRect.left,
      top:  cT - sRect.top,
      width: pr.width,
      height: pr.height,
      bRect, sRect
    };
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

  function getValMaybeFn(v){
    try{ return (typeof v === 'function') ? v() : v; }catch{ return v; }
  }

  // anti-stuck grid9 memory
  let lastGridCell = -1;

  function pickSpawnPointLocal(playLocal, sizePx){
    const { sRect } = playLocal;
    const centers = getExistingCentersLocal(sRect);

    const minDist = Math.max(18, sizePx * minSeparation);
    const tries = clamp(maxSpawnTries, 6, 30);

    const around = !!getValMaybeFn(spawnAroundCrosshair);
    const rX = clamp(Number(getValMaybeFn(spawnRadiusX) ?? 0.34) || 0.34, 0.18, 0.99);
    const rY = clamp(Number(getValMaybeFn(spawnRadiusY) ?? 0.30) || 0.30, 0.16, 0.99);

    let ax = playLocal.left + playLocal.width * 0.50;
    let ay = playLocal.top  + playLocal.height * 0.52;

    if (around) {
      const cp = getCrosshairPoint();
      ax = cp.x - sRect.left;
      ay = cp.y - sRect.top;
    }

    const rx = playLocal.width  * rX;
    const ry = playLocal.height * rY;

    const maxVisualScale = 1.10;
    const pad = Math.max(12, (sizePx * maxVisualScale) * 0.62);

    const minX = playLocal.left + pad;
    const maxX = playLocal.left + playLocal.width  - pad;
    const minY = playLocal.top  + pad;
    const maxY = playLocal.top  + playLocal.height - pad;

    const rectOk = (playLocal.width >= sizePx*1.30) && (playLocal.height >= sizePx*1.30);
    if (!rectOk) {
      return { x: clamp(ax, minX, maxX), y: clamp(ay, minY, maxY), ok:true };
    }

    function tri(){ return (Math.random() + Math.random() - 1); }
    let best=null, bestScore=-1;

    const useUniform = !around;
    const strat = String(getValMaybeFn(spawnStrategy) || '').toLowerCase();

    function grid9Point(){
      // เลือก cell แบบกันซ้ำติดกัน
      let col=0,row=0,cell=0;
      for (let t=0;t<4;t++){
        col = (Math.random()*3)|0;
        row = (Math.random()*3)|0;
        cell = row*3 + col;
        if (cell !== lastGridCell) break;
      }
      lastGridCell = cell;

      const cellW = (maxX - minX) / 3;
      const cellH = (maxY - minY) / 3;
      const x0 = minX + col*cellW;
      const y0 = minY + row*cellH;
      const x = x0 + Math.random()*cellW;
      const y = y0 + Math.random()*cellH;
      return { x, y };
    }

    for (let i=0;i<tries;i++){
      let x,y;

      if (strat === 'grid9'){
        const p = grid9Point();
        x = p.x; y = p.y;
      } else {
        x = useUniform
          ? (minX + Math.random() * (maxX - minX))
          : clamp(ax + tri()*rx, minX, maxX);

        y = useUniform
          ? (minY + Math.random() * (maxY - minY))
          : clamp(ay + tri()*ry, minY, maxY);
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
      if (score > bestScore) { bestScore = score; best = { x, y, ok }; }
      if (ok) return { x, y, ok:true };
    }

    return best || { x: clamp(ax, minX, maxX), y: clamp(ay, minY, maxY), ok:true };
  }

  function spawnTarget () {
    if (activeTargets.size >= curMaxActive) return;

    refreshExclusions();

    const playLocal = makePlayLocalRect();

    const poolsGood  = Array.isArray(pools.good)  ? pools.good  : [];
    const poolsBad   = Array.isArray(pools.bad)   ? pools.bad   : [];
    const poolsTrick = Array.isArray(pools.trick) ? pools.trick : [];

    const bossCfg = boss && boss.enabled ? boss : null;
    const bossEvery = bossCfg ? clamp(bossCfg.every || 0, 4, 999) : 0;
    const bossDue = bossCfg && bossEvery > 0 && (spawnCounter > 0) && (spawnCounter % bossEvery === 0);

    let ch='💧', isGood=true, isPower=false, itemType='good', isBoss=false, bossHp=0;

    const canPower = Array.isArray(powerups) && powerups.length > 0;
    const canTrick = poolsTrick.length > 0 && Math.random() < trickRate;

    if (bossDue){
      isBoss = true;
      bossHp = clamp(bossCfg.hp || 3, 2, 9);
      ch = String(bossCfg.emoji || '💧');
      isGood = true;
      isPower = false;
      itemType = 'boss';
    } else if (canPower && ((spawnCounter % Math.max(1, powerEvery)) === 0) && Math.random() < powerRate) {
      ch = pickOne(powerups, '⭐');
      isGood = true;
      isPower = true;
      itemType = 'power';
    } else if (canTrick) {
      ch = pickOne(poolsTrick, '🍭');
      isGood = true;
      isPower = false;
      itemType = 'fakeGood';
    } else {
      const r = Math.random();
      if (r < goodRate || !poolsBad.length) { ch = pickOne(poolsGood, '💧'); isGood=true; itemType='good'; }
      else { ch = pickOne(poolsBad, '🥤'); isGood=false; itemType='bad'; }
    }
    spawnCounter++;

    const el = DOC.createElement('div');
    el.className = 'hvr-target';
    el.setAttribute('data-hha-tgt', '1');
    el.setAttribute('data-item-type', itemType);

    const baseSize = 78;
    const sizeMulBoss = isBoss ? 1.55 : 1.0;
    const size = baseSize * curScale * sizeMulBoss;

    const p = pickSpawnPointLocal(playLocal, size);

    el.style.position='absolute';
    el.style.left = p.x+'px';
    el.style.top  = p.y+'px';
    el.style.transform='translate(-50%,-50%) scale(0.9)';
    el.style.width=size+'px';
    el.style.height=size+'px';
    el.style.touchAction='manipulation';
    el.style.zIndex='35';
    el.style.borderRadius='999px';

    const wiggle = DOC.createElement('div');
    wiggle.className='hvr-wiggle';

    let bgGrad='';
    let ringGlow='';

    if (isBoss){
      bgGrad='radial-gradient(circle at 30% 25%, #38bdf8, #0ea5e9)';
      ringGlow='0 0 0 2px rgba(56,189,248,0.85), 0 0 24px rgba(56,189,248,0.80)';
      el.classList.add('hvr-boss');
    } else if (isPower){
      bgGrad='radial-gradient(circle at 30% 25%, #facc15, #f97316)';
      ringGlow='0 0 0 2px rgba(250,204,21,0.85), 0 0 22px rgba(250,204,21,0.9)';
    } else if (itemType==='fakeGood'){
      bgGrad='radial-gradient(circle at 30% 25%, #4ade80, #16a34a)';
      ringGlow='0 0 0 2px rgba(167,139,250,0.85), 0 0 22px rgba(167,139,250,0.9)';
    } else if (isGood){
      bgGrad='radial-gradient(circle at 30% 25%, #4ade80, #16a34a)';
      ringGlow='0 0 0 2px rgba(74,222,128,0.75), 0 0 18px rgba(16,185,129,0.85)';
    } else {
      bgGrad='radial-gradient(circle at 30% 25%, #fb923c, #ea580c)';
      ringGlow='0 0 0 2px rgba(248,113,113,0.75), 0 0 18px rgba(248,113,113,0.9)';
      el.classList.add('bad');
    }

    el.style.background=bgGrad;
    el.style.boxShadow='0 14px 30px rgba(15,23,42,0.9),'+ringGlow;

    const ring = DOC.createElement('div');
    ring.style.position='absolute';
    ring.style.left='50%';
    ring.style.top='50%';
    ring.style.width=(size*0.36)+'px';
    ring.style.height=(size*0.36)+'px';
    ring.style.transform='translate(-50%,-50%)';
    ring.style.borderRadius='999px';
    ring.style.border='2px solid rgba(255,255,255,0.35)';
    ring.style.boxShadow='0 0 12px rgba(255,255,255,0.18)';
    ring.style.pointerEvents='none';

    const inner = DOC.createElement('div');
    inner.style.width=(size*0.82)+'px';
    inner.style.height=(size*0.82)+'px';
    inner.style.borderRadius='999px';
    inner.style.display='flex';
    inner.style.alignItems='center';
    inner.style.justifyContent='center';
    inner.style.background='radial-gradient(circle at 30% 25%, rgba(15,23,42,0.12), rgba(15,23,42,0.36))';
    inner.style.boxShadow='inset 0 4px 10px rgba(15,23,42,0.9)';

    const icon = DOC.createElement('span');
    icon.textContent = ch;
    icon.style.fontSize=(size*0.60)+'px';
    icon.style.lineHeight='1';
    icon.style.filter='drop-shadow(0 3px 4px rgba(15,23,42,0.9))';
    inner.appendChild(icon);

    let hpBadge=null;
    if (isBoss){
      hpBadge = DOC.createElement('div');
      hpBadge.textContent = String(bossHp);
      hpBadge.style.position='absolute';
      hpBadge.style.left='10px';
      hpBadge.style.top='8px';
      hpBadge.style.fontSize='16px';
      hpBadge.style.fontWeight='900';
      hpBadge.style.color='#e0f2fe';
      hpBadge.style.textShadow='0 2px 6px rgba(0,0,0,.6)';
      hpBadge.style.pointerEvents='none';
    }

    wiggle.appendChild(ring);
    wiggle.appendChild(inner);
    if (hpBadge) wiggle.appendChild(hpBadge);
    el.appendChild(wiggle);

    ROOT.requestAnimationFrame(()=>{ el.style.transform='translate(-50%,-50%) scale(1)'; });

    const lifeMsBase = getLifeMs();
    const lifeMs = isBoss ? Math.round(lifeMsBase * 1.18) : lifeMsBase;

    const data = {
      el, ch, isGood, isPower, itemType, isBoss, bossHp,
      life: lifeMs,
      _hit:null,
      _tm:null
    };

    try{
      if (typeof decorateTarget === 'function'){
        decorateTarget(el, { wiggle, inner, icon, ring, hpBadge }, data, { size, modeKey, difficulty: diffKey, spawnMul:getSpawnMul(), curScale, adaptLevel });
      }
    }catch{}

    activeTargets.add(data);
    hostSpawn.appendChild(el);

    function scheduleExpire(ms){
      try{ if (data._tm) ROOT.clearTimeout(data._tm); }catch{}
      data._tm = ROOT.setTimeout(()=>{
        if (stopped) return;
        if (!activeTargets.has(data)) return;

        activeTargets.delete(data);
        try{ el.remove(); }catch{}
        try{ if (typeof onExpire === 'function') onExpire({ ch, isGood, isPower, itemType, isBoss }); }catch{}
      }, ms);
    }

    function consumeHit(evOrSynth, hitInfoOpt){
      if (stopped) return;
      if (!activeTargets.has(data)) return;

      const xy = (evOrSynth && evOrSynth.__hhaSynth)
        ? { x: evOrSynth.clientX, y: evOrSynth.clientY }
        : getEventXY(evOrSynth || {});

      const info = hitInfoOpt || computeHitInfoFromPoint(el, xy.x, xy.y);

      // Boss chip
      if (data.isBoss && data.bossHp > 1){
        data.bossHp -= 1;
        if (hpBadge) hpBadge.textContent = String(data.bossHp);
        el.classList.remove('hvr-shake'); void el.offsetWidth; el.classList.add('hvr-shake');

        if (typeof judge === 'function'){
          try{
            judge(ch, {
              clientX: xy.x, clientY: xy.y,
              isGood:true, isPower:false,
              itemType:'boss',
              isBoss:true,
              bossChip:true,
              hitPerfect: !!info.perfect,
              hitDistNorm: Number(info.norm||1),
              targetRect: info.rect
            });
          }catch{}
        }
        addSample(true);

        scheduleExpire(Math.max(480, Math.round(lifeMs * 0.82)));
        return;
      }

      // remove
      activeTargets.delete(data);
      try{ if (data._tm) ROOT.clearTimeout(data._tm); }catch{}
      try{ el.remove(); }catch{}

      let res=null;
      if (typeof judge === 'function'){
        try{
          res = judge(ch, {
            clientX: xy.x, clientY: xy.y,
            isGood, isPower, itemType,
            isBoss: !!data.isBoss,
            hitPerfect: !!info.perfect,
            hitDistNorm: Number(info.norm||1),
            targetRect: info.rect
          });
        }catch{}
      }

      let isHit = isGood;
      if (res && typeof res.good === 'boolean') isHit = !!res.good;
      else if (res && typeof res.scoreDelta === 'number') isHit = (res.scoreDelta >= 0 ? isGood : false);
      addSample(isHit);
    }

    function handleHit(ev){
      if (stopped) return;
      ev.preventDefault();
      ev.stopPropagation();
      consumeHit(ev, null);
    }

    data._hit = consumeHit;
    el.addEventListener('pointerdown', handleHit, { passive:false });
    el.addEventListener('click', handleHit, { passive:false });
    el.addEventListener('touchstart', handleHit, { passive:false });

    scheduleExpire(lifeMs);
  }

  function dispatchTime (sec) {
    try { ROOT.dispatchEvent(new CustomEvent('hha:time', { detail: { sec } })); } catch {}
  }

  let rafId=null;
  let lastTs=0;
  let lastSpawnTs=0;

  function loop(ts){
    if (stopped) return;
    refreshExclusions(ts);

    if (!lastTs) lastTs = ts;
    const dt = ts - lastTs;

    if (dt >= 1000 && secLeft > 0){
      const steps = Math.floor(dt/1000);
      secLeft = Math.max(0, secLeft - steps);
      dispatchTime(secLeft);
      lastTs += steps*1000;
    }

    if (secLeft <= 0){ stop(); return; }

    const mul = getSpawnMul();
    if (mul < 50){
      const effInterval = Math.max(35, curInterval * mul);
      if (!lastSpawnTs) lastSpawnTs = ts;
      if (ts - lastSpawnTs >= effInterval){
        if (activeTargets.size < curMaxActive) spawnTarget();
        lastSpawnTs = ts;
      }
    }

    rafId = ROOT.requestAnimationFrame(loop);
  }

  function stop(){
    if (stopped) return;
    stopped = true;
    try{ if (rafId!=null) ROOT.cancelAnimationFrame(rafId); }catch{}
    rafId=null;

    activeTargets.forEach(t=>{ try{ t.el.remove(); }catch{} });
    activeTargets.clear();

    try{ dispatchTime(0); }catch{}
  }

  const onStopEvent = ()=> stop();
  ROOT.addEventListener('hha:stop', onStopEvent);

  rafId = ROOT.requestAnimationFrame(loop);

  return {
    stop(){
      ROOT.removeEventListener('hha:stop', onStopEvent);
      stop();
    },
    shootCrosshair
  };
}

export default { boot };