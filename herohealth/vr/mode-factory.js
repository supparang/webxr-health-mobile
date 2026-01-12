// === /herohealth/vr/mode-factory.js ===
// HHA Generic DOM Target Spawner (PRODUCTION) — PACK F
// ✅ spawnHost / boundsHost
// ✅ SAFEZONE exclusion (optional)
// ✅ EDGE-FIX: use boundsHost rect
// ✅ Seeded RNG (cfg.seed) + cfg.rng override (research deterministic)
// ✅ Hook: preKind(kind, ctx) -> override kind decision (boss/storm bias)
// ✅ API: setSpawnRate(ms) live control (boss/storm speed-up)
// ✅ onHit(t) includes clientX/clientY (center point) always
// ✅ Optional crosshair shooting integration stays compatible

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, items){
  // items: [{kind, weight}]
  let sum = 0;
  for(const it of items) sum += Math.max(0, Number(it.weight)||0);
  if(sum <= 0) return items?.[0]?.kind ?? 'good';

  let r = (rng ? rng() : Math.random()) * sum;
  for(const it of items){
    r -= Math.max(0, Number(it.weight)||0);
    if(r <= 0) return it.kind;
  }
  return items[items.length-1]?.kind ?? 'good';
}

function getRect(el){
  if(!el || !el.getBoundingClientRect) return { left:0, top:0, width:innerWidth, height:innerHeight, right:innerWidth, bottom:innerHeight };
  const r = el.getBoundingClientRect();
  return { left:r.left, top:r.top, width:r.width, height:r.height, right:r.right, bottom:r.bottom };
}

function nowMs(){
  return (performance && performance.now) ? performance.now() : Date.now();
}

// safezone: [{x,y,w,h}] in px relative to bounds rect
function pointInZones(x,y,zones){
  if(!zones || !zones.length) return false;
  for(const z of zones){
    const zx = Number(z.x)||0, zy = Number(z.y)||0, zw = Number(z.w)||0, zh = Number(z.h)||0;
    if(x >= zx && x <= (zx+zw) && y >= zy && y <= (zy+zh)) return true;
  }
  return false;
}

function defaultSafeZonesFromSelectors(boundsRect, selectors){
  // make exclusion boxes from UI overlays (e.g., HUD)
  const zones = [];
  if(!selectors || !selectors.length) return zones;
  for(const sel of selectors){
    const el = DOC.querySelector(sel);
    if(!el) continue;
    const r = el.getBoundingClientRect();
    const x = clamp(r.left - boundsRect.left, 0, boundsRect.width);
    const y = clamp(r.top  - boundsRect.top,  0, boundsRect.height);
    const w = clamp(r.width,  0, boundsRect.width);
    const h = clamp(r.height, 0, boundsRect.height);
    if(w > 1 && h > 1) zones.push({ x, y, w, h });
  }
  return zones;
}

function computeSpawnPoint(rng, boundsRect, sizePx, zones){
  // attempt multiple tries to avoid zones
  const pad = Math.max(6, Math.round(sizePx * 0.20));
  const maxTry = 30;

  for(let i=0;i<maxTry;i++){
    const x = pad + (boundsRect.width  - pad*2) * (rng ? rng() : Math.random());
    const y = pad + (boundsRect.height - pad*2) * (rng ? rng() : Math.random());

    // avoid edges so target stays visible
    const rx = clamp(x, pad, Math.max(pad, boundsRect.width  - pad));
    const ry = clamp(y, pad, Math.max(pad, boundsRect.height - pad));

    if(!pointInZones(rx, ry, zones)) return { x:rx, y:ry };
  }

  // fallback: center-ish
  return { x: boundsRect.width*0.5, y: boundsRect.height*0.5 };
}

function setTargetStyle(el, x, y, s){
  // uses CSS variables if you want, but keep plain inline too
  el.style.setProperty('--x', `${x}px`);
  el.style.setProperty('--y', `${y}px`);
  el.style.setProperty('--s', `${s}px`);

  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  el.style.width  = `${s}px`;
  el.style.height = `${s}px`;
  el.style.transform = 'translate(-50%,-50%)';
}

export function boot(cfg = {}){
  if(!DOC) throw new Error('mode-factory: document missing');

  const mount = cfg.mount || DOC.querySelector(cfg.mountSelector || '#playLayer') || DOC.body;
  if(!mount) throw new Error('mode-factory: mount missing');

  const boundsHost = cfg.boundsHost
    ? (typeof cfg.boundsHost === 'string' ? DOC.querySelector(cfg.boundsHost) : cfg.boundsHost)
    : (cfg.boundsSelector ? DOC.querySelector(cfg.boundsSelector) : mount);

  const spawnHost = cfg.spawnHost
    ? (typeof cfg.spawnHost === 'string' ? DOC.querySelector(cfg.spawnHost) : cfg.spawnHost)
    : mount;

  const rng = (typeof cfg.rng === 'function')
    ? cfg.rng
    : seededRng(cfg.seed);

  const kinds = Array.isArray(cfg.kinds) && cfg.kinds.length
    ? cfg.kinds
    : [{kind:'good', weight:0.7}, {kind:'junk', weight:0.3}];

  const preKind = (typeof cfg.preKind === 'function') ? cfg.preKind : null;

  let spawnRate = clamp(cfg.spawnRate ?? 900, 220, 5000);
  let expireMs  = clamp(cfg.expireMs ?? 1800, 350, 99999);

  const sizeRange = Array.isArray(cfg.sizeRange) ? cfg.sizeRange : [44, 64];
  const sizeMin = clamp(sizeRange[0] ?? 44, 18, 260);
  const sizeMax = clamp(sizeRange[1] ?? 64, sizeMin, 340);

  const safeSelectors = Array.isArray(cfg.safeSelectors) ? cfg.safeSelectors : []; // e.g. ['#hud', '.vr-ui']
  const safeZonesCfg  = Array.isArray(cfg.safeZones) ? cfg.safeZones : null;

  const onHit    = (typeof cfg.onHit === 'function') ? cfg.onHit : null;
  const onExpire = (typeof cfg.onExpire === 'function') ? cfg.onExpire : null;

  const state = {
    running:false,
    lastSpawnAt:0,
    timerId:null,
    targets:new Set(),
  };

  function computeZones(boundsRect){
    if(safeZonesCfg && safeZonesCfg.length) return safeZonesCfg;
    return defaultSafeZonesFromSelectors(boundsRect, safeSelectors);
  }

  function chooseKind(ctx){
    let k = pickWeighted(rng, kinds);
    if(preKind){
      try{
        const kk = preKind(k, ctx);
        if(kk) k = String(kk);
      }catch(_){}
    }
    return k;
  }

  function makeTarget(kind, boundsRect){
    const el = DOC.createElement('div');
    el.className = cfg.targetClass || 'hhaTarget';
    el.dataset.kind = kind;

    // size
    const s = Math.round(sizeMin + (sizeMax - sizeMin) * rng());
    const zones = computeZones(boundsRect);
    const p = computeSpawnPoint(rng, boundsRect, s, zones);

    el.style.position = 'absolute';
    el.style.pointerEvents = 'auto';
    el.style.touchAction = 'none';

    setTargetStyle(el, p.x, p.y, s);

    // Provide common fields for game logic
    const t = {
      el,
      kind,
      sizePx: s,
      x: p.x,
      y: p.y,
      bornAt: nowMs(),
      expiresAt: nowMs() + expireMs,
      // allow game to store custom fields:
      groupIndex: null,
    };

    // click/tap hit
    const hit = (ev)=>{
      if(!state.running) return;
      ev.preventDefault?.();

      const rect = boundsRect;
      // Always compute clientX/clientY as center point in viewport
      const cx = rect.left + t.x;
      const cy = rect.top  + t.y;

      // Provide consistent payload
      const payload = {
        ...t,
        clientX: cx,
        clientY: cy,
        rect: rect,
        // raw event (optional)
        srcEvent: ev
      };

      // remove target first (prevent double hit)
      removeTarget(t);

      if(onHit){
        try{ onHit(payload); }catch(err){ console.error('[mode-factory] onHit error', err); }
      }
    };

    el.addEventListener('pointerdown', hit, { passive:false });
    el.addEventListener('click', hit, { passive:false });

    // attach
    spawnHost.appendChild(el);
    state.targets.add(t);

    return t;
  }

  function removeTarget(t){
    if(!t) return;
    if(state.targets.has(t)) state.targets.delete(t);
    if(t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
  }

  function tick(){
    if(!state.running) return;

    const boundsRect = getRect(boundsHost);
    const tNow = nowMs();

    // expire check
    for(const t of Array.from(state.targets)){
      if(tNow >= t.expiresAt){
        removeTarget(t);
        if(onExpire){
          try{ onExpire({ ...t, rect: boundsRect, clientX: boundsRect.left + t.x, clientY: boundsRect.top + t.y }); }
          catch(err){ console.error('[mode-factory] onExpire error', err); }
        }
      }
    }

    // spawn timing
    if(tNow - state.lastSpawnAt >= spawnRate){
      state.lastSpawnAt = tNow;

      const ctx = {
        now: tNow,
        spawnRate,
        expireMs,
        activeCount: state.targets.size
      };

      const kind = chooseKind(ctx);
      const nt = makeTarget(kind, boundsRect);

      // allow game to pre-assign groupIndex if desired
      if(typeof cfg.assignGroupIndex === 'function'){
        try{
          const gi = cfg.assignGroupIndex({ kind: nt.kind, rng, ctx });
          if(gi != null) nt.groupIndex = gi;
        }catch(_){}
      }
    }
  }

  function start(){
    if(state.running) return api;
    state.running = true;
    state.lastSpawnAt = nowMs();
    state.timerId = ROOT.setInterval(tick, 50);
    return api;
  }

  function stop(){
    state.running = false;
    if(state.timerId){
      clearInterval(state.timerId);
      state.timerId = null;
    }
    // clear targets
    for(const t of Array.from(state.targets)) removeTarget(t);
    state.targets.clear();
    return api;
  }

  function setSpawnRate(ms){
    spawnRate = clamp(ms, 220, 5000);
    return spawnRate;
  }

  function setExpireMs(ms){
    expireMs = clamp(ms, 350, 99999);
    // update existing targets expire times softly (optional)
    const tNow = nowMs();
    for(const t of Array.from(state.targets)){
      const lived = clamp(tNow - t.bornAt, 0, 999999);
      t.expiresAt = tNow + Math.max(120, expireMs - lived);
    }
    return expireMs;
  }

  // Public API
  const api = {
    cfg: {
      mount, spawnHost, boundsHost,
      seed: cfg.seed,
      kinds,
    },
    start,
    stop,
    tick, // manual tick if needed
    setSpawnRate,
    setExpireMs,
    rng,
    getSpawnRate: ()=>spawnRate,
    getExpireMs: ()=>expireMs,
    getActiveCount: ()=>state.targets.size
  };

  // auto-start by default unless cfg.autoStart === false
  if(cfg.autoStart !== false) start();

  return api;
}

export default { boot };