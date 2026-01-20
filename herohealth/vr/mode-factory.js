// === /herohealth/vr/mode-factory.js ===
// Generic DOM Target Spawner (HHA Standard) — FIXED (A29)
// ✅ Fix: "Cannot access 'controller' before initialization"
// ✅ Export: boot + createSpawner (backward compatible)
// ✅ Crosshair shooting via window 'hha:shoot' {x,y,lockPx,source}
// ✅ Seeded RNG support (cfg.seed / cfg.rng)
// ✅ Fallback safe spawn so targets always appear

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

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

function getRect(el){
  if(!el) return { left:0, top:0, width: WIN.innerWidth||360, height: WIN.innerHeight||640 };
  const r = el.getBoundingClientRect();
  const w = Math.max(1, r.width);
  const h = Math.max(1, r.height);
  return { left:r.left, top:r.top, width:w, height:h };
}

function pickInRect(rng, rect, pad=16){
  const x = rect.left + pad + rng() * Math.max(1, rect.width  - pad*2);
  const y = rect.top  + pad + rng() * Math.max(1, rect.height - pad*2);
  return { x, y };
}

function distance(a,b){
  const dx = (a.x-b.x);
  const dy = (a.y-b.y);
  return Math.hypot(dx,dy);
}

/* -------------------------------------------------------
   createSpawner (primary API)
   opts:
    - mount: DOM element where targets are appended
    - seed / rng
    - spawnRateMs
    - sizeRange [min,max]
    - kinds: [{kind, weight, make?(rng)->payload}]
    - onHit(targetPayload, meta)
    - onExpire(targetPayload, meta)
------------------------------------------------------- */
export function createSpawner(opts = {}){
  if(!DOC) throw new Error('mode-factory: document missing');

  const mount = opts.mount || DOC.body;
  const rng = opts.rng || (opts.seed!=null ? seededRng(opts.seed) : Math.random);

  const sizeMin = (opts.sizeRange && opts.sizeRange[0]) ? Number(opts.sizeRange[0]) : 44;
  const sizeMax = (opts.sizeRange && opts.sizeRange[1]) ? Number(opts.sizeRange[1]) : 64;

  const spawnRateMs0 = Math.max(180, Number(opts.spawnRateMs || opts.spawnRate || 900) || 900);

  const kinds = Array.isArray(opts.kinds) && opts.kinds.length
    ? opts.kinds
    : [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }];

  const onHit = (typeof opts.onHit === 'function') ? opts.onHit : ()=>{};
  const onExpire = (typeof opts.onExpire === 'function') ? opts.onExpire : ()=>{};

  // ---- internal state ----
  let alive = true;
  let spawnTimer = null;
  let active = new Set();

  // IMPORTANT: controller must be declared BEFORE any closure uses it
  const controller = {
    spawnRateMs: spawnRateMs0,
    mountRect: null,
    lockPx: 26,
    lastShotAt: 0,
    shotCooldownMs: 60,
    timeLeftSec: null,
    setSpawnRate(ms){
      controller.spawnRateMs = Math.max(160, Number(ms)||spawnRateMs0);
      // restart loop if needed
      if(alive){
        stopLoop();
        startLoop();
      }
    },
    setTimeLeft(sec){
      controller.timeLeftSec = (sec==null) ? null : Number(sec);
    },
    destroy(){
      alive = false;
      stopLoop();
      WIN.removeEventListener('hha:shoot', onShoot);
      // cleanup nodes
      active.forEach((node)=>{ try{ node.remove(); }catch(_){} });
      active.clear();
    }
  };

  // ---- helpers ----
  function pickKind(){
    let total = 0;
    for(const k of kinds) total += Math.max(0, Number(k.weight||0));
    if(total <= 0) return kinds[0];
    let t = rng() * total;
    for(const k of kinds){
      t -= Math.max(0, Number(k.weight||0));
      if(t <= 0) return k;
    }
    return kinds[kinds.length-1];
  }

  function spawnOne(){
    if(!alive) return;
    const rect = getRect(mount);
    controller.mountRect = rect;

    const size = clamp(sizeMin + rng()*(sizeMax-sizeMin), 26, 180);
    const p = pickInRect(rng, rect, Math.max(10, size*0.55));

    const kindObj = pickKind();
    const payload = {
      kind: kindObj.kind || 'good',
      size,
      x: p.x,
      y: p.y,
      bornAt: Date.now()
    };

    // allow custom fields
    if(typeof kindObj.make === 'function'){
      try{
        Object.assign(payload, kindObj.make(rng) || {});
      }catch(_){}
    }

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = payload.kind;
    el.style.width = `${Math.round(size)}px`;
    el.style.height = `${Math.round(size)}px`;
    el.style.left = `${Math.round(p.x)}px`;
    el.style.top  = `${Math.round(p.y)}px`;
    el.textContent = payload.emoji || (payload.kind === 'junk' ? '🍟' : '🍽️');

    // click/tap hits too
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(payload, { source:'tap', x: ev.clientX, y: ev.clientY });
      removeNode(el);
    }, { passive:false });

    mount.appendChild(el);
    active.add(el);

    // expire (simple TTL)
    const ttl = Math.max(600, Number(opts.ttlMs || 1200) || 1200);
    setTimeout(()=>{
      if(!alive) return;
      if(!active.has(el)) return;
      onExpire(payload, { source:'ttl' });
      removeNode(el);
    }, ttl);
  }

  function removeNode(el){
    if(!el) return;
    if(active.has(el)) active.delete(el);
    try{ el.remove(); }catch(_){}
  }

  function hit(payload, meta){
    try{ onHit(payload, meta || {}); }catch(_){}
  }

  // ---- shooting bridge (crosshair) ----
  function onShoot(ev){
    if(!alive) return;
    const d = ev && ev.detail ? ev.detail : {};
    const now = Date.now();
    if(now - controller.lastShotAt < controller.shotCooldownMs) return;
    controller.lastShotAt = now;

    const x = Number(d.x) || (WIN.innerWidth||360)/2;
    const y = Number(d.y) || (WIN.innerHeight||640)/2;
    const lockPx = Math.max(6, Number(d.lockPx || controller.lockPx) || controller.lockPx);

    // find nearest active node within lock radius
    let best = null;
    let bestDist = 1e9;

    active.forEach((el)=>{
      try{
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width/2;
        const cy = r.top + r.height/2;
        const dist = Math.hypot(cx-x, cy-y);
        if(dist < bestDist){
          bestDist = dist;
          best = { el, cx, cy };
        }
      }catch(_){}
    });

    if(best && bestDist <= lockPx){
      // build minimal payload back from dataset
      const payload = {
        kind: best.el.dataset.kind || 'good',
        size: best.el.getBoundingClientRect().width || 50,
        x: best.cx,
        y: best.cy
      };
      hit(payload, { source: d.source || 'shoot', x, y, lockPx });
      removeNode(best.el);
    }
  }

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  // ---- loop ----
  function startLoop(){
    if(!alive) return;
    spawnTimer = setInterval(()=>{
      // always spawn even if something else fails
      try{ spawnOne(); }catch(e){ /* swallow */ }
    }, controller.spawnRateMs);
  }
  function stopLoop(){
    if(spawnTimer){
      clearInterval(spawnTimer);
      spawnTimer = null;
    }
  }

  startLoop();

  // public API
  return controller;
}

/* -------------------------------------------------------
   Backward compatible API:
   - boot(opts) -> returns controller from createSpawner
------------------------------------------------------- */
export function boot(opts = {}){
  // Old code may call spawnBoot({mount, seed, spawnRate, sizeRange, kinds, onHit, onExpire})
  return createSpawner({
    mount: opts.mount,
    seed: opts.seed,
    rng: opts.rng,
    spawnRateMs: opts.spawnRateMs || opts.spawnRate,
    sizeRange: opts.sizeRange,
    kinds: opts.kinds,
    ttlMs: opts.ttlMs,
    onHit: opts.onHit,
    onExpire: opts.onExpire
  });
}