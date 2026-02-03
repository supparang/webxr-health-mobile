// === /herohealth/vr/mode-factory.js ===
// Mode Factory — PRODUCTION (SAFE)
// ✅ Export: boot()
// ✅ Spawns DOM targets into mount
// ✅ Tap hit + Crosshair shoot hit (hha:shoot)
// ✅ Aim-assist lockPx (pick nearest target within radius)
// ✅ PATCH: decorateTarget(el,target) callback
// ✅ FIX: "controller before init" (no early refs)
// ✅ stop(): clears timers/listeners/targets hard

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

function clamp(v,a,b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function readSafeVars(){
  // generic safe vars; can be set by game CSS per page
  const cs = getComputedStyle(DOC.documentElement);

  // NOTE: keep legacy plate vars (works for Plate) but safe for other games too
  const top = parseFloat(cs.getPropertyValue('--plate-top-safe')) || 0;
  const bottom = parseFloat(cs.getPropertyValue('--plate-bottom-safe')) || 0;
  const left = parseFloat(cs.getPropertyValue('--plate-left-safe')) || 0;
  const right = parseFloat(cs.getPropertyValue('--plate-right-safe')) || 0;

  return { top, bottom, left, right };
}

function pickWeighted(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return { kind:'good', weight:1 };

  let sum = 0;
  for(const it of a) sum += Number(it.weight ?? 1) || 0;

  if(sum <= 0) return a[a.length - 1];

  let x = rng() * sum;
  for(const it of a){
    x -= (Number(it.weight ?? 1) || 0);
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
  decorateTarget = null, // ✅ NEW
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    targets: new Set(),
    cooldownUntil: 0,
    // keep options snapshot (useful for debug)
    opts: { spawnRate, sizeRange, kinds }
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

  function removeTarget(target){
    if(!target) return;
    if(!state.targets.has(target)) return;
    state.targets.delete(target);
    try{ target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;
    removeTarget(target);
    try{ onHit({ kind: target.kind, groupIndex: target.groupIndex, groupId: target.groupId, ...meta }); }catch{}
  }

  function onShoot(e){
    if(!state.alive) return;

    const d = e.detail || {};
    const tNow = now();

    // local cooldown (can still be overridden by vr-ui cooldown)
    if(tNow < state.cooldownUntil) return;
    state.cooldownUntil = tNow + 90;

    const x = Number(d.x), y = Number(d.y);
    const lockPx = clamp(d.lockPx ?? 28, 6, 140);
    if(!isFinite(x) || !isFinite(y)) return;

    // find nearest target center within lockPx
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

    if(best) hit(best, { source:'shoot', x, y, lockPx });
  }

  // ✅ FIX: listener bound AFTER function is declared (no early ref)
  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const minS = clamp(sizeRange[0], 28, 220);
    const maxS = clamp(sizeRange[1], minS, 280);
    const size = Math.round(minS + rng() * (maxS - minS));

    // keep away from edges
    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad * 2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad * 2));

    const chosen = pickWeighted(rng, kinds);
    const kind = String(chosen.kind || 'good');

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // absolutely positioned bubble target (centered at x,y)
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
      ttlMs: (kind === 'junk') ? 1700 : 2100,
      // default group index (game may override via decorateTarget)
      groupIndex: Math.floor(rng() * 5),
      groupId: null,
      size,
      rng // expose deterministic rng for emoji picks
    };

    // back-reference (optional debug)
    el.__hhaTarget = target;

    // ✅ NEW: game customization hook (emoji/icon/label/group assignment)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch{}

    // tap/click hit
    el.addEventListener('pointerdown', (ev)=>{
      if(!state.alive) return;
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    // mount + register
    mount.appendChild(el);
    state.targets.add(target);

    // expire by ttl
    const ttl = clamp(target.ttlMs, 250, 12000);
    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      removeTarget(target);
      try{ onExpire({ ...target }); }catch{}
    }, ttl);
  }

  // tick loop (stable; uses spawnRate distance)
  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const tNow = now();
    if(tNow - state.lastSpawnAt >= Number(spawnRate || 0)){
      state.lastSpawnAt = tNow;
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