// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — DOM Target Spawner (PRODUCTION PATCH A21)
// ✅ export boot() (fix: "no export named boot")
// ✅ fix TDZ: no "controller before initialization"
// ✅ Spawn DOM targets inside mount
// ✅ Click/tap hit + crosshair shoot (hha:shoot)
// ✅ Seeded RNG support
// ✅ Safe spawn bounds (avoid HUD & edges)
// ✅ destroy() to cleanup timers/listeners

'use strict';

const WIN = window;
const DOC = document;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function pickWeighted(items, rng){
  const total = items.reduce((s,it)=>s + (Number(it.weight)||0), 0) || 1;
  let r = (rng ? rng() : Math.random()) * total;
  for(const it of items){
    r -= (Number(it.weight)||0);
    if(r <= 0) return it;
  }
  return items[items.length-1];
}

function seededRng(seed){
  let t = (Number(seed)||0) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function getSafeArea(){
  // Basic safe-area from CSS env values if present (best-effort)
  const cs = getComputedStyle(DOC.documentElement);
  const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
  const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
  const sal = parseFloat(cs.getPropertyValue('--sal')) || 0;
  const sar = parseFloat(cs.getPropertyValue('--sar')) || 0;
  return { sat, sab, sal, sar };
}

function defaultTargetEl(){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.textContent = '🍽️';
  return el;
}

/**
 * boot({
 *   mount: HTMLElement,
 *   seed?: number,
 *   rng?: ()=>number,
 *   spawnRate?: ms,
 *   ttl?: ms,
 *   sizeRange?: [min,max],
 *   kinds?: [{kind, weight, emoji?}],
 *   onHit?: (t)=>void,
 *   onExpire?: (t)=>void,
 * })
 */
export function boot(opts={}){
  if(!DOC) throw new Error('mode-factory: document missing');
  const mount = opts.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  // ------- controller/state (declare BEFORE any use; fix TDZ) -------
  const controller = {
    alive: true,
    timerId: null,
    targets: new Map(),   // id -> target
    lastId: 0,
    rng: null,
    destroy,
    spawnOne,
    clearAll,
  };

  // ------- config -------
  const spawnRate = Math.max(120, Number(opts.spawnRate || 900) || 900);
  const ttl       = Math.max(300, Number(opts.ttl || 1300) || 1300);
  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [44, 64];
  const kinds     = Array.isArray(opts.kinds) && opts.kinds.length ? opts.kinds : [
    { kind:'good', weight:0.7, emoji:'🥦' },
    { kind:'junk', weight:0.3, emoji:'🍟' }
  ];

  controller.rng = (typeof opts.rng === 'function')
    ? opts.rng
    : seededRng(opts.seed ?? Date.now());

  // ensure mount positioning
  const ms = getComputedStyle(mount);
  if(ms.position === 'static') mount.style.position = 'fixed';
  if(!mount.style.inset) mount.style.inset = '0';
  mount.style.touchAction = 'none';
  mount.style.userSelect = 'none';

  // ------- helpers -------
  function getPlayRect(){
    const r = mount.getBoundingClientRect();
    // avoid edges + avoid HUD area using safe-area + extra padding
    const { sat, sab, sal, sar } = getSafeArea();
    const pad = 10;

    // conservative HUD zones (top/bottom) — tuned for your layouts
    const topHud = 120 + sat;         // HUD top + quest card area
    const bottomHud = 110 + sab;      // buttons / coach

    const left = r.left + pad + sal;
    const right = r.right - pad - sar;
    const top = r.top + pad + topHud;
    const bottom = r.bottom - pad - bottomHud;

    // fallback if rect too small: relax HUD exclusion
    if((right-left) < 140 || (bottom-top) < 160){
      return {
        left: r.left + pad + sal,
        right: r.right - pad - sar,
        top: r.top + pad + sat,
        bottom: r.bottom - pad - sab
      };
    }
    return { left, right, top, bottom };
  }

  function spawnPos(size){
    const pr = getPlayRect();
    const w = Math.max(40, (pr.right - pr.left) - size);
    const h = Math.max(40, (pr.bottom - pr.top) - size);
    const x = pr.left + (controller.rng() * w) + size/2;
    const y = pr.top + (controller.rng() * h) + size/2;
    return { x, y };
  }

  function makeTarget(){
    const pick = pickWeighted(kinds, controller.rng);
    const size = Math.round(
      clamp(sizeRange[0], 18, 200) +
      controller.rng() * (clamp(sizeRange[1], 18, 240) - clamp(sizeRange[0], 18, 200))
    );

    const { x, y } = spawnPos(size);

    const el = defaultTargetEl();
    el.dataset.kind = pick.kind;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.position = 'fixed';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.zIndex = '11';

    if(pick.emoji) el.textContent = pick.emoji;

    const id = String(++controller.lastId);
    const t = {
      id,
      kind: pick.kind,
      emoji: pick.emoji || '',
      groupIndex: (pick.kind === 'good') ? Math.floor(controller.rng()*5) : null,
      el,
      bornAt: performance.now(),
      expiresAt: performance.now() + ttl
    };

    return t;
  }

  function removeTarget(id, why){
    const t = controller.targets.get(id);
    if(!t) return;
    controller.targets.delete(id);
    try{ t.el.remove(); }catch(_){}
    if(why === 'expire'){
      try{ opts.onExpire && opts.onExpire(t); }catch(_){}
    }
  }

  function clearAll(){
    for(const [id] of controller.targets) removeTarget(id, 'clear');
  }

  // hit test by coordinates (for crosshair shoot)
  function hitTestAt(x, y, lockPx){
    const lx = Number(x)||0;
    const ly = Number(y)||0;
    const lp = Math.max(0, Number(lockPx||0)||0);

    // pick the nearest target inside lock radius (simple & fair)
    let best = null;
    let bestD = Infinity;

    for(const t of controller.targets.values()){
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dx = cx - lx;
      const dy = cy - ly;
      const d = Math.sqrt(dx*dx + dy*dy);
      const hitRadius = (Math.min(r.width, r.height)/2) + lp;
      if(d <= hitRadius && d < bestD){
        best = t;
        bestD = d;
      }
    }
    return best;
  }

  function onPointerDown(e){
    if(!controller.alive) return;
    const btn = e.target && e.target.closest && e.target.closest('button, a');
    if(btn) return;

    const tEl = e.target && e.target.closest && e.target.closest('.plateTarget');
    if(!tEl) return;

    // find target
    for(const t of controller.targets.values()){
      if(t.el === tEl){
        removeTarget(t.id, 'hit');
        try{ opts.onHit && opts.onHit(t); }catch(_){}
        return;
      }
    }
  }

  function onShoot(ev){
    if(!controller.alive) return;
    const d = ev && ev.detail ? ev.detail : {};
    const W = WIN.innerWidth || 360;
    const H = WIN.innerHeight || 640;
    const x = Number(d.x ?? (W/2));
    const y = Number(d.y ?? (H/2));
    const lockPx = Number(d.lockPx ?? 0);

    const hit = hitTestAt(x, y, lockPx);
    if(hit){
      removeTarget(hit.id, 'hit');
      try{ opts.onHit && opts.onHit(hit); }catch(_){}
    }
  }

  // ---------- main spawn loop ----------
  function tick(){
    if(!controller.alive) return;

    const now = performance.now();
    for(const [id, t] of controller.targets){
      if(now >= t.expiresAt){
        removeTarget(id, 'expire');
      }
    }

    // keep a small stable population
    const desired = 3; // can be tuned later per diff
    while(controller.targets.size < desired){
      spawnOne();
    }
  }

  function spawnOne(){
    if(!controller.alive) return;
    const t = makeTarget();
    controller.targets.set(t.id, t);
    mount.appendChild(t.el);
  }

  function destroy(){
    if(!controller.alive) return;
    controller.alive = false;
    try{ clearInterval(controller.timerId); }catch(_){}
    controller.timerId = null;
    clearAll();
    try{ mount.removeEventListener('pointerdown', onPointerDown); }catch(_){}
    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
  }

  // ---------- bind listeners ----------
  mount.addEventListener('pointerdown', onPointerDown, { passive:true });
  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  // ---------- start loop ----------
  controller.timerId = setInterval(tick, 80);
  tick();

  return controller;
}