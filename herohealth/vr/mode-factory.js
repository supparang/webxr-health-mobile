// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — PRODUCTION (Plate/Groups compatible)
// ✅ FIX: named export 'boot'
// ✅ FIX: "controller before init" (no TDZ usage)
// ✅ Supports decorateTarget(el, target)
// ✅ Supports crosshair/tap-to-shoot via hha:shoot {x,y,lockPx}
// ✅ Deterministic spawn via seeded RNG
// ✅ stop(): removes listeners, clears targets, stops spawner

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
  try { return performance.now(); } catch { return Date.now(); }
}

function readSafeVars(prefix='--plate'){
  // Example CSS vars:
  // --plate-top-safe, --plate-bottom-safe, --plate-left-safe, --plate-right-safe
  const cs = getComputedStyle(DOC.documentElement);
  const top = parseFloat(cs.getPropertyValue(`${prefix}-top-safe`)) || 0;
  const bottom = parseFloat(cs.getPropertyValue(`${prefix}-bottom-safe`)) || 0;
  const left = parseFloat(cs.getPropertyValue(`${prefix}-left-safe`)) || 0;
  const right = parseFloat(cs.getPropertyValue(`${prefix}-right-safe`)) || 0;
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

export function boot({
  mount,
  seed = Date.now(),

  // spawn cadence
  spawnRate = 900,          // ms between spawns (approx)
  tickMs = 60,              // scheduler tick

  // target shape
  sizeRange = [44, 64],     // px
  ttlGoodMs = 2100,
  ttlJunkMs = 1700,

  // selection
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],

  // callbacks
  onHit = ()=>{},
  onExpire = ()=>{},

  // ✅ NEW
  decorateTarget = null,

  // lock settings for shoot
  shootCooldownMs = 90,
  defaultLockPx = 28,

  // safe-area vars prefix (plate uses --plate-*)
  safePrefix = '--plate',
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    targets: new Set(),
    cooldownUntil: 0,
    safePrefix,
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
    try{ target?.el?.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!target || !state.targets.has(target)) return;

    state.targets.delete(target);
    removeTarget(target);

    // meta can include {source:'tap'|'shoot'}
    try{
      onHit({
        kind: target.kind,
        groupIndex: target.groupIndex,
        groupId: (target.groupIndex ?? 0) + 1,
        size: target.size,
        bornAt: target.bornAt,
        ttlMs: target.ttlMs,
        ...meta
      });
    }catch{}
  }

  function onShoot(e){
    if(!state.alive) return;

    const d = e.detail || {};
    const t = nowMs();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + shootCooldownMs;

    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = Number(d.lockPx || defaultLockPx);

    if(!isFinite(x) || !isFinite(y) || !isFinite(lockPx)) return;

    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      const el = target.el;
      if(!el) continue;

      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(cx - x, cy - y);

      if(dist <= lockPx && dist < bestDist){
        bestDist = dist;
        best = target;
      }
    }

    if(best) hit(best, { source: 'shoot' });
  }

  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    // if playfield too small (HUD overlay/safe-area too big) => don't spawn
    if(rect.w < 90 || rect.h < 90) return;

    const size = Math.round(sizeRange[0] + rng() * (sizeRange[1] - sizeRange[0]));
    const pad = Math.max(10, Math.round(size * 0.55));

    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad * 2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad * 2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen && chosen.kind) ? String(chosen.kind) : 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // positioning
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    // touch optimizations
    el.style.touchAction = 'none';
    el.style.webkitTapHighlightColor = 'transparent';

    const target = {
      el,
      kind,
      bornAt: nowMs(),
      ttlMs: (kind === 'junk') ? ttlJunkMs : ttlGoodMs,
      groupIndex: Math.floor(rng() * 5), // 0..4
      size,
      rng, // expose deterministic rng to decorator
      seed,
    };

    el.__hhaTarget = target;

    // ✅ decorate hook (emoji/icon)
    try{
      if(typeof decorateTarget === 'function'){
        decorateTarget(el, target);
      }else{
        // sane default if no decorator:
        el.textContent = (kind === 'junk') ? '✖' : '●';
        el.style.display = 'grid';
        el.style.placeItems = 'center';
        el.style.fontSize = `${Math.round(size * 0.5)}px`;
        el.style.userSelect = 'none';
      }
    }catch{}

    // tap hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source: 'tap' });
    }, { passive: false });

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
          groupId: target.groupIndex + 1,
          size: target.size,
          bornAt: target.bornAt,
          ttlMs: target.ttlMs
        });
      }catch{}
    }, target.ttlMs);
  }

  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = nowMs();
    if(t - state.lastSpawnAt >= spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, tickMs);

  // ✅ controller returned after everything initialized (no TDZ)
  const controller = {
    stop(){
      if(!state.alive) return;
      state.alive = false;

      try{ clearInterval(state.spawnTimer); }catch{}
      try{ WIN.removeEventListener('hha:shoot', onShoot); }catch{}

      for(const target of state.targets){
        removeTarget(target);
      }
      state.targets.clear();
    },

    // optional debug helpers
    _state: state,
    _rng: rng,
    computeSpawnRect,
  };

  return controller;
}
