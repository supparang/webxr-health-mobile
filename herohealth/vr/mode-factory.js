// === /herohealth/vr/mode-factory.js ===
// Mode Factory — SAFE Spawner (PRODUCTION)
// HHA Standard helper for spawn/hit/expire (Plate/Groups/GoodJunk/Hydration)
// ✅ export boot()
// ✅ deterministic RNG by seed
// ✅ click/tap hit + hha:shoot hit (crosshair)
// ✅ safe spawn rect avoids HUD via CSS vars: --hud-top-safe / --hud-bottom-safe
// ✅ no "controller before initialization" (fixed)

'use strict';

/* -----------------------------------------------------------
 * RNG
 * --------------------------------------------------------- */
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

function pickWeighted(rng, arr){
  // arr: [{weight,...}, ...]
  let sum = 0;
  for(const it of arr) sum += (Number(it.weight) || 0);
  let r = rng() * (sum || 1);
  for(const it of arr){
    r -= (Number(it.weight) || 0);
    if(r <= 0) return it;
  }
  return arr[arr.length - 1];
}

function pxFromCssVar(name, fallbackPx){
  try{
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if(!v) return fallbackPx;
    // supports "110px" or "110"
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallbackPx;
  }catch{
    return fallbackPx;
  }
}

/* -----------------------------------------------------------
 * Core boot
 * --------------------------------------------------------- */
export function boot(opts){
  const WIN = window;
  const DOC = document;

  const mount = opts?.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = (opts.seed != null) ? seededRng(opts.seed) : (opts.rng || Math.random);

  const spawnRate = clamp(opts.spawnRate ?? 900, 120, 999999);
  const ttlMs = clamp(opts.ttlMs ?? 1600, 240, 999999);

  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [44, 64];
  const minSize = clamp(sizeRange[0] ?? 44, 18, 220);
  const maxSize = clamp(sizeRange[1] ?? 64, minSize, 260);

  const kinds = Array.isArray(opts.kinds) && opts.kinds.length ? opts.kinds : [
    { kind:'good', weight:0.7 },
    { kind:'junk', weight:0.3 }
  ];

  const className = (opts.className || opts.targetClass || 'plateTarget').trim() || 'plateTarget';
  const labeler = (typeof opts.labeler === 'function')
    ? opts.labeler
    : (t)=> (t.kind === 'good' ? '🍽️' : '🍩');

  const onHit = (typeof opts.onHit === 'function') ? opts.onHit : ()=>{};
  const onExpire = (typeof opts.onExpire === 'function') ? opts.onExpire : ()=>{};

  // safe rect: avoid HUD overlay
  const SAFE_TOP  = clamp(opts.safeTopPx  ?? pxFromCssVar('--hud-top-safe', 110), 0, 600);
  const SAFE_BOT  = clamp(opts.safeBottomPx ?? pxFromCssVar('--hud-bottom-safe', 210), 0, 800);
  const SAFE_PADX = clamp(opts.safePadX ?? 14, 0, 80);

  const LOCK_PX_DEFAULT = clamp(opts.lockPx ?? 28, 8, 90);

  /* -------------------------------------------------------
   * State
   * ----------------------------------------------------- */
  let running = true;
  let spawnTimer = null;
  let idSeq = 1;

  /** active targets: {id, kind, groupIndex, xPct,yPct,sizePx,bornAt,ttlMs, el, expireTO} */
  const active = [];

  /* -------------------------------------------------------
   * Helpers
   * ----------------------------------------------------- */
  function getSafeRect(){
    const r = mount.getBoundingClientRect();
    const w = Math.max(0, r.width);
    const h = Math.max(0, r.height);

    const left = SAFE_PADX;
    const right = Math.max(left + 10, w - SAFE_PADX);
    const top = SAFE_TOP;
    const bottom = Math.max(top + 10, h - SAFE_BOT);

    return { w, h, left, right, top, bottom, rect: r };
  }

  function randBetween(a,b){
    return a + (b - a) * rng();
  }

  function spawnOne(){
    if(!running) return;
    const safe = getSafeRect();
    if(safe.w < 40 || safe.h < 40) return;

    const k = pickWeighted(rng, kinds);
    const kind = k.kind || 'good';

    const sizePx = Math.round(randBetween(minSize, maxSize));

    // position in pixels inside safe rect
    const xPx = randBetween(safe.left + sizePx*0.6, safe.right - sizePx*0.6);
    const yPx = randBetween(safe.top  + sizePx*0.7, safe.bottom - sizePx*0.7);

    // convert to % relative to mount box
    const xPct = safe.w > 0 ? (xPx / safe.w) * 100 : 50;
    const yPct = safe.h > 0 ? (yPx / safe.h) * 100 : 50;

    const t = {
      id: idSeq++,
      kind,
      groupIndex: (Number.isFinite(k.groupIndex) ? k.groupIndex : undefined),
      xPct, yPct,
      sizePx,
      bornAt: performance.now(),
      ttlMs: clamp(k.ttlMs ?? ttlMs, 240, 999999),
      el: null,
      expireTO: null
    };

    const el = DOC.createElement('div');
    el.className = className;
    el.dataset.id = String(t.id);
    el.dataset.kind = String(kind);
    if(t.groupIndex != null) el.dataset.groupIndex = String(t.groupIndex);

    el.style.setProperty('--x', String(t.xPct));
    el.style.setProperty('--y', String(t.yPct));
    el.style.setProperty('--s', String(t.sizePx));

    el.textContent = String(labeler(t) ?? '');

    // click/tap hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      hitTarget(t, { source:'pointer' });
    }, { passive:false });

    t.el = el;
    mount.appendChild(el);

    // expire
    t.expireTO = setTimeout(()=>{
      expireTarget(t);
    }, t.ttlMs);

    active.push(t);
  }

  function removeTarget(t){
    if(!t) return;
    clearTimeout(t.expireTO);
    t.expireTO = null;

    const idx = active.indexOf(t);
    if(idx >= 0) active.splice(idx, 1);

    if(t.el && t.el.parentNode){
      t.el.parentNode.removeChild(t.el);
    }
    t.el = null;
  }

  function hitTarget(t, meta){
    if(!running) return;
    if(!t || !t.el) return;

    // tiny feedback class (CSS optional)
    try{
      t.el.classList.add('is-hit');
      setTimeout(()=>{ try{ t.el && t.el.classList.remove('is-hit'); }catch{} }, 160);
    }catch{}

    removeTarget(t);
    try{ onHit(Object.assign({}, t, meta || {})); }catch{}
  }

  function expireTarget(t){
    if(!running) return;
    if(!t || !t.el) return;
    removeTarget(t);
    try{ onExpire(Object.assign({}, t, { source:'expire' })); }catch{}
  }

  function findNearestTarget(x, y, lockPx){
    let best = null;
    let bestD = Infinity;

    for(const t of active){
      const el = t.el;
      if(!el) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;
      const dx = cx - x;
      const dy = cy - y;
      const d = Math.hypot(dx, dy);
      if(d < bestD){
        bestD = d;
        best = t;
      }
    }
    if(best && bestD <= lockPx) return best;

    // fallback: elementFromPoint
    const hitEl = DOC.elementFromPoint(x, y);
    if(hitEl){
      const id = hitEl?.dataset?.id;
      if(id){
        const t = active.find(a => String(a.id) === String(id));
        if(t) return t;
      }
    }
    return null;
  }

  /* -------------------------------------------------------
   * hha:shoot integration (crosshair)
   * ----------------------------------------------------- */
  function onShoot(ev){
    if(!running) return;
    const d = ev?.detail || {};
    const x = Number(d.x);
    const y = Number(d.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    const lockPx = clamp(d.lockPx ?? LOCK_PX_DEFAULT, 8, 120);
    const t = findNearestTarget(x, y, lockPx);
    if(t) hitTarget(t, { source:'shoot', lockPx });
  }

  /* -------------------------------------------------------
   * Controller (declared early; assigned after)
   * ----------------------------------------------------- */
  let controller = null;

  function startLoop(){
    if(spawnTimer) clearInterval(spawnTimer);
    spawnTimer = setInterval(()=>{
      if(!running) return;
      spawnOne();
    }, spawnRate);
  }

  function destroyAll(){
    // remove everything safely
    for(const t of [...active]) removeTarget(t);
  }

  controller = {
    stop(){
      running = false;
      if(spawnTimer) clearInterval(spawnTimer);
      spawnTimer = null;
      WIN.removeEventListener('hha:shoot', onShoot);
      destroyAll();
    },
    pause(){
      running = false;
    },
    resume(){
      if(!spawnTimer) startLoop();
      running = true;
    },
    spawn(){
      spawnOne();
    },
    clear(){
      destroyAll();
    },
    getActiveCount(){
      return active.length;
    }
  };

  // bind shoot AFTER controller exists
  WIN.addEventListener('hha:shoot', onShoot);

  // start
  startLoop();

  return controller;
}