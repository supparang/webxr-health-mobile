// === /herohealth/vr/mode-factory.js ===
// HHA Spawn Factory (PRODUCTION)
// ✅ Seeded RNG (deterministic-friendly)
// ✅ Safe spawn rect via CSS vars: --plate-top-safe/--plate-bottom-safe/--plate-left-safe/--plate-right-safe
// ✅ Tap hit + Crosshair hit (hha:shoot)
// ✅ NEW: decorateTarget(el, target) callback
// ✅ NEW: controller.setParams({spawnRate, ttlGoodMs, ttlJunkMs, kinds}) for adaptive (play only)

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

function readSafeVars(){
  const cs = getComputedStyle(DOC.documentElement);
  const top = parseFloat(cs.getPropertyValue('--plate-top-safe')) || 0;
  const bottom = parseFloat(cs.getPropertyValue('--plate-bottom-safe')) || 0;
  const left = parseFloat(cs.getPropertyValue('--plate-left-safe')) || 0;
  const right = parseFloat(cs.getPropertyValue('--plate-right-safe')) || 0;
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

function clamp(n, a, b){
  n = Number(n);
  if(!isFinite(n)) n = a;
  return n < a ? a : (n > b ? b : n);
}

export function boot({
  mount,
  seed = Date.now(),

  // base parameters
  spawnRate = 900,
  sizeRange = [44, 64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],

  ttlGoodMs = 2100,
  ttlJunkMs = 1700,

  onHit = ()=>{},
  onExpire = ()=>{},

  decorateTarget = null,
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  // mutable params (for adaptive)
  const params = {
    spawnRate: clamp(spawnRate, 320, 2200),
    sizeMin: clamp(sizeRange?.[0] ?? 44, 24, 220),
    sizeMax: clamp(sizeRange?.[1] ?? 64, 24, 260),
    ttlGoodMs: clamp(ttlGoodMs, 650, 6000),
    ttlJunkMs: clamp(ttlJunkMs, 450, 6000),
    kinds: Array.isArray(kinds) && kinds.length ? kinds : [{kind:'good',weight:0.7},{kind:'junk',weight:0.3}],
  };

  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
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
    state.cooldownUntil = t + 90;

    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx || 28);
    if(!isFinite(x) || !isFinite(y)) return;

    let best = null, bestDist = Infinity;
    for(const target of state.targets){
      const rr = target.el.getBoundingClientRect();
      const cx = rr.left + rr.width/2;
      const cy = rr.top + rr.height/2;
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

    const size = Math.round(params.sizeMin + rng() * Math.max(1, (params.sizeMax - params.sizeMin)));
    const pad = Math.max(10, Math.round(size * 0.55));

    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, params.kinds);
    const kind = (chosen.kind || 'good');

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
      ttlMs: (kind === 'junk') ? params.ttlJunkMs : params.ttlGoodMs,
      groupIndex: Math.floor(rng()*5), // 0..4
      size,
      rng
    };
    el.__hhaTarget = target;

    // ✅ Decorate (emoji/icon/label)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch{}

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
    setParams(next = {}){
      // allow adaptive in play mode (caller decides)
      if(next.spawnRate != null) params.spawnRate = clamp(next.spawnRate, 320, 2200);
      if(next.ttlGoodMs != null) params.ttlGoodMs = clamp(next.ttlGoodMs, 650, 6000);
      if(next.ttlJunkMs != null) params.ttlJunkMs = clamp(next.ttlJunkMs, 450, 6000);
      if(next.sizeRange && Array.isArray(next.sizeRange)){
        params.sizeMin = clamp(next.sizeRange[0] ?? params.sizeMin, 24, 220);
        params.sizeMax = clamp(next.sizeRange[1] ?? params.sizeMax, 24, 260);
      }
      if(next.kinds && Array.isArray(next.kinds) && next.kinds.length){
        params.kinds = next.kinds;
      }
    },
    getParams(){
      return { ...params };
    }
  };

  return controller;
}