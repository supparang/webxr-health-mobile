// === /herohealth/vr/mode-factory.js ===
// Spawn/Target Factory — PRODUCTION (shared)
// ✅ export boot()
// ✅ FIX: no "controller before initialization"
// ✅ Uses CSS safe vars: --hud-top-safe / --hud-bottom-safe
// ✅ Supports hha:shoot (crosshair/tap-to-shoot) from vr-ui.js
// ✅ Returns controller: { stop(), pause(), resume() }

'use strict';

const WIN = window;
const DOC = document;

function clamp(v, a, b){
  v = Number(v)||0;
  return v < a ? a : (v > b ? b : v);
}

function mulberry32(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function cssPx(el, name, fallbackPx){
  try{
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    if(!v) return fallbackPx;
    // supports "140px" only (we use px)
    const n = Number(String(v).replace('px','').trim());
    return Number.isFinite(n) ? n : fallbackPx;
  }catch{
    return fallbackPx;
  }
}

function now(){ return performance.now(); }

function rectOf(el){
  const r = el.getBoundingClientRect();
  return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
}

function dist2(ax,ay,bx,by){
  const dx = ax-bx, dy = ay-by;
  return dx*dx + dy*dy;
}

function pickWeighted(rng, items){
  let sum = 0;
  for(const it of items) sum += (Number(it.weight)||0);
  let x = rng() * (sum || 1);
  for(const it of items){
    x -= (Number(it.weight)||0);
    if(x <= 0) return it;
  }
  return items[items.length-1];
}

/**
 * boot({ mount, seed, spawnRate, ttlMs, sizeRange, kinds, onHit, onExpire, labeler, className })
 * kinds: [{kind:'good'|'junk', weight:number, groupIndex?:0-4, ...custom}]
 * labeler(t) -> string (emoji)
 */
export function boot(opts){
  const mount = opts?.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  const seed = Number(opts.seed ?? Date.now());
  const rng = mulberry32(seed);

  const spawnRate = clamp(opts.spawnRate ?? 850, 120, 4000);
  const ttlMs = clamp(opts.ttlMs ?? 1600, 350, 15000);
  const sizeRange = opts.sizeRange || [54,78];
  const kinds = Array.isArray(opts.kinds) ? opts.kinds : [{kind:'good',weight:1}];
  const onHit = (typeof opts.onHit === 'function') ? opts.onHit : ()=>{};
  const onExpire = (typeof opts.onExpire === 'function') ? opts.onExpire : ()=>{};
  const labeler = (typeof opts.labeler === 'function') ? opts.labeler : (t)=> (t.kind==='junk'?'🍟':'🥦');
  const className = String(opts.className || 'plateTarget');

  // ---- controller (declare FIRST to avoid TDZ errors) ----
  const controller = {
    stopped:false,
    paused:false,
    stop(){ controller.stopped = true; cleanup(); },
    pause(){ controller.paused = true; },
    resume(){ controller.paused = false; },
  };

  // ---- internal state ----
  const live = new Map(); // id -> {el, t, born, ttl, cx, cy}
  let nextId = 1;
  let spawnTimer = null;
  let tickTimer = null;

  function safeRect(){
    // read safe zones from CSS vars (mount or body)
    const baseEl = DOC.documentElement || DOC.body;
    const topSafe = cssPx(baseEl, '--hud-top-safe', 140);
    const botSafe = cssPx(baseEl, '--hud-bottom-safe', 240);

    const r = rectOf(mount);
    const pad = 12;

    const left = r.left + pad;
    const right = r.right - pad;
    const top = r.top + pad + topSafe;
    const bottom = r.bottom - pad - botSafe;

    // fallback if too small
    if(bottom - top < 120){
      return {
        left: r.left + pad,
        right: r.right - pad,
        top: r.top + pad + 80,
        bottom: r.bottom - pad - 120
      };
    }
    return { left, right, top, bottom };
  }

  function spawnOne(){
    if(controller.stopped || controller.paused) return;

    const r = safeRect();
    const sMin = clamp(sizeRange[0] ?? 54, 28, 220);
    const sMax = clamp(sizeRange[1] ?? 78, sMin, 260);
    const sPx = Math.round(sMin + (sMax - sMin) * rng());

    const x = r.left + (r.right - r.left) * rng();
    const y = r.top + (r.bottom - r.top) * rng();

    const pick = pickWeighted(rng, kinds);
    const t = Object.assign({}, pick); // clone
    t.id = nextId++;
    t.sizePx = sPx;

    const el = DOC.createElement('div');
    el.className = className;
    el.dataset.kind = t.kind || 'good';
    if(t.groupIndex != null) el.dataset.group = String(t.groupIndex);

    // set css vars (percent based relative to mount)
    const mr = rectOf(mount);
    const px = clamp((x - mr.left) / (mr.width || 1) * 100, 0, 100);
    const py = clamp((y - mr.top) / (mr.height || 1) * 100, 0, 100);
    el.style.setProperty('--x', String(px));
    el.style.setProperty('--y', String(py));
    el.style.setProperty('--s', String(sPx));

    el.textContent = String(labeler(t) || '');

    // click/tap hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hitTarget(t.id);
    }, { passive:false });

    mount.appendChild(el);

    const born = now();
    live.set(t.id, {
      el, t,
      born,
      ttl: ttlMs,
      // approximate center for shoot-lock
      cx: x,
      cy: y
    });
  }

  function hitTarget(id){
    const it = live.get(id);
    if(!it) return;
    live.delete(id);

    try{
      it.el.classList.add('is-hit');
    }catch{}

    // remove element
    try{ it.el.remove(); }catch{}

    try{ onHit(it.t); }catch{}
  }

  function expireTarget(id){
    const it = live.get(id);
    if(!it) return;
    live.delete(id);
    try{ it.el.remove(); }catch{}
    try{ onExpire(it.t); }catch{}
  }

  function tick(){
    if(controller.stopped) return;
    if(controller.paused) return;

    const tnow = now();
    for(const [id, it] of live){
      if(tnow - it.born >= it.ttl){
        expireTarget(id);
      }
    }
  }

  // ---- hha:shoot support ----
  function onShoot(ev){
    if(controller.stopped || controller.paused) return;
    const d = ev?.detail || {};
    const lockPx = clamp(d.lockPx ?? 28, 6, 120);

    // If view=cvr strict: use center of viewport by design
    const cx = (d.x != null) ? Number(d.x) : (WIN.innerWidth/2);
    const cy = (d.y != null) ? Number(d.y) : (WIN.innerHeight/2);

    // find nearest target within lock radius
    const lock2 = lockPx * lockPx;
    let bestId = null;
    let bestD2 = Infinity;

    for(const [id, it] of live){
      const dd2 = dist2(cx, cy, it.cx, it.cy);
      if(dd2 <= lock2 && dd2 < bestD2){
        bestD2 = dd2;
        bestId = id;
      }
    }
    if(bestId != null) hitTarget(bestId);
  }

  WIN.addEventListener('hha:shoot', onShoot);

  function cleanup(){
    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch{}
    try{ clearInterval(spawnTimer); }catch{}
    try{ clearInterval(tickTimer); }catch{}
    spawnTimer = null;
    tickTimer = null;

    for(const [, it] of live){
      try{ it.el.remove(); }catch{}
    }
    live.clear();
  }

  // start loops
  spawnTimer = setInterval(()=> spawnOne(), spawnRate);
  tickTimer = setInterval(()=> tick(), 80);

  // spawn a few immediately
  spawnOne(); spawnOne();

  return controller;
}