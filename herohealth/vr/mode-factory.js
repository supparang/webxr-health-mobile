// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — DOM Target Spawner (PRODUCTION)
// ----------------------------------------------------
// ✅ Exports: boot (primary) + spawnBoot + makeSpawner + createSpawner + default
// ✅ Seeded RNG deterministic when seed provided
// ✅ Spawn DOM targets into mount, handles hit + expire
// ✅ Hooks:
//    - decorate(target, el) : set emoji/text/dataset/class
//    - onHit(target, el)    : game logic on click
//    - onExpire(target, el) : game logic on timeout
// ✅ Options:
//    mount, seed, spawnRate(ms), sizeRange([min,max]), ttlRange([min,max]),
//    kinds([{kind,weight}]), safePad(px), maxTargets
// ----------------------------------------------------

'use strict';

/* -----------------------------
 * RNG
------------------------------ */
function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function pickWeighted(items, rng){
  let sum = 0;
  for(const it of items) sum += Math.max(0, Number(it.weight)||0);
  if(sum <= 0) return items[0];
  let r = rng() * sum;
  for(const it of items){
    r -= Math.max(0, Number(it.weight)||0);
    if(r <= 0) return it;
  }
  return items[items.length - 1];
}

/* -----------------------------
 * Safe-area helper
------------------------------ */
function readCssPx(varName){
  try{
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if(!v) return 0;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }catch(_){ return 0; }
}

/* -----------------------------
 * Main factory
------------------------------ */
export function boot(opts = {}){
  const mount = opts.mount;
  if(!mount) throw new Error('mode-factory: mount required');

  const rng = (opts.seed != null) ? seededRng(opts.seed) : Math.random;

  const spawnRate = clamp(opts.spawnRate ?? 850, 180, 5000);
  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [46, 70];
  const ttlRange  = Array.isArray(opts.ttlRange)  ? opts.ttlRange  : [1600, 2800];

  const kinds = Array.isArray(opts.kinds) && opts.kinds.length
    ? opts.kinds
    : [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }];

  const safePad = clamp(opts.safePad ?? 12, 0, 80);
  const maxTargets = clamp(opts.maxTargets ?? 12, 1, 60);

  const decorate = typeof opts.decorate === 'function' ? opts.decorate : null;
  const onHit    = typeof opts.onHit === 'function' ? opts.onHit : null;
  const onExpire = typeof opts.onExpire === 'function' ? opts.onExpire : null;

  // internal state (declare first; no TDZ issues)
  const S = {
    running: true,
    intervalId: null,
    targets: new Set(),
    lastSpawnAt: 0,
  };

  function getSpawnRect(){
    const r = mount.getBoundingClientRect();

    // If mount is 0-sized, fallback to viewport
    const W = (r.width  > 10) ? r.width  : window.innerWidth;
    const H = (r.height > 10) ? r.height : window.innerHeight;
    const L = (r.width  > 10) ? r.left   : 0;
    const T = (r.height > 10) ? r.top    : 0;

    // read safe-area css vars if present
    const sat = readCssPx('--sat');
    const sar = readCssPx('--sar');
    const sab = readCssPx('--sab');
    const sal = readCssPx('--sal');

    const padT = safePad + sat;
    const padR = safePad + sar;
    const padB = safePad + sab;
    const padL = safePad + sal;

    return {
      left: L + padL,
      top:  T + padT,
      right: L + W - padR,
      bottom:T + H - padB,
      width: Math.max(1, W - (padL + padR)),
      height:Math.max(1, H - (padT + padB))
    };
  }

  function randBetween(a, b){
    a = Number(a)||0; b = Number(b)||0;
    if(b < a){ const t=a; a=b; b=t; }
    return a + (b - a) * rng();
  }

  function makeTarget(){
    const rect = getSpawnRect();

    const sz = randBetween(sizeRange[0], sizeRange[1]);
    const x = randBetween(rect.left + sz/2, rect.right - sz/2);
    const y = randBetween(rect.top  + sz/2, rect.bottom- sz/2);

    const kindPick = pickWeighted(kinds, rng);
    const t = {
      id: `${Date.now()}_${Math.floor(rng()*1e9)}`,
      kind: String(kindPick.kind || 'good'),
      x, y,
      size: sz,
      bornAt: performance.now(),
      ttlMs: randBetween(ttlRange[0], ttlRange[1]),
      // optional extra fields set by decorate hook (e.g., groupIndex)
    };

    const el = document.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = t.kind;

    // position via CSS vars if your CSS supports it; else inline
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.width  = `${sz}px`;
    el.style.height = `${sz}px`;
    el.style.position = 'absolute';
    el.style.transform = 'translate(-50%,-50%)';

    // default label
    el.textContent = (t.kind === 'junk') ? '🍩' : '🍎';

    // allow caller to decorate (set emoji/groupIndex etc.)
    if(decorate){
      try{ decorate(t, el); }catch(err){ console.warn('[mode-factory] decorate error', err); }
    }

    // click handler
    const onClick = (ev)=>{
      ev.preventDefault();
      if(!S.running) return;
      if(!S.targets.has(el)) return;
      removeTarget(el, t, 'hit');
      if(onHit){
        try{ onHit(t, el); }catch(err){ console.warn('[mode-factory] onHit error', err); }
      }
    };
    el.addEventListener('click', onClick, { passive:false });

    // mount & track
    mount.appendChild(el);
    S.targets.add(el);

    // expire timer
    const to = window.setTimeout(()=>{
      if(!S.running) return;
      if(!S.targets.has(el)) return;
      removeTarget(el, t, 'expire');
      if(onExpire){
        try{ onExpire(t, el); }catch(err){ console.warn('[mode-factory] onExpire error', err); }
      }
    }, Math.max(200, t.ttlMs));

    // attach meta for cleanup
    el.__hha_to = to;
    el.__hha_t  = t;

    // enforce max targets (remove oldest)
    if(S.targets.size > maxTargets){
      const first = S.targets.values().next().value;
      if(first) removeTarget(first, first.__hha_t, 'cap');
    }
  }

  function removeTarget(el, t, why){
    try{
      if(el && el.__hha_to) window.clearTimeout(el.__hha_to);
    }catch(_){}
    S.targets.delete(el);
    try{
      el?.remove();
    }catch(_){}
  }

  function tick(){
    if(!S.running) return;
    // spawn one per tick (fixed rate)
    makeTarget();
  }

  // start interval AFTER everything declared (no TDZ)
  S.intervalId = window.setInterval(tick, spawnRate);

  // public controller
  const controller = {
    stop(){
      if(!S.running) return;
      S.running = false;
      if(S.intervalId) window.clearInterval(S.intervalId);

      // remove all targets safely
      for(const el of Array.from(S.targets)){
        removeTarget(el, el.__hha_t, 'stop');
      }
      S.targets.clear();
    },
    setSpawnRate(ms){
      const v = clamp(ms, 180, 5000);
      if(S.intervalId) window.clearInterval(S.intervalId);
      S.intervalId = window.setInterval(tick, v);
    },
    getCount(){ return S.targets.size; }
  };

  return controller;
}

/* Aliases (for compatibility across files) */
export const spawnBoot = boot;
export const makeSpawner = boot;
export const createSpawner = boot;
export default boot;