// === /herohealth/vr/mode-factory.js ===
// HHA Spawn / Mode Factory — PRODUCTION (PATCH A4-1)
// ✅ Exports: boot (named)
// ✅ Spawns DOM targets into mount using CSS vars: --x --y --s
// ✅ Safe zones: reads --hud-top-safe / --hud-bottom-safe (from :root or mount)
// ✅ Supports hit by tap/click AND crosshair shoot via window event: hha:shoot
// ✅ Fixes "Cannot access 'controller' before initialization" by ordering init safely

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function readPxVar(el, name, fallbackPx){
  try{
    const cs = getComputedStyle(el || DOC.documentElement);
    const v = (cs.getPropertyValue(name) || '').trim();
    if(!v) return fallbackPx;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallbackPx;
  }catch{
    return fallbackPx;
  }
}

function readSafeZones(mount){
  // allow defining on :root or mount
  const top = readPxVar(mount || DOC.documentElement, '--hud-top-safe', 140);
  const bottom = readPxVar(mount || DOC.documentElement, '--hud-bottom-safe', 260);
  return { top, bottom };
}

function pickKind(kinds, rng){
  // kinds = [{kind, weight}]
  let sum = 0;
  for(const k of kinds) sum += (Number(k.weight)||0);
  if(sum <= 0) return kinds?.[0]?.kind || 'good';
  let r = rng() * sum;
  for(const k of kinds){
    r -= (Number(k.weight)||0);
    if(r <= 0) return k.kind;
  }
  return kinds[kinds.length - 1]?.kind || 'good';
}

function nowMs(){ return performance?.now ? performance.now() : Date.now(); }

function getRect(mount){
  const r = mount.getBoundingClientRect();
  return {
    left:r.left, top:r.top, right:r.right, bottom:r.bottom,
    w: Math.max(1, r.width),
    h: Math.max(1, r.height)
  };
}

function elFromPoint(x,y){
  return DOC.elementFromPoint(x,y);
}

function makeTargetEl(t){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.dataset.kind = t.kind;
  // IMPORTANT: position+size via CSS vars
  el.style.setProperty('--x', String(t.xPct));
  el.style.setProperty('--y', String(t.yPct));
  el.style.setProperty('--s', String(t.sizePx));
  el.textContent = t.label || (t.kind === 'junk' ? '🍩' : '🥦');
  return el;
}

/* ---------------------------------------------------------
   Controller (safe init)
--------------------------------------------------------- */
function createController(opts){
  const {
    mount,
    seed,
    spawnRate = 900,
    ttlMs = 1650,
    sizeRange = [44, 64],
    kinds = [{kind:'good',weight:0.7},{kind:'junk',weight:0.3}],
    onHit = ()=>{},
    onExpire = ()=>{},
    labeler = null
  } = opts;

  const rng = seededRng(seed);
  const safe = readSafeZones(mount);

  let running = false;
  let lastSpawn = 0;
  let rafId = 0;

  // active targets map: id -> target
  const active = new Map();
  let nextId = 1;

  function removeTarget(id, reason){
    const t = active.get(id);
    if(!t) return;
    active.delete(id);
    try{ t.el?.remove(); }catch{}
    if(reason === 'expire') onExpire(t);
  }

  function hitTarget(t, source='tap'){
    if(!t || t.dead) return;
    t.dead = true;
    try{
      t.el.classList.add('is-hit');
      // remove after short animation
      setTimeout(()=>{ try{ t.el?.remove(); }catch{} }, 120);
    }catch{}
    active.delete(t.id);
    onHit(Object.assign({ source }, t));
  }

  function spawnOne(){
    const rect = getRect(mount);
    const kind = pickKind(kinds, rng);

    const sMin = Math.max(24, Number(sizeRange?.[0] ?? 44));
    const sMax = Math.max(sMin, Number(sizeRange?.[1] ?? 64));
    const sizePx = Math.round(sMin + (sMax - sMin) * rng());

    // safe zones in px -> convert to pct using mount height
    const topSafePx = safe.top;
    const bottomSafePx = safe.bottom;

    const yMinPx = clamp(topSafePx, 0, rect.h - 1);
    const yMaxPx = clamp(rect.h - bottomSafePx, yMinPx + 1, rect.h);

    // choose center point within safe band
    const xPx = rng() * rect.w;
    const yPx = yMinPx + rng() * (yMaxPx - yMinPx);

    const xPct = clamp((xPx / rect.w) * 100, 2, 98);
    const yPct = clamp((yPx / rect.h) * 100, 2, 98);

    const id = nextId++;
    const t = {
      id,
      kind,
      sizePx,
      xPct,
      yPct,
      bornMs: nowMs(),
      ttlMs: Number(ttlMs) || 1650,
      groupIndex: (kind === 'good') ? Math.floor(rng()*5) : null,
      label: null,
      el: null,
      dead:false
    };

    // labeler hook
    if(typeof labeler === 'function'){
      try{ t.label = String(labeler(t) || ''); }catch{ t.label = ''; }
    }
    if(!t.label){
      t.label = (kind === 'junk') ? '🍟' : '🍚';
    }

    const el = makeTargetEl(t);
    t.el = el;

    // click/tap hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hitTarget(t, 'tap');
    }, { passive:false });

    mount.appendChild(el);
    active.set(id, t);
  }

  function tick(){
    if(!running) return;

    const t = nowMs();
    if((t - lastSpawn) >= spawnRate){
      lastSpawn = t;
      // spawn 1 each tick; if speed wants more -> caller reduce spawnRate
      spawnOne();
    }

    // expire check
    for(const [id, obj] of active){
      if(obj.dead) continue;
      if((t - obj.bornMs) >= obj.ttlMs){
        removeTarget(id, 'expire');
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function start(){
    if(running) return;
    running = true;
    lastSpawn = nowMs();
    rafId = requestAnimationFrame(tick);
  }

  function stop(){
    running = false;
    cancelAnimationFrame(rafId);
    // cleanup
    for(const [id] of active) removeTarget(id, 'stop');
    active.clear();
  }

  // crosshair shooting via hha:shoot (center-screen hit)
  function onShoot(ev){
    if(!running) return;
    const d = ev?.detail || {};
    const x = Number(d.x);
    const y = Number(d.y);
    // fallback: center screen
    const sx = Number.isFinite(x) ? x : (innerWidth/2);
    const sy = Number.isFinite(y) ? y : (innerHeight/2);

    const el = elFromPoint(sx, sy);
    if(!el) return;

    // find closest plateTarget
    const targetEl = el.closest?.('.plateTarget') || null;
    if(!targetEl) return;

    // find target obj by element match
    for(const [, obj] of active){
      if(obj.el === targetEl){
        hitTarget(obj, d.source || 'shoot');
        break;
      }
    }
  }

  // register listeners safely (no TDZ)
  WIN.addEventListener('hha:shoot', onShoot);

  return {
    start,
    stop,
    _debugActive: active
  };
}

/* ---------------------------------------------------------
   Public API
--------------------------------------------------------- */
export function boot(opts){
  const mount = opts?.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  // IMPORTANT: controller must be created before use
  const controller = createController(opts);

  // auto start
  controller.start();

  return controller;
}