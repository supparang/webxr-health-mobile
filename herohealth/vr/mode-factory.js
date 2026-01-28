// === /herohealth/vr/mode-factory.js ===
// Spawn Mode Factory — PRODUCTION (HHA Standard)
// ------------------------------------------------
// ✅ FIX export: named export boot(...)
// ✅ FIX "controller before init" (no TDZ)
// ✅ Supports: decorateTarget(el, target)
// ✅ Supports: crosshair/tap-to-shoot via event hha:shoot {x,y,lockPx,source}
// ✅ Safe-area spawn rect via CSS vars (prefix-based)
// ✅ Anti corner-clump (basic spacing)
// ✅ stop(): clears timers/listeners + removes remaining targets (no "flash" after end)
// ------------------------------------------------

'use strict';

const WIN = window;
const DOC = document;

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function now(){
  try{ return performance.now(); }catch{ return Date.now(); }
}

function readSafeVars(prefix){
  // default prefix: plate -> --plate-top-safe, --plate-bottom-safe, ...
  const cs = getComputedStyle(DOC.documentElement);
  const p = String(prefix || 'plate').trim() || 'plate';
  const top    = parseFloat(cs.getPropertyValue(`--${p}-top-safe`)) || 0;
  const bottom = parseFloat(cs.getPropertyValue(`--${p}-bottom-safe`)) || 0;
  const left   = parseFloat(cs.getPropertyValue(`--${p}-left-safe`)) || 0;
  const right  = parseFloat(cs.getPropertyValue(`--${p}-right-safe`)) || 0;
  return { top, bottom, left, right };
}

function pickWeighted(rng, arr){
  let sum = 0;
  for(const it of arr) sum += (it.weight ?? 1);
  let x = rng() * sum;
  for(const it of arr){
    x -= (it.weight ?? 1);
    if(x <= 0) return it;
  }
  return arr[arr.length-1];
}

/**
 * Named export (important): boot(...)
 */
export function boot({
  mount,
  seed = Date.now(),

  // spawn pacing
  spawnRate = 900,            // ms between spawns (approx)
  sizeRange = [44, 64],

  // types
  kinds = [
    { kind:'good', weight:0.7 },
    { kind:'junk', weight:0.3 }
  ],

  // hooks
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,

  // shooting assist
  shootCooldownMs = 90,
  lockPxDefault = 28,

  // safe area vars prefix (plate/groups/goodjunk/...)
  safeVarPrefix = 'plate',

  // simple spacing (anti-clump)
  recentPointsCap = 10,
  minDistPx = 72,
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);
  const state = {
    alive: true,
    spawnTimer: null,
    lastSpawnAt: 0,
    targets: new Set(),
    cooldownUntil: 0,
    recentPts: [], // {x,y,t}
  };

  function computeSpawnRect(){
    const r = mount.getBoundingClientRect();
    const safe = readSafeVars(safeVarPrefix);
    const left = r.left + safe.left;
    const top = r.top + safe.top;
    const right = r.right - safe.right;
    const bottom = r.bottom - safe.bottom;
    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);
    return { left, top, right, bottom, w, h };
  }

  function removeTarget(target){
    if(!target) return;
    try{ if(target._tmo) clearTimeout(target._tmo); }catch{}
    try{ target.el && target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;

    state.targets.delete(target);
    removeTarget(target);

    try{
      onHit({
        kind: target.kind,
        groupIndex: target.groupIndex,
        size: target.size,
        bornAt: target.bornAt,
        seed,
        ...meta
      });
    }catch{}
  }

  function onShoot(e){
    if(!state.alive) return;
    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + (Number(d.cooldownMs) || shootCooldownMs);

    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx || lockPxDefault);

    if(!isFinite(x) || !isFinite(y)) return;

    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      const r = target.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;
      const dist = Math.hypot(cx - x, cy - y);
      if(dist <= lockPx && dist < bestDist){
        bestDist = dist;
        best = target;
      }
    }

    if(best) hit(best, { source:'shoot' });
  }

  // IMPORTANT: attach AFTER functions exist (no TDZ)
  WIN.addEventListener('hha:shoot', onShoot);

  function isFarEnough(x, y, minD){
    const pts = state.recentPts;
    for(const p of pts){
      const d = Math.hypot(p.x - x, p.y - y);
      if(d < minD) return false;
    }
    return true;
  }

  function rememberPoint(x, y){
    state.recentPts.push({ x, y, t: now() });
    if(state.recentPts.length > recentPointsCap){
      state.recentPts.splice(0, state.recentPts.length - recentPointsCap);
    }
  }

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const size = Math.round(sizeRange[0] + rng() * (sizeRange[1] - sizeRange[0]));
    const pad = Math.max(10, Math.round(size * 0.55));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen && chosen.kind) ? String(chosen.kind) : 'good';

    // try a few times to avoid clump/corners
    let x = 0, y = 0;
    const minD = Math.max(40, Number(minDistPx) || 72);

    let ok = false;
    for(let i=0; i<10; i++){
      const xx = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
      const yy = rect.top  + pad + rng() * Math.max(1, (rect.h - pad*2));
      if(isFarEnough(xx, yy, minD)){
        x = xx; y = yy; ok = true; break;
      }
      x = xx; y = yy;
    }
    // even if not ok, still spawn at last candidate
    rememberPoint(x, y);

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // ✅ critical: ensure visible even if CSS forgot position
    el.style.position = 'absolute';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width  = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el,
      kind,
      bornAt: now(),
      ttlMs: (kind === 'junk') ? 1700 : 2100,
      groupIndex: Math.floor(rng() * 5), // 0..4
      size,
      rng,      // expose rng for deterministic emoji pick inside decorateTarget
      seed
    };

    // allow game to decorate (emoji/icon/etc)
    try{
      if(typeof decorateTarget === 'function'){
        decorateTarget(el, target);
      }
    }catch{}

    // tap hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // expire
    target._tmo = setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      state.targets.delete(target);
      removeTarget(target);
      try{
        onExpire({
          kind: target.kind,
          groupIndex: target.groupIndex,
          size: target.size,
          bornAt: target.bornAt,
          seed
        });
      }catch{}
    }, target.ttlMs);
  }

  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = now();
    if(t - state.lastSpawnAt >= spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  return {
    stop(){
      if(!state.alive) return;
      state.alive = false;

      try{ clearInterval(state.spawnTimer); }catch{}
      try{ WIN.removeEventListener('hha:shoot', onShoot); }catch{}

      for(const target of state.targets){
        removeTarget(target);
      }
      state.targets.clear();
      state.recentPts.length = 0;
    }
  };
}