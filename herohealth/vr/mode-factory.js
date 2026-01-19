// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — DOM Target Spawner (PRODUCTION)
// ✅ Named export: boot (fix import error)
// ✅ Fix: no "controller before initialization"
// ✅ Supports boundsHost (prevents HUD overlap if you set #plate-bounds etc.)
// ✅ Supports hha:shoot (crosshair/tap-to-shoot) from vr-ui.js
// ✅ onHit / onExpire callbacks
// ✅ Seeded RNG support via cfg.seed
//
// Usage (example):
//   import { boot as spawnBoot } from '../vr/mode-factory.js';
//   const engine = spawnBoot({
//     mount: document.getElementById('plate-layer'),
//     boundsHost: document.getElementById('plate-bounds'), // optional but recommended
//     seed: 13579,
//     spawnRate: 900,
//     ttlMs: 1900,
//     sizeRange: [44, 64],
//     kinds: [{kind:'good', weight:0.7},{kind:'junk', weight:0.3}],
//     makeTarget: (t, el)=>{ ... optional customize ... },
//     onHit: (t)=>{},
//     onExpire:(t)=>{},
//   });
//   engine.start(); engine.stop(); engine.destroy();

'use strict';

const WIN = window;
const DOC = document;

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
  if(sum <= 0){
    // fallback: uniform
    return arr[Math.floor(rng() * arr.length)];
  }
  let r = rng() * sum;
  for(const it of arr){
    r -= Math.max(0, Number(it.weight) || 0);
    if(r <= 0) return it;
  }
  return arr[arr.length - 1];
}

function getEl(x){
  if(!x) return null;
  if(x instanceof Element) return x;
  if(typeof x === 'string'){
    try{ return DOC.querySelector(x); }catch(_){ return null; }
  }
  return null;
}

function rectOf(el){
  if(!el) return null;
  const r = el.getBoundingClientRect();
  return {
    left: r.left, top: r.top, right: r.right, bottom: r.bottom,
    width: r.width, height: r.height
  };
}

function now(){ return performance.now ? performance.now() : Date.now(); }

function defaultMakeEl(){
  const el = DOC.createElement('div');
  el.className = 'plateTarget'; // default class; game CSS can override by kind via data-kind
  el.setAttribute('role','button');
  el.style.position = 'absolute';
  el.style.display = 'grid';
  el.style.placeItems = 'center';
  el.style.userSelect = 'none';
  el.style.touchAction = 'none';
  return el;
}

function styleTarget(el, t){
  el.dataset.kind = t.kind || 'good';
  el.textContent = t.label || t.emoji || '🍽️';

  el.style.left = `${t.x}px`;
  el.style.top  = `${t.y}px`;
  el.style.width  = `${t.size}px`;
  el.style.height = `${t.size}px`;

  // center text in circle
  el.style.fontSize = `${Math.round(t.size * 0.52)}px`;
  el.style.lineHeight = '1';
}

function randBetween(rng, a, b){
  a = Number(a) || 0;
  b = Number(b) || 0;
  if(b < a){ const tmp = a; a = b; b = tmp; }
  return a + (b - a) * rng();
}

function pointInRect(px, py, r){
  return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
}

function dist2(ax, ay, bx, by){
  const dx = ax - bx;
  const dy = ay - by;
  return dx*dx + dy*dy;
}

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------
export function boot(opts = {}){
  const mount = getEl(opts.mount);
  if(!mount) throw new Error('mode-factory: mount missing');

  // IMPORTANT: declare controller BEFORE any usage (fix your error)
  const controller = new AbortController();
  const { signal } = controller;

  const boundsHost = getEl(opts.boundsHost) || null;

  const rng = (typeof opts.rng === 'function')
    ? opts.rng
    : (opts.seed != null ? seededRng(opts.seed) : Math.random);

  const cfg = {
    spawnRate: Math.max(120, Number(opts.spawnRate || 900) || 900), // ms
    ttlMs: Math.max(350, Number(opts.ttlMs || 1900) || 1900),
    maxAlive: Math.max(1, Number(opts.maxAlive || 10) || 10),
    sizeRange: Array.isArray(opts.sizeRange) ? opts.sizeRange : [44, 64],
    kinds: Array.isArray(opts.kinds) ? opts.kinds : [{ kind:'good', weight:1 }],
    safePad: Object.assign({ top:0, right:0, bottom:0, left:0 }, opts.safePad || {}),
    makeTarget: typeof opts.makeTarget === 'function' ? opts.makeTarget : null,
    onHit: typeof opts.onHit === 'function' ? opts.onHit : null,
    onExpire: typeof opts.onExpire === 'function' ? opts.onExpire : null,
    // crosshair assist
    enableShoot: opts.enableShoot !== false, // default true
  };

  const STATE = {
    running: false,
    alive: [],
    timerSpawn: null,
    timerTick: null,
  };

  function getBoundsRect(){
    // Prefer boundsHost (the safe play rectangle), else mount.
    const r = rectOf(boundsHost || mount);
    if(!r || r.width < 10 || r.height < 10) return null;

    // apply safe padding inside bounds
    const pad = cfg.safePad || {};
    const left = r.left + (pad.left||0);
    const right = r.right - (pad.right||0);
    const top = r.top + (pad.top||0);
    const bottom = r.bottom - (pad.bottom||0);

    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);

    return { left, top, right, bottom, width:w, height:h };
  }

  function spawnOne(){
    if(!STATE.running) return;
    if(STATE.alive.length >= cfg.maxAlive) return;

    const br = getBoundsRect();
    if(!br || br.width < 40 || br.height < 40) return;

    const size = Math.round(randBetween(rng, cfg.sizeRange[0], cfg.sizeRange[1]));
    const maxX = Math.max(0, br.width - size);
    const maxY = Math.max(0, br.height - size);

    // uniform spread
    const x = Math.round(randBetween(rng, 0, maxX));
    const y = Math.round(randBetween(rng, 0, maxY));

    const k = pickWeighted(rng, cfg.kinds) || { kind:'good', weight:1 };

    // target object
    const t = {
      id: `t_${Math.floor(rng()*1e9)}`,
      kind: k.kind || 'good',
      weight: k.weight,
      createdAt: now(),
      expiresAt: now() + cfg.ttlMs,

      // coords relative to boundsHost/mount
      x, y, size,

      // defaults for emoji/label (game can override via makeTarget)
      emoji: k.emoji || null,
      label: k.label || null,

      // optional custom payload
      data: k.data || null,
    };

    // element
    const el = defaultMakeEl();

    // allow game customize before styling
    if(cfg.makeTarget){
      try{ cfg.makeTarget(t, el); }catch(_){}
    }

    // default label fallback
    if(!t.label && !t.emoji){
      // sensible defaults
      if(t.kind === 'junk') t.emoji = '🍩';
      else if(String(t.kind).startsWith('g')) t.emoji = '🍽️';
      else t.emoji = '🥗';
    }

    styleTarget(el, t);

    // attach
    (boundsHost || mount).appendChild(el);

    // store
    STATE.alive.push({ t, el });
  }

  function expireTick(){
    if(!STATE.running) return;
    const ts = now();
    for(let i = STATE.alive.length - 1; i >= 0; i--){
      const it = STATE.alive[i];
      if(ts >= it.t.expiresAt){
        // remove
        try{ it.el.remove(); }catch(_){}
        STATE.alive.splice(i,1);
        if(cfg.onExpire){
          try{ cfg.onExpire(it.t); }catch(_){}
        }
      }
    }
  }

  function hitItem(idx, source='tap'){
    const it = STATE.alive[idx];
    if(!it) return;

    // visual feedback class (CSS can style)
    try{
      it.el.classList.add('is-hit');
      setTimeout(()=>{ try{ it.el.classList.remove('is-hit'); }catch(_){} }, 160);
    }catch(_){}

    // remove from DOM
    try{ it.el.remove(); }catch(_){}
    STATE.alive.splice(idx,1);

    if(cfg.onHit){
      try{
        const payload = Object.assign({ source }, it.t);
        cfg.onHit(payload);
      }catch(_){}
    }
  }

  // click/tap on target
  function onPointerDown(ev){
    if(!STATE.running) return;

    const targetEl = ev.target && ev.target.closest && ev.target.closest('.plateTarget');
    if(!targetEl) return;

    const idx = STATE.alive.findIndex(it => it.el === targetEl);
    if(idx >= 0) hitItem(idx, 'pointer');
  }

  // crosshair shoot: find closest target center within lockPx
  function onShoot(ev){
    if(!STATE.running) return;
    if(!cfg.enableShoot) return;

    const d = ev && ev.detail ? ev.detail : {};
    const px = Number(d.x); const py = Number(d.y);
    const lockPx = Math.max(6, Number(d.lockPx || 28) || 28);

    if(!isFinite(px) || !isFinite(py)) return;

    // bounds to translate relative coords to viewport coords
    const br = getBoundsRect();
    if(!br) return;

    // only shoot if shoot point is within overall viewport (always true), but we
    // compute distance in viewport space.
    let best = -1;
    let bestD2 = lockPx * lockPx;

    for(let i = 0; i < STATE.alive.length; i++){
      const it = STATE.alive[i];
      // element rect in viewport coords
      const r = it.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;

      const d2 = dist2(px, py, cx, cy);
      if(d2 <= bestD2){
        bestD2 = d2;
        best = i;
      }
    }

    if(best >= 0) hitItem(best, d.source || 'shoot');
  }

  function start(){
    if(STATE.running) return;
    STATE.running = true;

    // listeners
    mount.addEventListener('pointerdown', onPointerDown, { passive:true, signal });
    WIN.addEventListener('hha:shoot', onShoot, { passive:true, signal });

    // spawn loop
    STATE.timerSpawn = setInterval(()=>{
      // mild burst spawn (keeps action)
      spawnOne();
      if(rng() < 0.25) spawnOne();
    }, cfg.spawnRate);

    // tick for expire
    STATE.timerTick = setInterval(expireTick, 100);

    // initial seed spawns
    spawnOne(); spawnOne();
  }

  function stop(){
    STATE.running = false;
    if(STATE.timerSpawn){ clearInterval(STATE.timerSpawn); STATE.timerSpawn = null; }
    if(STATE.timerTick){ clearInterval(STATE.timerTick); STATE.timerTick = null; }
  }

  function destroy(){
    stop();
    try{ controller.abort(); }catch(_){}
    for(const it of STATE.alive){
      try{ it.el.remove(); }catch(_){}
    }
    STATE.alive.length = 0;
  }

  // auto-start by default (keeps old behavior compatible)
  const autoStart = opts.autoStart !== false;
  const api = { start, stop, destroy, spawnOne };

  if(autoStart) start();
  return api;
}