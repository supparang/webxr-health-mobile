// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — DOM Target Spawner (PRODUCTION)
// ✅ Named export: boot(...)  (FIX: export exists)
// ✅ FIX: “Cannot access 'controller' before initialization”
// ✅ Supports: decorateTarget(el, target)
// ✅ Supports: tap hit + crosshair/tap-to-shoot via vr-ui.js => event hha:shoot {x,y,lockPx,source}
// ✅ Safe-area spawn rect via CSS vars (plate-safe vars) with fallbacks
// ✅ Robust stop(): remove listener + clear timers + remove all targets
//
// Usage (Plate):
//   import { boot as spawnBoot } from '../vr/mode-factory.js';
//   const spawner = spawnBoot({ mount, seed, spawnRate, kinds, onHit, onExpire, decorateTarget });
//   ...
//   spawner.stop();

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

function num(v, d=0){
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : d;
}

/**
 * Read safe-area spawn padding vars.
 * Primary for Plate: --plate-top-safe/--plate-bottom-safe/--plate-left-safe/--plate-right-safe
 * Fallback: --hha-top-safe/... (if you reuse for other games)
 */
function readSafeVars(){
  const cs = getComputedStyle(DOC.documentElement);

  const top =
    num(cs.getPropertyValue('--plate-top-safe')) ||
    num(cs.getPropertyValue('--hha-top-safe')) || 0;

  const bottom =
    num(cs.getPropertyValue('--plate-bottom-safe')) ||
    num(cs.getPropertyValue('--hha-bottom-safe')) || 0;

  const left =
    num(cs.getPropertyValue('--plate-left-safe')) ||
    num(cs.getPropertyValue('--hha-left-safe')) || 0;

  const right =
    num(cs.getPropertyValue('--plate-right-safe')) ||
    num(cs.getPropertyValue('--hha-right-safe')) || 0;

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

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

export function boot({
  mount,
  seed = Date.now(),

  // spawn pacing
  spawnRate = 900,             // ms (average)
  jitterMs = 0,                // optional random jitter added to spawnRate

  // target size
  sizeRange = [44, 64],

  // weighted kinds
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],

  // callbacks
  onHit = ()=>{},
  onExpire = ()=>{},

  // NEW: customize target UI (emoji/icon)
  decorateTarget = null,

  // shoot assist
  shootCooldownMs = 90,
  defaultLockPx = 28,

  // lifetime
  ttlGoodMs = 2100,
  ttlJunkMs = 1700,

  // anti-clump sampling
  spawnTries = 6,
  minSpacingPx = 26,
} = {}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    spawnTimer: null,
    targets: new Set(),
    cooldownUntil: 0,
    lastSpawnAt: 0,
  };

  // ✅ FIX “controller before init”: create controller early; methods reference state safely.
  const controller = {
    stop(){
      if(!state.alive) return;
      state.alive = false;
      try{ clearInterval(state.spawnTimer); }catch(_){}
      try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
      for(const t of state.targets){
        try{ t._ttl && clearTimeout(t._ttl); }catch(_){}
        try{ t.el && t.el.remove(); }catch(_){}
      }
      state.targets.clear();
    }
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

  function dist(a, b){
    const dx = (a.x - b.x);
    const dy = (a.y - b.y);
    return Math.hypot(dx, dy);
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;

    state.targets.delete(target);
    try{ target._ttl && clearTimeout(target._ttl); }catch(_){}
    try{ target.el.remove(); }catch(_){}

    try{
      onHit({
        kind: target.kind,
        groupIndex: target.groupIndex,
        size: target.size,
        bornAt: target.bornAt,
        ttlMs: target.ttlMs,
        ...meta
      });
    }catch(_){}
  }

  function onShoot(e){
    if(!state.alive) return;

    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + shootCooldownMs;

    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = clamp(Number(d.lockPx || defaultLockPx), 8, 220);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      const r = target.el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dd = Math.hypot(cx - x, cy - y);
      if(dd <= lockPx && dd < bestDist){
        bestDist = dd;
        best = target;
      }
    }

    if(best) hit(best, { source:'shoot', x, y, lockPx });
  }

  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 90 || rect.h < 90) return;

    const minS = Math.min(sizeRange[0], sizeRange[1]);
    const maxS = Math.max(sizeRange[0], sizeRange[1]);
    const size = Math.round(minS + rng() * (maxS - minS));

    // padding so target isn't clipped
    const pad = Math.max(10, Math.round(size * 0.55));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen.kind || 'good');

    // sample position to avoid edges/clumps a bit
    let pos = null;
    for(let i=0; i<Math.max(1, spawnTries); i++){
      const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
      const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad*2));
      const cand = { x, y };

      // simple spacing: avoid spawning too close to existing centers
      let ok = true;
      for(const t of state.targets){
        const r = t.el.getBoundingClientRect();
        const cx = r.left + r.width/2;
        const cy = r.top + r.height/2;
        if(dist(cand, {x:cx,y:cy}) < (minSpacingPx + Math.min(size, r.width)*0.35)){
          ok = false; break;
        }
      }
      if(ok){ pos = cand; break; }
      if(!pos) pos = cand; // fallback to last cand
    }

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // IMPORTANT: Use fixed because we spawn in viewport coords from getBoundingClientRect()
    el.style.position = 'fixed';
    el.style.left = `${Math.round(pos.x)}px`;
    el.style.top  = `${Math.round(pos.y)}px`;
    el.style.width  = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el,
      kind,
      size,
      bornAt: now(),
      ttlMs: (kind === 'junk') ? ttlJunkMs : ttlGoodMs,
      groupIndex: Math.floor(rng() * 5), // 0..4 (game can map to 1..5)
      rng
    };
    el.__hhaTarget = target;

    // ✅ NEW: decorate target (emoji/icon etc.)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(_){}

    el.addEventListener('pointerdown', (ev)=>{
      if(!state.alive) return;
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // TTL expire
    target._ttl = setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      state.targets.delete(target);
      try{ el.remove(); }catch(_){}
      try{
        onExpire({
          kind: target.kind,
          groupIndex: target.groupIndex,
          size: target.size,
          bornAt: target.bornAt,
          ttlMs: target.ttlMs
        });
      }catch(_){}
    }, target.ttlMs);
  }

  // spawn loop (low-cost tick)
  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;

    const t = now();
    const rate = Math.max(120, Number(spawnRate) || 900);
    const jitter = Math.max(0, Number(jitterMs) || 0);
    const want = rate + (jitter ? Math.round((rng()*2-1)*jitter) : 0);

    if(t - state.lastSpawnAt >= want){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  return controller;
}