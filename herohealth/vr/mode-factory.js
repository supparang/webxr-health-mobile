// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (HHA) — PRODUCTION PATCH
// ✅ Export boot() for compatibility
// ✅ Fix TDZ: controller referenced before init

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

// --- seeded rng helper (keep existing if you already have)
function seededRng(seed){
  let t = (seed>>>0) || 1;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * createSpawner(cfg)
 * cfg = {
 *   mount, seed, spawnRate, sizeRange,
 *   kinds:[{kind,weight,...}], onHit(t), onExpire(t),
 *   playRectEl? (optional), safeZoneEl? (optional)
 * }
 */
export function createSpawner(cfg){
  if(!cfg || !cfg.mount) throw new Error('mode-factory: mount missing');

  // ✅ FIX TDZ: declare first
  let controller = null;

  const mount = cfg.mount;
  const rng = (cfg.rng) ? cfg.rng : seededRng(Number(cfg.seed)||Date.now());
  const spawnRate = Math.max(120, Number(cfg.spawnRate)||900);
  const sizeMin = (cfg.sizeRange && cfg.sizeRange[0]) ? Number(cfg.sizeRange[0]) : 44;
  const sizeMax = (cfg.sizeRange && cfg.sizeRange[1]) ? Number(cfg.sizeRange[1]) : 64;

  const kinds = Array.isArray(cfg.kinds) && cfg.kinds.length ? cfg.kinds : [
    {kind:'good', weight:0.7},
    {kind:'junk', weight:0.3}
  ];

  function pickKind(){
    let sum = 0;
    for(const k of kinds) sum += (Number(k.weight)||0);
    let r = rng()*sum;
    for(const k of kinds){
      r -= (Number(k.weight)||0);
      if(r<=0) return k;
    }
    return kinds[kinds.length-1];
  }

  function getRect(){
    const r = mount.getBoundingClientRect();
    // กันกรณี mount ซ่อน/0x0
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    return { left:r.left, top:r.top, width:w, height:h };
  }

  function spawnOne(){
    if(!controller || !controller.running) return;

    const rect = getRect();
    const size = clamp(sizeMin + rng()*(sizeMax-sizeMin), 24, 160);

    const x = rect.left + size/2 + rng()*(rect.width - size);
    const y = rect.top  + size/2 + rng()*(rect.height - size);

    const k = pickKind();

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = k.kind;

    // allow caller attach metadata
    const t = {
      kind: k.kind,
      el,
      x, y,
      size,
      bornAt: now(),
      ttlMs: Number(k.ttlMs||cfg.ttlMs||2200),
      groupIndex: (k.groupIndex != null) ? k.groupIndex : undefined
    };

    el.style.position = 'absolute';
    el.style.left = (x - rect.left) + 'px';
    el.style.top  = (y - rect.top) + 'px';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.transform = 'translate(-50%,-50%)';

    // text/icon decided by caller OR default emoji
    el.textContent = k.icon || (k.kind==='junk' ? '🍩' : '🍽️');

    let expired = false;
    const to = setTimeout(()=>{
      expired = true;
      try{ el.remove(); }catch(_){}
      cfg.onExpire && cfg.onExpire(t);
    }, t.ttlMs);

    const onHit = ()=>{
      if(expired) return;
      expired = true;
      clearTimeout(to);
      try{ el.remove(); }catch(_){}
      cfg.onHit && cfg.onHit(t);
    };

    el.addEventListener('pointerdown', onHit, { passive:true });
    mount.appendChild(el);
  }

  // ✅ controller assigned after functions defined
  controller = {
    running:false,
    _timer:null,
    start(){
      if(controller.running) return;
      controller.running = true;
      controller._timer = setInterval(spawnOne, spawnRate);
      // spawn immediately
      spawnOne();
    },
    stop(){
      controller.running = false;
      clearInterval(controller._timer);
      controller._timer = null;
    }
  };

  return controller;
}

/** ✅ Compatibility: export boot() so Plate can import { boot as spawnBoot } */
export function boot(cfg){
  const c = createSpawner(cfg);
  c.start();
  return c;
}