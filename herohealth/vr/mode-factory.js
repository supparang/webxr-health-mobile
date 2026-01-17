// === /herohealth/vr/mode-factory.js ===
// Mode Factory — DOM Target Spawner (PRODUCTION, ES Module + Window Bridge)
// ✅ export boot()
// ✅ window.GAME_MODULES.ModeFactory.boot
// ✅ Supports click/tap + hha:shoot {x,y,lockPx}
// ✅ Seeded RNG support via cfg.seed
// ✅ Simple weighted kinds + expire TTL
// ------------------------------------------------------------

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

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

function nowMs(){ return performance?.now?.() ?? Date.now(); }

function pickWeighted(rng, items){
  let sum = 0;
  for(const it of items) sum += Math.max(0, Number(it.weight)||0);
  if(sum <= 0) return items[0];
  let t = rng() * sum;
  for(const it of items){
    t -= Math.max(0, Number(it.weight)||0);
    if(t <= 0) return it;
  }
  return items[items.length-1];
}

function makeTargetEl(kind){
  const el = DOC.createElement('div');
  el.className = 'plateTarget hha-target';
  el.dataset.kind = kind.kind || 'good';
  // optional metadata passthrough
  if(kind.groupIndex != null) el.dataset.groupIndex = String(kind.groupIndex);
  if(kind.emoji) el.textContent = String(kind.emoji);
  return el;
}

function getRectSafe(mount){
  const r = mount.getBoundingClientRect();
  return { left:r.left, top:r.top, width:r.width, height:r.height };
}

function placeEl(mount, el, x, y, size){
  el.style.position = 'absolute';
  el.style.left = `${Math.round(x)}px`;
  el.style.top  = `${Math.round(y)}px`;
  el.style.width  = `${Math.round(size)}px`;
  el.style.height = `${Math.round(size)}px`;
  el.style.transform = 'translate(-50%,-50%)';
  el.style.zIndex = '1';
  mount.appendChild(el);
}

function dist2(ax,ay,bx,by){
  const dx = ax-bx, dy = ay-by;
  return dx*dx + dy*dy;
}

/**
 * boot(cfg)
 * cfg = {
 *   mount: HTMLElement (required)
 *   seed: number
 *   spawnRate: ms (default 900)
 *   sizeRange: [min,max] px
 *   ttlRange: [min,max] ms (default [1800, 2600])
 *   kinds: [{kind:'good', weight:0.7, emoji?, groupIndex?}, {kind:'junk', weight:0.3, ...}]
 *   margin: px (default 26)
 *   onHit: (target)=>void
 *   onExpire: (target)=>void
 * }
 */
export function boot(cfg = {}){
  if(!DOC) throw new Error('ModeFactory: document not available');
  const mount = cfg.mount;
  if(!mount) throw new Error('ModeFactory: mount missing');

  const rng = (cfg.rng && typeof cfg.rng === 'function')
    ? cfg.rng
    : seededRng(cfg.seed);

  const spawnRate = clamp(cfg.spawnRate ?? 900, 120, 5000);
  const sizeMin = clamp(cfg.sizeRange?.[0] ?? 44, 18, 260);
  const sizeMax = clamp(cfg.sizeRange?.[1] ?? 64, sizeMin, 320);

  const ttlMin = clamp(cfg.ttlRange?.[0] ?? 1800, 250, 15000);
  const ttlMax = clamp(cfg.ttlRange?.[1] ?? 2600, ttlMin, 20000);

  const margin = clamp(cfg.margin ?? 26, 0, 180);

  const kinds = Array.isArray(cfg.kinds) && cfg.kinds.length
    ? cfg.kinds
    : [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }];

  const onHit = (typeof cfg.onHit === 'function') ? cfg.onHit : ()=>{};
  const onExpire = (typeof cfg.onExpire === 'function') ? cfg.onExpire : ()=>{};

  let alive = true;
  let timer = null;

  const liveEls = new Set(); // track current targets

  function spawnOne(){
    if(!alive) return;

    const r = getRectSafe(mount);
    if(r.width < 40 || r.height < 40) return; // not ready

    const kind = pickWeighted(rng, kinds);
    const size = Math.round(sizeMin + (sizeMax-sizeMin)*rng());

    // spawn inside mount with margin
    const x = Math.round(margin + (r.width - margin*2) * rng());
    const y = Math.round(margin + (r.height - margin*2) * rng());

    const el = makeTargetEl(kind);
    placeEl(mount, el, x, y, size);

    const t = {
      el,
      kind: el.dataset.kind,
      groupIndex: (el.dataset.groupIndex != null) ? Number(el.dataset.groupIndex) : undefined,
      bornMs: nowMs(),
      ttlMs: Math.round(ttlMin + (ttlMax-ttlMin)*rng())
    };

    liveEls.add(el);

    function kill(reason){
      if(!liveEls.has(el)) return;
      liveEls.delete(el);
      try{ el.remove(); }catch{}
      if(reason === 'expire') onExpire(t);
    }

    // click/tap
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      if(!liveEls.has(el)) return;
      kill('hit');
      onHit(t);
    }, { passive:false });

    // expire
    setTimeout(()=>{
      if(!alive) return;
      if(!liveEls.has(el)) return;
      kill('expire');
    }, t.ttlMs);
  }

  // crosshair shooting: choose closest target to (x,y) within lockPx
  function onShoot(e){
    if(!alive) return;
    const d = e?.detail || {};
    const x = Number(d.x); const y = Number(d.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    const lockPx = clamp(d.lockPx ?? 28, 8, 160);
    const lock2 = lockPx*lockPx;

    // coords from viewport -> mount local
    const r = mount.getBoundingClientRect();
    const mx = x - r.left;
    const my = y - r.top;

    let bestEl = null;
    let bestD2 = Infinity;

    for(const el of liveEls){
      const er = el.getBoundingClientRect();
      const cx = (er.left - r.left) + er.width/2;
      const cy = (er.top  - r.top ) + er.height/2;
      const d2 = dist2(mx,my,cx,cy);
      if(d2 < bestD2){
        bestD2 = d2;
        bestEl = el;
      }
    }

    if(bestEl && bestD2 <= lock2){
      // simulate a hit
      const kind = bestEl.dataset.kind || 'good';
      const gi = (bestEl.dataset.groupIndex != null) ? Number(bestEl.dataset.groupIndex) : undefined;
      liveEls.delete(bestEl);
      try{ bestEl.remove(); }catch{}
      onHit({ el: bestEl, kind, groupIndex: gi, bornMs: nowMs(), ttlMs: 0 });
    }
  }

  WIN.addEventListener('hha:shoot', onShoot);

  // start loop
  timer = setInterval(spawnOne, spawnRate);
  // immediate seed spawns
  spawnOne(); spawnOne();

  return {
    stop(){
      if(!alive) return;
      alive = false;
      clearInterval(timer);
      WIN.removeEventListener('hha:shoot', onShoot);
      for(const el of liveEls){
        try{ el.remove(); }catch{}
      }
      liveEls.clear();
    }
  };
}

// Window bridge (compat)
try{
  WIN.GAME_MODULES = WIN.GAME_MODULES || {};
  WIN.GAME_MODULES.ModeFactory = WIN.GAME_MODULES.ModeFactory || {};
  WIN.GAME_MODULES.ModeFactory.boot = boot;
}catch(_){}
