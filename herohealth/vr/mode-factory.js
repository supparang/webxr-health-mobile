// === /herohealth/vr/mode-factory.js ===
// Mode Factory — PRODUCTION (HHA Standard)
// ✅ FIX: export named "boot" (for `import { boot as spawnBoot } ...`)
// ✅ FIX: no "controller before initialization"
// ✅ Supports: decorateTarget(el, target)
// ✅ Supports: tap + crosshair shoot via event "hha:shoot"
// ✅ Safe spawn padding via CSS vars: --<safePrefix>-top-safe/bottom/left/right (default safePrefix="plate")

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

function readSafeVars(prefix){
  const p = String(prefix || 'plate').trim() || 'plate';
  const cs = getComputedStyle(DOC.documentElement);

  const top    = parseFloat(cs.getPropertyValue(`--${p}-top-safe`)) || 0;
  const bottom = parseFloat(cs.getPropertyValue(`--${p}-bottom-safe`)) || 0;
  const left   = parseFloat(cs.getPropertyValue(`--${p}-left-safe`)) || 0;
  const right  = parseFloat(cs.getPropertyValue(`--${p}-right-safe`)) || 0;

  return { top, bottom, left, right };
}

function pickWeighted(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return { kind:'good', weight:1 };

  let sum = 0;
  for(const it of a) sum += (Number(it.weight) || 1);

  let x = rng() * sum;
  for(const it of a){
    x -= (Number(it.weight) || 1);
    if(x <= 0) return it;
  }
  return a[a.length - 1];
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
  safePrefix = 'plate',        // ✅ NEW (default for Plate)
  cooldownMs = 90,             // shoot cooldown
  lockPxDefault = 28           // lock radius default
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  // ---- internal state ----
  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    targets: new Set(),
    cooldownUntil: 0,
    safePrefix: safePrefix || 'plate'
  };

  function computeSpawnRect(){
    const r = mount.getBoundingClientRect();
    const safe = readSafeVars(state.safePrefix);

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
    if(state.targets.has(target)) state.targets.delete(target);
    try{ target.el && target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;
    removeTarget(target);
    try{
      onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta });
    }catch{}
  }

  // ✅ crosshair shoot handler (mobile/cVR) from vr-ui.js
  function onShoot(e){
    if(!state.alive) return;

    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + (Number(d.cooldownMs) || cooldownMs || 90);

    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx || lockPxDefault || 28);

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

    const minS = Number(sizeRange?.[0] ?? 44);
    const maxS = Number(sizeRange?.[1] ?? 64);
    const size = Math.round(minS + rng() * Math.max(1, (maxS - minS)));

    // pad กันไปชิดขอบ
    const pad = Math.max(10, Math.round(size * 0.55));

    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen && chosen.kind) ? String(chosen.kind) : 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // ✅ make sure it actually positions
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
      groupIndex: Math.floor(rng() * 5),
      size,
      rng // expose deterministic rng to decorateTarget
    };
    el.__hhaTarget = target;

    // ✅ decorate hook (emoji/icon/label)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(err){
      console.warn('[mode-factory] decorateTarget error', err);
    }

    // tap/click hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // expire
    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      removeTarget(target);
      try{ onExpire({ ...target }); }catch{}
    }, target.ttlMs);
  }

  // ✅ spawn loop
  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = now();
    if(t - state.lastSpawnAt >= spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  // ✅ controller (declare AFTER everything ready; no pre-init access)
  const controller = {
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

  return controller;
}