// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (adaptive) สำหรับ HeroHealth VR/Quest
// ✅ spawnHost / boundsHost / decorateTarget / wiggle / crosshair / rhythm / trick / storm / safezone
// ✅ PATCH A3.1: spawn ตาม "วิวปัจจุบัน" (ชดเชย translate ของ playfield) + กันทับกัน
// ✅ PATCH A3.4 (3+++): Hint arrow (รวมกลุ่มตามทิศ) + BAD-first + distance intensity + ⚠️ near-edge
// ✅ PATCH A4 (4): Mini Radar Ring (8-direction arc) + distance intensity + BAD-first + storm/danger animate
// ✅ PATCH A5 (5): Radar 2 ชั้น (NEAR/FAR) + low-time alert (≤10s/≤5s) + tick escalate
// ✅ PATCH A6 (6): Radar pips นับจำนวน (แยก NEAR/FAR) + Priority Lock (BAD>POWER>FAKE>GOOD) ลดรกตา
// ✅ PATCH A7 (7): Auto-Pan Assist (gentle) → ค่อย ๆ เลื่อนวิวไปหาเป้านอกจอ (ปลอดภัยเฉพาะ translate-only) + cooldown กันสู้มือ

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

// ---------- อ่าน translate ของ host (ตอน drag view) ----------
function getTranslateXY (el) {
  try{
    if (!el || !ROOT.getComputedStyle) return { tx:0, ty:0 };
    const tr = ROOT.getComputedStyle(el).transform;
    if (!tr || tr === 'none') return { tx:0, ty:0 };

    let m = tr.match(/^matrix\((.+)\)$/);
    if (m){
      const parts = m[1].split(',').map(s=>Number(s.trim()));
      return { tx: parts[4] || 0, ty: parts[5] || 0 };
    }
    m = tr.match(/^matrix3d\((.+)\)$/);
    if (m){
      const parts = m[1].split(',').map(s=>Number(s.trim()));
      return { tx: parts[12] || 0, ty: parts[13] || 0 };
    }
  }catch{}
  return { tx:0, ty:0 };
}

// ---------- Safe parse: translate-only matrix ----------
function readTranslateOnlyMatrix(el){
  try{
    if (!el || !ROOT.getComputedStyle) return null;
    const tr = ROOT.getComputedStyle(el).transform;
    if (!tr || tr === 'none') return { tx:0, ty:0, ok:true };

    const m = tr.match(/^matrix\((.+)\)$/);
    if (!m) return null;
    const p = m[1].split(',').map(s=>Number(s.trim()));
    if (p.length < 6) return null;

    const a=p[0], b=p[1], c=p[2], d=p[3], tx=p[4], ty=p[5];
    // translate-only => a=1,d=1,b=0,c=0 (ยอมเพี้ยนเล็กน้อย)
    const eps = 0.0005;
    const ok = (Math.abs(a-1)<=eps && Math.abs(d-1)<=eps && Math.abs(b)<=eps && Math.abs(c)<=eps);
    if (!ok) return null;
    return { tx: tx||0, ty: ty||0, ok:true };
  }catch{}
  return null;
}
function writeTranslateMatrix(el, tx, ty){
  try{
    if (!el) return false;
    el.style.transform = `matrix(1,0,0,1,${tx},${ty})`;
    return true;
  }catch{}
  return false;
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
//  Overlay fallback + Hint/Radar CSS
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

    /* ---------- Hint overlay ---------- */
    .hvr-hint-host{
      position:fixed;
      inset:0;
      z-index:9999;
      pointer-events:none;
    }

    .hvr-hint{
      position:absolute;
      width:36px;
      height:36px;
      border-radius:999px;
      background:rgba(2,6,23,.55);
      border:1px solid rgba(148,163,184,.20);
      backdrop-filter: blur(10px);
      display:flex;
      align-items:center;
      justify-content:center;

      --op: .95; --bri: 1; --sat: 1;
      --glow: rgba(148,163,184,.10);
      --glow2: rgba(148,163,184,.14);

      opacity: var(--op);
      filter: brightness(var(--bri)) saturate(var(--sat));
      box-shadow:
        0 12px 30px rgba(0,0,0,.45),
        0 0 0 2px var(--glow),
        0 0 22px var(--glow2);

      will-change: transform, left, top, opacity, filter;
      transform: translate(-50%,-50%);
    }
    .hvr-hint .arr{
      font-size:18px;
      line-height:1;
      filter: drop-shadow(0 3px 6px rgba(0,0,0,.55));
      transform-origin: 50% 50%;
    }
    .hvr-hint .cnt{
      position:absolute;
      right:-3px;
      top:-3px;
      min-width:18px;
      height:18px;
      padding:0 5px;
      border-radius:999px;
      display:none;
      align-items:center;
      justify-content:center;
      font-size:11px;
      font-weight:900;
      letter-spacing:.02em;
      color:rgba(226,232,240,.95);
      background:rgba(2,6,23,.72);
      border:1px solid rgba(148,163,184,.22);
      box-shadow:0 10px 24px rgba(0,0,0,.45);
    }
    .hvr-hint.has-count .cnt{ display:flex; }

    .hvr-hint .warn{
      position:absolute;
      left:-4px;
      top:-4px;
      width:18px;
      height:18px;
      border-radius:999px;
      display:none;
      align-items:center;
      justify-content:center;
      font-size:12px;
      font-weight:900;
      color:#fff;
      background:rgba(239,68,68,.72);
      border:1px solid rgba(248,113,113,.55);
      box-shadow:0 12px 24px rgba(0,0,0,.55), 0 0 18px rgba(248,113,113,.35);
      filter: drop-shadow(0 3px 6px rgba(0,0,0,.55));
    }
    .hvr-hint.has-warn .warn{ display:flex; }

    .hvr-hint.bad{ border-color: rgba(251,113,133,.30); }
    .hvr-hint.good{ border-color: rgba(74,222,128,.22); }
    .hvr-hint.power{ border-color: rgba(250,204,21,.22); }
    .hvr-hint.fake{ border-color: rgba(167,139,250,.22); }

    .hvr-hint-host.hvr-danger .hvr-hint.bad{
      width:44px;
      height:44px;
      box-shadow:
        0 16px 44px rgba(0,0,0,.55),
        0 0 0 2px rgba(251,113,133,.22),
        0 0 26px rgba(251,113,133,.28);
      filter: saturate(1.10) contrast(1.06);
      animation: hvrDangerPulse .60s ease-in-out infinite;
    }
    .hvr-hint-host.hvr-danger .hvr-hint.bad .arr{ font-size:20px; }

    @keyframes hvrDangerPulse{
      0%{ transform:translate(-50%,-50%) scale(1); opacity:.95; }
      50%{ transform:translate(-50%,-50%) scale(1.08); opacity:.80; }
      100%{ transform:translate(-50%,-50%) scale(1); opacity:.95; }
    }

    /* storm baseline */
    .hvr-hint-host.hvr-storm-on .hvr-hint{
      animation: hvrHintShake .34s linear infinite, hvrHintBlink .64s ease-in-out infinite;
    }
    .hvr-hint-host.hvr-danger.hvr-storm-on .hvr-hint.bad{
      animation: hvrDangerPulse .55s ease-in-out infinite, hvrHintShakeStrong .20s linear infinite, hvrHintBlink .46s ease-in-out infinite;
    }

    /* low-time alerts speed up */
    .hvr-hint-host.hvr-time-low .hvr-hint{
      animation: hvrHintShake .34s linear infinite, hvrHintBlink .44s ease-in-out infinite;
    }
    .hvr-hint-host.hvr-time-crit .hvr-hint{
      animation: hvrHintShakeStrong .22s linear infinite, hvrHintBlink .34s ease-in-out infinite;
    }
    .hvr-hint-host.hvr-time-crit.hvr-danger .hvr-hint.bad{
      animation: hvrDangerPulse .42s ease-in-out infinite, hvrHintShakeStrong .18s linear infinite, hvrHintBlink .30s ease-in-out infinite;
    }

    @keyframes hvrHintShake{
      0%{ transform:translate(-50%,-50%) rotate(-1deg); }
      25%{ transform:translate(-50%,-50%) rotate(1deg); }
      50%{ transform:translate(-50%,-50%) rotate(-1deg); }
      75%{ transform:translate(-50%,-50%) rotate(1deg); }
      100%{ transform:translate(-50%,-50%) rotate(-1deg); }
    }
    @keyframes hvrHintShakeStrong{
      0%{ transform:translate(-50%,-50%) rotate(-2deg); }
      25%{ transform:translate(-50%,-50%) rotate(2deg); }
      50%{ transform:translate(-50%,-50%) rotate(-2deg); }
      75%{ transform:translate(-50%,-50%) rotate(2deg); }
      100%{ transform:translate(-50%,-50%) rotate(-2deg); }
    }
    @keyframes hvrHintBlink{
      0%{ opacity:.95; }
      50%{ opacity:.55; }
      100%{ opacity:.95; }
    }

    /* ---------- Radar (A4/A5/A6) ---------- */
    .hvr-radar{
      position:fixed;
      inset:0;
      z-index:9997;
      pointer-events:none;
      --rad-op: .78;
      --rad-bri: 1;
      opacity: var(--rad-op);
      filter: brightness(var(--rad-bri));
    }
    .hvr-radar svg{ width:100%; height:100%; display:block; }

    .hvr-radar .seg{
      fill:none;
      stroke-linecap:round;
      opacity: .14;
      filter: drop-shadow(0 6px 12px rgba(0,0,0,.55));
    }
    .hvr-radar .seg.near{ stroke-width:7; }
    .hvr-radar .seg.far{  stroke-width:5; opacity:.10; }

    .hvr-radar .seg.on{
      opacity: var(--o, .85);
      stroke: var(--c, rgba(148,163,184,.55));
      filter:
        drop-shadow(0 10px 18px rgba(0,0,0,.55))
        drop-shadow(0 0 16px var(--g, rgba(148,163,184,.18)));
    }

    /* A6: pips count */
    .hvr-radar .pip{
      opacity:.0;
      transform-origin: 50% 50%;
      filter: drop-shadow(0 8px 14px rgba(0,0,0,.55));
    }
    .hvr-radar .pip.on{
      opacity: var(--po, .85);
      fill: var(--pc, rgba(226,232,240,.65));
    }

    .hvr-hint-host.hvr-danger ~ .hvr-radar{ --rad-op:.90; --rad-bri:1.06; }

    .hvr-hint-host.hvr-storm-on ~ .hvr-radar{
      animation: hvrRadarShake .26s linear infinite, hvrRadarBlink .64s ease-in-out infinite;
    }
    .hvr-hint-host.hvr-danger.hvr-storm-on ~ .hvr-radar{
      animation: hvrRadarShakeStrong .18s linear infinite, hvrRadarBlink .46s ease-in-out infinite;
    }

    .hvr-hint-host.hvr-time-low ~ .hvr-radar{
      animation: hvrRadarShake .26s linear infinite, hvrRadarBlink .44s ease-in-out infinite;
    }
    .hvr-hint-host.hvr-time-crit ~ .hvr-radar{
      animation: hvrRadarShakeStrong .18s linear infinite, hvrRadarBlink .34s ease-in-out infinite;
    }

    @keyframes hvrRadarShake{
      0%{ transform:translate(0,0) rotate(-.2deg); }
      25%{ transform:translate(0.5px,0) rotate(.2deg); }
      50%{ transform:translate(0,0.5px) rotate(-.2deg); }
      75%{ transform:translate(-0.5px,0) rotate(.2deg); }
      100%{ transform:translate(0,0) rotate(-.2deg); }
    }
    @keyframes hvrRadarShakeStrong{
      0%{ transform:translate(0,0) rotate(-.4deg); }
      25%{ transform:translate(1px,0) rotate(.4deg); }
      50%{ transform:translate(0,1px) rotate(-.4deg); }
      75%{ transform:translate(-1px,0) rotate(.4deg); }
      100%{ transform:translate(0,0) rotate(-.4deg); }
    }
    @keyframes hvrRadarBlink{
      0%{ opacity:.88; }
      50%{ opacity:.56; }
      100%{ opacity:.88; }
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

function ensureHintHost(){
  if (!DOC) return null;
  ensureOverlayStyle();
  let host = DOC.getElementById('hvr-hint-host');
  if (host && host.isConnected) return host;
  host = DOC.createElement('div');
  host.id = 'hvr-hint-host';
  host.className = 'hvr-hint-host';
  DOC.body.appendChild(host);
  return host;
}

function ensureRadar(){
  if (!DOC) return null;
  ensureOverlayStyle();

  let r = DOC.getElementById('hvr-radar');
  if (r && r.isConnected) return r;

  r = DOC.createElement('div');
  r.id = 'hvr-radar';
  r.className = 'hvr-radar';

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = DOC.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');

  const base1 = DOC.createElementNS(svgNS, 'circle');
  base1.setAttribute('cx', '50'); base1.setAttribute('cy', '50');
  base1.setAttribute('r',  '16');
  base1.setAttribute('fill', 'none');
  base1.setAttribute('stroke', 'rgba(148,163,184,.14)');
  base1.setAttribute('stroke-width', '2');
  svg.appendChild(base1);

  for (let i=0;i<8;i++){
    const pN = DOC.createElementNS(svgNS, 'path');
    pN.setAttribute('class', 'seg near');
    pN.setAttribute('data-seg', String(i));
    pN.setAttribute('data-band', 'near');
    svg.appendChild(pN);

    const pF = DOC.createElementNS(svgNS, 'path');
    pF.setAttribute('class', 'seg far');
    pF.setAttribute('data-seg', String(i));
    pF.setAttribute('data-band', 'far');
    svg.appendChild(pF);

    const gN = DOC.createElementNS(svgNS, 'g');
    gN.setAttribute('data-pips', 'near');
    gN.setAttribute('data-seg', String(i));
    svg.appendChild(gN);

    const gF = DOC.createElementNS(svgNS, 'g');
    gF.setAttribute('data-pips', 'far');
    gF.setAttribute('data-seg', String(i));
    svg.appendChild(gF);

    for (let k=0;k<7;k++){
      const cN = DOC.createElementNS(svgNS, 'circle');
      cN.setAttribute('class', 'pip near');
      cN.setAttribute('data-k', String(k));
      cN.setAttribute('r', '2.2');
      gN.appendChild(cN);

      const cF = DOC.createElementNS(svgNS, 'circle');
      cF.setAttribute('class', 'pip far');
      cF.setAttribute('data-k', String(k));
      cF.setAttribute('r', '2.0');
      gF.appendChild(cF);
    }
  }

  r.appendChild(svg);

  const hh = DOC.getElementById('hvr-hint-host');
  if (hh && hh.parentNode) hh.parentNode.insertBefore(r, hh.nextSibling);
  else DOC.body.appendChild(r);

  return r;
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

    if (r.top < hy1 + 80 && r.bottom > hy1) m.top = Math.max(m.top, clamp(r.bottom - hy1, 0, hostRect.height));
    if (r.bottom > hy2 - 80 && r.top < hy2) m.bottom = Math.max(m.bottom, clamp(hy2 - r.top, 0, hostRect.height));
    if (r.left < hx1 + 80 && r.right > hx1) m.left = Math.max(m.left, clamp(r.right - hx1, 0, hostRect.width));
    if (r.right > hx2 - 80 && r.left < hx2) m.right = Math.max(m.right, clamp(hx2 - r.left, 0, hostRect.width));
  });

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
//  overlap-safe spawn near current view
// ======================================================
function pickSpawnPoint(rect, size, activeTargets, hostForTransform, spread = 0.50){
  const W = Math.max(1, rect.width);
  const H = Math.max(1, rect.height);

  const minDist = size * 1.05;
  const tries   = 26;

  const { tx, ty } = getTranslateXY(hostForTransform);

  const cx0 = rect.left + W * 0.50 - tx;
  const cy0 = rect.top  + H * 0.52 - ty;

  const clampX = (x)=> clamp(x, rect.left + size*0.60, rect.left + W - size*0.60);
  const clampY = (y)=> clamp(y, rect.top  + size*0.65, rect.top  + H - size*0.65);

  const ok = (x, y) => {
    let pass = true;
    activeTargets.forEach(t=>{
      const x0 = Number(t._x), y0 = Number(t._y);
      if (!Number.isFinite(x0) || !Number.isFinite(y0)) return;
      const dx = x - x0, dy = y - y0;
      if ((dx*dx + dy*dy) < (minDist*minDist)) pass = false;
    });
    return pass;
  };

  const hasAny = activeTargets.size > 0;
  const rMax = clamp(spread, 0.28, 0.68);

  for (let i=0; i<tries; i++){
    let x, y;

    if (!hasAny && i < 8){
      const jx = (Math.random() + Math.random() - 1) * (W * 0.10);
      const jy = (Math.random() + Math.random() - 1) * (H * 0.10);
      x = clampX(cx0 + jx);
      y = clampY(cy0 + jy);
    } else {
      const ang  = Math.random() * Math.PI * 2;
      const rMin = 0.06;
      const rr   = rMin + (Math.random()) * (rMax - rMin);
      x = clampX(cx0 + Math.cos(ang) * (W * rr));
      y = clampY(cy0 + Math.sin(ang) * (H * rr));
    }

    if (ok(x, y)) return { x, y };
  }

  return { x: clampX(cx0), y: clampY(cy0) };
}

// ======================================================
//  Hint/Radar helpers
// ======================================================
function hintKindFromItemType(itemType){
  if (itemType === 'bad') return 'bad';
  if (itemType === 'power') return 'power';
  if (itemType === 'fakeGood') return 'fake';
  return 'good';
}
function kindPriority(kind){
  if (kind === 'bad') return 4;
  if (kind === 'power') return 3;
  if (kind === 'fake') return 2;
  return 1;
}
function makeGroupedHintEl(kind){
  const host = ensureHintHost();
  if (!host) return null;

  const el = DOC.createElement('div');
  el.className = 'hvr-hint ' + kind;

  const a = DOC.createElement('div');
  a.className = 'arr';
  a.textContent = '➤';

  const c = DOC.createElement('div');
  c.className = 'cnt';
  c.textContent = '';

  const w = DOC.createElement('div');
  w.className = 'warn';
  w.textContent = '⚠️';

  el.appendChild(a);
  el.appendChild(c);
  el.appendChild(w);
  host.appendChild(el);
  return el;
}

function setHint(el, x, y, angRad, kind, count, intensity01, warn){
  if (!el) return;

  el.classList.remove('good','bad','power','fake','has-count','has-warn');
  el.classList.add(kind);
  if (count && count > 1) el.classList.add('has-count');
  if (warn) el.classList.add('has-warn');

  el.style.left = `${Math.round(x)}px`;
  el.style.top  = `${Math.round(y)}px`;

  const arr = el.querySelector('.arr');
  if (arr) arr.style.transform = `rotate(${angRad}rad)`;

  const cnt = el.querySelector('.cnt');
  if (cnt) cnt.textContent = (count && count > 1) ? `×${count}` : '';

  const I = clamp(intensity01, 0, 1);
  const op  = 0.62 + I * 0.36;
  const bri = 0.92 + I * 0.55;
  const sat = 1.00 + I * 0.65;

  el.style.setProperty('--op',  op.toFixed(3));
  el.style.setProperty('--bri', bri.toFixed(3));
  el.style.setProperty('--sat', sat.toFixed(3));

  let g1 = 'rgba(148,163,184,.10)';
  let g2 = 'rgba(148,163,184,.14)';

  if (kind === 'bad'){
    g1 = `rgba(248,113,113,${(0.10 + I*0.22).toFixed(3)})`;
    g2 = `rgba(248,113,113,${(0.14 + I*0.26).toFixed(3)})`;
  } else if (kind === 'power'){
    g1 = `rgba(250,204,21,${(0.08 + I*0.18).toFixed(3)})`;
    g2 = `rgba(250,204,21,${(0.12 + I*0.22).toFixed(3)})`;
  } else if (kind === 'fake'){
    g1 = `rgba(167,139,250,${(0.08 + I*0.18).toFixed(3)})`;
    g2 = `rgba(167,139,250,${(0.12 + I*0.22).toFixed(3)})`;
  } else {
    g1 = `rgba(74,222,128,${(0.06 + I*0.16).toFixed(3)})`;
    g2 = `rgba(74,222,128,${(0.10 + I*0.20).toFixed(3)})`;
  }

  el.style.setProperty('--glow', g1);
  el.style.setProperty('--glow2', g2);
}

function projectToInnerRectEdge(bx, by, dx, dy, ix1, iy1, ix2, iy2){
  const EPS = 1e-6;
  dx = Math.abs(dx) < EPS ? (dx >= 0 ? EPS : -EPS) : dx;
  dy = Math.abs(dy) < EPS ? (dy >= 0 ? EPS : -EPS) : dy;

  let tMin = Infinity;

  if (dx > 0){
    const t = (ix2 - bx) / dx;
    if (t > 0) tMin = Math.min(tMin, t);
  } else {
    const t = (ix1 - bx) / dx;
    if (t > 0) tMin = Math.min(tMin, t);
  }

  if (dy > 0){
    const t = (iy2 - by) / dy;
    if (t > 0) tMin = Math.min(tMin, t);
  } else {
    const t = (iy1 - by) / dy;
    if (t > 0) tMin = Math.min(tMin, t);
  }

  if (!Number.isFinite(tMin) || tMin === Infinity) tMin = 1;

  const x = bx + dx * tMin;
  const y = by + dy * tMin;

  return { x: clamp(x, ix1, ix2), y: clamp(y, iy1, iy2) };
}

function angleToSector8(ang){
  const twoPI = Math.PI * 2;
  let a = ang % twoPI;
  if (a < 0) a += twoPI;
  const step = twoPI / 8;
  return Math.round(a / step) % 8;
}

function outDistance(cx, cy, ix1, iy1, ix2, iy2){
  const ox = (cx < ix1) ? (ix1 - cx) : (cx > ix2 ? (cx - ix2) : 0);
  const oy = (cy < iy1) ? (iy1 - cy) : (cy > iy2 ? (cy - iy2) : 0);
  return Math.sqrt(ox*ox + oy*oy);
}

function arcPath(cx, cy, r, a0, a1){
  const x0 = cx + Math.cos(a0) * r;
  const y0 = cy + Math.sin(a0) * r;
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;
  const large = (Math.abs(a1 - a0) > Math.PI) ? 1 : 0;
  const sweep = 1;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

// ======================================================
//  Beep (WebAudio) + throttle
// ======================================================
function makeBeep(){
  const A = {};
  A.ctx = null;
  A.last = 0;

  function getCtx(){
    if (!ROOT.AudioContext && !ROOT.webkitAudioContext) return null;
    if (A.ctx) return A.ctx;
    try{
      A.ctx = new (ROOT.AudioContext || ROOT.webkitAudioContext)();
      return A.ctx;
    }catch{
      return null;
    }
  }

  function beep(freq=860, dur=0.045, vol=0.040, minGapMs=260){
    const ctx = getCtx();
    if (!ctx) return;
    const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (t - A.last < minGapMs) return;
    A.last = t;

    try{
      if (ctx.state === 'suspended') ctx.resume().catch(()=>{});
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;

      const now = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.02, dur));

      o.connect(g);
      g.connect(ctx.destination);
      o.start(now);
      o.stop(now + Math.max(0.03, dur + 0.02));
    }catch{}
  }

  return { beep };
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

    spread = 0.50,

    showHints = true,
    showRadar = true,

    lockPriority = true,
    radarPipMax = 7,
    badBeep = true,

    // ===== A7: Auto-Pan Assist =====
    autoPan = true,              // เปิด/ปิดระบบดันวิว
    autoPanMode = 'bad',         // 'bad' | 'priority' | 'any'
    autoPanCooldownMs = 900,     // หลังผู้เล่นแตะ/ลาก/สไลด์ รอเท่านี้ก่อนดัน
    autoPanDeadZone = 0.10,      // ถ้าเป้านอกจออยู่ "เกือบตรงกลาง" อย่าดัน (กันส่าย)
    autoPanMaxSpeed = 18,        // px ต่อเฟรม (บน 60fps)
    autoPanEase = 0.10,          // 0..1 ยิ่งมากยิ่งดันไว
    autoPanClamp = 0.38          // จำกัดการเลื่อนสูงสุดเป็นสัดส่วนของหน้าจอ
  } = rawCfg || {};

  const diffKey  = String(difficulty || 'normal').toLowerCase();
  const baseDiff = pickDiffConfig(modeKey, diffKey);

  const hostSpawn  = resolveHost(rawCfg, 'spawnHost');
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

  // ✅ Storm multiplier getter
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
  //  Exclusions cache
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
  //  Hint + Radar state
  // ======================================================
  const hintState = {
    host: showHints ? ensureHintHost() : null,
    map: new Map()
  };

  const radarState = {
    el: (showHints && showRadar) ? ensureRadar() : null,
    segNear: null,
    segFar: null,
    pipsNearG: null,
    pipsFarG: null,
    lastGeomKey: ''
  };
  if (radarState.el){
    try{
      radarState.segNear = Array.from(radarState.el.querySelectorAll('.seg.near'));
      radarState.segFar  = Array.from(radarState.el.querySelectorAll('.seg.far'));
      radarState.pipsNearG = Array.from(radarState.el.querySelectorAll('g[data-pips="near"]'));
      radarState.pipsFarG  = Array.from(radarState.el.querySelectorAll('g[data-pips="far"]'));
    }catch{
      radarState.segNear = radarState.segFar = null;
      radarState.pipsNearG = radarState.pipsFarG = null;
    }
  }

  const audio = makeBeep();
  let lastDangerBeepAt = 0;

  // A7: assist vector (computed from offscreen buckets)
  const assistState = {
    want: false,
    vx: 0,
    vy: 0,
    kind: 'good',
    intensity: 0,
    count: 0
  };

  function setHintStorm(isOn){
    if (!hintState.host) return;
    try{
      if (isOn) hintState.host.classList.add('hvr-storm-on');
      else hintState.host.classList.remove('hvr-storm-on');
    }catch{}
  }
  function setHintDanger(isOn){
    if (!hintState.host) return;
    try{
      if (isOn) hintState.host.classList.add('hvr-danger');
      else hintState.host.classList.remove('hvr-danger');
    }catch{}
  }
  function setHintTimeAlert(sec){
    if (!hintState.host) return;
    const low  = (sec <= 10 && sec > 5);
    const crit = (sec <= 5);

    try{
      if (low) hintState.host.classList.add('hvr-time-low');
      else hintState.host.classList.remove('hvr-time-low');

      if (crit) hintState.host.classList.add('hvr-time-crit');
      else hintState.host.classList.remove('hvr-time-crit');
    }catch{}
  }

  function clearHints(){
    if (!hintState.map || !hintState.map.size) return;
    hintState.map.forEach(v=>{ try{ v.el && v.el.remove(); }catch{} });
    hintState.map.clear();
  }

  function clearRadar(){
    const wipeSeg = (arr)=>{
      if (!arr) return;
      arr.forEach(s=>{
        try{
          s.classList.remove('on');
          s.style.removeProperty('--o');
          s.style.removeProperty('--c');
          s.style.removeProperty('--g');
        }catch{}
      });
    };
    wipeSeg(radarState.segNear);
    wipeSeg(radarState.segFar);

    const wipePips = (gArr)=>{
      if (!gArr) return;
      gArr.forEach(g=>{
        try{
          g.querySelectorAll('.pip').forEach(p=>{
            p.classList.remove('on');
            p.style.removeProperty('--po');
            p.style.removeProperty('--pc');
            p.removeAttribute('cx');
            p.removeAttribute('cy');
          });
        }catch{}
      });
    };
    wipePips(radarState.pipsNearG);
    wipePips(radarState.pipsFarG);
  }

  function kindColors(kind, I){
    I = clamp(I, 0, 1);
    if (kind === 'bad'){
      return {
        c: `rgba(248,113,113,${(0.45 + I*0.45).toFixed(3)})`,
        g: `rgba(248,113,113,${(0.12 + I*0.28).toFixed(3)})`
      };
    }
    if (kind === 'power'){
      return {
        c: `rgba(250,204,21,${(0.42 + I*0.45).toFixed(3)})`,
        g: `rgba(250,204,21,${(0.10 + I*0.26).toFixed(3)})`
      };
    }
    if (kind === 'fake'){
      return {
        c: `rgba(167,139,250,${(0.40 + I*0.45).toFixed(3)})`,
        g: `rgba(167,139,250,${(0.10 + I*0.26).toFixed(3)})`
      };
    }
    return {
      c: `rgba(74,222,128,${(0.36 + I*0.45).toFixed(3)})`,
      g: `rgba(74,222,128,${(0.08 + I*0.24).toFixed(3)})`
    };
  }

  function updatePipGroup(gEl, count, midAngle, baseR, stepR, bx, by, color, op){
    if (!gEl) return;
    const max = clamp(radarPipMax, 1, 7);
    const n = clamp(count, 0, max);

    const pips = Array.from(gEl.querySelectorAll('.pip'));
    for (let k=0;k<pips.length;k++){
      const p = pips[k];
      if (k < n){
        const r = baseR + stepR * k;
        const x = bx + Math.cos(midAngle) * r;
        const y = by + Math.sin(midAngle) * r;
        p.setAttribute('cx', x.toFixed(2));
        p.setAttribute('cy', y.toFixed(2));
        p.classList.add('on');
        p.style.setProperty('--pc', color);
        p.style.setProperty('--po', op.toFixed(3));
      } else {
        p.classList.remove('on');
        p.style.removeProperty('--pc');
        p.style.removeProperty('--po');
      }
    }
  }

  // ======================================================
  //  Update Hints + Radar from activeTargets
  // ======================================================
  function updateHintsAndRadar(stormOn){
    // reset assist
    assistState.want = false;
    assistState.vx = 0;
    assistState.vy = 0;
    assistState.kind = 'good';
    assistState.intensity = 0;
    assistState.count = 0;

    if ((!showHints || !hintState.host) && !radarState.el) return;

    let br = null;
    try{ br = hostBounds.getBoundingClientRect(); }catch{}
    if (!br) return;

    const pad = 18;
    const ix1 = br.left + pad;
    const iy1 = br.top  + pad;
    const ix2 = br.right - pad;
    const iy2 = br.bottom - pad;

    const bx = br.left + br.width/2;
    const by = br.top  + br.height/2;

    const buckets = new Map();

    const EDGE_NEAR = 140;
    const FAR_SWITCH = 300;

    let anyOffscreen = false;

    activeTargets.forEach(t=>{
      const el = t.el;
      if (!el || !el.isConnected) return;

      let r = null;
      try{ r = el.getBoundingClientRect(); }catch{}
      if (!r) return;

      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;

      const inside = (cx >= ix1 && cx <= ix2 && cy >= iy1 && cy <= iy2);
      if (inside) return;

      anyOffscreen = true;

      const dx = cx - bx;
      const dy = cy - by;
      const ang = Math.atan2(dy, dx);
      const sector = angleToSector8(ang);

      const kind = hintKindFromItemType(t.itemType);
      const kp = kindPriority(kind);

      const od = outDistance(cx, cy, ix1, iy1, ix2, iy2);

      const EDGE_FAR  = 520;
      const intensity = 1 - clamp(od / EDGE_FAR, 0, 1);

      const isFar = (od > FAR_SWITCH);

      let b = buckets.get(sector);
      if (!b){
        b = {
          n:0,
          vx:0, vy:0,

          kind:'good',
          kindP:0,
          intensityMax:0,

          cntBad:0, cntPower:0, cntFake:0, cntGood:0,

          nearCount:0,
          farCount:0,
          nearI:0,
          farI:0,
          nearKind:'good',
          farKind:'good',
          nearKindP:0,
          farKindP:0,

          warnNearEdge:false
        };
        buckets.set(sector, b);
      }

      b.n += 1;
      b.vx += Math.cos(ang);
      b.vy += Math.sin(ang);
      b.intensityMax = Math.max(b.intensityMax, intensity);

      if (kind === 'bad') b.cntBad++;
      else if (kind === 'power') b.cntPower++;
      else if (kind === 'fake') b.cntFake++;
      else b.cntGood++;

      if (kp > b.kindP){
        b.kindP = kp;
        b.kind = kind;
      }

      if (isFar){
        b.farCount++;
        b.farI = Math.max(b.farI, intensity);
        if (kp > b.farKindP){ b.farKindP = kp; b.farKind = kind; }
      } else {
        b.nearCount++;
        b.nearI = Math.max(b.nearI, intensity);
        if (kp > b.nearKindP){ b.nearKindP = kp; b.nearKind = kind; }
      }

      if (kind === 'bad' && od <= EDGE_NEAR) b.warnNearEdge = true;
    });

    // ---- Priority Lock (A6) ----
    if (lockPriority && anyOffscreen){
      let globalP = 0;
      buckets.forEach(b=>{ globalP = Math.max(globalP, b.kindP); });

      const keep = new Map();
      buckets.forEach((b, k)=>{
        if (b.kindP === globalP) keep.set(k, b);
      });
      buckets.clear();
      keep.forEach((b,k)=> buckets.set(k,b));
    }

    // ---- A7: compute assist vector (from buckets after lock) ----
    if (anyOffscreen && buckets.size){
      let sumX = 0, sumY = 0, sumW = 0;
      let bestP = 0;
      let bestKind = 'good';
      let total = 0;

      buckets.forEach(b=>{
        const I = clamp(b.intensityMax + clamp((b.n-1)*0.06,0,0.22), 0, 1);
        const w = 0.25 + I * 0.95 + clamp((b.n-1)*0.08,0,0.30);
        const vx = (b.vx || 0);
        const vy = (b.vy || 0);
        const mag = Math.max(0.0001, Math.sqrt(vx*vx + vy*vy));
        const nx = vx / mag;
        const ny = vy / mag;

        sumX += nx * w;
        sumY += ny * w;
        sumW += w;
        total += b.n;

        if (b.kindP > bestP){
          bestP = b.kindP;
          bestKind = b.kind;
        }
      });

      if (sumW > 0.0001){
        const ax = sumX / sumW;
        const ay = sumY / sumW;
        const amag = Math.sqrt(ax*ax + ay*ay);

        if (amag > autoPanDeadZone){
          assistState.want = true;
          assistState.vx = ax / amag;
          assistState.vy = ay / amag;
          assistState.kind = bestKind;
          assistState.intensity = clamp(sumW / (buckets.size * 1.4), 0, 1);
          assistState.count = total;
        }
      }
    }

    // danger state
    let anyBad = false;
    buckets.forEach(b=>{ if (b.kind === 'bad' || b.cntBad > 0) anyBad = true; });
    setHintDanger(anyBad);

    // beep tick escalate by time + storm
    if (badBeep && anyBad){
      const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

      const timeCrit = (secLeft <= 5);
      const timeLow  = (secLeft <= 10);

      const beatBase = stormOn ? 320 : 520;
      const beat = timeCrit ? Math.max(180, beatBase * 0.55)
                 : timeLow  ? Math.max(240, beatBase * 0.72)
                 : beatBase;

      const gap = timeCrit ? 150 : timeLow ? 190 : 260;
      if (t - lastDangerBeepAt > beat){
        audio.beep(stormOn ? 980 : 860, 0.045, stormOn ? 0.050 : 0.040, gap);
        lastDangerBeepAt = t;
      }
    } else {
      lastDangerBeepAt = 0;
    }

    // ---------- Update Arrow Hints ----------
    if (showHints && hintState.host){
      const innerPad = 18;
      const hx1 = br.left + innerPad;
      const hy1 = br.top  + innerPad;
      const hx2 = br.right - innerPad;
      const hy2 = br.bottom - innerPad;

      const alive = new Set(buckets.keys());
      hintState.map.forEach((v, k)=>{
        if (!alive.has(k)){
          try{ v.el.remove(); }catch{}
          hintState.map.delete(k);
        }
      });

      buckets.forEach((b, sector)=>{
        const ang = Math.atan2(b.vy, b.vx);
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        const p = projectToInnerRectEdge(bx, by, dx, dy, hx1, hy1, hx2, hy2);

        let rec = hintState.map.get(sector);
        if (!rec || !rec.el || !rec.el.isConnected){
          const el = makeGroupedHintEl(b.kind);
          rec = { el, kind: b.kind };
          hintState.map.set(sector, rec);
        }

        const countBoost = clamp((b.n - 1) * 0.08, 0, 0.24);
        const I = clamp(b.intensityMax + countBoost, 0, 1);
        const warn = (b.kind === 'bad') && b.warnNearEdge;

        setHint(rec.el, p.x, p.y, ang, b.kind, b.n, I, warn);
      });
    }

    // ---------- Update Radar Ring + Pips ----------
    if (radarState.el && radarState.segNear && radarState.segFar &&
        radarState.pipsNearG && radarState.pipsFarG &&
        radarState.segNear.length >= 8 && radarState.segFar.length >= 8){

      const minSide = Math.max(120, Math.min(br.width, br.height));
      const rNear = clamp(minSide * 0.18, 72, 160);
      const rFar  = clamp(rNear + 14, 86, 182);

      const step = (Math.PI * 2) / 8;
      const gap  = 0.18;
      const geomKey = `${Math.round(bx)}|${Math.round(by)}|${Math.round(rNear)}|${Math.round(rFar)}`;

      if (geomKey !== radarState.lastGeomKey){
        radarState.lastGeomKey = geomKey;
        for (let i=0;i<8;i++){
          const aMid = i * step;
          const a0 = aMid - (step/2) + gap;
          const a1 = aMid + (step/2) - gap;
          const dN = arcPath(bx, by, rNear, a0, a1);
          const dF = arcPath(bx, by, rFar,  a0, a1);
          try{ radarState.segNear[i].setAttribute('d', dN); }catch{}
          try{ radarState.segFar[i].setAttribute('d',  dF); }catch{}
        }
      }

      clearRadar();

      buckets.forEach((b, sector)=>{
        const countBoost = clamp((b.n - 1) * 0.06, 0, 0.22);
        const aMid = sector * step;

        const IN = clamp(b.nearI + countBoost*0.55, 0, 1);
        if (IN > 0.02){
          const segN = radarState.segNear[sector];
          const { c, g } = kindColors(b.nearKind, IN);
          const o = (0.18 + IN * 0.82);
          try{
            segN.classList.add('on');
            segN.style.setProperty('--c', c);
            segN.style.setProperty('--g', g);
            segN.style.setProperty('--o', o.toFixed(3));
          }catch{}

          const gN = radarState.pipsNearG[sector];
          const pipOp = clamp(0.45 + IN*0.55, 0.35, 1);
          updatePipGroup(gN, b.nearCount, aMid, rNear - 10, -6, bx, by, c, pipOp);
        }

        const IF = clamp(b.farI + countBoost*0.45, 0, 1);
        if (IF > 0.02){
          const segF = radarState.segFar[sector];
          const { c, g } = kindColors(b.farKind, IF);
          const o = (0.12 + IF * 0.72);
          try{
            segF.classList.add('on');
            segF.style.setProperty('--c', c);
            segF.style.setProperty('--g', g);
            segF.style.setProperty('--o', o.toFixed(3));
          }catch{}

          const gF = radarState.pipsFarG[sector];
          const pipOp = clamp(0.32 + IF*0.55, 0.28, 0.95);
          updatePipGroup(gF, b.farCount, aMid, rFar + 10, +6, bx, by, c, pipOp);
        }
      });
    }
  }

  // ======================================================
  //  A7: Auto-Pan Assist
  // ======================================================
  let lastUserInputAt = 0;

  function markUserInput(){
    const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    lastUserInputAt = t;
  }

  // listen broadly (capture) to detect manual drag/touch/scroll
  try{
    hostBounds.addEventListener('pointerdown', markUserInput, { capture:true, passive:true });
    hostBounds.addEventListener('pointermove', markUserInput, { capture:true, passive:true });
    hostBounds.addEventListener('touchstart',  markUserInput, { capture:true, passive:true });
    hostBounds.addEventListener('touchmove',   markUserInput, { capture:true, passive:true });
    ROOT.addEventListener('wheel', markUserInput, { capture:true, passive:true });
    ROOT.addEventListener('keydown', markUserInput, { capture:true, passive:true });
  }catch{}

  function shouldAutoPanNow(){
    if (!autoPan) return false;
    if (!assistState.want) return false;

    const kind = assistState.kind;
    if (autoPanMode === 'bad' && kind !== 'bad') return false;
    if (autoPanMode === 'priority'){
      // priority = ใช้ kind ที่ assist เลือก (หลัง lockPriority แล้ว)
    } else if (autoPanMode === 'any'){
      // ok
    }

    const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (t - lastUserInputAt < autoPanCooldownMs) return false;

    // ต้องเขียนได้แบบ translate-only matrix เท่านั้น (ปลอดภัย)
    const cur = readTranslateOnlyMatrix(hostSpawn);
    if (!cur) return false;

    return true;
  }

  function applyAutoPan(){
    if (!shouldAutoPanNow()) {
      // ส่ง suggestion เผื่อภายนอกใช้
      if (assistState.want){
        try{
          ROOT.dispatchEvent(new CustomEvent('hha:pan_suggest', {
            detail: {
              vx: assistState.vx, vy: assistState.vy,
              kind: assistState.kind, intensity: assistState.intensity, count: assistState.count
            }
          }));
        }catch{}
      }
      return;
    }

    const cur = readTranslateOnlyMatrix(hostSpawn);
    if (!cur) return;

    let br = null;
    try{ br = hostBounds.getBoundingClientRect(); }catch{}
    if (!br) return;

    // desired movement: move view toward offscreen direction
    // ถ้าเป้านอกจออยู่ทางขวา -> ต้องเลื่อนวิวไปทางขวา => translateX ลด? (ขึ้นกับ implementation)
    // ในระบบเดิม: target position ถูกชดเชยด้วย -tx ใน spawn (cx0 - tx)
    // ดังนั้นถ้าอยาก "มองไปทางขวา" ให้ tx ลดลง (moving content left) หรือเพิ่ม?:
    // เราใช้กติกาเดียวกับ UI drag ทั่วไป: tx/ty เพิ่ม = content เลื่อนตามนิ้ว (drag right => content right)
    // Offscreen vector (vx,vy) ชี้จาก center ไปหาเป้า → ให้ content เลื่อนสวนทางเล็กน้อยเพื่อให้เป้าเข้ากลาง:
    const dirX = assistState.vx;
    const dirY = assistState.vy;

    // move content opposite to direction to bring target toward center
    const wantX = -dirX;
    const wantY = -dirY;

    // speed scales with intensity + storm + time pressure
    const tMul = (secLeft <= 5) ? 1.35 : (secLeft <= 10 ? 1.15 : 1.0);
    const stormMul = (getSpawnMul() < 0.99) ? 1.25 : 1.0;

    let speed = autoPanMaxSpeed * (0.35 + assistState.intensity * 0.90) * tMul * stormMul;
    speed = clamp(speed, 2.5, autoPanMaxSpeed * 1.6);

    // ease smoothing: small step toward target
    const dx = wantX * speed * autoPanEase;
    const dy = wantY * speed * autoPanEase;

    // clamp translate range
    const limX = br.width  * clamp(autoPanClamp, 0.15, 0.55);
    const limY = br.height * clamp(autoPanClamp, 0.15, 0.55);

    const nextTx = clamp(cur.tx + dx, -limX, limX);
    const nextTy = clamp(cur.ty + dy, -limY, limY);

    if (Math.abs(nextTx - cur.tx) < 0.001 && Math.abs(nextTy - cur.ty) < 0.001) return;

    // apply
    writeTranslateMatrix(hostSpawn, nextTx, nextTy);

    try{
      ROOT.dispatchEvent(new CustomEvent('hha:pan', {
        detail: { tx: nextTx, ty: nextTy, dx, dy, kind: assistState.kind }
      }));
    }catch{}
  }

  // ======================================================
  //  Spawn target
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

    const p = pickSpawnPoint(rect, size, activeTargets, hostSpawn, spread);

    el.style.position = 'absolute';
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
    el.style.transform = 'translate(-50%, -50%) scale(0.9)';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.touchAction = 'manipulation';
    el.style.zIndex = '35';
    el.style.borderRadius = '999px';

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
      _x: p.x,
      _y: p.y
    };

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

    // time alert class
    setHintTimeAlert(secLeft);

    const mul = getSpawnMul();
    const stormOn = (mul < 0.99);

    // storm classes (hint/radar)
    if (hintState.host){
      try{
        if (stormOn) hintState.host.classList.add('hvr-storm-on');
        else hintState.host.classList.remove('hvr-storm-on');
      }catch{}
    }

    // update hints+radar (also computes assistState)
    updateHintsAndRadar(stormOn);

    // A7: apply auto-pan after we know where to go
    applyAutoPan();

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

      const effInterval = Math.max(35, curInterval * mul);

      try{
        if (stormOn) { hostBounds.classList.add('hvr-storm-on'); hostSpawn.classList.add('hvr-storm-on'); }
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

    clearHints();
    clearRadar();

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