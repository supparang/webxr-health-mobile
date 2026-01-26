// === /herohealth/vr/mode-factory.js ===
// HHA Spawn Factory — PRODUCTION
// ✅ Named export: boot
// ✅ Seeded RNG (deterministic)
// ✅ hha:shoot support (crosshair / tap-to-shoot)
// ✅ decorateTarget(el, target) callback
// ✅ setSpawnRate(ms) runtime (no TDZ / no controller init bug)

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
  // prefix example: "plate" => --plate-top-safe
  const cs = getComputedStyle(DOC.documentElement);
  const top = parseFloat(cs.getPropertyValue(`--${prefix}-top-safe`)) || 0;
  const bottom = parseFloat(cs.getPropertyValue(`--${prefix}-bottom-safe`)) || 0;
  const left = parseFloat(cs.getPropertyValue(`--${prefix}-left-safe`)) || 0;
  const right = parseFloat(cs.getPropertyValue(`--${prefix}-right-safe`)) || 0;
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
  safePrefix = 'plate', // ✅ NEW: use --plate-*-safe by default
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,
  ttlGoodMs = 2100,
  ttlJunkMs = 1700,
  shootCooldownMs = 90,
  shootLockPx = 28,
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);
  let spawnRateMs = Number(spawnRate)||900;

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
    onHit({ kind: target.kind, groupIndex: target.groupIndex, size: target.size, ...meta });
  }

  function onShoot(e){
    if(!state.alive) return;
    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;

    state.cooldownUntil = t + (Number(d.cooldownMs)||shootCooldownMs);

    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx || shootLockPx);
    if(!isFinite(x) || !isFinite(y)) return;

    let best=null, bestDist=Infinity;
    for(const target of state.targets){
      const r = target.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dist = Math.hypot(cx-x, cy-y);
      if(dist <= lockPx && dist < bestDist){
        bestDist = dist; best = target;
      }
    }
    if(best) hit(best, { source:'shoot' });
  }

  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 120 || rect.h < 120) return;

    const size = Math.round(sizeRange[0] + rng() * (sizeRange[1]-sizeRange[0]));
    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, kinds);
    const kind = chosen.kind || 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // ✅ IMPORTANT: must be absolute for left/top to work
    el.style.position = 'absolute';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el, kind,
      bornAt: now(),
      ttlMs: (kind === 'junk') ? ttlJunkMs : ttlGoodMs,
      groupIndex: Math.floor(rng()*5),
      size,
      rng // expose rng for deterministic emoji picks
    };
    el.__hhaTarget = target;

    // ✅ allow decorate (emoji/icon/label)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(err){
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
      state.targets.delete(target);
      try{ el.remove(); }catch{}
      onExpire({ kind: target.kind, groupIndex: target.groupIndex, size: target.size, source:'ttl' });
    }, target.ttlMs);
  }

  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = now();
    if(t - state.lastSpawnAt >= spawnRateMs){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  return {
    setSpawnRate(ms){
      spawnRateMs = clampNum(ms, 180, 4000, spawnRateMs);
      return spawnRateMs;
    },
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

function clampNum(v, a, b, fallback){
  v = Number(v);
  if(!isFinite(v)) return fallback;
  return v < a ? a : (v > b ? b : v);
}