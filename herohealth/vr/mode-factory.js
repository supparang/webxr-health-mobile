// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — DOM Target Spawner (PRODUCTION)
// ✅ Named export: boot()
// ✅ No "controller before init" (init order fixed)
// ✅ Safe spawn bounds: respects CSS vars --pf-top/--pf-bottom/--pf-side if present
// ✅ Supports crosshair/tap shoot via event: hha:shoot {x,y,lockPx,source}
// ✅ Simple hit/expire lifecycle (good/junk), weighted kinds
//
// Usage:
//   import { boot as spawnBoot } from '../vr/mode-factory.js';
//   const engine = spawnBoot({
//     mount,
//     seed,
//     spawnRate: 900,
//     sizeRange: [44,64],
//     kinds: [{kind:'good',weight:.7},{kind:'junk',weight:.3}],
//     onHit: (t)=>{},
//     onExpire: (t)=>{},
//   });

'use strict';

const WIN = window;
const DOC = document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function now(){ return performance.now ? performance.now() : Date.now(); }

function seededRng(seed){
  let t = (Number(seed)||0) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function parsePx(s, fallback=0){
  if(!s) return fallback;
  const n = parseFloat(String(s).trim());
  return Number.isFinite(n) ? n : fallback;
}

function cssVarPx(name, fallback=0){
  try{
    const cs = getComputedStyle(DOC.documentElement);
    return parsePx(cs.getPropertyValue(name), fallback);
  }catch(_){
    return fallback;
  }
}

function pickWeighted(rng, items){
  let sum = 0;
  for(const it of items) sum += Math.max(0, Number(it.weight)||0);
  if(sum <= 0) return items[0] || { kind:'good', weight:1 };
  let t = rng() * sum;
  for(const it of items){
    t -= Math.max(0, Number(it.weight)||0);
    if(t <= 0) return it;
  }
  return items[items.length-1];
}

function rectWithInsets(rect, insets){
  const r = {
    left: rect.left + (insets.left||0),
    top: rect.top + (insets.top||0),
    right: rect.right - (insets.right||0),
    bottom: rect.bottom - (insets.bottom||0),
  };
  r.width = Math.max(1, r.right - r.left);
  r.height = Math.max(1, r.bottom - r.top);
  return r;
}

function pointInRect(x,y,r){
  return x>=r.left && x<=r.right && y>=r.top && y<=r.bottom;
}

function dist2(ax,ay,bx,by){
  const dx=ax-bx, dy=ay-by;
  return dx*dx+dy*dy;
}

function mountRect(mount){
  const r = mount.getBoundingClientRect();
  return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
}

/* -----------------------------------------------------------
   Exported boot()
----------------------------------------------------------- */
export function boot(cfg){
  if(!cfg || !cfg.mount) throw new Error('mode-factory: mount missing');

  // ---- controller must exist BEFORE any closures reference it
  const controller = {
    running: true,
    targets: new Map(), // id -> target
    spawnTO: null,
    tickRAF: null,
    rng: (cfg.rng && typeof cfg.rng === 'function') ? cfg.rng : seededRng(cfg.seed || Date.now()),
    lastSpawnAt: 0,
    idSeq: 1,

    destroy(){
      controller.running = false;
      clearTimeout(controller.spawnTO);
      cancelAnimationFrame(controller.tickRAF);
      controller.spawnTO = null;
      controller.tickRAF = null;

      // remove targets
      for(const t of controller.targets.values()){
        try{ t.el.remove(); }catch(_){}
      }
      controller.targets.clear();

      // detach listeners
      WIN.removeEventListener('hha:shoot', onShoot);
      WIN.removeEventListener('resize', onResize, { passive:true });
      WIN.removeEventListener('orientationchange', onResize, { passive:true });
    }
  };

  const mount = cfg.mount;
  const spawnRate = clamp(cfg.spawnRate ?? 900, 120, 5000);
  const sizeMin = clamp((cfg.sizeRange && cfg.sizeRange[0]) ?? 44, 18, 220);
  const sizeMax = clamp((cfg.sizeRange && cfg.sizeRange[1]) ?? 64, sizeMin, 260);
  const kinds = Array.isArray(cfg.kinds) && cfg.kinds.length ? cfg.kinds : [{kind:'good',weight:1}];
  const onHit = (typeof cfg.onHit === 'function') ? cfg.onHit : ()=>{};
  const onExpire = (typeof cfg.onExpire === 'function') ? cfg.onExpire : ()=>{};
  const ttlMs = clamp(cfg.ttlMs ?? 2400, 600, 9000);

  // Read playfield safe insets from CSS vars if present (from plate-vr.css)
  // If vars not set, fallback to 0.
  let insets = {
    top: cssVarPx('--pf-top', 0),
    bottom: cssVarPx('--pf-bottom', 0),
    left: cssVarPx('--pf-side', 0),
    right: cssVarPx('--pf-side', 0),
  };

  function getSpawnRect(){
    const r0 = mountRect(mount);
    // convert “global UI” insets to mount rect space:
    // since mount is full-screen fixed, applying insets directly is OK.
    const r = rectWithInsets(r0, insets);
    // avoid too-small area
    if(r.width < 160 || r.height < 160){
      // relax insets if screen is tiny
      const relax = 0.55;
      const r2 = rectWithInsets(r0, {
        top: insets.top*relax,
        bottom: insets.bottom*relax,
        left: insets.left*relax,
        right: insets.right*relax,
      });
      return r2;
    }
    return r;
  }

  function spawnOne(){
    if(!controller.running) return;

    const sr = getSpawnRect();
    const size = Math.round(sizeMin + (sizeMax - sizeMin) * controller.rng());
    const pad = Math.max(10, Math.floor(size * 0.55));

    const x = sr.left + pad + controller.rng() * Math.max(1, (sr.width - pad*2));
    const y = sr.top + pad + controller.rng() * Math.max(1, (sr.height - pad*2));

    const pick = pickWeighted(controller.rng, kinds);
    const kind = pick.kind || 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // allow games to attach extra metadata (e.g., groupIndex) via pick
    // (Plate will randomize groupIndex itself if not provided)
    if(pick.groupIndex != null) el.dataset.groupIndex = String(pick.groupIndex);

    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    // icon fallback: caller can override by setting el.textContent later
    el.textContent = (kind === 'junk') ? '🍩' : '🍚';

    const id = String(controller.idSeq++);
    const born = now();

    const target = {
      id, kind,
      el,
      bornAt: born,
      ttlMs,
      x, y, size,
      groupIndex: (pick.groupIndex != null) ? Number(pick.groupIndex) : null
    };

    controller.targets.set(id, target);
    mount.appendChild(el);

    // direct tap/click hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hitTarget(target, { source:'pointer', x: ev.clientX, y: ev.clientY });
    }, { passive:false });

    controller.lastSpawnAt = born;
  }

  function scheduleNext(){
    if(!controller.running) return;
    clearTimeout(controller.spawnTO);
    controller.spawnTO = setTimeout(()=>{
      spawnOne();
      scheduleNext();
    }, spawnRate);
  }

  function hitTarget(t, meta){
    if(!t || !controller.targets.has(t.id)) return;

    // small hit feedback class
    try{
      t.el.classList.add(t.kind === 'junk' ? 'is-bad' : 'is-hit');
      setTimeout(()=>t.el && t.el.classList.remove('is-hit','is-bad'), 160);
    }catch(_){}

    // remove
    controller.targets.delete(t.id);
    try{ t.el.remove(); }catch(_){}

    // callback
    try{
      onHit({
        id: t.id,
        kind: t.kind,
        groupIndex: t.groupIndex,
        x: t.x, y: t.y, size: t.size,
        meta: meta || {}
      });
    }catch(err){
      console.error('[mode-factory] onHit error', err);
    }
  }

  function expireTarget(t){
    if(!t || !controller.targets.has(t.id)) return;
    controller.targets.delete(t.id);
    try{ t.el.remove(); }catch(_){}
    try{
      onExpire({
        id: t.id,
        kind: t.kind,
        groupIndex: t.groupIndex,
        x: t.x, y: t.y, size: t.size
      });
    }catch(err){
      console.error('[mode-factory] onExpire error', err);
    }
  }

  function tick(){
    if(!controller.running) return;

    const tNow = now();
    for(const t of controller.targets.values()){
      if((tNow - t.bornAt) >= t.ttlMs){
        expireTarget(t);
      }
    }

    controller.tickRAF = requestAnimationFrame(tick);
  }

  // crosshair shoot: try lock onto nearest target within lockPx
  function onShoot(ev){
    if(!controller.running) return;
    const d = ev.detail || {};
    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = clamp(d.lockPx ?? 28, 6, 120);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    // find nearest target within lock radius
    let best = null;
    let bestD2 = lockPx * lockPx;

    for(const t of controller.targets.values()){
      // center of target
      const cx = t.x;
      const cy = t.y;
      const dd = dist2(x,y,cx,cy);
      if(dd <= bestD2){
        bestD2 = dd;
        best = t;
      }
    }

    if(best){
      hitTarget(best, { source:'shoot', x, y, lockPx, aim:'lock' });
    }
  }

  function onResize(){
    // re-read insets (in case orientation / safe-area changed)
    insets = {
      top: cssVarPx('--pf-top', 0),
      bottom: cssVarPx('--pf-bottom', 0),
      left: cssVarPx('--pf-side', 0),
      right: cssVarPx('--pf-side', 0),
    };
  }

  // listeners (after controller exists)
  WIN.addEventListener('hha:shoot', onShoot);
  WIN.addEventListener('resize', onResize, { passive:true });
  WIN.addEventListener('orientationchange', onResize, { passive:true });

  // start
  // (spawn a few instantly so “เป้าไม่โผล่” ไม่เกิด)
  const warm = clamp(cfg.warmStart ?? 2, 0, 6);
  for(let i=0;i<warm;i++) spawnOne();

  scheduleNext();
  controller.tickRAF = requestAnimationFrame(tick);

  return controller;
}