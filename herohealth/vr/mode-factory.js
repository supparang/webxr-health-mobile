// === /herohealth/vr/mode-factory.js ===
// Mode Factory — PRODUCTION (HHA Standard)
// ✅ export boot()
// ✅ seeded RNG (deterministic)
// ✅ spawn targets in mount rect with safe margins via CSS vars
// ✅ input: tap (pointerdown) + crosshair shoot (hha:shoot {x,y,lockPx})
// ✅ decorateTarget(el,target) hook for emoji/icon UI
// ✅ stop(): clears timers, listeners, removes targets

'use strict';

const WIN = window;
const DOC = document;

/* ------------------------------------------------
 * RNG (seeded, deterministic)
 * ------------------------------------------------ */
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

/* ------------------------------------------------
 * Safe margins (read from :root CSS vars)
 * - you can set these in plate-vr.css (or each game)
 *   --plate-top-safe, --plate-bottom-safe, --plate-left-safe, --plate-right-safe
 * ------------------------------------------------ */
function readSafeVars(prefix = 'plate'){
  const cs = getComputedStyle(DOC.documentElement);
  const top    = parseFloat(cs.getPropertyValue(`--${prefix}-top-safe`))    || 0;
  const bottom = parseFloat(cs.getPropertyValue(`--${prefix}-bottom-safe`)) || 0;
  const left   = parseFloat(cs.getPropertyValue(`--${prefix}-left-safe`))   || 0;
  const right  = parseFloat(cs.getPropertyValue(`--${prefix}-right-safe`))  || 0;
  return { top, bottom, left, right };
}

function pickWeighted(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return { kind:'good', weight:1 };

  let sum = 0;
  for(const it of a) sum += (Number(it.weight) || 0) || 0;
  if(sum <= 0) return a[a.length-1];

  let x = rng() * sum;
  for(const it of a){
    x -= (Number(it.weight) || 0);
    if(x <= 0) return it;
  }
  return a[a.length-1];
}

/* ------------------------------------------------
 * Exported boot()
 * ------------------------------------------------ */
export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,
  sizeRange = [44, 64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,
  safePrefix = 'plate',      // allows reuse across games if you want
  cooldownMs = 90,           // shoot cooldown
  defaultLockPx = 28,        // aim assist radius
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    targets: new Set(),
    cooldownUntil: 0,
    // IMPORTANT: avoid “controller before init” by defining handler AFTER state init
    onShoot: null,
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
    if(!target) return;
    if(state.targets.has(target)) state.targets.delete(target);
    try{ target.el && target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;
    removeTarget(target);
    try{
      onHit({
        kind: target.kind,
        groupIndex: target.groupIndex,
        emoji: target.emoji || null,
        ...meta
      });
    }catch{}
  }

  // shoot handler (crosshair/tap-to-shoot)
  state.onShoot = function onShoot(e){
    if(!state.alive) return;
    const d = (e && e.detail) ? e.detail : {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + Number(cooldownMs || 0);

    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = Number(d.lockPx ?? defaultLockPx);

    if(!isFinite(x) || !isFinite(y) || !isFinite(lockPx)) return;

    // find closest target center within lockPx
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

    if(best){
      hit(best, { source:'shoot' });
    }else{
      // optional: report miss to game if needed (not required)
      // onHit({ kind:'miss', source:'shoot' })
    }
  };

  WIN.addEventListener('hha:shoot', state.onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const minS = Math.min(sizeRange[0], sizeRange[1]);
    const maxS = Math.max(sizeRange[0], sizeRange[1]);
    const size = Math.round(minS + rng() * (maxS - minS));

    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad * 2));
    const y = rect.top  + pad + rng() * Math.max(1, (rect.h - pad * 2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen && chosen.kind) ? String(chosen.kind) : 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // absolute placement on viewport
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
      groupIndex: Math.floor(rng() * 5), // game can override / reinterpret
      size,
      rng, // expose deterministic rng for emoji picks
      emoji: null
    };
    el.__hhaTarget = target;

    // allow game to decorate (emoji/icon/label)
    try{
      if(typeof decorateTarget === 'function'){
        decorateTarget(el, target);
      }
    }catch(_){}

    // tap hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // expire
    const ttl = Number(target.ttlMs) || 2000;
    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      removeTarget(target);
      try{ onExpire({ ...target }); }catch{}
    }, ttl);
  }

  // spawn loop
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
      state.spawnTimer = null;

      try{ WIN.removeEventListener('hha:shoot', state.onShoot); }catch{}

      for(const target of state.targets){
        try{ target.el && target.el.remove(); }catch{}
      }
      state.targets.clear();
    }
  };
}