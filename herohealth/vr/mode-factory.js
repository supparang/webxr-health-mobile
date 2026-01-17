// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — DOM Target Spawner (PRODUCTION SAFE)
// ✅ export boot()
// ✅ FIX: controller referenced before init
// ✅ Works with click/touch and hha:shoot (crosshair / tap-to-shoot)
//
// Usage:
//   import { boot as spawnBoot } from '../vr/mode-factory.js';
//   const engine = spawnBoot({ mount, seed, spawnRate, sizeRange, kinds, onHit, onExpire });
//   engine.stop()

'use strict';

const WIN = window;
const DOC = document;

function clamp(v, a, b){
  v = Number(v);
  if(!isFinite(v)) v = a;
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

function rectOf(el){
  if(!el) return { left:0, top:0, right:innerWidth, bottom:innerHeight, width:innerWidth, height:innerHeight };
  const r = el.getBoundingClientRect();
  return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
}

function pickWeighted(rng, kinds){
  let sum = 0;
  for(const k of kinds) sum += Math.max(0, Number(k.weight)||0);
  if(sum <= 0) return kinds[0] || { kind:'good', weight:1 };

  let x = rng() * sum;
  for(const k of kinds){
    x -= Math.max(0, Number(k.weight)||0);
    if(x <= 0) return k;
  }
  return kinds[kinds.length-1];
}

function makeTargetEl(t){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.dataset.kind = t.kind || 'good';
  el.dataset.id = String(t.id);

  el.style.position = 'absolute';
  el.style.left = `${t.x}px`;
  el.style.top  = `${t.y}px`;
  el.style.width = `${t.size}px`;
  el.style.height = `${t.size}px`;
  el.style.transform = 'translate(-50%,-50%)';
  el.style.fontSize = `${Math.round(t.size * 0.55)}px`;

  el.textContent = t.emoji || '🍽️';
  el.style.display = 'grid';
  el.style.placeItems = 'center';
  el.style.userSelect = 'none';
  el.style.cursor = 'pointer';

  return el;
}

export function boot(opts){
  const mount = opts?.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = opts.rng || seededRng(opts.seed);
  const spawnRate = clamp(opts.spawnRate ?? 900, 120, 5000);
  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [44, 64];
  const kinds = Array.isArray(opts.kinds) && opts.kinds.length ? opts.kinds : [{ kind:'good', weight:1 }];
  const onHit = (typeof opts.onHit === 'function') ? opts.onHit : ()=>{};
  const onExpire = (typeof opts.onExpire === 'function') ? opts.onExpire : ()=>{};
  const ttlMs = clamp(opts.ttlMs ?? 1400, 350, 8000);

  let running = true;
  let timer = null;
  let nextId = 1;

  function onShoot(ev){ /* assigned below */ }

  const controller = {
    stop(){
      running = false;
      if(timer) clearTimeout(timer);
      timer = null;
      try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
      try{ mount.querySelectorAll('.plateTarget[data-id]').forEach(el=>el.remove()); }catch(_){}
    }
  };

  function spawnOne(){
    if(!running) return;

    const R = rectOf(mount);
    const size = clamp(sizeRange[0] + rng() * (sizeRange[1]-sizeRange[0]), 20, 240);

    const pad = Math.max(12, size * 0.5);
    const x = clamp(R.left + pad + rng() * Math.max(1, (R.width - pad*2)), R.left + pad, R.right - pad);
    const y = clamp(R.top  + pad + rng() * Math.max(1, (R.height - pad*2)), R.top  + pad, R.bottom - pad);

    const k = pickWeighted(rng, kinds);
    const t = {
      id: nextId++,
      kind: k.kind,
      size,
      x, y,
      groupIndex: (typeof k.groupIndex === 'number') ? k.groupIndex : undefined,
      emoji: (typeof k.emoji === 'string') ? k.emoji : undefined
    };

    const el = makeTargetEl(t);
    mount.appendChild(el);

    const hit = (ev)=>{
      ev?.preventDefault?.();
      if(!running) return;
      if(!el.isConnected) return;
      el.remove();
      onHit(t);
    };
    el.addEventListener('pointerdown', hit, { passive:false });

    setTimeout(()=>{
      if(!running) return;
      if(!el.isConnected) return;
      el.remove();
      onExpire(t);
    }, ttlMs);

    timer = setTimeout(spawnOne, spawnRate);
  }

  function findHitTargetAt(x, y, lockPx){
    const r = rectOf(mount);
    if(x < r.left || x > r.right || y < r.top || y > r.bottom) return null;

    const els = Array.from(mount.querySelectorAll('.plateTarget'));
    let best = null;
    let bestD = Infinity;

    for(const el of els){
      const b = el.getBoundingClientRect();
      const cx = (b.left + b.right)/2;
      const cy = (b.top + b.bottom)/2;
      const dx = cx - x;
      const dy = cy - y;
      const d = Math.hypot(dx, dy);

      const rad = Math.max(18, Math.min(90, (b.width/2)));
      const hitR = rad + (Number(lockPx)||0);

      if(d <= hitR && d < bestD){
        best = el;
        bestD = d;
      }
    }
    return best;
  }

  function onShoot(ev){
    if(!running) return;
    const d = ev?.detail || {};
    const x = Number(d.x);
    const y = Number(d.y);
    if(!isFinite(x) || !isFinite(y)) return;

    const lockPx = Number(d.lockPx || 0) || 0;
    const el = findHitTargetAt(x, y, lockPx);
    if(!el) return;

    const id = Number(el.dataset.id || 0);
    const kind = el.dataset.kind || 'good';
    el.remove();
    onHit({ id, kind });
  }

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  timer = setTimeout(spawnOne, Math.max(80, Math.round(spawnRate*0.6)));

  return controller;
}