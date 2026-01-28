// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — PRODUCTION (Targets Spawner)
// ------------------------------------------------------------
// ✅ Named export: boot(...)  (แก้ปัญหา "does not provide an export named boot")
// ✅ FIX: "Cannot access 'controller' before initialization" (จัดลำดับ init ใหม่)
// ✅ Supports decorateTarget(el, target) to customize UI (emoji/icon/etc.)
// ✅ Supports tap/click (pointerdown) + crosshair/tap-to-shoot via vr-ui.js: hha:shoot
// ✅ Safe-area spawn rect via CSS vars (defaults 0): --plate-top-safe/--plate-bottom-safe/--plate-left-safe/--plate-right-safe
// ✅ stop(): clears timers, removes listeners, removes remaining targets
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

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function readSafeVars(){
  const cs = getComputedStyle(DOC.documentElement);
  const top    = parseFloat(cs.getPropertyValue('--plate-top-safe')) || 0;
  const bottom = parseFloat(cs.getPropertyValue('--plate-bottom-safe')) || 0;
  const left   = parseFloat(cs.getPropertyValue('--plate-left-safe')) || 0;
  const right  = parseFloat(cs.getPropertyValue('--plate-right-safe')) || 0;
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

// ✅ IMPORTANT: named export "boot"
export function boot({
  mount,
  seed = Date.now(),

  // spawn cadence (ms between spawns)
  spawnRate = 900,

  // px
  sizeRange = [44, 64],

  // weighted kinds
  kinds = [
    { kind:'good', weight:0.7 },
    { kind:'junk', weight:0.3 }
  ],

  // callbacks
  onHit = ()=>{},
  onExpire = ()=>{},

  // new: customize target UI
  decorateTarget = null,

  // shoot assist
  shootCooldownMs = 90,
  defaultLockPx = 28,
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  // ✅ FIX: init controller FIRST (แก้ "controller before init")
  const controller = new AbortController();
  const signal = controller.signal;

  const rng = seededRng(seed);

  const state = {
    alive: true,
    lastSpawnAt: 0,
    tickTimer: null,
    targets: new Set(),
    cooldownUntil: 0
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
    try{ target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;

    state.targets.delete(target);
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

  function onShoot(ev){
    if(!state.alive) return;

    const d = ev?.detail || {};
    const t = nowMs();

    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + clamp(shootCooldownMs, 40, 400);

    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = clamp(d.lockPx ?? defaultLockPx, 10, 80);

    if(!isFinite(x) || !isFinite(y)) return;

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

  // ยิงจาก crosshair (vr-ui.js)
  WIN.addEventListener('hha:shoot', onShoot, { signal });

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const minS = Math.min(sizeRange[0] || 44, sizeRange[1] || 64);
    const maxS = Math.max(sizeRange[0] || 44, sizeRange[1] || 64);
    const size = Math.round(minS + rng() * (maxS - minS));

    const pad = Math.max(10, Math.round(size * 0.55));

    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad * 2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad * 2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen?.kind || 'good');

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    el.style.position = 'absolute';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.touchAction = 'none';

    const target = {
      el,
      kind,
      bornAt: nowMs(),
      ttlMs: (kind === 'junk') ? 1700 : 2100,
      groupIndex: Math.floor(rng() * 5), // 0..4 (เกม map เป็น 1..5 เอง)
      size,
      rng
    };

    el.__hhaTarget = target;

    // ✅ NEW: allow game to decorate target (emoji/icon/etc.)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(_){}

    // tap/click hit
    el.addEventListener('pointerdown', (e)=>{
      try{ e.preventDefault(); }catch{}
      hit(target, { source:'tap' });
    }, { passive:false, signal });

    mount.appendChild(el);
    state.targets.add(target);

    // expire
    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;

      state.targets.delete(target);
      removeTarget(target);

      try{
        onExpire({
          kind: target.kind,
          groupIndex: target.groupIndex,
          size: target.size,
          bornAt: target.bornAt,
          ttlMs: target.ttlMs
        });
      }catch(_){}
    }, target.ttlMs);
  }

  // spawn loop (stable tick)
  state.tickTimer = setInterval(()=>{
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

      try{ clearInterval(state.tickTimer); }catch{}
      try{ controller.abort(); }catch{}

      for(const target of state.targets){
        removeTarget(target);
      }
      state.targets.clear();
    }
  };
}