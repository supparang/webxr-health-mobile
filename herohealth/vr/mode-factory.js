// === /herohealth/vr/mode-factory.js ===
// PRODUCTION: spawn factory for DOM targets
// ✅ export boot
// ✅ decorateTarget(el, target)
// ✅ nextTarget({rng, params, rect, tNow}) -> {kind, groupIndex, ttlMs, size, x, y}
// ✅ controller.setParams({...}) for AI Difficulty Director
// ✅ supports multi kinds: good/junk/star/shield (any string)

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

function now(){ return performance.now ? performance.now() : Date.now(); }

function readSafeVars(prefix='--plate'){
  const cs = getComputedStyle(DOC.documentElement);
  const top = parseFloat(cs.getPropertyValue(`${prefix}-top-safe`)) || 0;
  const bottom = parseFloat(cs.getPropertyValue(`${prefix}-bottom-safe`)) || 0;
  const left = parseFloat(cs.getPropertyValue(`${prefix}-left-safe`)) || 0;
  const right = parseFloat(cs.getPropertyValue(`${prefix}-right-safe`)) || 0;
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

export function boot({
  mount,
  seed = Date.now(),

  spawnRate = 900,
  sizeRange = [44,64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],

  ttlMsGood = 2100,
  ttlMsJunk = 1700,

  cooldownMs = 90,

  safePrefix = '--plate',

  onHit = ()=>{},
  onExpire = ()=>{},

  decorateTarget = null,
  nextTarget = null, // ✅ NEW: pattern generator hook
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const params = {
    spawnRate:Number(spawnRate)||900,
    sizeRange:Array.isArray(sizeRange)? sizeRange.slice(0,2) : [44,64],
    kinds:Array.isArray(kinds)? kinds.slice() : [{kind:'good',weight:.7},{kind:'junk',weight:.3}],
    ttlMsGood:Number(ttlMsGood)||2100,
    ttlMsJunk:Number(ttlMsJunk)||1700,
    cooldownMs:Number(cooldownMs)||90,
    safePrefix:String(safePrefix||'--plate')
  };

  const state = {
    alive:true,
    lastSpawnAt:0,
    spawnTimer:null,
    targets:new Set(),
    cooldownUntil:0,
  };

  function computeSpawnRect(){
    const r = mount.getBoundingClientRect();
    const safe = readSafeVars(params.safePrefix);
    const left = r.left + safe.left;
    const top = r.top + safe.top;
    const right = r.right - safe.right;
    const bottom = r.bottom - safe.bottom;
    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);
    return { left, top, right, bottom, w, h };
  }

  function removeTarget(target){
    state.targets.delete(target);
    try{ target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;
    removeTarget(target);
    onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta });
  }

  function onShoot(e){
    if(!state.alive) return;
    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + params.cooldownMs;

    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx || 28);
    if(!isFinite(x) || !isFinite(y)) return;

    let best=null, bestDist=Infinity;
    for(const target of state.targets){
      const r = target.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dist = Math.hypot(cx-x, cy-y);
      if(dist <= lockPx && dist < bestDist){ bestDist = dist; best = target; }
    }
    if(best) hit(best, { source:'shoot' });
  }

  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    // defaults
    let size = Math.round(params.sizeRange[0] + rng() * (params.sizeRange[1]-params.sizeRange[0]));
    let chosen = pickWeighted(rng, params.kinds);
    let kind = (chosen && chosen.kind) ? chosen.kind : 'good';
    let groupIndex = Math.floor(rng()*5);

    let ttlMs =
      (kind === 'junk') ? params.ttlMsJunk :
      (kind === 'good') ? params.ttlMsGood :
      1800;

    // position
    const pad = Math.max(10, Math.round(size * 0.55));
    let x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    let y = rect.top + pad + rng() * Math.max(1, (rect.h - pad*2));

    // ✅ pattern hook can override
    if(typeof nextTarget === 'function'){
      try{
        const ov = nextTarget({ rng, params, rect, tNow: now() }) || null;
        if(ov){
          if(ov.kind) kind = String(ov.kind);
          if(Number.isFinite(ov.groupIndex)) groupIndex = Math.max(0, Math.min(4, Number(ov.groupIndex)));
          if(Number.isFinite(ov.ttlMs)) ttlMs = Math.max(400, Number(ov.ttlMs));
          if(Number.isFinite(ov.size)) size = Math.max(22, Number(ov.size));
          if(Number.isFinite(ov.x)) x = Number(ov.x);
          if(Number.isFinite(ov.y)) y = Number(ov.y);
        }
      }catch{}
    }

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${Math.round(size)}px`;
    el.style.height = `${Math.round(size)}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el, kind,
      bornAt: now(),
      ttlMs,
      groupIndex,
      size,
      rng
    };
    el.__hhaTarget = target;

    try{ if(typeof decorateTarget === 'function') decorateTarget(el, target); }catch{}

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      removeTarget(target);
      onExpire({ ...target });
    }, target.ttlMs);
  }

  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = now();
    if(t - state.lastSpawnAt >= params.spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  const controller = {
    stop(){
      if(!state.alive) return;
      state.alive = false;
      clearInterval(state.spawnTimer);
      WIN.removeEventListener('hha:shoot', onShoot);
      for(const target of state.targets){ try{ target.el.remove(); }catch{} }
      state.targets.clear();
    },
    setParams(patch={}){
      if(!patch || typeof patch !== 'object') return;
      if(patch.spawnRate != null) params.spawnRate = Math.max(120, Number(patch.spawnRate)||params.spawnRate);
      if(Array.isArray(patch.sizeRange) && patch.sizeRange.length>=2) params.sizeRange = patch.sizeRange.slice(0,2);
      if(Array.isArray(patch.kinds) && patch.kinds.length) params.kinds = patch.kinds.slice();
      if(patch.ttlMsGood != null) params.ttlMsGood = Math.max(300, Number(patch.ttlMsGood)||params.ttlMsGood);
      if(patch.ttlMsJunk != null) params.ttlMsJunk = Math.max(300, Number(patch.ttlMsJunk)||params.ttlMsJunk);
      if(patch.cooldownMs != null) params.cooldownMs = Math.max(10, Number(patch.cooldownMs)||params.cooldownMs);
      if(patch.safePrefix != null) params.safePrefix = String(patch.safePrefix||params.safePrefix);
    },
    getParams(){ return { ...params }; }
  };

  return controller;
}