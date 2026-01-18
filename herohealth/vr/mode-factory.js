// =========================================================
// /herohealth/vr/mode-factory.js
// Generic DOM Target Spawner — PRODUCTION PATCH (B1)
// FIX:
// 1) Prevent "Cannot access 'controller' before initialization"
// 2) Provide export named 'boot' (and alias createController)
// 3) Support click/touch + crosshair shooting (hha:shoot)
// =========================================================
'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const clamp = (v, a, b)=>{
  v = Number(v)||0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function rectOf(el){
  if(!el) return { left:0, top:0, right:innerWidth, bottom:innerHeight, width:innerWidth, height:innerHeight };
  const r = el.getBoundingClientRect();
  return {
    left:r.left, top:r.top, right:r.right, bottom:r.bottom,
    width:Math.max(1,r.width), height:Math.max(1,r.height)
  };
}

function pickWeighted(rng, items){
  // items: [{... , weight}]
  let sum = 0;
  for(const it of items) sum += Math.max(0, Number(it.weight)||0);
  if(sum <= 0) return items[0] || null;
  let x = rng() * sum;
  for(const it of items){
    x -= Math.max(0, Number(it.weight)||0);
    if(x <= 0) return it;
  }
  return items[items.length-1] || null;
}

function makeTargetEl({ kind, size, x, y, emoji, groupIndex }){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.dataset.kind = kind || 'good';
  if(groupIndex != null) el.dataset.groupIndex = String(groupIndex);

  el.style.position = 'absolute';
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  el.style.width  = `${size}px`;
  el.style.height = `${size}px`;
  el.style.transform = 'translate(-50%,-50%)';
  el.style.display = 'grid';
  el.style.placeItems = 'center';

  el.textContent = emoji || '🍽️';
  return el;
}

/**
 * createController(cfg)
 * cfg = {
 *   mount: HTMLElement,
 *   seed,
 *   spawnRate (ms),
 *   sizeRange [min,max],
 *   kinds: [{kind, weight}],
 *   emojisGood: [..] (optional),
 *   emojisJunk: [..] (optional),
 *   onHit(targetObj),
 *   onExpire(targetObj),
 * }
 */
function createController(cfg){
  if(!DOC) throw new Error('mode-factory: document missing');
  if(!cfg || !cfg.mount) throw new Error('mode-factory: mount missing');

  const mount = cfg.mount;
  const rng = cfg.rng || seededRng(cfg.seed || Date.now());

  const sizeMin = (cfg.sizeRange && cfg.sizeRange[0]) ? Number(cfg.sizeRange[0]) : 44;
  const sizeMax = (cfg.sizeRange && cfg.sizeRange[1]) ? Number(cfg.sizeRange[1]) : 64;

  const spawnRate = Math.max(200, Number(cfg.spawnRate)||900);
  const ttlMs = Math.max(600, Number(cfg.ttlMs)||1200);

  const kinds = Array.isArray(cfg.kinds) && cfg.kinds.length ? cfg.kinds : [
    { kind:'good', weight:0.75 },
    { kind:'junk', weight:0.25 }
  ];

  const emojisGood = cfg.emojisGood || ['🥦','🍎','🐟','🍚','🥑'];
  const emojisJunk = cfg.emojisJunk || ['🍟','🍩','🧁','🥤','🍔'];

  let running = false;
  let tickTO = null;

  // active targets map
  const live = new Set();

  function spawnOne(){
    if(!running) return;

    const r = rectOf(mount);

    // safe margin so target not clipped
    const m = 16;
    const size = clamp(sizeMin + (sizeMax-sizeMin)*rng(), sizeMin, sizeMax);

    const x = r.left + m + rng() * Math.max(1, (r.width  - m*2));
    const y = r.top  + m + rng() * Math.max(1, (r.height - m*2));

    const picked = pickWeighted(rng, kinds) || { kind:'good' };
    const kind = (picked.kind || 'good');

    let emoji = '🍽️';
    let groupIndex = null;

    if(kind === 'good'){
      groupIndex = Math.floor(rng()*5);
      emoji = emojisGood[groupIndex % emojisGood.length] || '🥗';
    }else if(kind === 'junk'){
      emoji = emojisJunk[Math.floor(rng()*emojisJunk.length)] || '🍟';
    }else if(kind === 'shield'){
      emoji = '🛡️';
    }

    const el = makeTargetEl({ kind, size, x, y, emoji, groupIndex });
    mount.appendChild(el);

    const obj = {
      el,
      kind,
      size,
      x, y,
      groupIndex,
      bornAt: performance.now(),
      expireAt: performance.now() + ttlMs
    };

    live.add(obj);

    // pointer hit
    const onPointer = (ev)=>{
      if(!running) return;
      ev.preventDefault();
      cleanupOne(obj, true);
      try{ cfg.onHit && cfg.onHit(obj); }catch(_){}
    };
    el.addEventListener('pointerdown', onPointer, { passive:false });

    // auto expire
    obj._expireTO = setTimeout(()=>{
      if(!running) return;
      if(!live.has(obj)) return;
      cleanupOne(obj, false);
      try{ cfg.onExpire && cfg.onExpire(obj); }catch(_){}
    }, ttlMs + 10);
  }

  function cleanupOne(obj, hit){
    if(!obj || !obj.el) return;
    clearTimeout(obj._expireTO);
    if(obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);
    live.delete(obj);
  }

  function tick(){
    if(!running) return;
    spawnOne();
    tickTO = setTimeout(tick, spawnRate);
  }

  // --- crosshair shooting support (vr-ui.js emits hha:shoot {x,y,lockPx}) ---
  function onShoot(e){
    if(!running) return;
    const d = e.detail || {};
    const sx = Number(d.x);
    const sy = Number(d.y);
    const lockPx = Math.max(8, Number(d.lockPx)||28);

    if(!isFinite(sx) || !isFinite(sy)) return;

    // find any live target within radius
    let best = null;
    let bestDist = Infinity;

    for(const t of live){
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;
      const dx = cx - sx;
      const dy = cy - sy;
      const dist = Math.hypot(dx,dy);
      if(dist <= lockPx && dist < bestDist){
        best = t;
        bestDist = dist;
      }
    }

    if(best){
      cleanupOne(best, true);
      try{ cfg.onHit && cfg.onHit(best); }catch(_){}
    }
  }

  function start(){
    if(running) return;
    running = true;
    // IMPORTANT: register shoot listener only when start (avoid early ref)
    ROOT.addEventListener('hha:shoot', onShoot);
    tick();
  }

  function stop(){
    running = false;
    clearTimeout(tickTO);
    ROOT.removeEventListener('hha:shoot', onShoot);

    // clear all live
    for(const t of Array.from(live)){
      cleanupOne(t, false);
    }
  }

  return { start, stop, spawnOne };
}

// ✅ export names (แก้ปัญหา import ไม่ตรง)
export function boot(cfg){
  const c = createController(cfg);
  c.start();
  return c;
}
export { createController };