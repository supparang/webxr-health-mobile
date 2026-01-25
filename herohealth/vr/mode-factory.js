// === /herohealth/vr/mode-factory.js ===
// Mode Factory — PRODUCTION (HHA Standard)
// ✅ Spawns DOM targets inside mount rect (safe-zone aware)
// ✅ Supports tap + crosshair shoot via event 'hha:shoot'
// ✅ NEW: decorateTarget(el, target) for emoji/icon UI
// ✅ NEW: controller setters for adaptive difficulty (spawnRate/weights/ttl/sizeRange)

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

function now(){ return performance?.now ? performance.now() : Date.now(); }

// ✅ HHA Standard safe vars
function readSafeVars(){
  const cs = getComputedStyle(DOC.documentElement);
  const top = parseFloat(cs.getPropertyValue('--hha-top-safe')) || 0;
  const bottom = parseFloat(cs.getPropertyValue('--hha-bottom-safe')) || 0;
  const left = parseFloat(cs.getPropertyValue('--hha-left-safe')) || 0;
  const right = parseFloat(cs.getPropertyValue('--hha-right-safe')) || 0;
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
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  ttlMs = { good: 2100, junk: 1700 },   // ✅ NEW (optional)
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,               // ✅ NEW
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive:true,
    lastSpawnAt:0,
    spawnTimer:null,
    targets:new Set(),
    cooldownUntil:0,

    // live-tunable params (AI Director)
    spawnRate: Math.max(180, Number(spawnRate)||900),
    sizeMin: Math.max(18, Number(sizeRange?.[0] ?? 44) || 44),
    sizeMax: Math.max(20, Number(sizeRange?.[1] ?? 64) || 64),

    goodW: Math.max(0.01, Number((kinds?.[0]?.kind==='good'?kinds[0].weight:null)) || 0.7),
    junkW: Math.max(0.01, Number((kinds?.[1]?.kind==='junk'?kinds[1].weight:null)) || 0.3),

    ttlGood: Math.max(400, Number(ttlMs?.good ?? 2100) || 2100),
    ttlJunk: Math.max(350, Number(ttlMs?.junk ?? 1700) || 1700),
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

    const size = Math.round(state.sizeMin + rng() * (state.sizeMax - state.sizeMin));
    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, [
      { kind:'good', weight: state.goodW },
      { kind:'junk', weight: state.junkW },
    ]);
    const kind = chosen.kind || 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // IMPORTANT: position absolute is required (CSS should set it too)
    el.style.position = 'absolute';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el, kind,
      bornAt: now(),
      ttlMs: (kind === 'junk') ? state.ttlJunk : state.ttlGood,
      groupIndex: Math.floor(rng()*5),
      size,
      rng // expose deterministic rng for emoji picks
    };
    el.__hhaTarget = target;

    // ✅ decorate target UI (emoji/icon/label)
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
      onExpire({ ...target });
    }, target.ttlMs);
  }

  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = now();
    if(t - state.lastSpawnAt >= state.spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  // ✅ controller API for AI Difficulty Director
  const controller = {
    stop(){
      if(!state.alive) return;
      state.alive = false;
      clearInterval(state.spawnTimer);
      WIN.removeEventListener('hha:shoot', onShoot);
      for(const target of state.targets){
        try{ target.el.remove(); }catch{}
      }
      state.targets.clear();
    },

    setSpawnRate(ms){
      const v = Math.max(180, Number(ms)||state.spawnRate);
      state.spawnRate = v;
    },

    setWeights(goodW, junkW){
      const g = Math.max(0.01, Number(goodW)||state.goodW);
      const j = Math.max(0.01, Number(junkW)||state.junkW);
      state.goodW = g;
      state.junkW = j;
    },

    setTTL(goodMs, junkMs){
      if(isFinite(Number(goodMs))) state.ttlGood = Math.max(400, Number(goodMs));
      if(isFinite(Number(junkMs))) state.ttlJunk = Math.max(350, Number(junkMs));
    },

    setSizeRange(minPx, maxPx){
      const mn = Math.max(18, Number(minPx)||state.sizeMin);
      const mx = Math.max(mn+2, Number(maxPx)||state.sizeMax);
      state.sizeMin = mn;
      state.sizeMax = mx;
    },
  };

  return controller;
}