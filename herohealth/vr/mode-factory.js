// === /herohealth/vr/mode-factory.js ===
// HHA Spawn Mode Factory — PRODUCTION
// ✅ Export: boot (named export)  -> import { boot as spawnBoot } ...
// ✅ FIX: "controller before init" (no self-reference before creation)
// ✅ Supports: decorateTarget(el, target) for emoji/icon UI
// ✅ Supports: tap hit + crosshair shoot hit via vr-ui.js event "hha:shoot"
// ✅ Deterministic: seeded RNG inside spawner
// ✅ Safe-area rect: reads CSS vars (fallback 0) for "top/bottom/left/right safe padding"

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
  try{ return performance.now(); }catch(_){ return Date.now(); }
}

function readSafeVars(){
  // allow each game to define its own safe vars; here we read Plate vars by default
  // If vars are not set -> 0
  const cs = getComputedStyle(DOC.documentElement);

  const top = parseFloat(cs.getPropertyValue('--plate-top-safe')) || 0;
  const bottom = parseFloat(cs.getPropertyValue('--plate-bottom-safe')) || 0;
  const left = parseFloat(cs.getPropertyValue('--plate-left-safe')) || 0;
  const right = parseFloat(cs.getPropertyValue('--plate-right-safe')) || 0;

  return { top, bottom, left, right };
}

function pickWeighted(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return { kind:'good', weight:1 };

  let sum = 0;
  for(const it of a) sum += (Number(it.weight) || 1);

  let x = rng() * sum;
  for(const it of a){
    x -= (Number(it.weight) || 1);
    if(x <= 0) return it;
  }
  return a[a.length - 1];
}

export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,                  // ms between spawns (soft)
  sizeRange = [44, 64],             // px
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],

  onHit = ()=>{},
  onExpire = ()=>{},

  decorateTarget = null,            // (el, target)=>{}  ✅ NEW
  cooldownMs = 90,                  // shoot cooldown
  lockPxDefault = 28,               // aim assist radius
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    targets: new Set(),
    cooldownUntil: 0,
    rectCache: null,
    rectCacheAt: 0
  };

  function computeSpawnRect(){
    // cache a little to reduce layout thrash
    const t = now();
    if(state.rectCache && (t - state.rectCacheAt) < 180) return state.rectCache;

    const r = mount.getBoundingClientRect();
    const safe = readSafeVars();

    const left = r.left + safe.left;
    const top = r.top + safe.top;
    const right = r.right - safe.right;
    const bottom = r.bottom - safe.bottom;

    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);

    state.rectCache = { left, top, right, bottom, w, h };
    state.rectCacheAt = t;
    return state.rectCache;
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
    try{ onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta }); }catch{}
  }

  function onShoot(e){
    if(!state.alive) return;

    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + (Number(d.cooldownMs) || cooldownMs);

    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = Number(d.lockPx || lockPxDefault);

    if(!isFinite(x) || !isFinite(y)) return;

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

  // listen crosshair/tap-to-shoot from vr-ui.js
  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const minS = Math.min(sizeRange[0], sizeRange[1]);
    const maxS = Math.max(sizeRange[0], sizeRange[1]);
    const size = Math.round(minS + rng() * (maxS - minS));

    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad * 2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad * 2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen && chosen.kind) ? String(chosen.kind) : 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // absolute-in-viewport positioning (works with fixed playfield layer)
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
      ttlMs: (kind === 'junk') ? 1700 : 2100,
      groupIndex: Math.floor(rng() * 5), // 0..4 (convert to 1..5 in game if needed)
      size,
      rng // expose rng so decorateTarget can do deterministic emoji
    };

    el.__hhaTarget = target;

    // ✅ allow game to decorate target (emoji/icon)
    try{
      if(typeof decorateTarget === 'function'){
        decorateTarget(el, target);
      }
    }catch(err){
      console.warn('[mode-factory] decorateTarget error', err);
    }

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // expire
    WIN.setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      removeTarget(target);
      try{ onExpire({ ...target }); }catch{}
    }, target.ttlMs);
  }

  // spawn loop (soft rate)
  state.spawnTimer = WIN.setInterval(()=>{
    if(!state.alive) return;
    const t = now();
    if(t - state.lastSpawnAt >= spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  // ✅ return controller (no self reference)
  return {
    stop(){
      if(!state.alive) return;
      state.alive = false;

      try{ WIN.removeEventListener('hha:shoot', onShoot); }catch{}
      try{ clearInterval(state.spawnTimer); }catch{}

      for(const target of state.targets){
        try{ target.el.remove(); }catch{}
      }
      state.targets.clear();
    }
  };
}