// === /herohealth/vr/mode-factory.js ===
// Universal DOM Spawner (HHA) — PRODUCTION (PATCHED)
// ----------------------------------------------------
// ✅ ESM export: boot()
// ✅ FIX: no "controller before init" (no TDZ / no premature refs)
// ✅ Supports decorateTarget(el, target) for emoji/icon UI
// ✅ Supports shooting via vr-ui.js event: hha:shoot {x,y,lockPx,source}
// ✅ Aim-assist: pick nearest target within lockPx
// ✅ stop(): removes listeners, clears timers & timeouts, removes targets
// ✅ Safe spawn rect uses CSS vars (prefers --hha-*-safe, fallback --plate-*-safe)
// ----------------------------------------------------

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
  return (WIN.performance && performance.now) ? performance.now() : Date.now();
}

function clamp(v,a,b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

// Read safe-area playfield margins from CSS variables.
// Prefer generic HHA vars; fallback to plate vars (for backward compatibility).
function readSafeVars(){
  const cs = getComputedStyle(DOC.documentElement);

  const read = (name)=>{
    const n = parseFloat(cs.getPropertyValue(name));
    return Number.isFinite(n) ? n : 0;
  };

  const top = read('--hha-top-safe')    || read('--plate-top-safe')    || 0;
  const bottom = read('--hha-bottom-safe') || read('--plate-bottom-safe') || 0;
  const left = read('--hha-left-safe')  || read('--plate-left-safe')  || 0;
  const right = read('--hha-right-safe') || read('--plate-right-safe') || 0;

  return { top, bottom, left, right };
}

function pickWeighted(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return { kind:'good', weight:1 };

  let sum = 0;
  for(const it of a) sum += (Number(it.weight) || 0) > 0 ? Number(it.weight) : 0;
  if(sum <= 0) return a[a.length - 1];

  let x = rng() * sum;
  for(const it of a){
    x -= (Number(it.weight) || 0) > 0 ? Number(it.weight) : 0;
    if(x <= 0) return it;
  }
  return a[a.length - 1];
}

/**
 * boot()
 * @param {Object} opt
 * @param {HTMLElement} opt.mount
 * @param {number} [opt.seed]
 * @param {number} [opt.spawnRate]  ms between spawns (approx)
 * @param {[number,number]} [opt.sizeRange]
 * @param {Array<{kind:string,weight:number}>} [opt.kinds]
 * @param {Function} [opt.onHit]    ({kind,groupIndex,source,...})
 * @param {Function} [opt.onExpire] ({kind,groupIndex,...})
 * @param {Function} [opt.decorateTarget] (el,target)=>void
 * @param {number} [opt.cooldownMs] shoot cooldown
 * @param {number} [opt.tickMs]     internal tick
 */
export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,
  sizeRange = [44, 64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,
  cooldownMs = 90,
  tickMs = 60
} = {}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    targets: new Set(),
    cooldownUntil: 0
  };

  function computeSpawnRect(){
    const r = mount.getBoundingClientRect();
    const safe = readSafeVars();

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
    if(target._to) clearTimeout(target._to);
    try{ target.el.remove(); }catch{}
    state.targets.delete(target);
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;

    removeTarget(target);
    try{
      onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta });
    }catch(err){
      console.warn('[mode-factory] onHit error', err);
    }
  }

  function expire(target){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;

    removeTarget(target);
    try{
      onExpire({ kind: target.kind, groupIndex: target.groupIndex, size: target.size });
    }catch(err){
      console.warn('[mode-factory] onExpire error', err);
    }
  }

  // --- shooting support (from vr-ui.js) ---
  function onShoot(ev){
    if(!state.alive) return;

    const d = ev && ev.detail ? ev.detail : {};
    const t = now();

    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + (Number(cooldownMs) || 90);

    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx || 28);

    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    // Find nearest target center within lock radius
    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      const rr = target.el.getBoundingClientRect();
      const cx = rr.left + rr.width/2;
      const cy = rr.top + rr.height/2;
      const dist = Math.hypot(cx - x, cy - y);

      if(dist <= lockPx && dist < bestDist){
        bestDist = dist;
        best = target;
      }
    }

    if(best) hit(best, { source: d.source || 'shoot' });
  }

  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 90 || rect.h < 90) return;

    const minS = Math.max(10, Number(sizeRange?.[0]) || 44);
    const maxS = Math.max(minS, Number(sizeRange?.[1]) || 64);

    const size = Math.round(minS + rng() * (maxS - minS));

    // keep away from edges by padding (prevents clipping)
    const pad = Math.max(10, Math.round(size * 0.55));

    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad * 2));
    const y = rect.top  + pad + rng() * Math.max(1, (rect.h - pad * 2));

    const chosen = pickWeighted(rng, kinds);
    const kind = String(chosen.kind || 'good');

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // IMPORTANT: ensure element positions even if CSS forgets
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
      groupIndex: Math.floor(rng() * 5), // 0..4 (game can map to 1..5)
      size,
      rng // expose deterministic RNG for emoji pick etc.
    };

    el.__hhaTarget = target;

    // decorate (emoji/icon etc.)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(err){
      console.warn('[mode-factory] decorateTarget error', err);
    }

    el.addEventListener('pointerdown', (pev)=>{
      try{ pev.preventDefault(); }catch{}
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // TTL
    target._to = setTimeout(()=>expire(target), target.ttlMs);
  }

  // lightweight scheduler
  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = now();
    if(t - state.lastSpawnAt >= spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, Math.max(16, Number(tickMs) || 60));

  return {
    stop(){
      if(!state.alive) return;
      state.alive = false;

      clearInterval(state.spawnTimer);
      WIN.removeEventListener('hha:shoot', onShoot);

      for(const target of Array.from(state.targets)){
        removeTarget(target);
      }
      state.targets.clear();
    }
  };
}