// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory (2D spawn on DOM layer) — SAFE — PRODUCTION v20260215a
// ✅ seeded RNG
// ✅ respects HUD-safe spawn vars (supports BOTH --hw-* and legacy --plate-*)
// ✅ decorateTarget(el, target) hook kept
// ✅ listens hha:shoot {x,y,lockPx} (from vr-ui.js crosshair)
// ✅ NEW: onShotMiss({x,y,lockPx,source}) when shoot didn't lock any target

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

// Read safe zone vars from :root
// Prefer --hw-* (HHA Standard) but fallback to legacy --plate-*
function readSafeVars(){
  const cs = getComputedStyle(DOC.documentElement);

  const read = (name)=> parseFloat(cs.getPropertyValue(name)) || 0;

  // HHA standard
  const topHW = read('--hw-top-safe');
  const botHW = read('--hw-bottom-safe');
  const lefHW = read('--hw-left-safe');
  const rigHW = read('--hw-right-safe');

  // legacy plate vars (older builds)
  const topPL = read('--plate-top-safe');
  const botPL = read('--plate-bottom-safe');
  const lefPL = read('--plate-left-safe');
  const rigPL = read('--plate-right-safe');

  return {
    top:   topHW || topPL || 0,
    bottom:botHW || botPL || 0,
    left:  lefHW || lefPL || 0,
    right: rigHW || rigPL || 0
  };
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
  onShotMiss = ()=>{},          // ✅ NEW
  decorateTarget = null,
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
    const safe = readSafeVars();

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
      onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta });
    }catch{}
  }

  function onShoot(e){
    if(!state.alive) return;

    const d = e.detail || {};
    const t = now();

    // cooldown (anti double-fire)
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + 90;

    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx || 28);

    if(!isFinite(x) || !isFinite(y)) return;

    let best = null, bestDist = Infinity;

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

    if(best){
      hit(best, { source:'shoot' });
    }else{
      // ✅ ยิงแล้วไม่โดนอะไร
      try{
        onShotMiss({ x, y, lockPx, source:'shoot' });
      }catch{}
    }
  }

  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const size = Math.round(sizeRange[0] + rng() * (sizeRange[1]-sizeRange[0]));
    const pad = Math.max(10, Math.round(size * 0.55));

    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad*2));

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
      groupIndex: Math.floor(rng()*5),
      size,
      rng
    };

    // attach (optional debug)
    el.__hhaTarget = target;

    // allow caller decorate (set emoji/labels/etc.)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch{}

    // direct tap hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // expiry
    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;

      state.targets.delete(target);
      try{ el.remove(); }catch{}

      try{ onExpire({ ...target }); }catch{}
    }, target.ttlMs);
  }

  // tick spawner
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
      try{ WIN.removeEventListener('hha:shoot', onShoot); }catch{}

      for(const target of state.targets){
        try{ target.el.remove(); }catch{}
      }
      state.targets.clear();
    }
  };
}
