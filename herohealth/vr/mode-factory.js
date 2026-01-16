// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — DOM Target Spawner (PRODUCTION RT)
// -----------------------------------------------------
// ✅ Spawns DOM targets inside mount rect
// ✅ Click/tap hit
// ✅ Crosshair shoot: listens to window 'hha:shoot' {x,y,lockPx,source}
// ✅ Seeded RNG for research
// ✅ Realtime spawn pace:
//    - cfg.spawnRate (number ms) OR cfg.getSpawnRate(): number ms
//    - engine.setSpawnRate(ms) / engine.getSpawnRate()
// ✅ onHit(targetInfo), onExpire(targetInfo)
// -----------------------------------------------------
// Notes:
// - mount is a DOM element used as playfield (position fixed/inset ok)
// - targets are div.plateTarget / .hhaTarget (class configurable)
// - caller may pass kinds[] with weights
// -----------------------------------------------------

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function nowMs(){ return performance.now ? performance.now() : Date.now(); }

function seededRng(seed){
  let t = (Number(seed) || 1) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, items){
  // items: [{kind, weight, ...}]
  if(!items || !items.length) return null;
  let sum = 0;
  for(const it of items) sum += Math.max(0, Number(it.weight) || 0);
  if(sum <= 0) return items[Math.floor(rng()*items.length)];
  let r = rng() * sum;
  for(const it of items){
    r -= Math.max(0, Number(it.weight) || 0);
    if(r <= 0) return it;
  }
  return items[items.length - 1];
}

function rectOf(el){
  try{ return el.getBoundingClientRect(); }
  catch{ return {left:0, top:0, right:0, bottom:0, width:0, height:0}; }
}

function dist2(ax,ay,bx,by){
  const dx = ax-bx, dy = ay-by;
  return dx*dx + dy*dy;
}

function within(x,y, r){
  return (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
}

function makeId(){
  return Math.random().toString(36).slice(2,10);
}

function defaultEmojiFor(kind){
  if(kind === 'shield') return '🛡️';
  if(kind === 'star') return '⭐';
  if(kind === 'diamond') return '💎';
  if(kind === 'junk') return '🍟';
  return '🍎';
}

/**
 * boot(cfg)
 * cfg = {
 *   mount: HTMLElement (required)
 *   seed: number (optional)
 *   rng: fn() (optional)
 *
 *   spawnRate: number ms (optional)
 *   getSpawnRate: () => number ms (optional)  // ✅ realtime
 *
 *   sizeRange: [minPx,maxPx] (optional)
 *   ttlMs: number (optional) default 2200
 *   maxAlive: number (optional) default 8
 *
 *   kinds: [{kind:'good', weight:0.7}, {kind:'junk', weight:0.3}, ...]
 *   className: string (optional) default 'plateTarget'
 *
 *   onHit: (targetInfo)=>void
 *   onExpire: (targetInfo)=>void
 *
 *   // optional per-kind generator hook
 *   makeTarget: ({kind, rng}) => { text, groupIndex, kind, ... }
 * }
 */
export function boot(cfg = {}){
  if(!DOC) throw new Error('mode-factory: document missing');
  const mount = cfg.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = (typeof cfg.rng === 'function') ? cfg.rng
            : (cfg.seed != null ? seededRng(cfg.seed) : Math.random);

  const sizeMin = clamp((cfg.sizeRange && cfg.sizeRange[0]) || 44, 18, 260);
  const sizeMax = clamp((cfg.sizeRange && cfg.sizeRange[1]) || 64, sizeMin, 320);

  const ttlMs    = clamp(cfg.ttlMs ?? 2200, 450, 20000);
  const maxAlive = clamp(cfg.maxAlive ?? 8, 1, 40);

  const kinds = Array.isArray(cfg.kinds) && cfg.kinds.length
    ? cfg.kinds.map(k => ({...k, weight: Math.max(0, Number(k.weight)||0)}))
    : [{kind:'good', weight:0.7},{kind:'junk', weight:0.3}];

  const className = String(cfg.className || 'plateTarget');

  // realtime spawnRate
  let spawnRateMs = clamp(cfg.spawnRate ?? 900, 120, 5000);
  const getSpawnRate = (typeof cfg.getSpawnRate === 'function')
    ? cfg.getSpawnRate
    : null;

  // state
  let alive = new Map(); // id -> targetObj
  let running = true;
  let loopTimer = null;

  // ensure mount is a positioning context
  // (mount may be fixed full-screen; absolute children still ok)
  const mountStyle = WIN.getComputedStyle(mount);
  if(mountStyle.position === 'static'){
    mount.style.position = 'relative';
  }

  // spawn helpers
  function currentSpawnRate(){
    try{
      if(getSpawnRate){
        const v = Number(getSpawnRate());
        if(Number.isFinite(v) && v > 0) return clamp(v, 120, 5000);
      }
    }catch(_){}
    return spawnRateMs;
  }

  function setSpawnRate(ms){
    spawnRateMs = clamp(ms, 120, 5000);
  }

  function makeTargetData(kind){
    if(typeof cfg.makeTarget === 'function'){
      const out = cfg.makeTarget({ kind, rng });
      if(out && typeof out === 'object') return out;
    }
    // default: good-> random groupIndex 0..4 for plate, junk none
    const base = { kind };
    if(kind === 'good'){
      base.groupIndex = Math.floor(rng()*5);
      base.text = ['🥦','🍎','🐟','🍚','🥑'][base.groupIndex] || '🍎';
    }else{
      base.text = defaultEmojiFor(kind);
    }
    return base;
  }

  function placeRandom(size){
    const r = rectOf(mount);
    const pad = 6; // keep inside
    const w = Math.max(0, r.width);
    const h = Math.max(0, r.height);

    // fallback if mount has no size yet
    if(w < 60 || h < 60){
      return { x: 50, y: 50, rect: r };
    }

    const x = clamp(pad + rng() * (w - pad*2), pad, w-pad);
    const y = clamp(pad + rng() * (h - pad*2), pad, h-pad);

    // x,y relative to mount (px)
    return { x, y, rect: r };
  }

  function spawnOne(){
    if(!running) return;
    if(alive.size >= maxAlive) return;

    const k = pickWeighted(rng, kinds);
    const kind = (k && k.kind) ? String(k.kind) : 'good';

    const size = Math.round(sizeMin + rng() * (sizeMax - sizeMin));
    const pos = placeRandom(size);

    const id = makeId();
    const info = makeTargetData(kind);
    info.id = id;
    info.kind = info.kind || kind;

    // DOM
    const el = DOC.createElement('div');
    el.className = className + ' hhaTarget';
    el.dataset.id = id;
    el.dataset.kind = String(info.kind || kind);

    // size & position relative to mount
    el.style.position = 'absolute';
    el.style.left = `${pos.x}px`;
    el.style.top  = `${pos.y}px`;
    el.style.width = `${size}px`;
    el.style.height= `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.display = 'grid';
    el.style.placeItems = 'center';
    el.style.userSelect = 'none';
    el.style.webkitTapHighlightColor = 'transparent';

    // content
    el.textContent = (info.text != null) ? String(info.text) : defaultEmojiFor(info.kind);

    // click/tap hit
    const onClick = (ev)=>{
      ev.preventDefault?.();
      hitById(id, { source:'tap', clientX: ev.clientX, clientY: ev.clientY });
    };
    el.addEventListener('pointerdown', onClick, { passive:false });

    mount.appendChild(el);

    const born = nowMs();
    const obj = { id, kind: info.kind, groupIndex: info.groupIndex, el, born, ttlMs, size, x: pos.x, y: pos.y };
    alive.set(id, obj);

    // expire
    obj.expireTO = WIN.setTimeout(()=>{
      if(!alive.has(id)) return;
      alive.delete(id);
      el.remove();
      cfg.onExpire && cfg.onExpire({ id, kind: obj.kind, groupIndex: obj.groupIndex });
    }, ttlMs);
  }

  function hitById(id, extra = {}){
    const obj = alive.get(id);
    if(!obj) return false;

    alive.delete(id);
    try{ WIN.clearTimeout(obj.expireTO); }catch(_){}
    try{ obj.el.remove(); }catch(_){}

    cfg.onHit && cfg.onHit({
      id,
      kind: obj.kind,
      groupIndex: obj.groupIndex,
      ...extra
    });
    return true;
  }

  // crosshair shoot support: find nearest target within lockPx
  function onShoot(ev){
    if(!running) return;
    const d = ev?.detail || {};
    const cx = Number(d.x);
    const cy = Number(d.y);
    const lockPx = clamp(d.lockPx ?? 28, 8, 120);

    if(!Number.isFinite(cx) || !Number.isFinite(cy)) return;

    // Prefer targets whose center is within lockPx of (cx,cy) in viewport space
    // target center in viewport: mountRect + (x,y)
    const mRect = rectOf(mount);
    if(!within(cx, cy, mRect)) {
      // still allow (for overlays) if near; but safer to return
      // return;
    }

    let best = null;
    let bestD2 = lockPx * lockPx;

    for(const obj of alive.values()){
      const tx = mRect.left + obj.x;
      const ty = mRect.top  + obj.y;
      const d2 = dist2(cx,cy,tx,ty);
      if(d2 <= bestD2){
        bestD2 = d2;
        best = obj;
      }
    }

    if(best){
      hitById(best.id, { source: d.source || 'shoot', clientX: cx, clientY: cy, lockPx });
    }
  }

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  // main loop (realtime spawn rate)
  function loop(){
    if(!running) return;
    spawnOne();

    const ms = currentSpawnRate();
    loopTimer = WIN.setTimeout(loop, ms);
  }
  loop();

  // public api
  const api = {
    stop(){
      if(!running) return;
      running = false;
      try{ WIN.clearTimeout(loopTimer); }catch(_){}
      WIN.removeEventListener('hha:shoot', onShoot);

      // clear all
      for(const obj of alive.values()){
        try{ WIN.clearTimeout(obj.expireTO); }catch(_){}
        try{ obj.el.remove(); }catch(_){}
      }
      alive.clear();
    },
    setSpawnRate,
    getSpawnRate: ()=> currentSpawnRate(),
    getAliveCount: ()=> alive.size,
    _debugAlive: ()=> Array.from(alive.values()).map(o=>({id:o.id,kind:o.kind,x:o.x,y:o.y}))
  };

  return api;
}