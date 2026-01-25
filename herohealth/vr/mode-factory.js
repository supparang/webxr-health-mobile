// === /herohealth/vr/mode-factory.js ===
// Spawn/Mode Factory — PRODUCTION
// ✅ export boot()
// ✅ Safe spawn rect via CSS vars (supports both --plate-*-safe and --hha-*-safe)
// ✅ Tap targets + Crosshair shoot via vr-ui.js (hha:shoot)
// ✅ decorateTarget(el, target) callback
// ✅ Returns controller with setters for runtime tuning (spawnRate/weights/ttl/size)
// ------------------------------------------------------------

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

function readSafeVars(){
  // Back-compat: plate-specific vars, plus generic hha vars
  const cs = getComputedStyle(DOC.documentElement);

  const top =
    parseFloat(cs.getPropertyValue('--hha-top-safe')) ||
    parseFloat(cs.getPropertyValue('--plate-top-safe')) || 0;

  const bottom =
    parseFloat(cs.getPropertyValue('--hha-bottom-safe')) ||
    parseFloat(cs.getPropertyValue('--plate-bottom-safe')) || 0;

  const left =
    parseFloat(cs.getPropertyValue('--hha-left-safe')) ||
    parseFloat(cs.getPropertyValue('--plate-left-safe')) || 0;

  const right =
    parseFloat(cs.getPropertyValue('--hha-right-safe')) ||
    parseFloat(cs.getPropertyValue('--plate-right-safe')) || 0;

  return { top, bottom, left, right };
}

function pickWeighted(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return { kind:'good', weight:1 };

  let sum = 0;
  for(const it of a) sum += (Number(it.weight ?? 1) || 0);
  if(sum <= 0) return a[a.length-1];

  let x = rng() * sum;
  for(const it of a){
    x -= (Number(it.weight ?? 1) || 0);
    if(x <= 0) return it;
  }
  return a[a.length-1];
}

export function boot({
  mount,
  seed = Date.now(),

  // dynamic knobs
  spawnRate = 900,              // ms between spawns (approx)
  sizeRange = [44, 64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  ttlMs = { good: 2100, junk: 1700 },

  // callbacks
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,

  // shooting
  cooldownMs = 90,
  lockPxDefault = 28,
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  // ---- internal mutable config (runtime tuning) ----
  const CFG = {
    spawnRate: Number(spawnRate) || 900,
    sizeRange: Array.isArray(sizeRange) ? sizeRange.slice(0,2) : [44,64],
    kinds: Array.isArray(kinds) ? kinds.map(x=>({ ...x })) : [{ kind:'good', weight:1 }],
    ttlMs: {
      good: Number(ttlMs?.good ?? 2100) || 2100,
      junk: Number(ttlMs?.junk ?? 1700) || 1700,
    },
    cooldownMs: Number(cooldownMs) || 90,
    lockPxDefault: Number(lockPxDefault) || 28,
  };

  const state = {
    alive:true,
    lastSpawnAt:0,
    tickTimer:null,
    targets:new Set(),
    cooldownUntil:0,
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
    state.targets.delete(target);
    try{ target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;
    removeTarget(target);
    try{
      onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta });
    }catch{}
  }

  function onShoot(e){
    if(!state.alive) return;

    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;

    state.cooldownUntil = t + (Number(d.cooldownMs) || CFG.cooldownMs);

    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx || CFG.lockPxDefault);
    if(!isFinite(x) || !isFinite(y)) return;

    let best=null, bestDist=Infinity;
    for(const target of state.targets){
      const r = target.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dist = Math.hypot(cx-x, cy-y);
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

    const minS = Number(CFG.sizeRange[0] ?? 44) || 44;
    const maxS = Number(CFG.sizeRange[1] ?? 64) || 64;
    const size = Math.round(minS + rng() * Math.max(1, (maxS - minS)));

    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, CFG.kinds);
    const kind = (chosen && chosen.kind) ? String(chosen.kind) : 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el, kind,
      bornAt: now(),
      ttlMs: (kind === 'junk') ? CFG.ttlMs.junk : CFG.ttlMs.good,
      groupIndex: Math.floor(rng()*5), // 0..4
      size,
      rng, // expose rng for deterministic emoji picks
    };

    el.__hhaTarget = target;

    // decorate (emoji/icon) hook
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
      removeTarget(target);
      try{ onExpire({ ...target }); }catch{}
    }, target.ttlMs);
  }

  state.tickTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = now();
    if(t - state.lastSpawnAt >= CFG.spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  // ---- public controller (safe to use immediately) ----
  const controller = {
    stop(){
      if(!state.alive) return;
      state.alive = false;
      clearInterval(state.tickTimer);
      WIN.removeEventListener('hha:shoot', onShoot);
      for(const target of state.targets){
        try{ target.el.remove(); }catch{}
      }
      state.targets.clear();
    },

    // runtime tuning
    setSpawnRate(ms){
      CFG.spawnRate = Math.max(120, Number(ms)||CFG.spawnRate);
    },
    setSizeRange(min, max){
      const a = Math.max(24, Number(min)||44);
      const b = Math.max(a+1, Number(max)||64);
      CFG.sizeRange = [a,b];
    },
    setTTL(goodMs, junkMs){
      if(isFinite(goodMs)) CFG.ttlMs.good = Math.max(300, Number(goodMs));
      if(isFinite(junkMs)) CFG.ttlMs.junk = Math.max(300, Number(junkMs));
    },
    setWeights(goodW, junkW){
      // keeps same kinds but adjusts weights for good/junk
      const gw = Math.max(0, Number(goodW));
      const jw = Math.max(0, Number(junkW));
      let hasGood=false, hasJunk=false;

      for(const it of CFG.kinds){
        if(it.kind === 'good'){ it.weight = gw; hasGood=true; }
        if(it.kind === 'junk'){ it.weight = jw; hasJunk=true; }
      }
      if(!hasGood) CFG.kinds.push({ kind:'good', weight:gw });
      if(!hasJunk) CFG.kinds.push({ kind:'junk', weight:jw });
    },
    setCooldown(ms){
      CFG.cooldownMs = Math.max(40, Number(ms)||CFG.cooldownMs);
    },

    // inspect (optional)
    getConfig(){
      return JSON.parse(JSON.stringify(CFG));
    }
  };

  return controller;
}