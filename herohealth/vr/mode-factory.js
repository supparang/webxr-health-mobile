// === /herohealth/vr/mode-factory.js ===
// Mode Factory — SAFE SPAWNER (PRODUCTION)
// ✅ export boot (...)
// ✅ Seeded RNG (deterministic)
// ✅ Spawn within mount rect + CSS safe vars
// ✅ Tap-to-hit + Crosshair shoot (hha:shoot)
// ✅ decorateTarget(el, target) hook
// ✅ FIX: no "controller before initialization" (no premature refs)

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

/** Reads safe-area padding variables.
 *  - Primary: --spawn-top-safe/--spawn-bottom-safe/--spawn-left-safe/--spawn-right-safe
 *  - Backward compat: --plate-top-safe/... (Plate already uses these)
 */
function readSafeVars(){
  const cs = getComputedStyle(DOC.documentElement);

  const read = (name, fallbackName)=>{
    const a = parseFloat(cs.getPropertyValue(name));
    if(Number.isFinite(a)) return a;
    const b = parseFloat(cs.getPropertyValue(fallbackName));
    return Number.isFinite(b) ? b : 0;
  };

  const top    = read('--spawn-top-safe',    '--plate-top-safe');
  const bottom = read('--spawn-bottom-safe', '--plate-bottom-safe');
  const left   = read('--spawn-left-safe',   '--plate-left-safe');
  const right  = read('--spawn-right-safe',  '--plate-right-safe');

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

/** boot spawner */
export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,
  sizeRange = [44,64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  ttlMsGood = 2100,
  ttlMsJunk = 1700,
  cooldownMs = 90,
  lockPx = 28,

  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  // internal state (NO controller refs before init)
  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    targets: new Set(),
    cooldownUntil: 0,
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
    if(!state.targets.has(target)) return;
    state.targets.delete(target);
    try{ target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;
    removeTarget(target);
    try{ onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta }); }catch{}
  }

  function onShoot(e){
    if(!state.alive) return;
    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;

    state.cooldownUntil = t + (Number.isFinite(+d.cooldownMs) ? (+d.cooldownMs) : cooldownMs);

    const x = Number(d.x), y = Number(d.y);
    const lp = Number.isFinite(+d.lockPx) ? (+d.lockPx) : lockPx;
    if(!isFinite(x) || !isFinite(y)) return;

    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      const r = target.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dist = Math.hypot(cx - x, cy - y);
      if(dist <= lp && dist < bestDist){
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

    // keep away from edges based on size
    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, Array.isArray(kinds) ? kinds : []);
    const kind = (chosen && chosen.kind) ? String(chosen.kind) : 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

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
      ttlMs: (kind === 'junk') ? ttlMsJunk : ttlMsGood,
      groupIndex: Math.floor(rng() * 5), // 0..4
      size,
      rng, // expose rng for deterministic emoji picks
    };
    el.__hhaTarget = target;

    // decorate hook (emoji/icon/etc.)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(err){
      // do not crash
      console.warn('[mode-factory] decorateTarget error', err);
    }

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
      try{ onExpire({ ...target }); }catch{}
    }, target.ttlMs);
  }

  // timer loop
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