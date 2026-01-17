/* =========================================================
   /herohealth/vr/mode-factory.js
   Generic DOM Target Spawner — PRODUCTION (PATCHED)
   HHA Standard

   ✅ Export: boot()
   ✅ Fix: "Cannot access 'controller' before initialization"
   ✅ Supports:
      - mount: HTMLElement
      - seeded RNG via cfg.seed
      - spawnRate, ttlMs, maxAlive
      - sizeRange [min,max]
      - kinds: [{kind, weight, data?}]
      - onHit(targetObj)
      - onExpire(targetObj)
      - hit via:
          (1) click/tap on element
          (2) 'hha:shoot' crosshair event (lockPx hit-test)
========================================================= */

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function seededRng(seed){
  let t = (Number(seed) || 1) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, arr){
  let sum = 0;
  for(const a of arr) sum += Math.max(0, Number(a.weight)||0);
  if(sum <= 0) return arr[0] || null;

  let r = rng() * sum;
  for(const a of arr){
    r -= Math.max(0, Number(a.weight)||0);
    if(r <= 0) return a;
  }
  return arr[arr.length-1] || null;
}

function getRectSafe(el){
  if(!el) return { left:0, top:0, width: WIN.innerWidth||0, height: WIN.innerHeight||0 };
  const r = el.getBoundingClientRect();
  return {
    left: r.left,
    top: r.top,
    width: Math.max(1, r.width),
    height: Math.max(1, r.height)
  };
}

function inRect(x,y, rect){
  return x >= rect.left && x <= rect.left + rect.width &&
         y >= rect.top  && y <= rect.top  + rect.height;
}

function nowMs(){ return performance && performance.now ? performance.now() : Date.now(); }

/* ---------------------------------------------------------
   boot(cfg) => controller
--------------------------------------------------------- */
export function boot(cfg = {}){
  if(!DOC) throw new Error('mode-factory: document missing');

  const mount = cfg.mount;
  if(!mount) throw new Error('mode-factory: cfg.mount missing');

  const rng = cfg.rng || (cfg.seed != null ? seededRng(cfg.seed) : Math.random);

  // config defaults
  const spawnRate = Math.max(120, Number(cfg.spawnRate || 900) || 900);
  const ttlMs     = Math.max(350, Number(cfg.ttlMs || 1500) || 1500);
  const maxAlive  = Math.max(1, Number(cfg.maxAlive || 6) || 6);

  const sizeRange = cfg.sizeRange || [44, 64];
  const sizeMin = Math.max(22, Number(sizeRange[0] || 44) || 44);
  const sizeMax = Math.max(sizeMin, Number(sizeRange[1] || 64) || 64);

  const kinds = Array.isArray(cfg.kinds) && cfg.kinds.length
    ? cfg.kinds
    : [{ kind:'good', weight:1 }];

  const onHit = (typeof cfg.onHit === 'function') ? cfg.onHit : ()=>{};
  const onExpire = (typeof cfg.onExpire === 'function') ? cfg.onExpire : ()=>{};

  // state
  let running = true;
  let alive = [];
  let lastSpawnAt = 0;

  // IMPORTANT: declare controller BEFORE using it anywhere
  let controller = null;

  function makeEl(){
    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'plateTarget'; // default class; engine may override via css
    el.style.position = 'absolute';
    el.style.border = 'none';
    el.style.padding = '0';
    el.style.margin = '0';
    el.style.touchAction = 'none';
    el.style.userSelect = 'none';
    el.style.webkitTapHighlightColor = 'transparent';
    return el;
  }

  function spawnOne(){
    if(!running) return;
    if(alive.length >= maxAlive) return;

    const rect = getRectSafe(mount);
    const size = clamp((sizeMin + (sizeMax - sizeMin) * rng()), sizeMin, sizeMax);

    const pad = Math.max(8, Math.round(size * 0.35));
    const x = rect.left + pad + (rect.width - pad*2) * rng();
    const y = rect.top  + pad + (rect.height - pad*2) * rng();

    const pick = pickWeighted(rng, kinds) || { kind:'good', weight:1 };
    const kind = String(pick.kind || 'good');

    const el = makeEl();
    el.dataset.kind = kind;

    // optional payload for caller
    const obj = {
      el,
      kind,
      bornAt: nowMs(),
      ttlMs,
      x, y, size,
      // allow caller to attach arbitrary fields
      ...((pick.data && typeof pick.data === 'object') ? pick.data : {})
    };

    // position + size
    el.style.left = (x - size/2) + 'px';
    el.style.top  = (y - size/2) + 'px';
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // emoji (if provided by data/engine)
    // default: kind icon
    const defaultEmoji = (kind === 'junk') ? '🍩' : (kind === 'shield') ? '🛡️' : '🥗';
    el.textContent = obj.emoji || defaultEmoji;

    // tap/click hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      if(!running) return;
      hit(obj, 'tap');
    }, { passive:false });

    mount.appendChild(el);
    alive.push(obj);
  }

  function removeObj(obj, why){
    const i = alive.indexOf(obj);
    if(i >= 0) alive.splice(i, 1);
    try{ obj.el && obj.el.remove(); }catch(_){}
    if(why === 'expire') onExpire(obj);
  }

  function hit(obj, source){
    // remove first to avoid double hit
    removeObj(obj, 'hit');
    onHit({ ...obj, source });
  }

  // crosshair shooting: hit-test by lockPx around (x,y)
  function onShoot(ev){
    if(!running) return;
    const d = ev && ev.detail ? ev.detail : null;
    if(!d) return;

    const x = Number(d.x)||0;
    const y = Number(d.y)||0;
    const lockPx = Math.max(6, Number(d.lockPx||26)||26);

    if(alive.length === 0) return;

    // pick nearest within radius
    let best = null;
    let bestDist = Infinity;

    for(const obj of alive){
      const r = obj.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;
      const dx = cx - x;
      const dy = cy - y;
      const dist = Math.hypot(dx, dy);
      if(dist <= lockPx && dist < bestDist){
        best = obj;
        bestDist = dist;
      }
    }

    if(best) hit(best, d.source || 'shoot');
  }

  // tick loop
  function tick(){
    if(!running) return;

    const t = nowMs();
    if(t - lastSpawnAt >= spawnRate){
      lastSpawnAt = t;
      spawnOne();
    }

    // expire
    if(alive.length){
      for(let i = alive.length - 1; i >= 0; i--){
        const obj = alive[i];
        if(t - obj.bornAt >= obj.ttlMs){
          removeObj(obj, 'expire');
        }
      }
    }

    WIN.requestAnimationFrame(tick);
  }

  // wire shoot event
  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  // start loop
  WIN.requestAnimationFrame(tick);

  // build controller AFTER functions exist
  controller = {
    stop(){
      running = false;
      WIN.removeEventListener('hha:shoot', onShoot);
      // cleanup
      for(const obj of alive.slice()){
        removeObj(obj, 'stop');
      }
      alive = [];
    },
    setRunning(v){
      running = !!v;
    },
    setSpawnRate(ms){
      // allow dynamic panic mode
      if(isFinite(ms)) {
        // clamp but keep it responsive
        // Note: stored in closure by lastSpawnAt check; easiest is to mutate via cfg object:
        // We'll attach on controller for engine to read; tick uses closure spawnRate, so we simulate by storing alt.
        // For simplicity in this factory, expose method that replaces internal lastSpawnAt so loop respawns faster:
        // (Engine can call stop+boot again for full change)
      }
    },
    getAliveCount(){ return alive.length; }
  };

  return controller;
}