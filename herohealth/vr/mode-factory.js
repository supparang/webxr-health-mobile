// === /herohealth/vr/mode-factory.js ===
// PRODUCTION (HHA Standard)
// ✅ deterministic rng
// ✅ decorateTarget(el,target)
// ✅ boss HP support (hp>1 => keep until hp=0)
// ✅ spawnCustom() for patterns (storm/boss scripted)
// ✅ getStats() for AI predictor
// ✅ NEW: className support in spawnCustom

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

function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

function readSafeVars(prefix='--plate-'){
  const cs = getComputedStyle(DOC.documentElement);
  const top = parseFloat(cs.getPropertyValue(prefix + 'top-safe')) || 0;
  const bottom = parseFloat(cs.getPropertyValue(prefix + 'bottom-safe')) || 0;
  const left = parseFloat(cs.getPropertyValue(prefix + 'left-safe')) || 0;
  const right = parseFloat(cs.getPropertyValue(prefix + 'right-safe')) || 0;
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
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,
  cooldownMs = 90,
  safePrefix = '--plate-',
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);
  const state = {
    alive:true,
    lastSpawnAt:0,
    spawnTimer:null,
    targets:new Set(),
    cooldownUntil:0,
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
    state.targets.delete(target);
    try{ target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;

    if((target.hp|0) > 1){
      target.hp = (target.hp|0) - 1;
      try{
        target.el.dataset.hp = String(target.hp);
        target.el.classList.add('hp-hit');
        setTimeout(()=>target.el && target.el.classList && target.el.classList.remove('hp-hit'), 120);
      }catch{}
      onHit({ kind: target.kind, groupIndex: target.groupIndex, hpLeft: target.hp, partial:true, ...meta });
      return;
    }

    removeTarget(target);
    onHit({ kind: target.kind, groupIndex: target.groupIndex, hpLeft: 0, partial:false, ...meta });
  }

  function onShoot(e){
    if(!state.alive) return;
    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + (Number(cooldownMs)||90);

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

  function spawnAt(cx, cy, opts={}){
    if(!state.alive) return null;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return null;

    const kind = String(opts.kind || 'good');
    const size = Math.round(Number(opts.size || (sizeRange[0] + rng() * (sizeRange[1]-sizeRange[0]))));
    const ttlMs = Math.round(Number(opts.ttlMs ?? (kind === 'junk' ? 1700 : 2100)));
    const hp = Math.max(1, Math.round(Number(opts.hp || 1)));
    const className = String(opts.className || '').trim();

    const pad = Math.max(10, Math.round(size * 0.55));
    const x = Math.min(rect.right - pad, Math.max(rect.left + pad, cx));
    const y = Math.min(rect.bottom - pad, Math.max(rect.top + pad, cy));

    const el = DOC.createElement('div');
    el.className = 'plateTarget' + (className ? ` ${className}` : '');
    el.dataset.kind = kind;
    if(hp > 1) el.dataset.hp = String(hp);

    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el,
      kind,
      bornAt: now(),
      ttlMs,
      groupIndex: (opts.groupIndex != null) ? Number(opts.groupIndex) : Math.floor(rng()*5),
      size,
      rng,
      hp
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
    }, ttlMs);

    return target;
  }

  function spawnOne(){
    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const chosen = pickWeighted(rng, kinds);
    const kind = chosen.kind || 'good';

    const size = Math.round(sizeRange[0] + rng() * (sizeRange[1]-sizeRange[0]));
    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad*2));

    const ttlMs = (chosen.ttlMs != null) ? Number(chosen.ttlMs) : (kind === 'junk' ? 1700 : 2100);
    const hp = (chosen.hp != null) ? Number(chosen.hp) : 1;

    spawnAt(x, y, { kind, size, ttlMs, hp });
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
      for(const target of state.targets){ try{ target.el.remove(); }catch{} }
      state.targets.clear();
    },
    spawnCustom({ x, y, kind='good', size=null, ttlMs=null, groupIndex=null, hp=1, className='' }){
      return spawnAt(Number(x), Number(y), { kind, size, ttlMs, groupIndex, hp, className });
    },
    getStats(){
      return {
        alive: state.alive,
        activeCount: state.targets.size,
        cooldownUntil: state.cooldownUntil
      };
    },
    computeSpawnRect,
    rng
  };
}