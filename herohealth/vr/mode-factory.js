// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — DOM Target Spawner (PLATE-PATCH / STABLE)
// ✅ Exports: boot({ mount, seed, spawnRate, sizeRange, kinds, onHit, onExpire })
// ✅ Fix: "Cannot access 'controller' before initialization"
// ✅ Fix: ensure named export 'boot' exists
// ✅ Basic seeded RNG support
// ✅ Spawns circular targets into mount (absolute positioned)
// ✅ Supports tap/click + hha:shoot (crosshair assist)

'use strict';

const WIN = window;
const DOC = document;

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
  // items: [{kind, weight}, ...]
  const arr = Array.isArray(items) ? items : [];
  let sum = 0;
  for(const it of arr) sum += Math.max(0, Number(it.weight)||0);
  if(sum <= 0) return arr[0] || { kind:'good', weight:1 };

  let t = rng() * sum;
  for(const it of arr){
    t -= Math.max(0, Number(it.weight)||0);
    if(t <= 0) return it;
  }
  return arr[arr.length-1];
}

function rectOf(el){
  const r = el.getBoundingClientRect();
  return { x:r.left, y:r.top, w:r.width, h:r.height };
}

function createTargetEl(){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.style.position = 'absolute';
  el.style.left = '0px';
  el.style.top  = '0px';
  el.style.width = '56px';
  el.style.height = '56px';
  el.style.fontSize = '26px';
  el.style.display = 'grid';
  el.style.placeItems = 'center';
  el.style.userSelect = 'none';
  el.style.touchAction = 'none';
  return el;
}

function dist2(ax,ay,bx,by){
  const dx=ax-bx, dy=ay-by;
  return dx*dx+dy*dy;
}

export function boot(opts = {}){
  const mount = opts.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  // ----- cfg -----
  const seed = opts.seed ?? Date.now();
  const rng  = opts.rng || seededRng(seed);

  const spawnRate = clamp(opts.spawnRate ?? 900, 200, 5000);
  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [44,64];
  const minS = clamp(sizeRange[0] ?? 44, 24, 220);
  const maxS = clamp(sizeRange[1] ?? 64, minS, 260);

  const kinds = Array.isArray(opts.kinds) ? opts.kinds : [{kind:'good', weight:1}];

  const onHit    = (typeof opts.onHit === 'function') ? opts.onHit : ()=>{};
  const onExpire = (typeof opts.onExpire === 'function') ? opts.onExpire : ()=>{};

  // ----- state -----
  const state = {
    alive:true,
    timer:null,
    targets:new Map(), // id -> meta
    nextId:1
  };

  // ensure mount style
  const ms = mount.style;
  if(getComputedStyle(mount).position === 'static'){
    ms.position = 'fixed';
    ms.inset = '0';
  }

  function spawnOne(){
    if(!state.alive) return;

    const play = rectOf(mount);
    if(play.w < 80 || play.h < 80) return; // too small, skip

    const s = Math.round(minS + rng()*(maxS-minS));
    const pad = 10;

    // pick position inside playfield
    const x = Math.round(play.x + pad + rng() * Math.max(1, play.w - s - pad*2));
    const y = Math.round(play.y + pad + rng() * Math.max(1, play.h - s - pad*2));

    const picked = pickWeighted(rng, kinds);
    const kind = String(picked.kind || 'good');

    const id = String(state.nextId++);
    const el = createTargetEl();
    el.dataset.id = id;
    el.dataset.kind = kind;
    el.setAttribute('data-kind', kind);

    el.style.width = `${s}px`;
    el.style.height = `${s}px`;
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.fontSize = `${Math.max(20, Math.round(s*0.45))}px`;

    // emoji content by kind (fallback)
    el.textContent = (kind === 'junk') ? '🍩' : '🍽️';

    // lifetime
    const bornAt = performance.now();
    const ttlMs = clamp(opts.ttlMs ?? 1800, 500, 6000);

    const meta = { id, kind, x, y, s, bornAt, ttlMs, el };
    state.targets.set(id, meta);

    mount.appendChild(el);

    // expire
    setTimeout(()=>{
      const m = state.targets.get(id);
      if(!m) return;
      // still alive -> expire
      state.targets.delete(id);
      try{ m.el.remove(); }catch(_){}
      try{ onExpire({ kind:m.kind, id:m.id }); }catch(_){}
    }, ttlMs);

    // direct click/tap hit
    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(id, 'tap', e.clientX, e.clientY);
    }, { passive:false });
  }

  function hitTarget(id, source='tap', px=null, py=null){
    const m = state.targets.get(id);
    if(!m) return false;

    state.targets.delete(id);
    try{ m.el.remove(); }catch(_){}

    try{
      onHit({
        id:m.id,
        kind:m.kind,
        source,
        groupIndex: (m.kind === 'good') ? Math.floor(rng()*5) : undefined
      });
    }catch(_){}
    return true;
  }

  // crosshair shooting: find nearest target to center (lockPx)
  function onShoot(ev){
    if(!state.alive) return;
    const d = ev?.detail || {};
    const W = WIN.innerWidth || 360;
    const H = WIN.innerHeight || 640;
    const cx = (d.x ?? (W/2));
    const cy = (d.y ?? (H/2));
    const lockPx = clamp(d.lockPx ?? 26, 6, 120);

    let bestId = null;
    let bestD2 = Infinity;

    for(const [id,m] of state.targets){
      const tx = m.x + m.s/2;
      const ty = m.y + m.s/2;
      const dd2 = dist2(cx,cy,tx,ty);
      if(dd2 < bestD2){
        bestD2 = dd2;
        bestId = id;
      }
    }

    if(bestId && bestD2 <= lockPx*lockPx){
      hitTarget(bestId, String(d.source||'shoot'), cx, cy);
    }
  }

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  // loop
  state.timer = setInterval(()=>{
    if(!state.alive) return;
    spawnOne();
  }, spawnRate);

  // spawn a few immediately
  spawnOne();
  setTimeout(spawnOne, Math.round(spawnRate*0.45));

  // controller API
  const controller = {
    stop(){
      if(!state.alive) return;
      state.alive = false;
      try{ clearInterval(state.timer); }catch(_){}
      WIN.removeEventListener('hha:shoot', onShoot, { passive:true });
      // cleanup targets
      for(const [id,m] of state.targets){
        try{ m.el.remove(); }catch(_){}
      }
      state.targets.clear();
    },
    setEmojiMap(map){
      // optional future hook
      controller.emojiMap = map || null;
    }
  };

  return controller;
}