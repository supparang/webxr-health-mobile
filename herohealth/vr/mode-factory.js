// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — PRODUCTION
// ✅ export boot (named)
// ✅ FIX: "controller before init" (controller declared before closures use it)
// ✅ Supports decorateTarget(el,target)
// ✅ Supports shooting via vr-ui.js: window event 'hha:shoot' {x,y,lockPx,source}
// ✅ stop(): clears intervals, listeners, removes targets, prevents late TTL removals
//
// Notes:
// - Designed for DOM targets spawned in a "mount" layer (position:fixed or absolute full screen)
// - Uses CSS safe vars: --<safePrefix>-top-safe/left-safe/right-safe/bottom-safe
//   default safePrefix='plate' (so it reads --plate-top-safe ...)

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

function clamp(v, a, b){
  v = Number(v) || 0;
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
  return a[a.length - 1];
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
  safePrefix = 'plate',
  ttlGoodMs = 2100,
  ttlJunkMs = 1700,
  cooldownMs = 90,
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  // ---- controller MUST be declared before any closure references it (fix "before init")
  const controller = {
    stop(){ /* overwritten below */ }
  };

  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    targets: new Set(),
    cooldownUntil: 0
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

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;

    state.targets.delete(target);
    try{ target.el.remove(); }catch{}

    try{
      onHit({
        kind: target.kind,
        groupIndex: target.groupIndex,
        size: target.size,
        bornAt: target.bornAt,
        ttlMs: target.ttlMs,
        ...meta
      });
    }catch(err){
      console.error('[mode-factory] onHit error', err);
    }
  }

  function onShoot(e){
    if(!state.alive) return;

    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + Number(cooldownMs || 90);

    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx || 28);
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

    if(best) hit(best, { source: d.source || 'shoot', x, y, lockPx });
  }

  // listen once per controller instance
  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    // too small => skip
    if(rect.w < 90 || rect.h < 90) return;

    const minS = Math.max(18, Number(sizeRange?.[0] ?? 44));
    const maxS = Math.max(minS, Number(sizeRange?.[1] ?? 64));
    const size = Math.round(minS + rng() * (maxS - minS));

    // keep away from edges a bit
    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad * 2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad * 2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen && chosen.kind) ? String(chosen.kind) : 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // ✅ IMPORTANT: ensure it's actually placed (CSS may not set position)
    el.style.position = 'absolute';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el,
      kind,
      bornAt: now(),
      ttlMs: (kind === 'junk') ? Number(ttlJunkMs || 1700) : Number(ttlGoodMs || 2100),
      groupIndex: Math.floor(rng() * 5),
      size,
      rng // expose deterministic rng for emoji picks
    };

    // allow external decoration (emoji/icon, label, data-attrs)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(err){
      console.error('[mode-factory] decorateTarget error', err);
    }

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // TTL expiration
    const ttl = clamp(target.ttlMs, 250, 20000);
    setTimeout(()=>{
      // stop() may have been called
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      state.targets.delete(target);
      try{ el.remove(); }catch{}
      try{
        onExpire({ ...target });
      }catch(err){
        console.error('[mode-factory] onExpire error', err);
      }
    }, ttl);
  }

  // spawn loop
  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = now();
    if(t - state.lastSpawnAt >= Number(spawnRate || 900)){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  // finalize controller.stop now that everything exists
  controller.stop = function stop(){
    if(!state.alive) return;
    state.alive = false;

    try{ clearInterval(state.spawnTimer); }catch{}
    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch{}

    // remove all targets
    for(const target of state.targets){
      try{ target.el.remove(); }catch{}
    }
    state.targets.clear();
  };

  return controller;
}