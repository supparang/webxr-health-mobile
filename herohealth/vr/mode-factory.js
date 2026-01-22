// === /herohealth/vr/mode-factory.js ===
// HHA Spawn Mode Factory — PRODUCTION (DOM targets)
// ✅ export: boot(...)  (compat for older engines)
// ✅ controller init order fixed (no TDZ crash)
// ✅ supports: click/tap + hha:shoot (crosshair)
// ✅ safe spawn rect: avoids HUD/top area + safe-area insets
// ✅ expire timer per target + spawn loop
// ---------------------------------------------------------
// Usage:
//   import { boot as spawnBoot } from '../vr/mode-factory.js';
//   const controller = spawnBoot({ mount, seed, spawnRate, sizeRange, kinds, onHit, onExpire });
//   controller.stop();

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

/* ---------------------------------------------------------
 * RNG (seeded)
--------------------------------------------------------- */
function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------
 * Safe rect (avoid HUD)
 * - We take CSS variables if present:
 *   --hud-top-safe, --hud-height-safe, --play-top-safe, --play-bottom-safe
 * - Otherwise estimate from #hud bounding box.
--------------------------------------------------------- */
function getSafeRect(mount){
  const vw = WIN.innerWidth || 1;
  const vh = WIN.innerHeight || 1;

  // safe-area insets
  const cs = getComputedStyle(DOC.documentElement);
  const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
  const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;

  // if user provided explicit safe vars
  const topVar = parseFloat(cs.getPropertyValue('--play-top-safe')) || 0;
  const bottomVar = parseFloat(cs.getPropertyValue('--play-bottom-safe')) || 0;

  let top = sat + 8 + topVar;
  let bottom = vh - (sab + 8 + bottomVar);

  // avoid HUD automatically if exists
  const hud = DOC.getElementById('hud');
  if(hud){
    const r = hud.getBoundingClientRect();
    // add margin below hud
    top = Math.max(top, r.bottom + 10);
  }

  // side padding
  const left = 10;
  const right = vw - 10;

  // clamp
  const safe = {
    left: clamp(left, 0, vw-1),
    top: clamp(top, 0, vh-1),
    right: clamp(right, 1, vw),
    bottom: clamp(bottom, 1, vh)
  };

  // ensure min height/width
  if(safe.bottom - safe.top < 120){
    safe.top = clamp(vh*0.25, 0, vh-140);
    safe.bottom = clamp(vh*0.95, safe.top+120, vh);
  }
  if(safe.right - safe.left < 180){
    safe.left = clamp(vw*0.05, 0, vw-200);
    safe.right = clamp(vw*0.95, safe.left+180, vw);
  }

  return safe;
}

/* ---------------------------------------------------------
 * Hit-test helper for hha:shoot
--------------------------------------------------------- */
function hitTestAt(x,y, lockPx=28){
  // find closest target near (x,y)
  const els = Array.from(DOC.querySelectorAll('.plateTarget, .gjTarget, .grpTarget, [data-hha-target="1"]'));
  let best = null;
  let bestD = 1e9;

  for(const el of els){
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;
    const dx = cx - x;
    const dy = cy - y;
    const d = Math.hypot(dx,dy);
    if(d < bestD){
      bestD = d;
      best = el;
    }
  }
  if(best && bestD <= lockPx) return best;
  return null;
}

/* ---------------------------------------------------------
 * Target creation
--------------------------------------------------------- */
function makeTarget({ mount, kind, size, x, y, ttlMs, data, onHit, onExpire }){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.dataset.kind = kind;

  // allow other games reuse
  el.dataset.hhaTarget = '1';

  // payload (ex: groupIndex)
  if(data){
    for(const k of Object.keys(data)){
      el.dataset[k] = String(data[k]);
    }
  }

  el.style.position = 'absolute';
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.left = `${Math.round(x)}px`;
  el.style.top  = `${Math.round(y)}px`;
  el.style.transform = 'translate(-50%,-50%)';

  // emoji / label
  el.textContent = data?.emoji || (kind==='good' ? '🥗' : '🍩');

  let expired = false;
  const to = WIN.setTimeout(()=>{
    if(expired) return;
    expired = true;
    try{ el.remove(); }catch{}
    onExpire && onExpire({ kind, el, ...data });
  }, clamp(ttlMs, 250, 8000));

  function hit(source='tap'){
    if(expired) return;
    expired = true;
    WIN.clearTimeout(to);
    try{ el.remove(); }catch{}
    onHit && onHit({ kind, el, source, ...data });
  }

  el.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    hit('tap');
  }, { passive:false });

  mount.appendChild(el);

  return { el, hit, stop(){ expired=true; WIN.clearTimeout(to); try{ el.remove(); }catch{} } };
}

/* ---------------------------------------------------------
 * Spawn controller (main)
--------------------------------------------------------- */
export function boot(opts){
  const mount = opts?.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(opts.seed ?? Date.now());

  const spawnRate = clamp(opts.spawnRate ?? 900, 180, 5000);
  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [44, 66];
  const kinds = Array.isArray(opts.kinds) ? opts.kinds : [{kind:'good',weight:0.7},{kind:'junk',weight:0.3}];

  const onHit = typeof opts.onHit === 'function' ? opts.onHit : null;
  const onExpire = typeof opts.onExpire === 'function' ? opts.onExpire : null;

  const ttlBase = clamp(opts.ttlMs ?? 1800, 500, 8000);

  // ✅ FIX TDZ: create controller first, then assign methods/vars
  const controller = {
    running: true,
    targets: new Set(),
    stop(){},
    spawnOnce(){},
    recomputeSafe(){},
    safe: null,
  };

  controller.safe = getSafeRect(mount);

  controller.recomputeSafe = ()=>{
    controller.safe = getSafeRect(mount);
    return controller.safe;
  };

  function pickKind(){
    let sum = 0;
    for(const k of kinds) sum += (Number(k.weight)||0);
    let r = rng() * (sum || 1);
    for(const k of kinds){
      r -= (Number(k.weight)||0);
      if(r <= 0) return k.kind || 'good';
    }
    return kinds[0]?.kind || 'good';
  }

  function randBetween(a,b){
    return a + (b-a)*rng();
  }

  controller.spawnOnce = ()=>{
    if(!controller.running) return;

    // safe rect recalculated occasionally (handles rotation / hud changes)
    if(!controller.safe || (rng() < 0.08)) controller.recomputeSafe();
    const s = controller.safe;

    const kind = pickKind();
    const size = Math.round(randBetween(sizeRange[0], sizeRange[1]));

    const x = randBetween(s.left + size*0.6, s.right - size*0.6);
    const y = randBetween(s.top + size*0.8, s.bottom - size*0.8);

    // optional extra payload (e.g., plate groups)
    const data = Object.assign({}, opts.dataFactory ? opts.dataFactory({kind,rng}) : null);

    // TTL: a little variance
    const ttlMs = Math.round(ttlBase * randBetween(0.85, 1.15));

    const t = makeTarget({
      mount, kind, size, x, y, ttlMs, data,
      onHit: (payload)=>{
        controller.targets.delete(t);
        onHit && onHit(payload);
      },
      onExpire: (payload)=>{
        controller.targets.delete(t);
        onExpire && onExpire(payload);
      }
    });

    controller.targets.add(t);
  };

  let timer = null;
  function loop(){
    if(!controller.running) return;
    controller.spawnOnce();
    timer = WIN.setTimeout(loop, spawnRate);
  }
  timer = WIN.setTimeout(loop, 250);

  // listen to crosshair shoot
  function onShoot(e){
    if(!controller.running) return;
    const d = e.detail || {};
    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = Number(d.lockPx ?? 28) || 28;

    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    const el = hitTestAt(x,y, lockPx);
    if(!el) return;

    // find target object and hit it
    for(const t of controller.targets){
      if(t.el === el){
        t.hit('shoot');
        break;
      }
    }
  }
  WIN.addEventListener('hha:shoot', onShoot);

  // responsive
  function onResize(){
    controller.recomputeSafe();
  }
  WIN.addEventListener('resize', onResize);
  WIN.addEventListener('orientationchange', onResize);

  controller.stop = ()=>{
    controller.running = false;
    try{ WIN.clearTimeout(timer); }catch{}
    WIN.removeEventListener('hha:shoot', onShoot);
    WIN.removeEventListener('resize', onResize);
    WIN.removeEventListener('orientationchange', onResize);

    for(const t of Array.from(controller.targets)){
      try{ t.stop(); }catch{}
    }
    controller.targets.clear();
  };

  return controller;
}