// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — PRODUCTION spawner (DOM targets)
// ✅ export boot()
// ✅ Safe controller init (no TDZ)
// ✅ Click/tap hit + hha:shoot (crosshair/tap-to-shoot)
// ✅ Expire + onExpire callbacks
// ✅ Safe spawn rect (edges + optional UI margins)
// ✅ Optional pattern support (cfg.patternNext)

// Usage:
//   import { boot as spawnBoot } from '../vr/mode-factory.js';
//   const spawner = spawnBoot({
//     mount, seed, spawnRate, sizeRange, kinds,
//     onHit, onExpire,
//     margins: { top:120, right:16, bottom:18, left:16 },
//     patternNext: ()=>({type:'spread', n:4}) // optional
//   });

'use strict';

const WIN = window;
const DOC = document;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function rectOf(el){
  const r = el.getBoundingClientRect();
  return { x:r.left, y:r.top, w:r.width, h:r.height };
}

function pickWeighted(rng, items){
  let sum = 0;
  for(const it of items) sum += Math.max(0, Number(it.weight) || 0);
  if(sum <= 0) return items[0] || null;
  let t = rng() * sum;
  for(const it of items){
    t -= Math.max(0, Number(it.weight) || 0);
    if(t <= 0) return it;
  }
  return items[items.length-1] || null;
}

function makeTargetEl(){
  const el = DOC.createElement('div');
  el.className = 'plateTarget'; // ใช้ร่วมกันได้ (Plate/Groups/GoodJunk สามารถ override class เพิ่มได้)
  el.setAttribute('role','button');
  el.setAttribute('tabindex','0');
  return el;
}

function dist2(ax, ay, bx, by){
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy;
}

function elementCenter(el){
  const r = el.getBoundingClientRect();
  return { cx: r.left + r.width/2, cy: r.top + r.height/2, r: Math.min(r.width, r.height)/2 };
}

// ----- Controller (declare first to avoid TDZ) -----
let controller = null;

function initController(){
  if(controller) return controller;

  // internal controller state
  controller = {
    running: false,
    destroyed: false,

    mount: null,
    rng: Math.random,

    // config
    seed: 0,
    spawnRate: 900,
    sizeMin: 44,
    sizeMax: 64,
    kinds: [],
    margins: { top: 110, right: 16, bottom: 18, left: 16 },
    maxAlive: 8,
    ttlMs: 2200,

    // callbacks
    onHit: null,
    onExpire: null,

    // pattern hook (optional)
    patternNext: null,

    // timers
    spawnTimer: null,

    // alive
    alive: new Set(),

    // shoot lock
    lockPx: 28
  };

  return controller;
}

function computeSpawnRect(C){
  const base = rectOf(C.mount);
  const m = C.margins || {};
  const left   = base.x + (m.left   ?? 0);
  const top    = base.y + (m.top    ?? 0);
  const right  = base.x + base.w - (m.right  ?? 0);
  const bottom = base.y + base.h - (m.bottom ?? 0);
  const w = Math.max(0, right - left);
  const h = Math.max(0, bottom - top);
  return { left, top, right, bottom, w, h };
}

function spawnAt(C, x, y, size, payload){
  const el = makeTargetEl();
  el.style.width  = `${size}px`;
  el.style.height = `${size}px`;

  // position: absolute inside mount
  // convert viewport coords -> mount local coords
  const mr = C.mount.getBoundingClientRect();
  const lx = x - mr.left;
  const ly = y - mr.top;

  el.style.position = 'absolute';
  el.style.left = `${lx}px`;
  el.style.top  = `${ly}px`;
  el.style.transform = 'translate(-50%,-50%)';

  // payload
  el.dataset.kind = payload.kind || 'good';
  if(payload.kind) el.setAttribute('data-kind', payload.kind);

  // optional emoji/icon
  if(payload.icon != null) el.textContent = String(payload.icon);
  else el.textContent = (payload.kind === 'junk') ? '🍩' : '🥗';

  // store meta
  const target = {
    el,
    kind: payload.kind || 'good',
    groupIndex: payload.groupIndex,
    icon: payload.icon,
    bornAt: Date.now(),
    ttlMs: payload.ttlMs ?? C.ttlMs
  };
  C.alive.add(target);

  // click/tap hit
  const onClick = (ev)=>{
    ev.preventDefault();
    ev.stopPropagation();
    hitTarget(C, target, { source:'tap', x: ev.clientX, y: ev.clientY });
  };
  el.addEventListener('pointerdown', onClick);

  // mount
  C.mount.appendChild(el);

  // expire
  target.expireTO = setTimeout(()=>{
    if(!C.running || C.destroyed) return;
    if(!C.alive.has(target)) return;
    C.alive.delete(target);
    try{ el.remove(); }catch{}
    if(typeof C.onExpire === 'function') C.onExpire(target);
  }, target.ttlMs);

  return target;
}

function chooseSpawnPoint(C, size, pattern){
  const R = computeSpawnRect(C);
  if(R.w <= 10 || R.h <= 10) return null;

  // keep inside bounds with padding = size/2
  const pad = Math.max(18, size/2);
  const minX = R.left + pad;
  const maxX = R.right - pad;
  const minY = R.top + pad;
  const maxY = R.bottom - pad;

  const rng = C.rng;

  // pattern types: clusters / spread / zigzag
  if(pattern && pattern.type === 'zigzag'){
    const t = Date.now() % 4000;
    const k = (t/4000);
    const x = minX + (maxX-minX) * k;
    const y = (rng() < 0.5)
      ? (minY + (maxY-minY) * (0.25 + rng()*0.2))
      : (minY + (maxY-minY) * (0.65 + rng()*0.2));
    return { x, y };
  }

  if(pattern && pattern.type === 'clusters'){
    // 3 cluster anchors
    const ax = minX + (maxX-minX) * (0.2 + rng()*0.6);
    const ay = minY + (maxY-minY) * (0.2 + rng()*0.6);
    const jitter = 48;
    const x = clamp(ax + (rng()*2-1)*jitter, minX, maxX);
    const y = clamp(ay + (rng()*2-1)*jitter, minY, maxY);
    return { x, y };
  }

  // default: spread/random
  const x = minX + (maxX-minX) * rng();
  const y = minY + (maxY-minY) * rng();
  return { x, y };
}

function avoidTooClose(C, x, y, minDist){
  const md2 = minDist * minDist;
  for(const t of C.alive){
    const c = elementCenter(t.el);
    if(dist2(x,y,c.cx,c.cy) < md2) return false;
  }
  return true;
}

function spawnOne(C){
  if(!C.running || C.destroyed) return;
  if(C.alive.size >= C.maxAlive) return;

  const kindPick = pickWeighted(C.rng, C.kinds) || { kind:'good', weight:1 };
  const kind = kindPick.kind || 'good';

  const size = Math.round(C.sizeMin + (C.sizeMax - C.sizeMin) * C.rng());

  // pattern suggestion
  let pattern = null;
  try{
    if(typeof C.patternNext === 'function') pattern = C.patternNext('spawn');
  }catch{}

  // try a few times to find a good point
  let pt = null;
  for(let i=0;i<10;i++){
    const p = chooseSpawnPoint(C, size, pattern);
    if(!p) continue;
    const ok = avoidTooClose(C, p.x, p.y, Math.max(64, size*0.9));
    if(ok){ pt = p; break; }
  }
  if(!pt) return;

  // payload
  const payload = Object.assign({}, kindPick);
  payload.kind = kind;

  // optional groupIndex (Plate: 0-4)
  if(payload.kind === 'good' && payload.groupIndex == null){
    payload.groupIndex = Math.floor(C.rng()*5);
  }

  spawnAt(C, pt.x, pt.y, size, payload);
}

function scheduleNext(C){
  if(!C.running || C.destroyed) return;
  clearTimeout(C.spawnTimer);
  C.spawnTimer = setTimeout(()=>{
    spawnOne(C);
    scheduleNext(C);
  }, clamp(C.spawnRate, 260, 4000));
}

function hitTarget(C, target, meta={}){
  if(!C.running || C.destroyed) return;
  if(!C.alive.has(target)) return;

  C.alive.delete(target);
  clearTimeout(target.expireTO);
  try{ target.el.remove(); }catch{}

  if(typeof C.onHit === 'function'){
    C.onHit(Object.assign({
      kind: target.kind,
      groupIndex: target.groupIndex,
      icon: target.icon,
      source: meta.source || 'tap'
    }, meta));
  }
}

function onShootEvent(C, e){
  if(!C.running || C.destroyed) return;

  const d = (e && e.detail) ? e.detail : {};
  const lockPx = Number(d.lockPx ?? d.lock ?? C.lockPx) || C.lockPx;

  // aim point (viewport)
  const ax = Number(d.x ?? (WIN.innerWidth/2));
  const ay = Number(d.y ?? (WIN.innerHeight/2));

  // find closest target within lock radius
  let best = null;
  let bestD2 = (lockPx*lockPx);

  for(const t of C.alive){
    const c = elementCenter(t.el);
    const r = Math.max(12, c.r);
    // allow hit if within lockPx OR within target radius (whichever larger)
    const lim = Math.max(lockPx, r);
    const d2 = dist2(ax, ay, c.cx, c.cy);
    if(d2 <= lim*lim && d2 <= bestD2){
      bestD2 = d2;
      best = t;
    }
  }

  if(best){
    hitTarget(C, best, { source:'shoot', x: ax, y: ay });
  }
}

// ----- PUBLIC: boot() -----
export function boot(opts={}){
  const C = initController();

  if(!opts.mount) throw new Error('mode-factory: mount missing');
  if(C.running) {
    // stop previous
    try{ C.destroy(); }catch{}
    controller = null;
    return boot(opts);
  }

  C.mount = opts.mount;
  C.seed = Number(opts.seed ?? Date.now());
  C.rng = (typeof opts.rng === 'function') ? opts.rng : seededRng(C.seed);

  // config
  C.spawnRate = Number(opts.spawnRate ?? 900);
  const sr = opts.sizeRange || [44,64];
  C.sizeMin = Number(sr[0] ?? 44);
  C.sizeMax = Number(sr[1] ?? 64);

  C.kinds = Array.isArray(opts.kinds) && opts.kinds.length ? opts.kinds : [
    { kind:'good', weight:0.7, icon:'🥗' },
    { kind:'junk', weight:0.3, icon:'🍩' }
  ];

  C.margins = Object.assign({}, C.margins, (opts.margins || {}));
  C.maxAlive = Number(opts.maxAlive ?? 8);
  C.ttlMs = Number(opts.ttlMs ?? 2200);

  C.onHit = (typeof opts.onHit === 'function') ? opts.onHit : null;
  C.onExpire = (typeof opts.onExpire === 'function') ? opts.onExpire : null;

  C.patternNext = (typeof opts.patternNext === 'function') ? opts.patternNext : null;

  // lockPx from vr-ui config if present
  try{
    const uiCfg = WIN.HHA_VRUI_CONFIG || {};
    C.lockPx = Number(uiCfg.lockPx ?? C.lockPx) || C.lockPx;
  }catch{}

  // running
  C.running = true;
  C.destroyed = false;

  // listen shoot
  C._onShoot = (e)=>onShootEvent(C, e);
  WIN.addEventListener('hha:shoot', C._onShoot);

  // start
  scheduleNext(C);

  // controller API
  C.setSpawnRate = (ms)=>{
    C.spawnRate = clamp(ms, 260, 4000);
  };
  C.setSizeRange = (a,b)=>{
    C.sizeMin = clamp(a, 18, 160);
    C.sizeMax = clamp(b, C.sizeMin, 220);
  };
  C.setWeights = (goodW, junkW)=>{
    // update existing kinds by kind name
    for(const it of C.kinds){
      if(it.kind === 'good') it.weight = Number(goodW);
      if(it.kind === 'junk') it.weight = Number(junkW);
    }
  };
  C.clearAll = ()=>{
    for(const t of Array.from(C.alive)){
      C.alive.delete(t);
      clearTimeout(t.expireTO);
      try{ t.el.remove(); }catch{}
    }
  };
  C.destroy = ()=>{
    if(C.destroyed) return;
    C.destroyed = true;
    C.running = false;
    clearTimeout(C.spawnTimer);
    C.clearAll();
    WIN.removeEventListener('hha:shoot', C._onShoot);
  };

  return C;
}