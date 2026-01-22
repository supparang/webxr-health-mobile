// === /herohealth/vr/mode-factory.js ===
// DOM Target Spawner (HHA Standard-ish) — PRODUCTION
// ✅ export named boot()
// ✅ click/tap hit
// ✅ crosshair shoot via window event: hha:shoot {x,y,lockPx}
// ✅ safe spawn: separation + tries
// ✅ expiry + maxAlive + stop()
// ✅ FIX: no "controller before initialization" (use let + init order)

'use strict';

const WIN = window;
const DOC = document;

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

function seededRng(seed){
  let t = (seed >>> 0);
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

function rectCenter(r){ return { x: r.left + r.width/2, y: r.top + r.height/2 }; }
function dist(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }

function qsAll(sel, root){ try{ return Array.from((root||DOC).querySelectorAll(sel)); }catch{ return []; } }

function defaultKinds(){
  return [
    { kind:'good', weight:0.7 },
    { kind:'junk', weight:0.3 }
  ];
}

function pickWeighted(rng, kinds){
  let sum = 0;
  for(const k of kinds) sum += (Number(k.weight)||0);
  let t = rng() * (sum || 1);
  for(const k of kinds){
    t -= (Number(k.weight)||0);
    if(t <= 0) return k.kind || 'good';
  }
  return kinds?.[0]?.kind || 'good';
}

function makeEl(kind){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.dataset.kind = kind;
  // content will be filled by decorateTarget
  return el;
}

function decorateDefault(el, data){
  // data: { kind, emoji, label }
  const emoji = data.emoji || (data.kind === 'junk' ? '🍟' : '🍎');
  const label = data.label || '';
  el.innerHTML = `
    <div class="emo">${emoji}</div>
    ${label ? `<div class="tag">${label}</div>` : ``}
  `;
}

function applyPosSize(el, x, y, s){
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  el.style.width  = `${s}px`;
  el.style.height = `${s}px`;
  el.style.position = 'absolute';
  el.style.transform = 'translate(-50%,-50%)';
}

/**
 * boot({
 *  mount, seed, spawnRate, sizeRange,
 *  kinds:[{kind,weight}], lifetimeMs, maxAlive,
 *  minSeparationPx, spawnTries,
 *  makeItem:(kind, rng)=>({kind, emoji, label, groupIndex, ...}),
 *  decorateTarget:(el, item)=>void,
 *  onHit:(item, meta)=>void,
 *  onExpire:(item)=>void
 * })
 */
export function boot(opts){
  const mount = opts?.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(Number(opts.seed) || Date.now());
  const spawnRate = clamp(Number(opts.spawnRate)||900, 120, 5000);
  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [44,64];
  const minS = clamp(Number(sizeRange[0]||44), 24, 180);
  const maxS = clamp(Number(sizeRange[1]||64), minS, 240);

  const kinds = Array.isArray(opts.kinds) ? opts.kinds : defaultKinds();
  const lifetimeMs = clamp(Number(opts.lifetimeMs)||2600, 500, 20000);
  const maxAlive = clamp(Number(opts.maxAlive)||10, 1, 80);

  const minSeparationPx = clamp(Number(opts.minSeparationPx)||18, 0, 120);
  const spawnTries = clamp(Number(opts.spawnTries)||16, 1, 60);

  const makeItem = typeof opts.makeItem === 'function'
    ? opts.makeItem
    : (kind)=>({ kind, emoji: kind==='junk'?'🍟':'🍎', label:'' });

  const decorateTarget = typeof opts.decorateTarget === 'function'
    ? opts.decorateTarget
    : decorateDefault;

  const onHit = typeof opts.onHit === 'function' ? opts.onHit : ()=>{};
  const onExpire = typeof opts.onExpire === 'function' ? opts.onExpire : ()=>{};

  // controller (FIX: declare first, init after)
  let controller = null;

  const state = {
    alive: [],
    running: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    shootHandler: null
  };

  function getPlayRect(){
    // spawn inside mount bounds
    const r = mount.getBoundingClientRect();
    // small padding so target not cut off
    const pad = 10;
    return {
      left: r.left + pad,
      top: r.top + pad,
      right: r.right - pad,
      bottom: r.bottom - pad,
      width: Math.max(0, r.width - pad*2),
      height: Math.max(0, r.height - pad*2)
    };
  }

  function canPlace(x,y,s){
    const c = { x, y };
    for(const it of state.alive){
      const d = dist(c, it.center);
      const minD = (it.size/2) + (s/2) + minSeparationPx;
      if(d < minD) return false;
    }
    return true;
  }

  function spawnOne(){
    if(!state.running) return;
    if(state.alive.length >= maxAlive) return;

    const pr = getPlayRect();
    if(pr.width < 40 || pr.height < 40) return;

    const kind = pickWeighted(rng, kinds);
    const item = makeItem(kind, rng) || { kind };

    const s = Math.round(minS + (maxS-minS) * rng());
    let x=0,y=0, ok=false;

    for(let t=0; t<spawnTries; t++){
      x = pr.left + (rng() * pr.width);
      y = pr.top + (rng() * pr.height);
      if(canPlace(x,y,s)){ ok=true; break; }
    }
    if(!ok){
      // fallback: allow anyway (still better than no target)
      x = pr.left + (rng() * pr.width);
      y = pr.top + (rng() * pr.height);
    }

    const el = makeEl(item.kind || kind);
    applyPosSize(el, x, y, s);
    decorateTarget(el, item);

    const meta = {
      el,
      kind: item.kind || kind,
      item,
      bornAt: now(),
      size: s,
      center: { x, y }
    };

    // click/tap hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(meta, { source:'pointer', x: ev.clientX, y: ev.clientY });
    }, { passive:false });

    mount.appendChild(el);
    state.alive.push(meta);

    // expiry
    meta.expTO = setTimeout(()=>{
      if(!state.running) return;
      expire(meta);
    }, lifetimeMs);
  }

  function remove(meta){
    try{ clearTimeout(meta.expTO); }catch{}
    const idx = state.alive.indexOf(meta);
    if(idx >= 0) state.alive.splice(idx,1);
    try{ meta.el?.remove(); }catch{}
  }

  function hit(meta, hmeta){
    if(!state.running) return;
    remove(meta);
    try{ onHit(meta.item, hmeta || {}); }catch{}
  }

  function expire(meta){
    if(!state.running) return;
    remove(meta);
    try{ onExpire(meta.item); }catch{}
  }

  function shootHitTest(x,y,lockPx){
    // choose nearest target within lockPx (or default 28)
    const lock = clamp(Number(lockPx)||28, 8, 120);
    let best = null;
    let bestD = 1e9;

    for(const m of state.alive){
      const r = m.el.getBoundingClientRect();
      const c = rectCenter(r);
      const d = Math.hypot((c.x-x),(c.y-y));
      if(d <= lock && d < bestD){
        bestD = d;
        best = m;
      }
    }
    if(best) hit(best, { source:'shoot', x, y, lockPx: lock });
  }

  function startLoop(){
    state.lastSpawnAt = 0;
    state.spawnTimer = setInterval(()=>{
      if(!state.running) return;
      // spawn pacing
      const t = now();
      if(state.lastSpawnAt === 0 || (t - state.lastSpawnAt) >= spawnRate){
        state.lastSpawnAt = t;
        spawnOne();
      }
    }, 60);
  }

  function wireShoot(){
    state.shootHandler = (e)=>{
      const d = e?.detail || {};
      const x = Number(d.x), y = Number(d.y);
      if(!Number.isFinite(x) || !Number.isFinite(y)) return;
      shootHitTest(x,y, d.lockPx);
    };
    WIN.addEventListener('hha:shoot', state.shootHandler);
  }

  function initController(){
    // kept for compatibility (future expansion), but safe init order
    controller = {
      stop(){
        state.running = false;
        try{ clearInterval(state.spawnTimer); }catch{}
        if(state.shootHandler){
          try{ WIN.removeEventListener('hha:shoot', state.shootHandler); }catch{}
        }
        // cleanup alive
        for(const m of [...state.alive]) remove(m);
      }
    };
  }

  // init order (FIX)
  initController();
  wireShoot();
  startLoop();

  return controller;
}