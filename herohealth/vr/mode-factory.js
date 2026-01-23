// === /herohealth/vr/mode-factory.js ===
// Mode Factory — SPAWN ENGINE (PRODUCTION)
// ✅ Named export: boot()
// ✅ Supports: tap/click + crosshair shoot (hha:shoot)
// ✅ Supports: decorateTarget(el, target)
// ✅ Safe spawn rect via CSS vars: --{prefix}-top-safe/... etc
// ✅ Basic anti-overlap spawning
// NOTE: Designed for Plate/Groups/Hydration style DOM targets

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
  return (performance && performance.now) ? performance.now() : Date.now();
}

function pickWeighted(rng, arr){
  let sum = 0;
  for(const it of arr) sum += (it.weight ?? 1);
  let x = rng() * sum;
  for(const it of arr){
    x -= (it.weight ?? 1);
    if(x <= 0) return it;
  }
  return arr[arr.length - 1];
}

function readSafeVars(prefix){
  const cs = getComputedStyle(DOC.documentElement);
  const p = (prefix || 'plate').trim();
  const top    = parseFloat(cs.getPropertyValue(`--${p}-top-safe`))    || 0;
  const bottom = parseFloat(cs.getPropertyValue(`--${p}-bottom-safe`)) || 0;
  const left   = parseFloat(cs.getPropertyValue(`--${p}-left-safe`))   || 0;
  const right  = parseFloat(cs.getPropertyValue(`--${p}-right-safe`))  || 0;
  return { top, bottom, left, right };
}

export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,
  sizeRange = [44, 64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,

  // extras
  safePrefix = 'plate',    // uses --plate-top-safe ... etc
  lockPx = 28,             // shoot lock radius (fallback if event doesn't include)
  shootCooldownMs = 90,    // fire rate limit
  minDistPx = 10,          // extra spacing between targets (approx)
  spawnAttempts = 10,      // try N times to find non-overlap spot
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    lastSpawnAt: 0,
    timer: null,
    targets: new Set(),
    cooldownUntil: 0
  };

  function computeSpawnRect(){
    const r = mount.getBoundingClientRect();
    const safe = readSafeVars(safePrefix);

    const left   = r.left + safe.left;
    const top    = r.top + safe.top;
    const right  = r.right - safe.right;
    const bottom = r.bottom - safe.bottom;

    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);
    return { left, top, right, bottom, w, h };
  }

  function isOverlapping(x, y, rad){
    // basic circle overlap vs existing targets
    for(const t of state.targets){
      const dx = (t.x - x);
      const dy = (t.y - y);
      const dist = Math.hypot(dx, dy);
      if(dist < (t.radius + rad + minDistPx)) return true;
    }
    return false;
  }

  function destroyTarget(target){
    if(!target) return;
    state.targets.delete(target);
    try{ target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;
    destroyTarget(target);
    onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta });
  }

  function onShoot(e){
    if(!state.alive) return;
    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;

    const cd = Number(d.cooldownMs ?? shootCooldownMs) || shootCooldownMs;
    state.cooldownUntil = t + cd;

    const x = Number(d.x);
    const y = Number(d.y);
    const lock = Number(d.lockPx ?? lockPx) || lockPx;
    if(!isFinite(x) || !isFinite(y)) return;

    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      // quick distance using stored center
      const dist = Math.hypot(target.x - x, target.y - y);
      if(dist <= lock && dist < bestDist){
        bestDist = dist;
        best = target;
      }
    }
    if(best) hit(best, { source:'shoot' });
  }

  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const size = Math.round(sizeRange[0] + rng() * (sizeRange[1] - sizeRange[0]));
    const rad = size / 2;

    const pad = Math.max(10, Math.round(size * 0.55));
    const wAvail = Math.max(1, rect.w - pad*2);
    const hAvail = Math.max(1, rect.h - pad*2);

    let x = rect.left + pad + rng() * wAvail;
    let y = rect.top  + pad + rng() * hAvail;

    // try to avoid overlap
    for(let i=0; i<spawnAttempts; i++){
      if(!isOverlapping(x, y, rad)) break;
      x = rect.left + pad + rng() * wAvail;
      y = rect.top  + pad + rng() * hAvail;
    }

    const chosen = pickWeighted(rng, kinds);
    const kind = chosen.kind || 'good';

    const el = DOC.createElement('div');
    // IMPORTANT: ensure absolute so it shows even if CSS forgets position
    el.style.position = 'absolute';
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // center-based positioning
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
      groupIndex: Math.floor(rng() * 5),

      // cached center for shoot distance
      x, y,
      radius: rad,

      // expose rng for deterministic emoji picks (decorateTarget)
      rng
    };

    el.__hhaTarget = target;

    // ✅ NEW: allow game to decorate target (emoji/icon)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(err){
      console.warn('[mode-factory] decorateTarget error', err);
    }

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      destroyTarget(target);
      onExpire({ ...target });
    }, target.ttlMs);
  }

  // main loop
  state.timer = setInterval(()=>{
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
      clearInterval(state.timer);
      WIN.removeEventListener('hha:shoot', onShoot);
      for(const t of state.targets){
        try{ t.el.remove(); }catch{}
      }
      state.targets.clear();
    }
  };
}