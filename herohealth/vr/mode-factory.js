// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — PRODUCTION (ESM)
// ✅ export boot() (named)  -> import { boot as spawnBoot } from '../vr/mode-factory.js'
// ✅ FIX: "controller before init" (robust lifecycle + cleanup)
// ✅ Supports: decorateTarget(el, target)
// ✅ Supports: hha:shoot {x,y,lockPx,source}
// ✅ stop(): clears everything + prevents late expire "blink"

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

function readSafeVars(prefix='plate'){
  // ex: --plate-top-safe, --plate-bottom-safe, --plate-left-safe, --plate-right-safe
  // If vars missing => 0 (safe)
  try{
    const cs = getComputedStyle(DOC.documentElement);
    const top = parseFloat(cs.getPropertyValue(`--${prefix}-top-safe`)) || 0;
    const bottom = parseFloat(cs.getPropertyValue(`--${prefix}-bottom-safe`)) || 0;
    const left = parseFloat(cs.getPropertyValue(`--${prefix}-left-safe`)) || 0;
    const right = parseFloat(cs.getPropertyValue(`--${prefix}-right-safe`)) || 0;
    return { top, bottom, left, right };
  }catch{
    return { top:0, bottom:0, left:0, right:0 };
  }
}

function pickWeighted(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return { kind:'good', weight:1 };
  let sum = 0;
  for(const it of a) sum += (Number(it.weight) || 0) || 1;
  let x = rng() * sum;
  for(const it of a){
    x -= (Number(it.weight) || 0) || 1;
    if(x <= 0) return it;
  }
  return a[a.length-1];
}

function clamp(v,a,b){
  v = Number(v)||0;
  return v < a ? a : (v > b ? b : v);
}

export function boot({
  mount,
  seed = Date.now(),

  spawnRate = 900,            // ms (min gap between spawns)
  tickMs = 60,                // internal timer tick
  sizeRange = [44,64],

  // kinds: [{kind:'good', weight:0.7, ttlMs?:2100},{kind:'junk',weight:0.3, ttlMs?:1700}]
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],

  // callbacks
  onHit = ()=>{},             // onHit({kind, groupIndex, ...meta})
  onExpire = ()=>{},          // onExpire(target)
  decorateTarget = null,      // decorateTarget(el, target)
  safePrefix = 'plate',       // CSS vars prefix for safe zone
  cooldownMs = 90,            // shoot cooldown
  defaultLockPx = 28,         // shoot lock radius
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  // lifecycle controller (fix "controller before init")
  const controller = new AbortController();
  const signal = controller.signal;

  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    targets: new Set(),
    cooldownUntil: 0,
    stopToken: 0, // increments on stop to invalidate pending timeouts
  };

  function computeSpawnRect(){
    const r = mount.getBoundingClientRect();
    const safe = readSafeVars(safePrefix);

    const left = r.left + (safe.left || 0);
    const top = r.top + (safe.top || 0);
    const right = r.right - (safe.right || 0);
    const bottom = r.bottom - (safe.bottom || 0);

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
    try{
      onHit({ kind: target.kind, groupIndex: target.groupIndex, groupId: target.groupId, ...meta });
    }catch(err){
      console.error('[mode-factory] onHit error', err);
    }
  }

  function onShoot(e){
    if(!state.alive) return;
    const d = (e && e.detail) ? e.detail : {};
    const t = now();

    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + cooldownMs;

    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = clamp(Number(d.lockPx || defaultLockPx), 6, 120);
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

    if(best) hit(best, { source: d.source || 'shoot' });
  }

  // attach shoot listener (cleanable)
  WIN.addEventListener('hha:shoot', onShoot, { signal });

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 120 || rect.h < 120) return;

    const minS = Math.max(18, Number(sizeRange[0]) || 44);
    const maxS = Math.max(minS, Number(sizeRange[1]) || 64);
    const size = Math.round(minS + rng() * (maxS - minS));

    const pad = Math.max(10, Math.round(size * 0.60));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad * 2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad * 2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen && chosen.kind) ? String(chosen.kind) : 'good';

    // element
    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // IMPORTANT: must be positioned
    el.style.position = 'absolute';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    // deterministic group index for "good" targets (Plate/Groups can override via decorateTarget)
    const groupIndex = Math.floor(rng() * 5); // 0..4
    const groupId = groupIndex + 1;           // 1..5

    const ttlGood = 2100;
    const ttlJunk = 1700;
    const ttlMs = clamp(Number(chosen && chosen.ttlMs) || (kind === 'junk' ? ttlJunk : ttlGood), 600, 8000);

    const target = {
      el,
      kind,
      size,
      bornAt: now(),
      ttlMs,
      seed,
      rng,          // expose rng for deterministic emoji pick
      groupIndex,   // 0..4
      groupId,      // 1..5
    };

    // store backref
    el.__hhaTarget = target;

    // decorate hook (emoji / label / custom classes)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(err){
      console.error('[mode-factory] decorateTarget error', err);
    }

    // pointerdown => hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false, signal });

    // mount & track
    mount.appendChild(el);
    state.targets.add(target);

    // expire timeout (guarded by stopToken)
    const myToken = state.stopToken;
    setTimeout(()=>{
      if(!state.alive) return;
      if(myToken !== state.stopToken) return; // stopped/restarted
      if(!state.targets.has(target)) return;
      removeTarget(target);
      try{ onExpire({ ...target }); }catch(err){ console.error('[mode-factory] onExpire error', err); }
    }, ttlMs);
  }

  // main loop: spawn respecting spawnRate
  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = now();
    if(t - state.lastSpawnAt >= spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, clamp(tickMs, 16, 200));

  return {
    stop(){
      if(!state.alive) return;
      state.alive = false;
      state.stopToken++;

      try{ clearInterval(state.spawnTimer); }catch{}
      // abort listeners (shoot + pointerdown)
      try{ controller.abort(); }catch{}

      // remove targets
      for(const target of state.targets){
        try{ target.el.remove(); }catch{}
      }
      state.targets.clear();
    }
  };
}