// === /herohealth/vr/mode-factory.js ===
// Mode Factory (DOM Spawner) — PRODUCTION
// ✅ export named: boot (fix: "does not provide an export named 'boot'")
// ✅ Fix TDZ: controller used before init (fix: "Cannot access 'controller' before initialization")
// ✅ Spawns DOM targets into mount with safe rect (CSS vars)
// ✅ Supports: click/tap + crosshair shoot via event 'hha:shoot'
// ✅ Hooks: onHit(target), onExpire(target)
// -----------------------------------------------------------

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => (WIN.performance && performance.now) ? performance.now() : Date.now();

function qsNumStyle(el, prop, defPx = 0){
  if(!el) return defPx;
  const cs = getComputedStyle(el);
  const s = cs.getPropertyValue(prop);
  const n = parseFloat(String(s || '').trim());
  return Number.isFinite(n) ? n : defPx;
}

function getSafeRect(mount){
  // mount may define --safe-top/--safe-bottom/--safe-left/--safe-right
  const r = mount.getBoundingClientRect();

  const safeTop    = qsNumStyle(mount, '--safe-top', 0);
  const safeBottom = qsNumStyle(mount, '--safe-bottom', 0);
  const safeLeft   = qsNumStyle(mount, '--safe-left', 0);
  const safeRight  = qsNumStyle(mount, '--safe-right', 0);

  const left = r.left + safeLeft;
  const top  = r.top  + safeTop;
  const right = r.right - safeRight;
  const bottom = r.bottom - safeBottom;

  const w = Math.max(1, right - left);
  const h = Math.max(1, bottom - top);

  return { left, top, right, bottom, w, h };
}

function pickWeighted(rng, items){
  // items: [{weight, ...}]
  let sum = 0;
  for(const it of items) sum += Math.max(0, Number(it.weight) || 0);
  if(sum <= 0) return items[0];

  let t = rng() * sum;
  for(const it of items){
    t -= Math.max(0, Number(it.weight) || 0);
    if(t <= 0) return it;
  }
  return items[items.length - 1];
}

function makeRNG(seed){
  // mulberry32-like
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function distance2(ax, ay, bx, by){
  const dx = ax - bx;
  const dy = ay - by;
  return dx*dx + dy*dy;
}

/* -----------------------------------------------------------
   Controller
----------------------------------------------------------- */
function createController(opts){
  const mount = opts.mount;
  const rng = opts.rng || Math.random;

  const spawnRate = Math.max(120, Number(opts.spawnRate) || 900);
  const ttlMs = Math.max(450, Number(opts.ttlMs) || 1500);

  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [44, 64];
  const sizeMin = Math.max(24, Number(sizeRange[0]) || 44);
  const sizeMax = Math.max(sizeMin, Number(sizeRange[1]) || 64);

  const kinds = Array.isArray(opts.kinds) && opts.kinds.length ? opts.kinds : [
    { kind:'good', weight:0.7 },
    { kind:'junk', weight:0.3 }
  ];

  const onHit = typeof opts.onHit === 'function' ? opts.onHit : ()=>{};
  const onExpire = typeof opts.onExpire === 'function' ? opts.onExpire : ()=>{};

  // optional: enrich target info
  const enrich = typeof opts.enrich === 'function' ? opts.enrich : (t)=>t;

  // aiming
  const lockPxDefault = Number(opts.lockPx) || 28;

  // internal state
  const state = {
    running:false,
    timer:null,
    lastSpawnAt:0,
    active:new Set(),
    boundClick:null,
    boundShoot:null
  };

  function makeTarget(spec, safe){
    const t = {};
    t.id = `${spec.kind}-${Math.random().toString(16).slice(2)}`;
    t.kind = spec.kind || 'good';
    t.createdAt = now();
    t.expiresAt = t.createdAt + ttlMs;

    // optional groupIndex for plate/groups
    // (caller may override in enrich)
    t.groupIndex = (spec.groupIndex != null) ? spec.groupIndex : null;

    // size
    const s = Math.round(sizeMin + (sizeMax - sizeMin) * rng());
    t.size = s;

    // spawn pos inside safe rect
    // place center within safe bounds
    const x = safe.left + (s/2) + (safe.w - s) * rng();
    const y = safe.top  + (s/2) + (safe.h - s) * rng();
    t.cx = x;
    t.cy = y;

    // element
    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = t.kind;

    // use emoji if provided
    if(spec.emoji) el.textContent = spec.emoji;
    else el.textContent = (t.kind === 'junk') ? '🍟' : '🥗';

    el.style.position = 'absolute';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${s}px`;
    el.style.height = `${s}px`;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.setProperty('--size', `${s}px`);

    // attach
    mount.appendChild(el);

    t.el = el;
    return enrich(t) || t;
  }

  function removeTarget(t, why='remove'){
    if(!t || !t.el) return;
    if(t.el.parentNode) t.el.parentNode.removeChild(t.el);
    state.active.delete(t);
    t._removed = true;
    t._removedWhy = why;
  }

  function spawnOne(){
    const safe = getSafeRect(mount);
    // if safe rect too tiny, skip
    if(safe.w < 40 || safe.h < 40) return;

    const spec = pickWeighted(rng, kinds);
    const t = makeTarget(spec, safe);
    state.active.add(t);
  }

  function hitTarget(t, source='tap'){
    if(!t || t._removed) return;
    removeTarget(t, 'hit');
    try{ onHit(t, { source }); }catch{}
  }

  function expireSweep(){
    const tNow = now();
    for(const t of Array.from(state.active)){
      if(t._removed) continue;
      if(tNow >= t.expiresAt){
        removeTarget(t, 'expire');
        try{ onExpire(t); }catch{}
      }
    }
  }

  function onMountClick(ev){
    if(!state.running) return;

    // find closest target under pointer (simple hit test by bounding rect)
    const x = ev.clientX;
    const y = ev.clientY;

    let best = null;
    let bestD2 = Infinity;

    for(const t of state.active){
      if(!t || t._removed) continue;
      const d2 = distance2(x, y, t.cx, t.cy);
      // within radius (size/2)
      const r = (t.size || 56) * 0.55;
      if(d2 <= r*r && d2 < bestD2){
        best = t;
        bestD2 = d2;
      }
    }

    if(best) hitTarget(best, 'tap');
  }

  function onShoot(ev){
    // Crosshair shoot from vr-ui.js: detail {x,y,lockPx,source}
    if(!state.running) return;
    const d = ev && ev.detail ? ev.detail : {};
    const x = Number(d.x);
    const y = Number(d.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    const lockPx = Number.isFinite(Number(d.lockPx)) ? Number(d.lockPx) : lockPxDefault;
    const lock2 = lockPx * lockPx;

    let best = null;
    let bestD2 = Infinity;

    for(const t of state.active){
      if(!t || t._removed) continue;
      const d2 = distance2(x, y, t.cx, t.cy);
      // allow lock radius OR inside target radius (whichever larger)
      const r = Math.max(lockPx, (t.size || 56) * 0.55);
      const r2 = r*r;
      if(d2 <= r2 && d2 < bestD2){
        best = t;
        bestD2 = d2;
      }
    }

    if(best && bestD2 <= Math.max(lock2, 1)){
      hitTarget(best, d.source || 'shoot');
    }else if(best){
      // even if > lock2 but within target radius, still accept
      hitTarget(best, d.source || 'shoot');
    }
  }

  function loop(){
    if(!state.running) return;

    const tNow = now();
    if(tNow - state.lastSpawnAt >= spawnRate){
      state.lastSpawnAt = tNow;
      spawnOne();
    }
    expireSweep();
  }

  function start(){
    if(state.running) return;
    state.running = true;
    state.lastSpawnAt = 0;

    // bind once (avoid TDZ)
    state.boundClick = (ev)=>onMountClick(ev);
    state.boundShoot = (ev)=>onShoot(ev);

    mount.addEventListener('pointerdown', state.boundClick, { passive:true });
    WIN.addEventListener('hha:shoot', state.boundShoot);

    state.timer = setInterval(loop, 60);
  }

  function stop(){
    state.running = false;
    clearInterval(state.timer);

    if(state.boundClick) mount.removeEventListener('pointerdown', state.boundClick);
    if(state.boundShoot) WIN.removeEventListener('hha:shoot', state.boundShoot);

    // clear
    for(const t of Array.from(state.active)){
      removeTarget(t, 'stop');
    }
  }

  return {
    start,
    stop,
    spawnOne,
    getActive: ()=>Array.from(state.active),
    getSafeRect: ()=>getSafeRect(mount),
  };
}

/* -----------------------------------------------------------
   Public API
----------------------------------------------------------- */
export function boot(options){
  if(!DOC) throw new Error('mode-factory: document missing');
  if(!options || !options.mount) throw new Error('mode-factory: mount missing');

  const rng = options.rng || makeRNG(options.seed || Date.now());

  const controller = createController({
    ...options,
    rng
  });

  controller.start();
  return controller;
}

export default { boot };