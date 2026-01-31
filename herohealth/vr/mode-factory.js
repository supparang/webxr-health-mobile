// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — DOM Target Spawner (PRODUCTION)
// ✅ export { boot }
// ✅ FIX: "controller before init" (return controller after declared)
// ✅ FIX: targets must be position:absolute (otherwise may not render as expected)
// ✅ Supports: decorateTarget(el, target) for emoji/icon customization
// ✅ Supports: crosshair/tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ stop(): clears timers, removes listeners, removes all targets
//
// Notes:
// - This module is generic. Games can pass safeVarPrefix to respect safe-zone CSS vars.
//   Example: Plate uses --plate-top-safe/--plate-bottom-safe/--plate-left-safe/--plate-right-safe
// - Default prefix = 'plate' (safe for Plate). Other games should pass their own prefix.

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

function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

function clamp(v,a,b){
  v = Number(v)||0;
  return v < a ? a : (v > b ? b : v);
}

function readSafeVars(prefix='plate'){
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
  return a[a.length-1];
}

export function boot({
  mount,
  seed = Date.now(),

  // timing / sizing
  spawnRate = 900,
  sizeRange = [44,64],

  // spawn mix
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],

  // ttl by kind (ms)
  ttlMsGood = 2100,
  ttlMsJunk = 1700,

  // safe-zone css vars prefix (e.g., 'plate' uses --plate-*-safe)
  safeVarPrefix = 'plate',

  // interactions
  lockPxDefault = 28,
  shootCooldownMs = 90,

  // callbacks
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null, // (el, target) => void
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    targets: new Set(),
    cooldownUntil: 0,
    safePrefix: safeVarPrefix || 'plate'
  };

  function computeSpawnRect(){
    const r = mount.getBoundingClientRect();
    const safe = readSafeVars(state.safePrefix);

    const left = r.left + safe.left;
    const top = r.top + safe.top;
    const right = r.right - safe.right;
    const bottom = r.bottom - safe.bottom;

    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);
    return { left, top, right, bottom, w, h };
  }

  function removeTarget(target){
    try{ target.el?.remove?.(); }catch{}
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
        ttlMs: target.ttlMs,
        ...meta
      });
    }catch{}
  }

  function onShoot(e){
    if(!state.alive) return;

    const d = e.detail || {};
    const t = nowMs();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + shootCooldownMs;

    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = Number(d.lockPx || lockPxDefault);

    if(!isFinite(x) || !isFinite(y) || !isFinite(lockPx)) return;

    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      const r = target.el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(cx - x, cy - y);

      if(dist <= lockPx && dist < bestDist){
        bestDist = dist;
        best = target;
      }
    }

    if(best) hit(best, { source:'shoot' });
  }

  // listen to vr-ui crosshair shooting
  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const size = Math.round(sizeRange[0] + rng() * (sizeRange[1] - sizeRange[0]));
    const pad = Math.max(10, Math.round(size * 0.55));

    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad * 2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad * 2));

    const chosen = pickWeighted(rng, kinds);
    const kind = String(chosen.kind || 'good');

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // ✅ critical: absolute positioning
    el.style.position = 'absolute';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el,
      kind,
      bornAt: nowMs(),
      ttlMs: (kind === 'junk') ? ttlMsJunk : ttlMsGood,
      groupIndex: Math.floor(rng() * 5),
      size,
      rng // expose rng for deterministic emoji picks
    };

    el.__hhaTarget = target;

    // ✅ decorate hook (emoji/icon/label)
    try{
      if(typeof decorateTarget === 'function'){
        decorateTarget(el, target);
      }
    }catch{}

    // tap/click to hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // expire timer
    setTimeout(()=>{
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
          ttlMs: target.ttlMs
        });
      }catch{}
    }, target.ttlMs);
  }

  // spawn loop
  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;

    const t = nowMs();
    if(t - state.lastSpawnAt >= spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  // ✅ FIX: declare controller first, then return it (no "before init")
  const controller = {
    stop(){
      if(!state.alive) return;
      state.alive = false;

      try{ clearInterval(state.spawnTimer); }catch{}
      try{ WIN.removeEventListener('hha:shoot', onShoot); }catch{}

      for(const target of state.targets){
        removeTarget(target);
      }
      state.targets.clear();
    }
  };

  return controller;
}