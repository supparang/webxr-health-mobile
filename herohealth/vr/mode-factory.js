// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (HHA) — PRODUCTION PATCH
// ✅ Export boot() for compatibility (Plate imports { boot as spawnBoot })
// ✅ Fix TDZ: controller referenced before init
// ✅ Simple spawn with TTL + pointer hit
// ✅ Works for PC/Mobile/cVR (tap-to-shoot handled by vr-ui.js separately)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

function seededRng(seed){
  let t = (seed>>>0) || 1;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, arr){
  let sum = 0;
  for(const a of arr) sum += (Number(a.weight)||0);
  let r = rng() * (sum || 1);
  for(const a of arr){
    r -= (Number(a.weight)||0);
    if(r <= 0) return a;
  }
  return arr[arr.length-1];
}

/**
 * createSpawner(cfg)
 * cfg = {
 *   mount,
 *   seed, rng?,
 *   spawnRate, ttlMs?,
 *   sizeRange:[min,max],
 *   kinds:[{kind,weight,icon,ttlMs,meta...}],
 *   onHit(t), onExpire(t),
 *   className? (default 'plateTarget')
 * }
 */
export function createSpawner(cfg){
  if(!DOC) throw new Error('mode-factory: document missing');
  if(!cfg || !cfg.mount) throw new Error('mode-factory: mount missing');

  // ✅ FIX TDZ: declare first
  let controller = null;

  const mount = cfg.mount;
  const rng = cfg.rng ? cfg.rng : seededRng(Number(cfg.seed)||Date.now());

  const spawnRate = Math.max(120, Number(cfg.spawnRate)||900);
  const ttlBase   = Math.max(400, Number(cfg.ttlMs)||2200);

  const sizeMin = (cfg.sizeRange && cfg.sizeRange[0]) ? Number(cfg.sizeRange[0]) : 44;
  const sizeMax = (cfg.sizeRange && cfg.sizeRange[1]) ? Number(cfg.sizeRange[1]) : 64;

  const kinds = Array.isArray(cfg.kinds) && cfg.kinds.length ? cfg.kinds : [
    { kind:'good', weight:0.7, icon:'🍽️' },
    { kind:'junk', weight:0.3, icon:'🍩' }
  ];

  const className = cfg.className || 'plateTarget';

  function getRect(){
    const r = mount.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    return { left:r.left, top:r.top, width:w, height:h };
  }

  function spawnOne(){
    if(!controller || !controller.running) return;

    const rect = getRect();
    // ถ้า mount ยังไม่มีขนาด (เช่น display:none) ก็ skip
    if(rect.width < 4 || rect.height < 4) return;

    const size = clamp(sizeMin + rng()*(sizeMax-sizeMin), 24, 220);

    const x = rect.left + size/2 + rng()*(rect.width - size);
    const y = rect.top  + size/2 + rng()*(rect.height - size);

    const k = pickWeighted(rng, kinds);

    const el = DOC.createElement('div');
    el.className = className;
    el.dataset.kind = k.kind || 'good';

    const t = Object.assign({}, k, {
      kind: k.kind || 'good',
      el,
      x, y, size,
      bornAt: now(),
      ttlMs: Math.max(250, Number(k.ttlMs || ttlBase) || ttlBase),
    });

    // positioning within mount
    el.style.position = 'absolute';
    el.style.left = (x - rect.left) + 'px';
    el.style.top  = (y - rect.top) + 'px';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.transform = 'translate(-50%,-50%)';

    // icon/text
    el.textContent = k.icon || (t.kind === 'junk' ? '🍩' : '🍽️');

    let expired = false;

    const to = setTimeout(()=>{
      expired = true;
      try{ el.remove(); }catch(_){}
      cfg.onExpire && cfg.onExpire(t);
    }, t.ttlMs);

    function hit(){
      if(expired) return;
      expired = true;
      clearTimeout(to);
      try{ el.remove(); }catch(_){}
      cfg.onHit && cfg.onHit(t);
    }

    el.addEventListener('pointerdown', hit, { passive:true });
    mount.appendChild(el);
  }

  // ✅ assign controller after functions exist
  controller = {
    running:false,
    _timer:null,
    start(){
      if(controller.running) return;
      controller.running = true;
      controller._timer = setInterval(spawnOne, spawnRate);
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

/** ✅ Compatibility export: Plate can import { boot as spawnBoot } */
export function boot(cfg){
  const c = createSpawner(cfg);
  c.start();
  return c;
}