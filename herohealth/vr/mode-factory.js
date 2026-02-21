// === /herohealth/vr/mode-factory.js ===
// MODE FACTORY (shared spawner + hha:shoot judge)
// PRODUCTION v20260221a
// ✅ keep decorateTarget(el, target)
// ✅ listens hha:shoot {x,y,lockPx}
// ✅ NEW: when shoot misses => emits hha:judge {kind:'shot_miss'} AND calls onShotMiss()
// ✅ safe-zone vars: prefers --plate-*-safe, then --gj-*-safe, then --hw-*-safe, else 0

'use strict';

const WIN = window;
const DOC = document;

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function readNumVar(cs, name){
  const v = parseFloat(cs.getPropertyValue(name));
  return Number.isFinite(v) ? v : 0;
}

/**
 * readSafeVars()
 * - Prefer --plate-top-safe etc.
 * - Fallback to --gj-* (GoodJunk) then --hw-* (Handwash) to be reusable.
 */
function readSafeVars(){
  const cs = getComputedStyle(DOC.documentElement);

  // primary
  let top    = readNumVar(cs, '--plate-top-safe');
  let bottom = readNumVar(cs, '--plate-bottom-safe');
  let left   = readNumVar(cs, '--plate-left-safe');
  let right  = readNumVar(cs, '--plate-right-safe');

  // fallback (goodjunk)
  if(!(top||bottom||left||right)){
    top    = readNumVar(cs, '--gj-top-safe');
    bottom = readNumVar(cs, '--gj-bottom-safe');
    left   = readNumVar(cs, '--gj-left-safe');
    right  = readNumVar(cs, '--gj-right-safe');
  }

  // fallback (handwash / others)
  if(!(top||bottom||left||right)){
    top    = readNumVar(cs, '--hw-top-safe');
    bottom = readNumVar(cs, '--hw-bottom-safe');
    left   = readNumVar(cs, '--hw-left-safe');
    right  = readNumVar(cs, '--hw-right-safe');
  }

  return { top, bottom, left, right };
}

function pickWeighted(rng, arr){
  let sum = 0;
  for(const it of arr) sum += (it.weight ?? 1);
  let x = rng() * sum;
  for(const it of arr){
    x -= (it.weight ?? 1);
    if(x <= 0) return it;
  }
  return arr[arr.length-1];
}

/**
 * boot({ mount, seed, spawnRate, sizeRange, kinds, onHit, onExpire, onShotMiss, decorateTarget })
 * - mount: HTMLElement (absolute or fixed container)
 * - onShotMiss: optional callback({x,y,lockPx,source,ts})
 * - also emits 'hha:judge' kind:'shot_miss' always on miss-shot (safe for games that listen)
 */
export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,
  sizeRange = [44,64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  onHit = ()=>{},
  onExpire = ()=>{},
  onShotMiss = ()=>{},          // ✅ NEW
  decorateTarget = null,
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);
  const state = {
    alive:true,
    lastSpawnAt:0,
    spawnTimer:null,
    targets:new Set(),
    cooldownUntil:0
  };

  function computeSpawnRect(){
    const r = mount.getBoundingClientRect();
    const safe = readSafeVars();
    const left = r.left + safe.left;
    const top = r.top + safe.top;
    const right = r.right - safe.right;
    const bottom = r.bottom - safe.bottom;
    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);
    return { left, top, right, bottom, w, h };
  }

  function removeTarget(target){
    try{ target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;
    state.targets.delete(target);
    removeTarget(target);
    onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta });
  }

  function judgeShotMiss(meta){
    // emit judge (for any game that listens)
    emit('hha:judge', {
      kind:'shot_miss',
      x: meta.x, y: meta.y,
      lockPx: meta.lockPx,
      source: meta.source || 'shoot',
      ts: meta.ts || now()
    });

    // callback (for canonical counters like Plate)
    try{ onShotMiss({ x:meta.x, y:meta.y, lockPx:meta.lockPx, source:meta.source||'shoot', ts:meta.ts||now() }); }
    catch{}
  }

  function onShoot(e){
    if(!state.alive) return;
    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + 90;

    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx || 28);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    let best=null, bestDist=Infinity;
    for(const target of state.targets){
      const r = target.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dist = Math.hypot(cx-x, cy-y);
      if(dist <= lockPx && dist < bestDist){
        bestDist = dist; best = target;
      }
    }

    if(best){
      hit(best, { source:'shoot', x, y, lockPx });
    }else{
      // ✅ NEW: ยิงแล้วไม่โดนเป้า
      judgeShotMiss({ x, y, lockPx, source:'shoot', ts:t });
    }
  }

  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const size = Math.round(sizeRange[0] + rng() * (sizeRange[1]-sizeRange[0]));
    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, kinds);
    const kind = chosen.kind || 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el, kind,
      bornAt: now(),
      ttlMs: kind === 'junk' ? 1700 : 2100,
      groupIndex: Math.floor(rng()*5),
      size,
      rng
    };

    // attach for debug / external
    try{ el.__hhaTarget = target; }catch{}

    // let the game decorate it (emoji/labels etc.)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch{}

    // tap/click hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // TTL expire
    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      state.targets.delete(target);
      removeTarget(target);
      onExpire({ ...target });
    }, target.ttlMs);
  }

  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = now();
    if(t - state.lastSpawnAt >= spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  return {
    stop(){
      if(!state.alive) return;
      state.alive = false;
      clearInterval(state.spawnTimer);
      WIN.removeEventListener('hha:shoot', onShoot);
      for(const target of state.targets){ removeTarget(target); }
      state.targets.clear();
    }
  };
}