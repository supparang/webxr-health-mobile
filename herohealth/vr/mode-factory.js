// =========================================================
// /herohealth/vr/mode-factory.js
// HHA Mode Factory — DOM Target Spawner (PRODUCTION)
// ---------------------------------------------------------
// ✅ export boot (fix import error)
// ✅ Fix: controller referenced before init
// ✅ Reliable spawn bounds (playRect fallback + resize safe)
// ✅ Click/tap hit + crosshair shoot via vr-ui.js (hha:shoot)
// ✅ Seeded RNG support (cfg.seed / cfg.rng)
// ✅ onHit / onExpire hooks
// ✅ Per-target TTL + safe cleanup
// =========================================================

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function nowMs(){ return Date.now(); }

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function getView(){
  const v = (qs('view','') || '').toLowerCase();
  return v || ''; // '' allowed
}

function seededRng(seed){
  let t = (Number(seed) || 0) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * boot({
 *   mount: HTMLElement,
 *   seed?: number,
 *   rng?: ()=>number,
 *   spawnRate?: number (ms),
 *   maxTargets?: number,
 *   sizeRange?: [min,max],
 *   ttlRange?: [min,max] (ms),
 *   kinds?: [{kind, weight}],
 *   onHit?: (target)=>void,
 *   onExpire?: (target)=>void,
 * })
 */
export function boot(cfg = {}){
  if(!DOC) throw new Error('mode-factory: document missing');
  const mount = cfg.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  // ---------- RNG ----------
  const rng = (typeof cfg.rng === 'function')
    ? cfg.rng
    : (cfg.seed != null ? seededRng(cfg.seed) : Math.random);

  // ---------- Config defaults ----------
  const spawnRate = clamp(cfg.spawnRate ?? 900, 120, 5000);
  const maxTargets = clamp(cfg.maxTargets ?? 6, 1, 40);

  const sizeMin = clamp((cfg.sizeRange && cfg.sizeRange[0]) ?? 44, 18, 220);
  const sizeMax = clamp((cfg.sizeRange && cfg.sizeRange[1]) ?? 72, sizeMin, 260);

  const ttlMin = clamp((cfg.ttlRange && cfg.ttlRange[0]) ?? 1200, 350, 20000);
  const ttlMax = clamp((cfg.ttlRange && cfg.ttlRange[1]) ?? 2400, ttlMin, 30000);

  const kinds = Array.isArray(cfg.kinds) && cfg.kinds.length
    ? cfg.kinds.map(k => ({ kind: String(k.kind||'good'), weight: Math.max(0, Number(k.weight)||0) }))
    : [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }];

  const onHit = (typeof cfg.onHit === 'function') ? cfg.onHit : (()=>{});
  const onExpire = (typeof cfg.onExpire === 'function') ? cfg.onExpire : (()=>{});

  // ---------- weighted pick ----------
  const totalW = kinds.reduce((s,k)=>s+k.weight, 0) || 1;
  function pickKind(){
    let r = rng() * totalW;
    for(const k of kinds){
      r -= k.weight;
      if(r <= 0) return k.kind;
    }
    return kinds[kinds.length-1].kind;
  }

  // ---------- play rect ----------
  // IMPORTANT: spawn inside visible safe area; fallback to viewport.
  let rect = null;

  function computeRect(){
    // Prefer mount rect if it has size; otherwise viewport rect.
    const r = mount.getBoundingClientRect();
    const w = r.width, h = r.height;

    if(w > 40 && h > 40){
      rect = { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:w, height:h };
    } else {
      rect = { left:0, top:0, right:WIN.innerWidth, bottom:WIN.innerHeight, width:WIN.innerWidth, height:WIN.innerHeight };
    }

    // Add a small padding so targets won't be clipped
    const pad = 10;
    rect.left   += pad;
    rect.top    += pad;
    rect.right  -= pad;
    rect.bottom -= pad;
    rect.width  = Math.max(0, rect.right - rect.left);
    rect.height = Math.max(0, rect.bottom - rect.top);
  }

  // initial
  computeRect();

  // resize / rotate safe
  let _resizeTO = null;
  function onResize(){
    clearTimeout(_resizeTO);
    _resizeTO = setTimeout(computeRect, 60);
  }
  WIN.addEventListener('resize', onResize, { passive:true });
  WIN.addEventListener('orientationchange', onResize, { passive:true });

  // ---------- targets state ----------
  const targets = new Map(); // id -> target
  let nextId = 1;
  let running = true;

  function removeTarget(t, why='remove'){
    if(!t || !targets.has(t.id)) return;
    targets.delete(t.id);
    try { t.el?.remove(); } catch(_){}
    clearTimeout(t._ttlTO);
    if(why === 'expire') onExpire(t);
  }

  function clearAll(){
    for(const t of targets.values()){
      try { t.el?.remove(); } catch(_){}
      clearTimeout(t._ttlTO);
    }
    targets.clear();
  }

  // ---------- hit test helpers ----------
  function hitTestPoint(x, y){
    // x,y are viewport coords
    // Try elementFromPoint first (fast) then fallback to distance check.
    const el = DOC.elementFromPoint(x, y);
    if(el){
      const hitEl = el.closest?.('.plateTarget, .hhaTarget, [data-target]');
      if(hitEl){
        for(const t of targets.values()){
          if(t.el === hitEl) return t;
        }
      }
    }

    // fallback: find closest center
    let best = null;
    let bestD = 1e18;
    for(const t of targets.values()){
      const rr = t.el.getBoundingClientRect();
      const cx = rr.left + rr.width/2;
      const cy = rr.top + rr.height/2;
      const dx = x - cx, dy = y - cy;
      const d2 = dx*dx + dy*dy;
      // allow some slack (hit radius ~ 0.52 * size)
      const rad = Math.max(18, rr.width * 0.52);
      if(d2 <= rad*rad && d2 < bestD){
        best = t; bestD = d2;
      }
    }
    return best;
  }

  // ---------- pointer hit ----------
  function onPointerDown(ev){
    if(!running) return;
    // ignore if not in mount visual area (best-effort)
    const x = ev.clientX, y = ev.clientY;
    const t = hitTestPoint(x,y);
    if(t){
      onHit(t);
      removeTarget(t, 'hit');
    }
  }
  mount.addEventListener('pointerdown', onPointerDown, { passive:true });

  // ---------- crosshair shoot (vr-ui.js) ----------
  // vr-ui emits: hha:shoot {x,y,lockPx,source}
  function onShoot(ev){
    if(!running) return;
    const d = ev.detail || {};
    let x = Number(d.x), y = Number(d.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)){
      // fallback center
      x = WIN.innerWidth/2;
      y = WIN.innerHeight/2;
    }

    // For view=cvr strict: allow lock zone around center
    const view = getView();
    const lockPx = clamp(d.lockPx ?? 28, 8, 120);
    if(view === 'cvr'){
      // snap to exact center to match your standard
      const cx = WIN.innerWidth/2, cy = WIN.innerHeight/2;
      // if within lockPx, clamp to center
      if(Math.abs(x-cx) <= lockPx && Math.abs(y-cy) <= lockPx){
        x = cx; y = cy;
      }
    }

    const t = hitTestPoint(x,y);
    if(t){
      onHit(t);
      removeTarget(t, 'hit');
    }
  }
  WIN.addEventListener('hha:shoot', onShoot);

  // ---------- spawn ----------
  function randBetween(a,b){ return a + (b-a) * rng(); }

  function spawnOne(){
    if(!running) return;
    if(targets.size >= maxTargets) return;

    // Ensure rect valid
    if(!rect || rect.width < 40 || rect.height < 40){
      computeRect();
      if(!rect || rect.width < 40 || rect.height < 40) return;
    }

    const size = Math.round(randBetween(sizeMin, sizeMax));
    const x = Math.round(rect.left + randBetween(0, Math.max(1, rect.width - size)));
    const y = Math.round(rect.top  + randBetween(0, Math.max(1, rect.height - size)));

    const kind = pickKind();

    const id = nextId++;
    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;
    el.dataset.target = '1';
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    // emoji content: engine may override later; put something visible by default
    // Plate/Groups engine can also set innerText itself.
    el.textContent = (kind === 'junk') ? '🍩' : '🥦';

    mount.appendChild(el);

    const t = {
      id, kind, el,
      bornAt: nowMs(),
      size,
      groupIndex: Math.floor(rng()*5),
      _ttlTO: null
    };

    // TTL expire
    const ttl = Math.round(randBetween(ttlMin, ttlMax));
    t._ttlTO = setTimeout(()=>{
      // if already removed, ignore
      if(!targets.has(id)) return;
      removeTarget(t, 'expire');
    }, ttl);

    targets.set(id, t);
  }

  // spawn loop
  let loopTimer = null;
  function loop(){
    if(!running) return;
    // spawn up to fill
    spawnOne();
    loopTimer = setTimeout(loop, spawnRate);
  }
  loop();

  // ---------- controller object (returned) ----------
  // NOTE: define AFTER everything to avoid "before initialization" errors.
  const controller = {
    stop(){
      running = false;
      clearTimeout(loopTimer);
      clearTimeout(_resizeTO);
      clearAll();
      mount.removeEventListener('pointerdown', onPointerDown);
      WIN.removeEventListener('hha:shoot', onShoot);
      WIN.removeEventListener('resize', onResize);
      WIN.removeEventListener('orientationchange', onResize);
    },
    setRunning(v){
      running = !!v;
      if(running && !loopTimer) loop();
    },
    spawnNow(n=1){
      n = clamp(n, 1, 20);
      for(let i=0;i<n;i++) spawnOne();
    },
    getCount(){ return targets.size; },
    getRect(){ return rect ? { ...rect } : null; },
    _debugTargets(){ return Array.from(targets.values()).map(t=>({id:t.id, kind:t.kind, size:t.size})); }
  };

  return controller;
}