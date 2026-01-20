// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (PRODUCTION)
// Used by: Plate / Hydration / Groups / GoodJunk (as needed)
//
// ✅ export boot()
// ✅ supports: mount, seed, rng override
// ✅ spawnRate(ms), ttlRange([min,max]), sizeRange([min,max]), maxTargets
// ✅ kinds: [{kind,weight}, ...]
// ✅ onHit(target), onExpire(target)
// ✅ hit via pointerdown on targets OR hha:shoot (crosshair/tap-to-shoot)
// ✅ fixes: "Cannot access 'controller' before initialization" (no TDZ)
// ✅ safe spawn padding + avoid clumping

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = (Number(seed)||0) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, items){
  let sum = 0;
  for(const it of items) sum += Math.max(0, Number(it.weight)||0);
  if(sum <= 0) return items[0] || {kind:'good', weight:1};
  let x = rng() * sum;
  for(const it of items){
    x -= Math.max(0, Number(it.weight)||0);
    if(x <= 0) return it;
  }
  return items[items.length-1];
}

function rectOf(el){
  const r = el.getBoundingClientRect();
  return { x:r.left, y:r.top, w:r.width, h:r.height, r };
}

function now(){ return performance.now ? performance.now() : Date.now(); }

function ensureTargetClass(el, cls){
  try{ el.classList.add(cls); }catch(_){}
}

/* ------------------------------------------------
 * boot()
 * ------------------------------------------------ */
export function boot(opts = {}){
  const mount = opts.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = (typeof opts.rng === 'function')
    ? opts.rng
    : (opts.seed != null ? seededRng(opts.seed) : Math.random);

  // config
  const spawnRate = Math.max(120, Number(opts.spawnRate || 900) || 900);
  const maxTargets = clamp(opts.maxTargets ?? 6, 1, 24);

  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [46, 70];
  const ttlRange  = Array.isArray(opts.ttlRange)  ? opts.ttlRange  : [1200, 2400];

  const kinds = Array.isArray(opts.kinds) && opts.kinds.length
    ? opts.kinds
    : [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }];

  const onHit = (typeof opts.onHit === 'function') ? opts.onHit : ()=>{};
  const onExpire = (typeof opts.onExpire === 'function') ? opts.onExpire : ()=>{};

  // safe padding to avoid edges / HUD-ish zone
  const safePad = clamp(opts.safePad ?? 10, 0, 80);

  // internal state
  const state = {
    running:true,
    targets: new Map(), // id -> t
    nextId: 1,
    lastSpawnAt: 0,
    raf: 0,
  };

  // controller object (declared BEFORE use) ✅ prevents TDZ bug
  const controller = {
    stop,
    spawnOnce,
    clearAll,
    getTargets: ()=>Array.from(state.targets.values())
  };

  // ---------- target create ----------
  function makeTarget(){
    const id = state.nextId++;
    const kindPick = pickWeighted(rng, kinds);
    const kind = String(kindPick.kind || 'good');

    const size = Math.round(clamp(
      (Number(sizeRange[0])||46) + rng() * ((Number(sizeRange[1])||70) - (Number(sizeRange[0])||46)),
      28, 140
    ));

    const ttl = Math.round(clamp(
      (Number(ttlRange[0])||1200) + rng() * ((Number(ttlRange[1])||2400) - (Number(ttlRange[0])||1200)),
      250, 12000
    ));

    const el = DOC.createElement('div');
    ensureTargetClass(el, 'plateTarget'); // default class (Plate uses this). Other games can style by [data-kind].
    el.setAttribute('data-id', String(id));
    el.setAttribute('data-kind', kind);

    el.style.position = 'absolute';
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = '0px';
    el.style.top  = '0px';
    el.style.transform = 'translate(-9999px,-9999px)'; // hide until placed

    // placeholder text (games can override in onHit or via mutation)
    el.textContent = (kind === 'junk') ? '🍩' : '🍽️';

    // hit by pointer
    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      hitTarget(id, 'pointer');
    }, { passive:false });

    mount.appendChild(el);

    const t = {
      id, kind, el,
      bornAt: now(),
      expireAt: now() + ttl,
      size,
      x:0, y:0,
      groupIndex: null
    };

    placeTarget(t);
    state.targets.set(id, t);
    return t;
  }

  // ---------- placement ----------
  function placeTarget(t){
    const m = rectOf(mount);

    // If mount is not visible -> avoid NaN and keep hidden
    if(m.w < 10 || m.h < 10){
      t.el.style.transform = 'translate(-9999px,-9999px)';
      return;
    }

    const pad = safePad;
    const minX = pad;
    const minY = pad;
    const maxX = Math.max(minX, m.w - t.size - pad);
    const maxY = Math.max(minY, m.h - t.size - pad);

    // try multiple times to avoid clumping
    let best = null;
    for(let k=0; k<18; k++){
      const x = Math.round(minX + rng() * (maxX - minX));
      const y = Math.round(minY + rng() * (maxY - minY));

      // score position by distance to existing targets
      let score = 0;
      for(const ot of state.targets.values()){
        const dx = (ot.x - x);
        const dy = (ot.y - y);
        const d2 = dx*dx + dy*dy;
        score += d2;
      }
      if(!best || score > best.score){
        best = { x, y, score };
      }
    }

    t.x = best ? best.x : minX;
    t.y = best ? best.y : minY;

    t.el.style.left = `${t.x}px`;
    t.el.style.top  = `${t.y}px`;
    t.el.style.transform = 'translateZ(0)';
  }

  // ---------- hit / remove ----------
  function removeTarget(id){
    const t = state.targets.get(id);
    if(!t) return;
    state.targets.delete(id);
    try{ t.el.remove(); }catch(_){}
  }

  function hitTarget(id, source){
    const t = state.targets.get(id);
    if(!t) return;
    removeTarget(id);
    try{ onHit(Object.assign({ source }, t)); }catch(_){}
  }

  // ---------- shoot assist ----------
  function onShoot(ev){
    const d = ev?.detail || {};
    const x = Number(d.x), y = Number(d.y);
    const lockPx = clamp(d.lockPx ?? 26, 6, 120);

    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    // find nearest target center within lockPx
    let best = null;
    for(const t of state.targets.values()){
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;
      const dx = cx - x;
      const dy = cy - y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if(dist <= lockPx && (!best || dist < best.dist)){
        best = { id: t.id, dist };
      }
    }
    if(best) hitTarget(best.id, 'shoot');
  }

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  // ---------- loop ----------
  function tick(){
    if(!state.running) return;

    const tNow = now();

    // expire
    for(const t of Array.from(state.targets.values())){
      if(tNow >= t.expireAt){
        removeTarget(t.id);
        try{ onExpire(t); }catch(_){}
      }
    }

    // spawn
    if((tNow - state.lastSpawnAt) >= spawnRate){
      state.lastSpawnAt = tNow;
      spawnOnce();
    }

    state.raf = requestAnimationFrame(tick);
  }

  function spawnOnce(){
    if(!state.running) return null;
    if(state.targets.size >= maxTargets) return null;
    return makeTarget();
  }

  function clearAll(){
    for(const t of Array.from(state.targets.values())){
      removeTarget(t.id);
    }
  }

  function stop(){
    state.running = false;
    try{ cancelAnimationFrame(state.raf); }catch(_){}
    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
    clearAll();
  }

  // start
  state.lastSpawnAt = now();
  state.raf = requestAnimationFrame(tick);

  return controller;
}