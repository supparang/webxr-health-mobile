// === /herohealth/vr/mode-factory.js ===
// Generic DOM Target Spawner (HHA Standard) — PRODUCTION
// ✅ export boot(...) for engines
// ✅ Reads playfield bounds from CSS vars: --pf-top/--pf-right/--pf-bottom/--pf-left
// ✅ Fix: no "controller before initialization"
// ✅ Targets: click/touch + crosshair shooting via event hha:shoot {x,y,lockPx,source}
// ✅ TTL expire callbacks, weighted kinds, sizeRange
// ✅ Returns controller: { stop(), pause(), resume(), clear(), getState() }

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

function seededRng(seed){
  let t = (Number(seed) || 0) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function readCssPxVar(varName, fallbackPx){
  try{
    const cs = getComputedStyle(DOC.documentElement);
    const raw = (cs.getPropertyValue(varName) || '').trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallbackPx;
  }catch(_){
    return fallbackPx;
  }
}

function getPlayRect(mount){
  // Prefer CSS vars (insets) set by game CSS
  const pfTop    = readCssPxVar('--pf-top', 160);
  const pfRight  = readCssPxVar('--pf-right', 16);
  const pfBottom = readCssPxVar('--pf-bottom', 110);
  const pfLeft   = readCssPxVar('--pf-left', 16);

  // Use viewport-based rect so it stays stable in fixed layout
  let x = pfLeft;
  let y = pfTop;
  let w = Math.max(0, WIN.innerWidth  - pfLeft - pfRight);
  let h = Math.max(0, WIN.innerHeight - pfTop  - pfBottom);

  // If mount is not full-screen, clamp into mount rect (safe)
  try{
    const mr = mount.getBoundingClientRect();
    if (mr && mr.width > 0 && mr.height > 0){
      // Intersect with mount
      const ix1 = Math.max(x, mr.left);
      const iy1 = Math.max(y, mr.top);
      const ix2 = Math.min(x + w, mr.right);
      const iy2 = Math.min(y + h, mr.bottom);
      x = ix1; y = iy1;
      w = Math.max(0, ix2 - ix1);
      h = Math.max(0, iy2 - iy1);
    }
  }catch(_){}

  // Auto-relax if too small (prevents "no spawn => looks like targets never appear")
  const MIN_W = 220, MIN_H = 220;
  if (w < MIN_W){
    const extra = (MIN_W - w) / 2;
    x = Math.max(0, x - extra);
    w = MIN_W;
  }
  if (h < MIN_H){
    const extra = (MIN_H - h) / 2;
    y = Math.max(0, y - extra);
    h = MIN_H;
  }

  // Keep inside viewport
  x = clamp(x, 0, Math.max(0, WIN.innerWidth - 40));
  y = clamp(y, 0, Math.max(0, WIN.innerHeight - 40));
  w = clamp(w, 120, WIN.innerWidth - x);
  h = clamp(h, 120, WIN.innerHeight - y);

  return { x, y, w, h, x2: x + w, y2: y + h };
}

function pickWeighted(rng, items){
  // items: [{kind, weight, ...}]
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) return null;
  let sum = 0;
  for (const it of arr) sum += Math.max(0, Number(it.weight) || 0);
  if (sum <= 0) return arr[0];
  let r = (rng() * sum);
  for (const it of arr){
    r -= Math.max(0, Number(it.weight) || 0);
    if (r <= 0) return it;
  }
  return arr[arr.length - 1];
}

function dist2(ax, ay, bx, by){
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy;
}

function defaultMakeEl(t){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.dataset.kind = t.kind || 'good';
  el.textContent = t.text || '🍽️';
  el.style.setProperty('--x', `${t.x}px`);
  el.style.setProperty('--y', `${t.y}px`);
  el.style.setProperty('--s', `${t.size}px`);
  el.setAttribute('role','button');
  el.setAttribute('aria-label', t.kind === 'junk' ? 'junk target' : 'good target');
  return el;
}

export function boot(opts = {}){
  const mount = opts.mount;
  if (!mount) throw new Error('mode-factory: mount missing');

  const seed = Number(opts.seed ?? Date.now());
  const rng  = (typeof opts.rng === 'function') ? opts.rng : seededRng(seed);

  const spawnRate = clamp(opts.spawnRate ?? 900, 120, 5000);
  const ttlMs     = clamp(opts.ttlMs ?? 2200, 450, 12000);
  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [46, 66];

  const kinds = Array.isArray(opts.kinds) ? opts.kinds : [
    { kind:'good', weight:0.7 },
    { kind:'junk', weight:0.3 }
  ];

  const onHit    = (typeof opts.onHit === 'function') ? opts.onHit : ()=>{};
  const onExpire = (typeof opts.onExpire === 'function') ? opts.onExpire : ()=>{};
  const makeEl   = (typeof opts.makeEl === 'function') ? opts.makeEl : defaultMakeEl;

  const state = {
    running: true,
    paused: false,
    seed,
    spawnRate,
    ttlMs,
    lastSpawnAt: 0,
    targets: [], // {id, kind, x,y,size, bornAt, expireAt, el, groupIndex, text}
    playRect: getPlayRect(mount),
  };

  let rafId = 0;
  let idSeq = 1;

  function refreshRect(){
    state.playRect = getPlayRect(mount);
  }

  function randSize(){
    const a = Number(sizeRange[0] ?? 46);
    const b = Number(sizeRange[1] ?? 66);
    const lo = Math.min(a,b), hi = Math.max(a,b);
    return Math.round(lo + rng() * (hi - lo));
  }

  function spawnOne(){
    refreshRect();
    const R = state.playRect;

    const k = pickWeighted(rng, kinds) || { kind:'good', weight:1 };
    const kind = (k.kind || 'good');

    const size = randSize();

    // Keep inside play rect with margin = size/2
    const m = Math.max(16, Math.round(size * 0.55));
    const x = Math.round(clamp(R.x + m + rng()*(R.w - 2*m), R.x + m, R.x2 - m));
    const y = Math.round(clamp(R.y + m + rng()*(R.h - 2*m), R.y + m, R.y2 - m));

    const t = {
      id: idSeq++,
      kind,
      x, y, size,
      bornAt: nowMs(),
      expireAt: nowMs() + ttlMs,
      groupIndex: (kind === 'good') ? Math.floor(rng()*5) : undefined,
      text: (kind === 'junk') ? '🍟' : '🍚' // engine สามารถ override ได้จาก opts.makeEl
    };

    const el = makeEl(t);
    t.el = el;

    // Click/tap hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      hitTarget(t, { source:'pointer', x: ev.clientX, y: ev.clientY });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.push(t);
  }

  function removeTarget(t){
    try{ t.el && t.el.remove(); }catch(_){}
    state.targets = state.targets.filter(x => x !== t);
  }

  function hitTarget(t, meta){
    if (!state.running) return;
    removeTarget(t);
    try{ onHit(t, meta || {}); }catch(err){ console.warn('[mode-factory] onHit err', err); }
  }

  function expireSweep(ts){
    // remove expired
    const list = state.targets.slice();
    for (const t of list){
      if (ts >= t.expireAt){
        removeTarget(t);
        try{ onExpire(t, { source:'ttl' }); }catch(err){ console.warn('[mode-factory] onExpire err', err); }
      }
    }
  }

  function shootAt(x, y, lockPx){
    if (!state.running) return false;
    const r = Math.max(8, Number(lockPx) || 28);
    const r2 = r*r;

    // pick nearest within lock
    let best = null;
    let bestD = Infinity;
    for (const t of state.targets){
      const d = dist2(x, y, t.x, t.y);
      if (d <= r2 && d < bestD){
        bestD = d;
        best = t;
      }
    }
    if (best){
      hitTarget(best, { source:'shoot', x, y, lockPx:r });
      return true;
    }
    return false;
  }

  function onShootEvent(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    // If x/y missing -> use center (cVR strict)
    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = Number(d.lockPx ?? 28) || 28;

    if (Number.isFinite(x) && Number.isFinite(y)){
      shootAt(x, y, lockPx);
    }else{
      shootAt(WIN.innerWidth/2, WIN.innerHeight/2, lockPx);
    }
  }

  function tick(ts){
    if (!state.running){
      rafId = 0;
      return;
    }
    if (!state.paused){
      // spawn
      if (!state.lastSpawnAt) state.lastSpawnAt = ts;
      if (ts - state.lastSpawnAt >= state.spawnRate){
        state.lastSpawnAt = ts;
        // spawn 1 per tick; if you want burst, adjust here
        spawnOne();
      }
      // expire
      expireSweep(ts);
    }
    rafId = WIN.requestAnimationFrame(tick);
  }

  // Start
  WIN.addEventListener('resize', refreshRect, { passive:true });
  WIN.addEventListener('orientationchange', refreshRect, { passive:true });
  WIN.addEventListener('hha:shoot', onShootEvent);

  refreshRect();
  rafId = WIN.requestAnimationFrame(tick);

  // Controller API
  const controller = {
    stop(){
      state.running = false;
      state.paused = false;
      try{ WIN.cancelAnimationFrame(rafId); }catch(_){}
      rafId = 0;
      WIN.removeEventListener('resize', refreshRect);
      WIN.removeEventListener('orientationchange', refreshRect);
      WIN.removeEventListener('hha:shoot', onShootEvent);
      controller.clear();
    },
    pause(){ state.paused = true; },
    resume(){ state.paused = false; },
    clear(){
      const list = state.targets.slice();
      for (const t of list) removeTarget(t);
      state.targets = [];
    },
    getState(){
      return {
        running: state.running,
        paused: state.paused,
        seed: state.seed,
        spawnRate: state.spawnRate,
        ttlMs: state.ttlMs,
        targets: state.targets.length,
        playRect: state.playRect
      };
    },
    shootAt
  };

  return controller;
}

export default { boot };