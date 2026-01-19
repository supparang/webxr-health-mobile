// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (SAFE) — HHA Standard
// ✅ Export: boot({ mount, seed, rng, spawnRate, sizeRange, kinds, onHit, onExpire })
// ✅ Listens: hha:shoot (from vr-ui.js) -> hit test at (x,y)
// ✅ FIX: TDZ "controller before initialization" by defining controller before use
// ✅ Safe cleanup: destroy()

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

function pickWeighted(rng, items){
  const arr = Array.isArray(items) ? items : [];
  if(arr.length === 0) return null;
  let sum = 0;
  for(const it of arr) sum += Math.max(0, Number(it.weight) || 0);
  if(sum <= 0) return arr[0];
  let roll = rng() * sum;
  for(const it of arr){
    roll -= Math.max(0, Number(it.weight) || 0);
    if(roll <= 0) return it;
  }
  return arr[arr.length - 1];
}

function rectOf(el){
  if(!el) return null;
  const r = el.getBoundingClientRect();
  return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
}

function within(x,y,r){
  return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function makeTargetEl({ sizePx=56, kind='good', emoji='🥦' }){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.dataset.kind = kind;
  el.textContent = emoji;
  el.style.position = 'absolute';
  el.style.width = `${sizePx}px`;
  el.style.height = `${sizePx}px`;
  el.style.display = 'grid';
  el.style.placeItems = 'center';
  el.style.borderRadius = '999px';
  el.style.userSelect = 'none';
  el.style.touchAction = 'none';
  el.style.transform = 'translateZ(0)';
  return el;
}

export function boot(opts = {}){
  if(!DOC) throw new Error('mode-factory: document missing');

  const mount = opts.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  // ---- config defaults ----
  const rng = (typeof opts.rng === 'function')
    ? opts.rng
    : seededRng(opts.seed);

  const spawnRate = clamp(opts.spawnRate ?? 900, 120, 5000); // ms
  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [44, 64];
  const minSize = clamp(sizeRange[0] ?? 44, 24, 240);
  const maxSize = clamp(sizeRange[1] ?? 64, minSize, 260);

  const kinds = Array.isArray(opts.kinds) ? opts.kinds : [
    { kind:'good', weight:0.7 },
    { kind:'junk', weight:0.3 }
  ];

  const onHit = (typeof opts.onHit === 'function') ? opts.onHit : ()=>{};
  const onExpire = (typeof opts.onExpire === 'function') ? opts.onExpire : ()=>{};

  // ---- controller declared BEFORE use (FIX TDZ) ----
  const controller = {
    alive:true,
    timer:null,
    targets:new Set(),
    destroy(){
      if(!controller.alive) return;
      controller.alive = false;
      clearInterval(controller.timer);
      WIN.removeEventListener('hha:shoot', onShoot, { passive:true });
      // remove targets
      for(const t of controller.targets){
        try{ t.el?.remove(); }catch(_){}
      }
      controller.targets.clear();
    }
  };

  function spawnOne(){
    if(!controller.alive) return;

    const r = rectOf(mount);
    if(!r || r.width < 50 || r.height < 50) return;

    const picked = pickWeighted(rng, kinds) || {kind:'good', weight:1};
    const kind = picked.kind || 'good';

    // pick emoji by kind (simple default)
    const emoji =
      kind === 'junk'   ? (picked.emoji || '🍟') :
      kind === 'shield' ? (picked.emoji || '🛡️') :
      (picked.emoji || '🥦');

    const sizePx = Math.round(minSize + (maxSize - minSize) * rng());

    // margin so it won't clip
    const pad = Math.max(6, Math.round(sizePx * 0.12));
    const x = Math.round(r.left + pad + (r.width  - 2*pad - sizePx) * rng());
    const y = Math.round(r.top  + pad + (r.height - 2*pad - sizePx) * rng());

    const el = makeTargetEl({ sizePx, kind, emoji });
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    const ttlMs = clamp(picked.ttlMs ?? 1400, 450, 6000);
    const born = performance.now();

    const t = {
      el, kind, emoji,
      sizePx, born,
      ttlMs,
      // optional extra payload (engine may attach)
      groupIndex: picked.groupIndex,
    };

    controller.targets.add(t);
    DOC.body.appendChild(el);

    // click/tap hit
    el.addEventListener('pointerdown', (ev)=>{
      if(!controller.alive) return;
      ev.preventDefault();
      hitTarget(t, ev.clientX, ev.clientY, 'pointer');
    }, { passive:false });

    // expire timer (lazy check)
    setTimeout(()=>{
      if(!controller.alive) return;
      if(!controller.targets.has(t)) return;
      const age = performance.now() - born;
      if(age >= ttlMs){
        controller.targets.delete(t);
        try{ el.remove(); }catch(_){}
        onExpire(t);
      }
    }, ttlMs + 20);
  }

  function hitTarget(t, x, y, source='shoot'){
    if(!controller.alive) return;
    if(!controller.targets.has(t)) return;

    controller.targets.delete(t);
    try{ t.el?.remove(); }catch(_){}
    onHit(t, { x, y, source });
  }

  function onShoot(ev){
    if(!controller.alive) return;
    const d = ev?.detail || {};
    const x = Number(d.x);
    const y = Number(d.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    // find topmost target under point
    // (iterate and check rect)
    let hit = null;
    for(const t of controller.targets){
      const r = t.el?.getBoundingClientRect?.();
      if(!r) continue;
      if(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom){
        hit = t;
        break;
      }
    }
    if(hit) hitTarget(hit, x, y, d.source || 'shoot');
  }

  // start loop
  controller.timer = setInterval(()=>{
    if(!controller.alive) return;
    spawnOne();
  }, spawnRate);

  // listen crosshair shoots
  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  return controller;
}