// === /herohealth/vr/mode-factory.js ===
// Spawn Mode Factory — PRODUCTION (HHA Standard-ish)
// ✅ Export: boot()
// ✅ Safe spawn inside mount content box (respects CSS padding reserved for HUD)
// ✅ Supports click/tap hit
// ✅ Supports crosshair/tap-to-shoot via event: hha:shoot {x,y,lockPx,source}
// ✅ Expire handling per kind
// ✅ Deterministic RNG via seed
//
// Usage (Plate):
//   import { boot as spawnBoot } from '../vr/mode-factory.js';
//   const engine = spawnBoot({ mount, seed, spawnRate, sizeRange, kinds, onHit, onExpire });

'use strict';

const WIN = window;
const DOC = document;

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v,a,b){
  v = Number(v)||0;
  return v < a ? a : (v > b ? b : v);
}

function pickWeighted(rng, items){
  // items: [{kind, weight, ...}]
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

function getInnerRect(el){
  const r = el.getBoundingClientRect();
  const cs = WIN.getComputedStyle(el);

  const pl = parseFloat(cs.paddingLeft) || 0;
  const pr = parseFloat(cs.paddingRight) || 0;
  const pt = parseFloat(cs.paddingTop) || 0;
  const pb = parseFloat(cs.paddingBottom) || 0;

  // spawn inside content box (padding excluded)
  return {
    left: r.left + pl,
    top: r.top + pt,
    right: r.right - pr,
    bottom: r.bottom - pb,
    width: Math.max(0, (r.right - pr) - (r.left + pl)),
    height: Math.max(0, (r.bottom - pb) - (r.top + pt))
  };
}

function nowMs(){ return performance.now ? performance.now() : Date.now(); }

function dist2(ax,ay,bx,by){
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy;
}

function ensureNumber(v, def){ v = Number(v); return Number.isFinite(v) ? v : def; }

/* =========================================================
   EXPORT: boot()
========================================================= */
export function boot(opts){
  const mount = opts && opts.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  // ---- Controller MUST be defined before any closure uses it (fix TDZ) ----
  const controller = {
    running: true,
    paused: false,
    destroyed: false,
    targets: new Map(),  // id -> {el, kind, createdMs, expireAtMs, x,y, s, groupIndex?}
    _tickId: null,
    _spawnTO: null,
    _idSeq: 0,

    stop(){ cleanup(); },
    pause(){ controller.paused = true; },
    resume(){ controller.paused = false; },
    getState(){
      return {
        running: controller.running,
        paused: controller.paused,
        count: controller.targets.size
      };
    }
  };

  // ---- Config ----
  const seed = ensureNumber(opts.seed, Date.now());
  const rng = opts.rng || seededRng(seed);

  const spawnRate = clamp(ensureNumber(opts.spawnRate, 900), 120, 5000); // ms
  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [48, 76];
  const sMin = clamp(ensureNumber(sizeRange[0], 48), 28, 240);
  const sMax = clamp(ensureNumber(sizeRange[1], 76), sMin, 280);

  const kinds = Array.isArray(opts.kinds) && opts.kinds.length ? opts.kinds : [
    { kind:'good', weight:0.7 },
    { kind:'junk', weight:0.3 }
  ];

  const onHit = typeof opts.onHit === 'function' ? opts.onHit : ()=>{};
  const onExpire = typeof opts.onExpire === 'function' ? opts.onExpire : ()=>{};

  // default lifetimes (ms)
  const lifeGoodMs = clamp(ensureNumber(opts.lifeGoodMs, 1900), 600, 8000);
  const lifeJunkMs = clamp(ensureNumber(opts.lifeJunkMs, 2400), 600, 12000);

  // avoid edge clipping
  const edgePad = clamp(ensureNumber(opts.edgePad, 8), 0, 40);

  // target spacing (prevent overlap-ish)
  const triesPerSpawn = clamp(ensureNumber(opts.triesPerSpawn, 18), 6, 80);

  // ---- helpers ----
  function makeEl(t){
    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = t.kind || 'good';
    el.textContent = t.emoji || '🍽️';
    el.style.width = `${t.s}px`;
    el.style.height = `${t.s}px`;
    el.style.left = `${t.x}px`;
    el.style.top  = `${t.y}px`;
    el.setAttribute('role','button');
    el.setAttribute('aria-label', t.kind === 'junk' ? 'junk' : 'good');
    return el;
  }

  function removeTarget(id, reason){
    const t = controller.targets.get(id);
    if(!t) return;
    controller.targets.delete(id);
    try{
      t.el.classList.add('hit');
      // remove after animation frame
      setTimeout(()=>{ try{ t.el.remove(); }catch{} }, 140);
    }catch{}
    if(reason === 'expire'){
      try{ onExpire({ kind: t.kind, groupIndex: t.groupIndex, id }); }catch{}
    }
  }

  function hitTarget(id, source='tap'){
    const t = controller.targets.get(id);
    if(!t) return false;
    removeTarget(id, 'hit');
    try{ onHit({ kind: t.kind, groupIndex: t.groupIndex, id, source }); }catch{}
    return true;
  }

  function findNearestTarget(x,y, lockPx){
    lockPx = clamp(lockPx ?? 28, 8, 120);
    const maxD2 = lockPx * lockPx;

    let bestId = null;
    let bestD2 = Infinity;

    for(const [id, t] of controller.targets){
      // target center is (x,y) already
      const d2 = dist2(x,y, t.x, t.y);
      if(d2 <= maxD2 && d2 < bestD2){
        bestD2 = d2;
        bestId = id;
      }
    }
    return bestId;
  }

  function onShootEvent(e){
    if(!controller.running || controller.paused) return;
    const d = (e && e.detail) || {};
    const x = ensureNumber(d.x, NaN);
    const y = ensureNumber(d.y, NaN);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    const id = findNearestTarget(x, y, d.lockPx);
    if(id) hitTarget(id, d.source || 'shoot');
  }

  function onMountClick(ev){
    if(!controller.running || controller.paused) return;
    const el = ev && ev.target;
    if(!el) return;
    if(el.classList && el.classList.contains('plateTarget')){
      const id = el.dataset.id;
      if(id) hitTarget(id, 'tap');
    }
  }

  function spawnOne(){
    if(!controller.running || controller.paused) return;

    const rect = getInnerRect(mount);
    if(rect.width < 80 || rect.height < 80){
      // too small, try later
      scheduleSpawn();
      return;
    }

    const kPick = pickWeighted(rng, kinds) || { kind:'good', weight:1 };
    const kind = (kPick.kind || 'good');

    // emoji choice
    // You can override by passing opts.emojiByKind or kPick.emojiSet
    const emojiByKind = opts.emojiByKind || null;
    const goodEmojis = (emojiByKind && emojiByKind.good) || kPick.goodSet || ['🍚','🥗','🐟','🥛','🍎'];
    const junkEmojis = (emojiByKind && emojiByKind.junk) || kPick.junkSet || ['🍟','🍩','🧋','🍰','🥓'];

    const emojiSet = (kind === 'junk') ? junkEmojis : goodEmojis;
    const emoji = emojiSet[Math.floor(rng() * emojiSet.length)] || (kind === 'junk' ? '🍟' : '🍚');

    // optional: groupIndex for good
    let groupIndex = null;
    if(kind !== 'junk'){
      // prefer any supplied generator
      if(typeof opts.pickGroupIndex === 'function'){
        groupIndex = opts.pickGroupIndex({ rng });
      }else{
        groupIndex = Math.floor(rng() * 5);
      }
    }

    const s = Math.round(sMin + rng() * (sMax - sMin));

    // place without heavy overlaps
    let x=0, y=0;
    let ok = false;

    for(let i=0; i<triesPerSpawn; i++){
      x = rect.left + edgePad + (rng() * (rect.width - edgePad*2));
      y = rect.top  + edgePad + (rng() * (rect.height - edgePad*2));

      // keep inside boundaries considering radius
      const r = s/2 + edgePad;
      if(x < rect.left + r) x = rect.left + r;
      if(x > rect.right - r) x = rect.right - r;
      if(y < rect.top + r) y = rect.top + r;
      if(y > rect.bottom - r) y = rect.bottom - r;

      // check spacing against existing targets
      ok = true;
      for(const [, t] of controller.targets){
        const minSep = (s/2 + t.s/2) * 0.72; // allow some closeness but not full overlap
        if(dist2(x,y,t.x,t.y) < (minSep*minSep)){
          ok = false;
          break;
        }
      }
      if(ok) break;
    }

    const id = String(++controller._idSeq);
    const created = nowMs();
    const life = (kind === 'junk') ? lifeJunkMs : lifeGoodMs;
    const expireAt = created + life;

    const t = {
      id,
      kind,
      emoji,
      groupIndex,
      createdMs: created,
      expireAtMs: expireAt,
      x, y, s,
      el: null
    };

    const el = makeEl(t);
    el.dataset.id = id;

    t.el = el;
    controller.targets.set(id, t);

    mount.appendChild(el);

    scheduleSpawn();
  }

  function scheduleSpawn(){
    clearTimeout(controller._spawnTO);
    controller._spawnTO = setTimeout(spawnOne, spawnRate);
  }

  function tick(){
    if(!controller.running || controller.destroyed) return;
    if(!controller.paused){
      const tNow = nowMs();
      for(const [id, t] of controller.targets){
        if(tNow >= t.expireAtMs){
          removeTarget(id, 'expire');
        }
      }
    }
    controller._tickId = requestAnimationFrame(tick);
  }

  function cleanup(){
    if(controller.destroyed) return;
    controller.running = false;
    controller.destroyed = true;

    clearTimeout(controller._spawnTO);
    controller._spawnTO = null;

    try{ cancelAnimationFrame(controller._tickId); }catch{}
    controller._tickId = null;

    // remove listeners
    try{ mount.removeEventListener('click', onMountClick); }catch{}
    try{ WIN.removeEventListener('hha:shoot', onShootEvent); }catch{}

    // purge targets
    for(const [id] of controller.targets){
      removeTarget(id, 'hit');
    }
    controller.targets.clear();
  }

  // ---- Wire events ----
  mount.addEventListener('click', onMountClick, { passive:true });
  WIN.addEventListener('hha:shoot', onShootEvent);

  // ---- Start loop ----
  scheduleSpawn();
  controller._tickId = requestAnimationFrame(tick);

  return controller;
}