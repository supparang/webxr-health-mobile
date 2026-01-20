// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — DOM Target Spawner (PRODUCTION)
// ---------------------------------------------------
// ✅ export: boot({ mount, ... })
// ✅ Seeded RNG support: opts.seed / opts.rng
// ✅ Spawn inside mount rect (safe, no transform pitfalls)
// ✅ Click/tap hit detection
// ✅ Crosshair shooting: listens hha:shoot {x,y,lockPx,source}
// ✅ Expire support (ttlMs)
// ✅ Avoid init-order bugs (controller before init) — FIXED
// ---------------------------------------------------

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, items){
  const arr = Array.isArray(items) ? items : [];
  let sum = 0;
  for (const it of arr) sum += Math.max(0, Number(it.weight) || 0);
  if (sum <= 0) return arr[0] || null;

  let t = rng() * sum;
  for (const it of arr){
    const w = Math.max(0, Number(it.weight) || 0);
    t -= w;
    if (t <= 0) return it;
  }
  return arr[arr.length - 1] || null;
}

function rectOf(el){
  const r = el.getBoundingClientRect();
  return {
    x: r.left, y: r.top,
    w: r.width, h: r.height,
    left: r.left, top: r.top, right: r.right, bottom: r.bottom
  };
}

function pointInRect(x, y, r){
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function makeEl(tag, cls){
  const el = DOC.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

function now(){
  return (WIN.performance && performance.now) ? performance.now() : Date.now();
}

/**
 * boot({
 *   mount: HTMLElement,                 // required
 *   seed?: number, rng?: ()=>number,    // optional
 *   spawnRate?: number,                // ms
 *   ttlMs?: number,                    // ms per target
 *   sizeRange?: [min,max],             // px
 *   kinds?: [{kind,weight,...}],        // weighted kinds
 *   onHit?: (t)=>void,
 *   onExpire?: (t)=>void
 * })
 */
export function boot(opts = {}){
  if(!DOC) throw new Error('mode-factory: document missing');
  const mount = opts.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  // RNG
  const rng = (typeof opts.rng === 'function')
    ? opts.rng
    : seededRng(opts.seed);

  // config
  const spawnRate = clamp(opts.spawnRate ?? 900, 120, 60000);
  const ttlMs = clamp(opts.ttlMs ?? 1800, 300, 20000);
  const sizeMin = clamp((opts.sizeRange && opts.sizeRange[0]) ?? 44, 18, 240);
  const sizeMax = clamp((opts.sizeRange && opts.sizeRange[1]) ?? 64, sizeMin, 320);

  const kinds = Array.isArray(opts.kinds) && opts.kinds.length
    ? opts.kinds
    : [{ kind:'good', weight:1 }];

  const onHit = (typeof opts.onHit === 'function') ? opts.onHit : ()=>{};
  const onExpire = (typeof opts.onExpire === 'function') ? opts.onExpire : ()=>{};

  // internal state (controller is declared BEFORE any use) — FIX
  const controller = {
    alive: true,
    timer: null,
    targets: new Set(),
    lastRect: null,
    destroyAll,
    stop,
    spawnOnce,
    hitAtPoint
  };

  // ensure mount styling baseline
  try{
    const cs = WIN.getComputedStyle(mount);
    if(cs.position === 'static') mount.style.position = 'relative';
  }catch(_){}

  function randSize(){
    return Math.round(sizeMin + (sizeMax - sizeMin) * rng());
  }

  function spawnXY(r, size){
    // keep inside bounds with small padding
    const pad = Math.max(6, Math.floor(size * 0.15));
    const x = r.left + pad + rng() * Math.max(1, (r.w - pad*2));
    const y = r.top  + pad + rng() * Math.max(1, (r.h - pad*2));
    // clamp to rect
    return {
      x: clamp(x, r.left + pad, r.right - pad),
      y: clamp(y, r.top  + pad, r.bottom - pad)
    };
  }

  function buildTarget(){
    const pick = pickWeighted(rng, kinds) || { kind:'good', weight:1 };
    const kind = String(pick.kind || 'good');

    const el = makeEl('div', 'plateTarget');
    el.dataset.kind = kind;

    // OPTIONAL payload fields e.g. groupIndex
    if (pick.groupIndex != null) el.dataset.groupIndex = String(pick.groupIndex);

    // default emoji per kind (engine may override later by setting textContent)
    el.textContent = (kind === 'junk') ? '🍩' : (kind === 'shield') ? '🛡️' : '🥦';

    const size = randSize();
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // place using viewport coords -> translate to mount local coords
    const mr = rectOf(mount);
    controller.lastRect = mr;

    const p = spawnXY(mr, size);

    const localX = p.x - mr.left;
    const localY = p.y - mr.top;

    el.style.position = 'absolute';
    el.style.left = localX + 'px';
    el.style.top  = localY + 'px';
    el.style.transform = 'translate(-50%,-50%)';

    // attach
    mount.appendChild(el);

    const t = {
      el,
      kind,
      size,
      createdAt: now(),
      ttlMs,
      // extra
      groupIndex: (pick.groupIndex != null) ? pick.groupIndex : undefined
    };

    // click/tap hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      if(!controller.alive) return;
      hitTarget(t, { x: ev.clientX, y: ev.clientY, source:'pointer' });
    }, { passive:false });

    // expire
    t.expireTo = WIN.setTimeout(()=>{
      if(!controller.alive) return;
      if(controller.targets.has(t)){
        controller.targets.delete(t);
        safeRemove(t.el);
        onExpire(t);
      }
    }, ttlMs);

    controller.targets.add(t);
    return t;
  }

  function safeRemove(el){
    try{ el && el.remove && el.remove(); }catch(_){}
  }

  function hitTarget(t, hitInfo){
    if(!controller.alive) return;
    if(!t || !t.el) return;
    if(!controller.targets.has(t)) return;

    controller.targets.delete(t);
    try{ WIN.clearTimeout(t.expireTo); }catch(_){}
    safeRemove(t.el);

    // callback payload should include the target plus optional info
    try{
      onHit(Object.assign({}, t, { hit: hitInfo || null }));
    }catch(err){
      console.error('[mode-factory] onHit error', err);
    }
  }

  function hitAtPoint(x, y){
    if(!controller.alive) return false;

    // ensure point is within mount rect first
    const mr = rectOf(mount);
    if(!pointInRect(x, y, mr)) return false;

    // find best candidate by distance to center
    let best = null;
    let bestD = Infinity;

    for(const t of controller.targets){
      const er = t.el.getBoundingClientRect();
      const cx = (er.left + er.right) / 2;
      const cy = (er.top + er.bottom) / 2;
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx*dx + dy*dy;

      // quick inside test
      if (x >= er.left && x <= er.right && y >= er.top && y <= er.bottom){
        if(d2 < bestD){
          bestD = d2;
          best = t;
        }
      }
    }

    if(best){
      hitTarget(best, { x, y, source:'shoot' });
      return true;
    }
    return false;
  }

  function spawnOnce(){
    if(!controller.alive) return null;
    return buildTarget();
  }

  function loop(){
    if(!controller.alive) return;
    spawnOnce();
    controller.timer = WIN.setTimeout(loop, spawnRate);
  }

  function destroyAll(){
    for(const t of controller.targets){
      try{ WIN.clearTimeout(t.expireTo); }catch(_){}
      safeRemove(t.el);
    }
    controller.targets.clear();
  }

  function stop(){
    controller.alive = false;
    try{ WIN.clearTimeout(controller.timer); }catch(_){}
    destroyAll();
    // remove shoot listener
    WIN.removeEventListener('hha:shoot', onShoot);
  }

  // crosshair / tap-to-shoot support
  function onShoot(e){
    if(!controller.alive) return;
    const d = (e && e.detail) ? e.detail : {};
    const x = Number(d.x);
    const y = Number(d.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;
    hitAtPoint(x, y);
  }

  // attach shoot listener
  WIN.addEventListener('hha:shoot', onShoot);

  // start loop
  controller.timer = WIN.setTimeout(loop, 60);

  return controller;
}