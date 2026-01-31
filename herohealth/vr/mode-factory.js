// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — DOM Target Spawner (PRODUCTION)
// ✅ export: boot(...)
// ✅ FIX: no "controller before init" (order-safe)
// ✅ Supports: decorateTarget(el, target)
// ✅ Supports: hha:shoot {x,y,lockPx} from vr-ui.js (crosshair / tap-to-shoot)
// ✅ stop(): clears interval + removes listeners + removes DOM + clears timeouts
//
// Notes:
// - Reads spawn safe margins from CSS vars:
//   --plate-top-safe / --plate-bottom-safe / --plate-left-safe / --plate-right-safe
// - Targets are DOM elements appended to mount.

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

function readSafeVars(prefix='plate'){
  // expects: --plate-top-safe, --plate-bottom-safe, --plate-left-safe, --plate-right-safe
  const cs = getComputedStyle(DOC.documentElement);
  const top = parseFloat(cs.getPropertyValue(`--${prefix}-top-safe`)) || 0;
  const bottom = parseFloat(cs.getPropertyValue(`--${prefix}-bottom-safe`)) || 0;
  const left = parseFloat(cs.getPropertyValue(`--${prefix}-left-safe`)) || 0;
  const right = parseFloat(cs.getPropertyValue(`--${prefix}-right-safe`)) || 0;
  return { top, bottom, left, right };
}

function pickWeighted(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return { kind:'good', weight:1 };

  let sum = 0;
  for(const it of a) sum += (it.weight ?? 1);

  let x = rng() * sum;
  for(const it of a){
    x -= (it.weight ?? 1);
    if(x <= 0) return it;
  }
  return a[a.length - 1];
}

export function boot({
  mount,
  seed = Date.now(),

  // spawn tuning
  spawnRate = 900,         // ms between spawns (soft; controlled by tick)
  sizeRange = [44, 64],    // px

  // kinds
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],

  // callbacks
  onHit = ()=>{},
  onExpire = ()=>{},

  // ✅ new
  decorateTarget = null,

  // optional: safe var prefix
  safePrefix = 'plate',

  // shoot tuning
  shootCooldownMs = 90,
}){
  if(!DOC || !WIN) throw new Error('mode-factory: DOM missing');
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    lastSpawnAt: 0,
    timer: null,
    cooldownUntil: 0,
    targets: new Set(),
    timeouts: new Set(),
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
    try{ target.el?.remove(); }catch{}
    state.targets.delete(target);
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
        ttlMs: target.ttlMs,
        ...meta
      });
    }catch{}
  }

  function onShoot(e){
    if(!state.alive) return;
    const d = e?.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + shootCooldownMs;

    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx || 28);
    if(!isFinite(x) || !isFinite(y) || !isFinite(lockPx)) return;

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

  // ✅ listen to crosshair shooting from vr-ui.js
  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const minS = Math.min(sizeRange[0], sizeRange[1]);
    const maxS = Math.max(sizeRange[0], sizeRange[1]);
    const size = Math.round(minS + rng() * (maxS - minS));

    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen.kind || 'good');

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // position
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el,
      kind,
      bornAt: now(),
      ttlMs: (kind === 'junk') ? 1700 : 2100,
      groupIndex: Math.floor(rng() * 5),
      size,
      rng, // expose rng for deterministic emoji pick
    };

    el.__hhaTarget = target;

    // ✅ decorate hook (emoji/icon/etc.)
    try{
      if(typeof decorateTarget === 'function'){
        decorateTarget(el, target);
      }
    }catch{}

    // tap/click hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // expire
    const to = setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;

      removeTarget(target);
      try{
        onExpire({
          kind: target.kind,
          groupIndex: target.groupIndex,
          size: target.size,
          bornAt: target.bornAt,
          ttlMs: target.ttlMs,
        });
      }catch{}
    }, target.ttlMs);

    state.timeouts.add(to);
  }

  // tick loop (keeps timing stable even if tab throttles)
  state.timer = setInterval(()=>{
    if(!state.alive) return;

    const t = now();
    if(t - state.lastSpawnAt >= spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  // controller (created AFTER functions => no TDZ issues)
  const controller = {
    stop(){
      if(!state.alive) return;
      state.alive = false;

      clearInterval(state.timer);
      WIN.removeEventListener('hha:shoot', onShoot);

      for(const to of state.timeouts) clearTimeout(to);
      state.timeouts.clear();

      for(const target of state.targets){
        try{ target.el.remove(); }catch{}
      }
      state.targets.clear();
    }
  };

  return controller;
}