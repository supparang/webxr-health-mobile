// === /herohealth/vr/mode-factory.js ===
// Mode Factory — PRODUCTION PATCH
// ✅ Exports: boot()
// ✅ Spawns DOM targets within mount rect (safe-area aware)
// ✅ Supports tap + crosshair shoot via hha:shoot
// ✅ decorateTarget(el, target) hook for emoji/icon skins
// ✅ Fixes: "controller before initialization" by design (no such pattern)

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

function readSafeVars(prefix='plate'){
  const cs = getComputedStyle(DOC.documentElement);
  // expected vars:
  // --{prefix}-top-safe, --{prefix}-bottom-safe, --{prefix}-left-safe, --{prefix}-right-safe
  const top = parseFloat(cs.getPropertyValue(`--${prefix}-top-safe`)) || 0;
  const bottom = parseFloat(cs.getPropertyValue(`--${prefix}-bottom-safe`)) || 0;
  const left = parseFloat(cs.getPropertyValue(`--${prefix}-left-safe`)) || 0;
  const right = parseFloat(cs.getPropertyValue(`--${prefix}-right-safe`)) || 0;
  return { top, bottom, left, right };
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

/**
 * boot({
 *   mount: HTMLElement,
 *   seed?: number,
 *   safePrefix?: string, // default 'plate'
 *   spawnRate?: number,  // ms between spawns (approx)
 *   sizeRange?: [min,max],
 *   kinds?: [{kind,weight}],
 *   cooldownMs?: number, // shoot debounce
 *   lockPx?: number,     // aim assist radius default (if event doesn't supply)
 *   onHit?: (t)=>void,
 *   onExpire?: (t)=>void,
 *   decorateTarget?: (el,target)=>void,
 * })
 */
export function boot({
  mount,
  seed = Date.now(),
  safePrefix = 'plate',

  spawnRate = 900,
  sizeRange = [44,64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],

  cooldownMs = 90,
  lockPx = 28,

  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    targets: new Set(),
    cooldownUntil: 0,
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

  function destroyTarget(target){
    state.targets.delete(target);
    try{ target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;
    destroyTarget(target);
    try{
      onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta });
    }catch{}
  }

  function onShoot(e){
    if(!state.alive) return;

    const tNow = now();
    if(tNow < state.cooldownUntil) return;
    state.cooldownUntil = tNow + Number(cooldownMs || 90);

    const d = e.detail || {};
    const x = Number(d.x), y = Number(d.y);
    const lp = Number(d.lockPx ?? lockPx ?? 28);

    if(!isFinite(x) || !isFinite(y)) return;

    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      const r = target.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dist = Math.hypot(cx - x, cy - y);
      if(dist <= lp && dist < bestDist){
        bestDist = dist;
        best = target;
      }
    }

    if(best) hit(best, { source: 'shoot' });
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
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen && chosen.kind) ? chosen.kind : 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // NOTE: CSS must have .plateTarget{ position:absolute; }
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
      rng,        // expose deterministic rng to decorateTarget if needed
      seed,       // expose seed (optional)
    };

    el.__hhaTarget = target;

    // ✅ decorate hook (emoji/icon)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch{}

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source: 'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      destroyTarget(target);
      try{ onExpire({ ...target }); }catch{}
    }, target.ttlMs);
  }

  // soft-loop spawner (stable even if tab lags)
  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = now();
    if(t - state.lastSpawnAt >= spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  // ✅ controller object (declared AFTER all functions) — no TDZ risk
  const controller = {
    stop(){
      if(!state.alive) return;
      state.alive = false;

      clearInterval(state.spawnTimer);
      WIN.removeEventListener('hha:shoot', onShoot);

      for(const target of state.targets){
        try{ target.el.remove(); }catch{}
      }
      state.targets.clear();
    }
  };

  return controller;
}