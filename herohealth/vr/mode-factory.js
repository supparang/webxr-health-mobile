// === /herohealth/vr/mode-factory.js ===
// Generic DOM Target Spawner — PRODUCTION (HHA Standard)
// ✅ Export: boot(opts)   <-- IMPORTANT
// ✅ Spawn within mount rect (playfield)
// ✅ Click/Tap hit + Crosshair shoot via event 'hha:shoot'
// ✅ Seeded RNG (optional)
// ✅ TTL expire callbacks
// ✅ Weighted kinds, sizeRange, spawnRate
//
// Usage:
//   import { boot as spawnBoot } from '../vr/mode-factory.js';
//   const engine = spawnBoot({ mount, seed, spawnRate, sizeRange, kinds, onHit, onExpire });
//   engine.destroy();

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function now(){
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

function seededRng(seed){
  let t = (Number(seed) || 0) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, items){
  // items: [{kind, weight, ...}]
  let sum = 0;
  for(const it of items) sum += Math.max(0, Number(it.weight) || 0);
  if(sum <= 0) return items[0] || null;
  let x = rng() * sum;
  for(const it of items){
    x -= Math.max(0, Number(it.weight) || 0);
    if(x <= 0) return it;
  }
  return items[items.length - 1] || null;
}

function getRect(el){
  if(!el) return { left:0, top:0, width:0, height:0, right:0, bottom:0 };
  const r = el.getBoundingClientRect();
  return { left:r.left, top:r.top, width:r.width, height:r.height, right:r.right, bottom:r.bottom };
}

function setPosSize(el, x, y, s){
  // center at (x,y) within viewport coords; convert to absolute in page
  // but since mount is position:fixed and target is absolute inside mount,
  // we'll set left/top relative to mount.
  el.style.setProperty('--x', `${x}px`);
  el.style.setProperty('--y', `${y}px`);
  el.style.setProperty('--s', `${s}px`);
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  el.style.width = `${s}px`;
  el.style.height = `${s}px`;
  el.style.transform = 'translate(-50%,-50%)';
}

function ensureTargetCSS(){
  // minimal fallback if game css not loaded
  if(!DOC) return;
  if(DOC.getElementById('hha-mode-factory-fallback')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-mode-factory-fallback';
  st.textContent = `
    .hha-target{
      position:absolute;
      display:grid;
      place-items:center;
      border-radius:999px;
      user-select:none;
      -webkit-tap-highlight-color:transparent;
      cursor:pointer;
      font-weight:900;
    }
  `;
  DOC.head.appendChild(st);
}

function makeTargetEl(){
  const el = DOC.createElement('div');
  el.className = 'hha-target plateTarget'; // plateTarget for Plate CSS compatibility
  el.setAttribute('role','button');
  el.setAttribute('tabindex','0');
  return el;
}

function pointInTarget(px, py, t){
  // t: {x,y,s}
  const dx = px - t.x;
  const dy = py - t.y;
  const r = (t.s * 0.5);
  return (dx*dx + dy*dy) <= (r*r);
}

function getShootPointFromEvent(e){
  // expects detail {x,y,lockPx,source} in viewport coords
  const d = e?.detail || {};
  const x = Number(d.x);
  const y = Number(d.y);
  if(Number.isFinite(x) && Number.isFinite(y)) return { x, y, lockPx: Number(d.lockPx)||0, source: d.source||'shoot' };
  return null;
}

/* =========================================================
   EXPORT: boot
========================================================= */
export function boot(opts = {}){
  if(!DOC) throw new Error('mode-factory: document missing');

  const mount = opts.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  ensureTargetCSS();

  const rng = (opts.rng && typeof opts.rng === 'function')
    ? opts.rng
    : (opts.seed != null ? seededRng(opts.seed) : Math.random);

  const spawnRate = clamp(opts.spawnRate ?? 900, 120, 5000);  // ms per spawn tick
  const ttlMs     = clamp(opts.ttlMs ?? 1400, 300, 9000);    // lifetime per target
  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [44, 64];
  const minSize = clamp(sizeRange[0] ?? 44, 18, 240);
  const maxSize = clamp(sizeRange[1] ?? 64, minSize, 320);

  const kinds = Array.isArray(opts.kinds) && opts.kinds.length ? opts.kinds : [{ kind:'good', weight:1 }];
  const onHit = (typeof opts.onHit === 'function') ? opts.onHit : null;
  const onExpire = (typeof opts.onExpire === 'function') ? opts.onExpire : null;

  // Controller MUST be created before any access (fix error)
  const controller = {
    alive: true,
    targets: [],
    toSpawn: null,
    raf: null,
    startedAt: now(),
    lastSpawnAt: 0
  };

  // Ensure mount positioning
  const cs = WIN.getComputedStyle(mount);
  if(cs.position === 'static'){
    mount.style.position = 'fixed';
    mount.style.inset = '0';
  }
  mount.style.overflow = mount.style.overflow || 'hidden';
  mount.style.touchAction = mount.style.touchAction || 'none';
  mount.style.userSelect = mount.style.userSelect || 'none';

  function clearAllTargets(){
    for(const t of controller.targets){
      try{ t.el.remove(); }catch(_){}
    }
    controller.targets.length = 0;
  }

  function spawnOne(){
    if(!controller.alive) return;

    const rect = getRect(mount);
    if(rect.width < 40 || rect.height < 40) return;

    const pick = pickWeighted(rng, kinds) || { kind:'good' };
    const s = Math.round(minSize + (maxSize - minSize) * rng());

    // keep inside bounds with padding
    const pad = Math.max(12, Math.round(s * 0.55));
    const x = Math.round(rect.left + pad + (rect.width  - pad*2) * rng());
    const y = Math.round(rect.top  + pad + (rect.height - pad*2) * rng());

    // Convert viewport coords to mount-local coords
    const lx = x - rect.left;
    const ly = y - rect.top;

    const el = makeTargetEl();
    el.dataset.kind = pick.kind || 'good';
    el.style.position = 'absolute';
    el.style.left = '0px';
    el.style.top = '0px';
    setPosSize(el, lx, ly, s);

    // emoji / label
    // allow caller to provide emoji map: opts.kindToEmoji
    const kindToEmoji = opts.kindToEmoji || null;
    const fallback = (pick.kind === 'junk') ? '🍩' : '🥦';
    el.textContent = (kindToEmoji && kindToEmoji[pick.kind]) ? kindToEmoji[pick.kind] : (pick.emoji || fallback);

    const t = {
      kind: pick.kind || 'good',
      groupIndex: (pick.groupIndex != null) ? pick.groupIndex : null,
      x: lx, y: ly, s,
      bornAt: now(),
      expireAt: now() + ttlMs,
      el
    };

    // direct tap/click hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      hitTarget(t, { source:'pointer' });
    }, { passive:false });

    mount.appendChild(el);
    controller.targets.push(t);
  }

  function hitTarget(t, meta = {}){
    if(!controller.alive) return;
    const idx = controller.targets.indexOf(t);
    if(idx < 0) return;

    // remove
    controller.targets.splice(idx, 1);
    try{ t.el.remove(); }catch(_){}

    if(onHit){
      try{ onHit(Object.assign({}, t, meta)); }catch(err){ console.error(err); }
    }
  }

  function expireSweep(){
    const tNow = now();
    for(let i = controller.targets.length - 1; i >= 0; i--){
      const t = controller.targets[i];
      if(tNow >= t.expireAt){
        controller.targets.splice(i, 1);
        try{ t.el.remove(); }catch(_){}
        if(onExpire){
          try{ onExpire(t); }catch(err){ console.error(err); }
        }
      }
    }
  }

  function tick(){
    if(!controller.alive) return;

    const tNow = now();

    // spawn on interval
    if(tNow - controller.lastSpawnAt >= spawnRate){
      controller.lastSpawnAt = tNow;
      spawnOne();
    }

    // expire
    expireSweep();

    controller.raf = WIN.requestAnimationFrame(tick);
  }

  // Crosshair shooting (vr-ui.js emits this)
  function onShoot(e){
    if(!controller.alive) return;

    const p = getShootPointFromEvent(e);
    if(!p) return;

    const rect = getRect(mount);
    const px = p.x - rect.left;
    const py = p.y - rect.top;

    // lockPx assist: pick nearest target within lock radius
    const lockPx = Math.max(0, Number(p.lockPx) || 0);
    let best = null;
    let bestD2 = Infinity;

    for(const t of controller.targets){
      const dx = px - t.x;
      const dy = py - t.y;
      const d2 = dx*dx + dy*dy;

      // hit radius: max(target radius, lockPx)
      const r = Math.max(t.s * 0.5, lockPx);
      if(d2 <= r*r){
        if(d2 < bestD2){
          bestD2 = d2;
          best = t;
        }
      }
    }

    if(best){
      hitTarget(best, { source: p.source || 'shoot' });
    }
  }

  WIN.addEventListener('hha:shoot', onShoot);

  // Start
  controller.lastSpawnAt = now() - spawnRate; // spawn quickly
  controller.raf = WIN.requestAnimationFrame(tick);

  return {
    destroy(){
      if(!controller.alive) return;
      controller.alive = false;
      WIN.removeEventListener('hha:shoot', onShoot);
      if(controller.raf) WIN.cancelAnimationFrame(controller.raf);
      clearAllTargets();
    },
    spawnNow(){
      spawnOne();
    },
    setSpawnRate(ms){
      // allow runtime tuning
      const v = clamp(ms, 120, 5000);
      // store in closure by overwriting local? -> easiest: mutate opts + use controller field
      // but we use spawnRate const; so for now just noop in this minimal engine.
      console.warn('[mode-factory] setSpawnRate not supported in this build. Reboot engine to change.');
      return v;
    }
  };
}