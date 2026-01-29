// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory (DOM Spawner) — PRODUCTION
// ------------------------------------------------------------
// ✅ export boot (named)
// ✅ FIX: no “controller before init” (clean init order)
// ✅ Supports:
//   - decorateTarget(el, target) to customize UI (emoji/icon)
//   - hha:shoot {x,y,lockPx,source} (vr-ui.js crosshair/tap-to-shoot)
//   - stop(): clears timers + listeners + removes targets
// ✅ Options for Plate/others:
//   - safePrefix: '--plate' => reads CSS vars: --plate-top-safe/... etc
//   - ttlGoodMs / ttlJunkMs
//   - defaultLockPx, shootCooldownMs
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

function pickWeighted(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return { kind:'good', weight:1 };
  let sum = 0;
  for(const it of a) sum += (it.weight ?? 1);
  let x = rng() * sum;
  for(const it of a){
    x -= (it.weight ?? 1);
    if(x <= 0) return it;
  }
  return a[a.length - 1];
}

function readSafeVars(prefix){
  // prefix: '--plate' => vars are --plate-top-safe, --plate-bottom-safe, etc.
  const p = String(prefix || '--plate');
  const cs = getComputedStyle(DOC.documentElement);

  const top    = parseFloat(cs.getPropertyValue(`${p}-top-safe`))    || 0;
  const bottom = parseFloat(cs.getPropertyValue(`${p}-bottom-safe`)) || 0;
  const left   = parseFloat(cs.getPropertyValue(`${p}-left-safe`))   || 0;
  const right  = parseFloat(cs.getPropertyValue(`${p}-right-safe`))  || 0;

  return { top, bottom, left, right };
}

/**
 * boot({ mount, ... })
 * returns controller { stop() }
 */
export function boot({
  mount,

  // determinism
  seed = Date.now(),

  // spawn pacing
  spawnRate = 900,              // ms between spawns (approx)
  sizeRange = [44, 64],         // px
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],

  // TTL (ms)
  ttlGoodMs = 2100,
  ttlJunkMs = 1700,

  // safe area css vars
  safePrefix = '--plate',

  // input
  defaultLockPx = 28,
  shootCooldownMs = 90,

  // callbacks
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,

  // className override (optional)
  targetClass = 'plateTarget'
} = {}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    spawnTimer: null,
    targets: new Set(),
    lastSpawnAt: 0,
    cooldownUntil: 0
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
    try{ target.el && target.el.remove(); }catch(_){}
    try{ state.targets.delete(target); }catch(_){}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;

    removeTarget(target);

    try{
      onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta });
    }catch(_){}
  }

  function onShoot(ev){
    if(!state.alive) return;

    const d = ev && ev.detail ? ev.detail : {};
    const t = nowMs();

    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + (Number(shootCooldownMs) || 90);

    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = Number(d.lockPx || defaultLockPx || 28);

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

  // attach shoot listener once
  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 90 || rect.h < 90) return;

    const size = Math.round(sizeRange[0] + rng() * (sizeRange[1] - sizeRange[0]));
    const pad = Math.max(10, Math.round(size * 0.55));

    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad * 2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad * 2));

    const chosen = pickWeighted(rng, kinds);
    const kind = String(chosen.kind || 'good');

    const el = DOC.createElement('div');
    el.className = targetClass;
    el.dataset.kind = kind;
    el.style.position = 'fixed';           // IMPORTANT: allow spawn in viewport coords
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width  = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.touchAction = 'none';

    const target = {
      el,
      kind,
      size,
      bornAt: nowMs(),
      ttlMs: (kind === 'junk') ? (Number(ttlJunkMs) || 1700) : (Number(ttlGoodMs) || 2100),
      groupIndex: Math.floor(rng() * 5),
      rng
    };

    // allow external customization
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(_){}

    // tap hit
    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // expire
    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;

      removeTarget(target);

      try{
        onExpire({ ...target });
      }catch(_){}
    }, target.ttlMs);
  }

  // spawn loop (lightweight)
  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = nowMs();
    if(t - state.lastSpawnAt >= (Number(spawnRate) || 900)){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  return {
    stop(){
      if(!state.alive) return;
      state.alive = false;

      try{ clearInterval(state.spawnTimer); }catch(_){}
      state.spawnTimer = null;

      WIN.removeEventListener('hha:shoot', onShoot);

      for(const target of state.targets){
        try{ target.el.remove(); }catch(_){}
      }
      state.targets.clear();
    }
  };
}