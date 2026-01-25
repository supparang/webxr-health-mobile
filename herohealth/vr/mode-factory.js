// === /herohealth/vr/mode-factory.js ===
// HHA Spawn Factory — PRODUCTION (Stable)
// ✅ Export: boot()
// ✅ Supports: tap hit + crosshair/tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Safe spawn rect via CSS vars: --plate-top-safe/--plate-bottom-safe/--plate-left-safe/--plate-right-safe
// ✅ NEW: decorateTarget(el, target) callback (emoji/icon/UI)
// ✅ FIX: remove "controller before init" pattern (no controller var)

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
  const top    = parseFloat(cs.getPropertyValue(`--${prefix}-top-safe`))    || 0;
  const bottom = parseFloat(cs.getPropertyValue(`--${prefix}-bottom-safe`)) || 0;
  const left   = parseFloat(cs.getPropertyValue(`--${prefix}-left-safe`))   || 0;
  const right  = parseFloat(cs.getPropertyValue(`--${prefix}-right-safe`))  || 0;
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
 *  mount,
 *  seed,
 *  spawnRate,
 *  sizeRange,
 *  kinds: [{kind,weight}],
 *  onHit(targetMeta),
 *  onExpire(targetMeta),
 *  decorateTarget(el,target)  // NEW
 *  safePrefix: 'plate'        // reads --plate-*-safe
 * })
 */
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
  shootCooldownMs = 90,
  defaultLockPx = 28,
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);
  const state = {
    alive:true,
    lastSpawnAt:0,
    spawnTimer:null,
    targets:new Set(),
    cooldownUntil:0
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
    onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta });
  }

  function onShoot(e){
    if(!state.alive) return;
    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + shootCooldownMs;

    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx ?? defaultLockPx);
    if(!isFinite(x) || !isFinite(y)) return;

    let best=null, bestDist=Infinity;
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

    const size = Math.round(sizeRange[0] + rng() * (sizeRange[1] - sizeRange[0]));
    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top  + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, kinds);
    const kind = chosen.kind || 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el,
      kind,
      bornAt: now(),
      ttlMs: kind === 'junk' ? 1700 : 2100,
      groupIndex: Math.floor(rng() * 5),
      size,
      rng // for deterministic emoji pick
    };
    el.__hhaTarget = target;

    // NEW: decorate target (emoji/icon/UI)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(e){ console.warn('[mode-factory] decorateTarget error', e); }

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      state.targets.delete(target);
      try{ el.remove(); }catch{}
      onExpire({ ...target });
    }, target.ttlMs);
  }

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