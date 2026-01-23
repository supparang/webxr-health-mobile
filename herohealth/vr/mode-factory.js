// =========================================================
// === /herohealth/vr/mode-factory.js ===
// Mode Factory — SPAWNER (PRODUCTION) — PATCH
// ✅ Deterministic RNG by seed
// ✅ Spawns DOM targets into mount rect with SAFE inset vars
// ✅ Tap/click hit + Crosshair shoot hit via event "hha:shoot"
// ✅ Callbacks: onHit, onExpire, decorateTarget
// ✅ PATCH: fix "controller before initialization" by removing
//          any premature references; clean state/api.
// =========================================================

'use strict';

const WIN = window;
const DOC = document;

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
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
  return arr[arr.length-1];
}

function readSafeVars(prefix){
  // e.g. prefix="plate" => --plate-top-safe, --plate-bottom-safe ...
  // fallback => 0
  const cs = getComputedStyle(DOC.documentElement);
  const p = (prefix || 'plate').trim();

  const top    = parseFloat(cs.getPropertyValue(`--${p}-top-safe`)) || 0;
  const bottom = parseFloat(cs.getPropertyValue(`--${p}-bottom-safe`)) || 0;
  const left   = parseFloat(cs.getPropertyValue(`--${p}-left-safe`)) || 0;
  const right  = parseFloat(cs.getPropertyValue(`--${p}-right-safe`)) || 0;

  return { top, bottom, left, right };
}

// ---------------------------------------------------------
// Exported boot
// ---------------------------------------------------------
export function boot({
  mount,
  seed = Date.now(),
  safeVarPrefix = 'plate',

  spawnRate = 900,        // ms between spawns (approx)
  sizeRange = [44, 64],   // px
  kinds = [
    { kind:'good', weight:0.7 },
    { kind:'junk', weight:0.3 },
  ],

  ttlGoodMs = 2100,
  ttlJunkMs = 1700,

  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,

  shootCooldownMs = 90,
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    lastSpawnAt: 0,
    tickTimer: null,
    targets: new Set(),
    cooldownUntil: 0,
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
    if(!state.targets.has(target)) return;
    state.targets.delete(target);
    try{ target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;

    removeTarget(target);
    try{
      onHit({
        kind: target.kind,
        groupIndex: target.groupIndex,
        size: target.size,
        bornAt: target.bornAt,
        ...meta
      });
    }catch{}
  }

  function onShoot(ev){
    if(!state.alive) return;

    const d = ev?.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + Number(shootCooldownMs || 90);

    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx || 28);
    if(!isFinite(x) || !isFinite(y)) return;

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

    if(best) hit(best, { source:'shoot' });
  }

  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const minS = Number(sizeRange?.[0] ?? 44);
    const maxS = Number(sizeRange?.[1] ?? 64);
    const size = Math.round(minS + rng() * Math.max(1, (maxS - minS)));

    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top  + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, kinds || []);
    const kind = (chosen?.kind || 'good');

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    el.style.position = 'fixed';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el,
      kind,
      bornAt: now(),
      ttlMs: (kind === 'junk') ? Number(ttlJunkMs||1700) : Number(ttlGoodMs||2100),
      groupIndex: Math.floor(rng() * 5),
      size,
      rng, // expose rng for deterministic emoji picks
    };

    el.__hhaTarget = target;

    // ✅ allow game to decorate target (emoji/icon)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch{}

    // tap/click hit
    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // expire
    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;

      removeTarget(target);
      try{ onExpire({ ...target }); }catch{}
    }, target.ttlMs);
  }

  // tick loop
  state.tickTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = now();
    if(t - state.lastSpawnAt >= spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  // return controller-like api (no early ref bugs)
  return {
    stop(){
      if(!state.alive) return;
      state.alive = false;

      clearInterval(state.tickTimer);
      state.tickTimer = null;

      WIN.removeEventListener('hha:shoot', onShoot);

      for(const target of state.targets){
        try{ target.el.remove(); }catch{}
      }
      state.targets.clear();
    }
  };
}