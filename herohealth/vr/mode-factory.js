// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — TARGET SPAWNER (PRODUCTION PATCH)
// ✅ export named: boot  (ESM)
// ✅ Spawn targets in safe rect using CSS vars: --{safePrefix}-top-safe/... (fallbacks)
// ✅ Pointer tap hit
// ✅ Crosshair/tap-to-shoot hit via vr-ui.js event: hha:shoot {x,y,lockPx,source}
// ✅ decorateTarget(el, target) callback for emoji/icon UI
// ✅ No XR controller hoist bug (fix: no "controller" referenced before init)

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

function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

function numCssVar(name, fallback=0){
  try{
    const cs = getComputedStyle(DOC.documentElement);
    const v = parseFloat(cs.getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  }catch{
    return fallback;
  }
}

function readSafeVars(safePrefix='plate'){
  // Primary: --{prefix}-top-safe etc.
  const top    = numCssVar(`--${safePrefix}-top-safe`,    NaN);
  const bottom = numCssVar(`--${safePrefix}-bottom-safe`, NaN);
  const left   = numCssVar(`--${safePrefix}-left-safe`,   NaN);
  const right  = numCssVar(`--${safePrefix}-right-safe`,  NaN);

  // Fallbacks: --hha-*, then safe-area insets
  const sat = numCssVar('--sat', 0);
  const sab = numCssVar('--sab', 0);
  const sal = numCssVar('--sal', 0);
  const sar = numCssVar('--sar', 0);

  return {
    top:    Number.isFinite(top)    ? top    : (numCssVar('--hha-top-safe',    sat) || sat),
    bottom: Number.isFinite(bottom) ? bottom : (numCssVar('--hha-bottom-safe', sab) || sab),
    left:   Number.isFinite(left)   ? left   : (numCssVar('--hha-left-safe',   sal) || sal),
    right:  Number.isFinite(right)  ? right  : (numCssVar('--hha-right-safe',  sar) || sar),
  };
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

function clamp(n,a,b){
  n = Number(n)||0;
  return n<a ? a : (n>b ? b : n);
}

export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,
  sizeRange = [44,64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  safePrefix = 'plate',        // ✅ NEW: CSS safe vars prefix
  cooldownMs = 90,             // hha:shoot cooldown
  lockPxDefault = 28,          // default aim-assist radius for hha:shoot
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,       // ✅ NEW: (el, target)=>void
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive:true,
    lastSpawnAt:0,
    spawnTimer:null,
    targets:new Set(),
    cooldownUntil:0,
    onShootBound:null,
  };

  function computeSpawnRect(){
    const r = mount.getBoundingClientRect();
    const safe = readSafeVars(safePrefix);

    const left = r.left + safe.left;
    const top = r.top + safe.top;
    const right = r.right - safe.right;
    const bottom = r.bottom - safe.bottom;

    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);

    return { left, top, right, bottom, w, h };
  }

  function removeTarget(target){
    if(!state.targets.has(target)) return;
    state.targets.delete(target);
    try{ target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;
    removeTarget(target);
    onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta });
  }

  function onShoot(e){
    if(!state.alive) return;
    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;

    state.cooldownUntil = t + cooldownMs;

    const x = Number(d.x), y = Number(d.y);
    const lockPx = clamp(d.lockPx ?? lockPxDefault, 8, 120);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      const r = target.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dist = Math.hypot(cx - x, cy - y);

      if(dist <= lockPx && dist < bestDist){
        bestDist = dist;
        best = target;
      }
    }

    if(best) hit(best, { source: d.source || 'shoot' });
  }

  // bind once (no controller hoist bug)
  state.onShootBound = onShoot;
  WIN.addEventListener('hha:shoot', state.onShootBound);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const minS = Math.min(sizeRange[0], sizeRange[1]);
    const maxS = Math.max(sizeRange[0], sizeRange[1]);
    const size = Math.round(minS + rng() * (maxS - minS));

    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top  + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen.kind || 'good').toLowerCase();

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el,
      kind,
      bornAt: now(),
      ttlMs: kind === 'junk' ? 1700 : 2100,
      groupIndex: Math.floor(rng()*5),
      size,
      rng,          // expose rng (deterministic emoji picks)
      seed,
      safePrefix,
    };

    el.__hhaTarget = target;

    // ✅ allow UI customization (emoji/icon/ring/badge)
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
      removeTarget(target);
      onExpire({ ...target });
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

      clearInterval(state.spawnTimer);
      WIN.removeEventListener('hha:shoot', state.onShootBound);

      for(const target of state.targets){
        try{ target.el.remove(); }catch{}
      }
      state.targets.clear();
    }
  };
}