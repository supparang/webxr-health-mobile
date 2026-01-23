// === /herohealth/vr/mode-factory.js ===
// Mode Factory (Spawner) — PRODUCTION PATCH A4
// ✅ export boot()
// ✅ Fix: Cannot access 'controller' before initialization (init order safe)
// ✅ Crosshair shoot: listens hha:shoot {x,y,lockPx}
// ✅ Tap/click: pointerdown on target
// ✅ Safe spawn rect via CSS vars: --plate-top-safe/--plate-bottom-safe/--plate-left-safe/--plate-right-safe
// ✅ NEW: decorateTarget(el, target) callback for emoji/icon skinning
//
// Target object passed to callbacks:
// { el, kind, bornAt, ttlMs, groupIndex, size, rng }
//
// Notes:
// - mount must be a DOM element (playfield layer)
// - This module is deterministic per seed (rng attached to target)

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

function readSafeVars(prefix='plate'){
  const cs = getComputedStyle(DOC.documentElement);
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
  return arr[arr.length-1];
}

function safeNum(v, d=0){
  v = Number(v);
  return Number.isFinite(v) ? v : d;
}

export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,          // ms per spawn (rough)
  sizeRange = [44, 64],     // px
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,    // (el, target)=>void
  safeVarPrefix = 'plate',  // allow reuse for other games: 'gj', 'groups', etc.
  cooldownMs = 90,          // shoot cooldown
  defaultTtlMsGood = 2100,
  defaultTtlMsJunk = 1700
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  // ---- internal state ----
  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    targets: new Set(),
    cooldownUntil: 0
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

  function cleanupTarget(target){
    if(!target) return;
    state.targets.delete(target);
    try{ target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;
    cleanupTarget(target);
    try{
      onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta });
    }catch{}
  }

  // ✅ Safe init: define handler AFTER all refs exist
  function onShoot(e){
    if(!state.alive) return;

    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + cooldownMs;

    const x = safeNum(d.x, NaN);
    const y = safeNum(d.y, NaN);
    const lockPx = safeNum(d.lockPx, 28);

    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

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

  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const s0 = Math.min(sizeRange[0], sizeRange[1]);
    const s1 = Math.max(sizeRange[0], sizeRange[1]);
    const size = Math.round(s0 + rng() * (s1 - s0));

    // padding keeps targets away from edges
    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad * 2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad * 2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen && chosen.kind) ? chosen.kind : 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // ✅ IMPORTANT: position fixed so it appears regardless of mount positioning
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
      ttlMs: (kind === 'junk') ? defaultTtlMsJunk : defaultTtlMsGood,
      groupIndex: Math.floor(rng() * 5),
      size,
      rng
    };

    el.__hhaTarget = target;

    // ✅ NEW: let game decorate (emoji/icon)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(err){
      // decoration should never break spawn
      console.warn('[mode-factory] decorateTarget error', err);
    }

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // TTL expiry
    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      cleanupTarget(target);
      try{ onExpire({ ...target }); }catch{}
    }, target.ttlMs);
  }

  // spawn loop (lightweight)
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
      WIN.removeEventListener('hha:shoot', onShoot);

      for(const target of state.targets){
        try{ target.el.remove(); }catch{}
      }
      state.targets.clear();
    }
  };
}