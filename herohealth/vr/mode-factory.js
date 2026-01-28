// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — PRODUCTION (DOM spawner)
// ------------------------------------------------------------
// ✅ EXPORT: boot(...)
// ✅ FIX: no "controller before init"
// ✅ Supports: decorateTarget(el, target)
// ✅ Supports: hha:shoot (crosshair/tap-to-shoot from vr-ui.js)
// ✅ Safe stop(): remove listeners + clear timers + remove targets
// ------------------------------------------------------------

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

function nowMs(){
  try{ return performance.now(); }catch(_){ return Date.now(); }
}

function clamp(v,a,b){
  v = Number(v)||0;
  return v<a?a:(v>b?b:v);
}

function readSafeVars(prefix='--plate'){
  // expected vars:
  // --plate-top-safe / --plate-bottom-safe / --plate-left-safe / --plate-right-safe
  const cs = getComputedStyle(DOC.documentElement);
  const top    = parseFloat(cs.getPropertyValue(`${prefix}-top-safe`))    || 0;
  const bottom = parseFloat(cs.getPropertyValue(`${prefix}-bottom-safe`)) || 0;
  const left   = parseFloat(cs.getPropertyValue(`${prefix}-left-safe`))   || 0;
  const right  = parseFloat(cs.getPropertyValue(`${prefix}-right-safe`))  || 0;
  return { top, bottom, left, right };
}

function pickWeighted(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return { kind:'good', weight:1 };

  let sum = 0;
  for(const it of a) sum += (Number(it.weight) || 0) > 0 ? Number(it.weight) : 0;
  if(sum <= 0) return a[a.length-1];

  let x = rng() * sum;
  for(const it of a){
    x -= (Number(it.weight) || 0);
    if(x <= 0) return it;
  }
  return a[a.length-1];
}

/**
 * boot({
 *   mount,
 *   seed,
 *   spawnRate,
 *   sizeRange,
 *   kinds,
 *   onHit,
 *   onExpire,
 *   decorateTarget, // (el, target) => void
 *   safeVarPrefix,  // default '--plate'
 *   ttlGoodMs,      // optional override
 *   ttlJunkMs       // optional override
 * })
 */
export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,
  sizeRange = [44,64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,

  safeVarPrefix = '--plate',
  ttlGoodMs = 2100,
  ttlJunkMs = 1700,

  shootCooldownMs = 90,
  shootDefaultLockPx = 28
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  // --- internal state ---
  const state = {
    alive: true,
    targets: new Set(),
    spawnTimer: null,
    lastSpawnAt: 0,
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

  function removeTarget(target){
    try{ target?.el?.remove?.(); }catch(_){}
    state.targets.delete(target);
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;

    removeTarget(target);
    try{
      onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta });
    }catch(err){
      console.error('[mode-factory] onHit error', err);
    }
  }

  // ✅ FIX: define handler AFTER functions exist; no controller-before-init nonsense
  function onShoot(ev){
    if(!state.alive) return;

    const d = ev?.detail || {};
    const t = nowMs();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + shootCooldownMs;

    const x = Number(d.x), y = Number(d.y);
    const lockPx = clamp(Number(d.lockPx ?? shootDefaultLockPx), 6, 120);
    if(!isFinite(x) || !isFinite(y)) return;

    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      const el = target.el;
      if(!el) continue;
      const r = el.getBoundingClientRect();
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

    const minS = Math.max(18, Number(sizeRange?.[0] ?? 44));
    const maxS = Math.max(minS, Number(sizeRange?.[1] ?? 64));
    const size = Math.round(minS + rng() * (maxS - minS));

    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen?.kind || 'good');

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // positioned at center
    el.style.position = 'fixed';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width  = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el,
      kind,
      bornAt: nowMs(),
      ttlMs: (kind === 'junk') ? Number(ttlJunkMs) : Number(ttlGoodMs),
      groupIndex: Math.floor(rng() * 5), // 0..4
      size,
      rng
    };
    el.__hhaTarget = target;

    // ✅ decorate target UI (emoji/icon)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(err){
      console.warn('[mode-factory] decorateTarget error', err);
    }

    el.addEventListener('pointerdown', (e)=>{
      if(!state.alive) return;
      e.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // ttl expiry
    const ttl = clamp(target.ttlMs, 250, 15000);
    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      removeTarget(target);
      try{ onExpire({ kind: target.kind, groupIndex: target.groupIndex, ...target }); }catch(err){
        console.error('[mode-factory] onExpire error', err);
      }
    }, ttl);
  }

  // spawn scheduler (lightweight)
  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = nowMs();
    if(t - state.lastSpawnAt >= spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  return {
    stop(){
      if(!state.alive) return;
      state.alive = false;

      try{ clearInterval(state.spawnTimer); }catch(_){}
      state.spawnTimer = null;

      WIN.removeEventListener('hha:shoot', onShoot);

      for(const target of state.targets){
        try{ target?.el?.remove?.(); }catch(_){}
      }
      state.targets.clear();
    }
  };
}