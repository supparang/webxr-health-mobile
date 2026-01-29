// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — PRODUCTION (DOM targets spawner)
// ---------------------------------------------------
// ✅ Export: boot (named export)  <-- FIX for "does not provide export named boot"
// ✅ FIX: "controller before init" (no premature refs)
// ✅ Supports crosshair/tap-to-shoot via vr-ui.js event: hha:shoot {x,y,lockPx,source}
// ✅ Supports decorateTarget(el, target) to customize UI (emoji/icon/labels)
// ✅ Safe spawn rect via CSS vars (plate safe vars)
// ---------------------------------------------------

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
  try{ return performance.now(); }catch(_){ return Date.now(); }
}

function readSafeVars(){
  // Note: these vars can be set per-game in CSS
  // For Plate we use: --plate-top-safe / --plate-bottom-safe / --plate-left-safe / --plate-right-safe
  let cs;
  try{ cs = getComputedStyle(DOC.documentElement); }catch(_){ cs = null; }
  const top    = cs ? parseFloat(cs.getPropertyValue('--plate-top-safe'))    : 0;
  const bottom = cs ? parseFloat(cs.getPropertyValue('--plate-bottom-safe')) : 0;
  const left   = cs ? parseFloat(cs.getPropertyValue('--plate-left-safe'))   : 0;
  const right  = cs ? parseFloat(cs.getPropertyValue('--plate-right-safe'))  : 0;
  return {
    top:    isFinite(top)    ? top    : 0,
    bottom: isFinite(bottom) ? bottom : 0,
    left:   isFinite(left)   ? left   : 0,
    right:  isFinite(right)  ? right  : 0
  };
}

function pickWeighted(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return { kind:'good', weight:1 };

  let sum = 0;
  for(const it of a) sum += (Number(it.weight) || 1);

  let x = (rng() * sum);
  for(const it of a){
    x -= (Number(it.weight) || 1);
    if(x <= 0) return it;
  }
  return a[a.length-1];
}

export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,
  sizeRange = [44,64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,      // ✅ NEW: game can customize target UI
  cooldownMs = 90             // shoot cooldown
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
    const t = now();
    // micro-cache to avoid reflow storms
    if(state.rectCache && (t - state.rectCacheAt) < 120) return state.rectCache;

    const r = mount.getBoundingClientRect();
    const safe = readSafeVars();
    const left = r.left + safe.left;
    const top = r.top + safe.top;
    const right = r.right - safe.right;
    const bottom = r.bottom - safe.bottom;

    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);

    const rect = { left, top, right, bottom, w, h };
    state.rectCache = rect;
    state.rectCacheAt = t;
    return rect;
  }

  function removeTarget(target){
    if(!state.targets.has(target)) return;
    state.targets.delete(target);
    try{ target.el.remove(); }catch(_){}
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
    }catch(_){}
  }

  // ✅ shoot handler (crosshair lock)
  function onShoot(e){
    if(!state.alive) return;
    const d = e && e.detail ? e.detail : {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + (Number(cooldownMs) || 90);

    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx || 28);
    if(!isFinite(x) || !isFinite(y)) return;

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

  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const minS = Math.max(18, Number(sizeRange[0]) || 44);
    const maxS = Math.max(minS, Number(sizeRange[1]) || 64);
    const size = Math.round(minS + rng() * (maxS - minS));

    // padding to keep circles fully inside
    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top  + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen && chosen.kind) ? String(chosen.kind) : 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // position
    el.style.position = 'fixed';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width  = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el,
      kind,
      bornAt: now(),
      ttlMs: (kind === 'junk') ? 1700 : 2100,
      groupIndex: Math.floor(rng() * 5), // 0..4 (Plate maps to 1..5)
      size,
      rng // expose deterministic rng for emoji picks
    };
    el.__hhaTarget = target;

    // ✅ NEW decorate callback
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(err){
      // never break spawn because of decorate
      console.warn('[mode-factory] decorateTarget error', err);
    }

    // click/tap
    el.addEventListener('pointerdown', (ev)=>{
      try{ ev.preventDefault(); }catch(_){}
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // expire
    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      removeTarget(target);
      try{ onExpire({ ...target, source:'expire' }); }catch(_){}
    }, target.ttlMs);
  }

  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = now();
    const rate = Math.max(160, Number(spawnRate) || 900);
    if(t - state.lastSpawnAt >= rate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  return Object.freeze({
    stop(){
      if(!state.alive) return;
      state.alive = false;
      clearInterval(state.spawnTimer);
      WIN.removeEventListener('hha:shoot', onShoot);
      for(const target of state.targets){
        try{ target.el.remove(); }catch(_){}
      }
      state.targets.clear();
    }
  });
}