// === /herohealth/vr/mode-factory.js ===
// Mode Factory — SAFE SPAWNER (PRODUCTION)
// For HeroHealth-like mini games (targets on DOM layer)
// ------------------------------------------------------
// ✅ Exports: boot(...)
// ✅ Spawns targets with CSS vars: --x --y --s (px)
// ✅ Weighted kinds (good/junk/etc.)
// ✅ onHit / onExpire hooks
// ✅ Lifetime per kind (lifeGoodMs / lifeJunkMs)
// ✅ Safe spawn rect (auto reads CSS vars like --hud-top-safe/--hud-bottom-safe)
// ✅ Crosshair/tap-to-shoot via window event: hha:shoot {x,y,lockPx}
// ------------------------------------------------------

'use strict';

/* -------------------------------------------------------
 * Utilities
 * ----------------------------------------------------- */
function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function qsNum(n, def){
  n = Number(n);
  return Number.isFinite(n) ? n : def;
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

function getCssVarPx(el, name, fallbackPx){
  try{
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    if(!v) return fallbackPx;
    // supports "123px" or "123"
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallbackPx;
  }catch{
    return fallbackPx;
  }
}

function pickWeighted(rng, items){
  // items: [{kind, weight, ...}]
  let sum = 0;
  for(const it of items) sum += Math.max(0, Number(it.weight)||0);
  if(sum <= 0) return items[0] || null;

  const r = rng() * sum;
  let acc = 0;
  for(const it of items){
    acc += Math.max(0, Number(it.weight)||0);
    if(r <= acc) return it;
  }
  return items[items.length - 1] || null;
}

/* -------------------------------------------------------
 * Core boot()
 * ----------------------------------------------------- */
export function boot(opts){
  const mount = opts?.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  // config defaults
  const rng = opts?.rng || seededRng(opts?.seed || Date.now());
  const spawnRate = clamp(opts?.spawnRate ?? 900, 180, 5000);
  const sizeRange = Array.isArray(opts?.sizeRange) ? opts.sizeRange : [44, 64];

  const kinds = Array.isArray(opts?.kinds) && opts.kinds.length
    ? opts.kinds
    : [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }];

  const onHit = typeof opts?.onHit === 'function' ? opts.onHit : ()=>{};
  const onExpire = typeof opts?.onExpire === 'function' ? opts.onExpire : ()=>{};

  const pickGroupIndex = typeof opts?.pickGroupIndex === 'function'
    ? opts.pickGroupIndex
    : ()=> Math.floor(rng()*5); // default for Plate/Groups

  const lifeGoodMs = clamp(opts?.lifeGoodMs ?? 1400, 350, 20000);
  const lifeJunkMs = clamp(opts?.lifeJunkMs ?? 1200, 350, 20000);

  // safe area (auto from CSS vars if present)
  const rootEl = document.documentElement;
  const safeTopPx = qsNum(opts?.safeTopPx, getCssVarPx(rootEl, '--hud-top-safe', 96));
  const safeBottomPx = qsNum(opts?.safeBottomPx, getCssVarPx(rootEl, '--hud-bottom-safe', 200));
  const safeLeftPx = qsNum(opts?.safeLeftPx, 10);
  const safeRightPx = qsNum(opts?.safeRightPx, 10);

  // internal state
  const state = {
    running: true,
    spawnTimer: null,
    targets: new Map(), // id -> targetObj
    nextId: 1
  };

  // IMPORTANT: create controller first (no TDZ issues)
  const controller = {
    stop(){ stop(); },
    start(){ start(); },
    clear(){ clearAll(); },
    destroy(){ destroy(); }
  };

  // ensure mount styling
  try{
    mount.style.position = mount.style.position || 'fixed';
  }catch{}

  /* -------------------------------------------------------
   * Spawn rect helpers
   * ----------------------------------------------------- */
  function getSpawnRect(){
    const r = mount.getBoundingClientRect();
    // clamp rect with safe margins
    const left = r.left + safeLeftPx;
    const top = r.top + safeTopPx;
    const right = r.right - safeRightPx;
    const bottom = r.bottom - safeBottomPx;

    // if too tight, fallback to less strict
    const minW = 220, minH = 260;
    let L = left, T = top, R = right, B = bottom;
    if((R - L) < minW){
      L = r.left + 10; R = r.right - 10;
    }
    if((B - T) < minH){
      T = r.top + 10; B = r.bottom - 10;
    }

    return { L, T, R, B, width: Math.max(0, R - L), height: Math.max(0, B - T) };
  }

  function randPx(min, max){
    return min + rng() * (max - min);
  }

  function randSize(){
    const a = Number(sizeRange[0] ?? 44);
    const b = Number(sizeRange[1] ?? 64);
    return clamp(Math.round(randPx(Math.min(a,b), Math.max(a,b))), 28, 140);
  }

  function createEl(kind, sizePx){
    const el = document.createElement('div');
    el.className = (opts?.className || 'plateTarget'); // default class used in plate-vr.css
    el.dataset.kind = kind;

    // emoji/icon text (optional)
    if(typeof opts?.renderText === 'function'){
      el.textContent = String(opts.renderText(kind) ?? '');
    }else{
      // sensible defaults
      el.textContent = (kind === 'junk') ? '🍩' : '🍽️';
    }

    // size + will be positioned via CSS vars
    el.style.setProperty('--s', `${sizePx}px`);
    return el;
  }

  function addTarget(){
    if(!state.running) return;

    const pick = pickWeighted(rng, kinds);
    const kind = pick?.kind || 'good';
    const sizePx = randSize();

    const rect = getSpawnRect();
    if(rect.width < 80 || rect.height < 80) return; // too small, skip spawn

    const x = randPx(rect.L + sizePx/2, rect.R - sizePx/2);
    const y = randPx(rect.T + sizePx/2, rect.B - sizePx/2);

    const id = state.nextId++;
    const el = createEl(kind, sizePx);
    el.dataset.id = String(id);

    // groupIndex for good targets
    const groupIndex = (kind === 'good') ? clamp(pickGroupIndex(), 0, 4) : null;
    if(groupIndex != null) el.dataset.group = String(groupIndex);

    // position relative to viewport (since layer is fixed)
    el.style.setProperty('--x', `${Math.round(x)}px`);
    el.style.setProperty('--y', `${Math.round(y)}px`);

    // attach
    mount.appendChild(el);

    const life = (kind === 'junk') ? lifeJunkMs : lifeGoodMs;
    const bornAt = performance.now();
    const expireAt = bornAt + life;

    const target = {
      id, kind, el,
      sizePx,
      x, y, // cached center in viewport coords
      groupIndex,
      bornAt, expireAt,
      removed:false,
      expireTO: null
    };

    // expire
    target.expireTO = setTimeout(()=>{
      if(target.removed) return;
      removeTarget(target, 'expire');
    }, life + 5);

    // click/tap hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      if(target.removed) return;
      removeTarget(target, 'hit');
    }, { passive:false });

    state.targets.set(id, target);
  }

  function removeTarget(target, why){
    if(!target || target.removed) return;
    target.removed = true;

    try{ clearTimeout(target.expireTO); }catch{}
    try{ target.el?.remove(); }catch{}
    state.targets.delete(target.id);

    if(why === 'hit'){
      onHit({
        id: target.id,
        kind: target.kind,
        groupIndex: target.groupIndex,
        x: target.x, y: target.y,
        sizePx: target.sizePx,
        at: Date.now()
      });
    }else{
      onExpire({
        id: target.id,
        kind: target.kind,
        groupIndex: target.groupIndex,
        x: target.x, y: target.y,
        sizePx: target.sizePx,
        at: Date.now()
      });
    }
  }

  function clearAll(){
    for(const t of state.targets.values()){
      try{ clearTimeout(t.expireTO); }catch{}
      try{ t.el?.remove(); }catch{}
    }
    state.targets.clear();
  }

  /* -------------------------------------------------------
   * Crosshair shoot (hha:shoot)
   * ----------------------------------------------------- */
  function onShoot(ev){
    if(!state.running) return;
    const d = ev?.detail || {};
    const sx = Number(d.x);
    const sy = Number(d.y);
    if(!Number.isFinite(sx) || !Number.isFinite(sy)) return;

    const lockPx = clamp(d.lockPx ?? 28, 8, 140);

    // find closest target center within lockPx
    let best = null;
    let bestDist = Infinity;

    for(const t of state.targets.values()){
      if(t.removed) continue;

      // update center from DOM (more accurate if layout shifted)
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      t.x = cx; t.y = cy;

      const dx = cx - sx;
      const dy = cy - sy;
      const dist = Math.hypot(dx, dy);

      if(dist <= lockPx && dist < bestDist){
        bestDist = dist;
        best = t;
      }
    }

    if(best){
      removeTarget(best, 'hit');
    }
  }

  window.addEventListener('hha:shoot', onShoot);

  /* -------------------------------------------------------
   * Start/Stop lifecycle
   * ----------------------------------------------------- */
  function start(){
    if(state.running) return;
    state.running = true;
    schedule();
  }

  function stop(){
    state.running = false;
    if(state.spawnTimer){
      clearInterval(state.spawnTimer);
      state.spawnTimer = null;
    }
  }

  function schedule(){
    if(state.spawnTimer) clearInterval(state.spawnTimer);
    state.spawnTimer = setInterval(()=>{
      if(!state.running) return;
      addTarget();

      // optional: cap targets
      const cap = clamp(opts?.maxTargets ?? 14, 2, 80);
      if(state.targets.size > cap){
        // remove oldest first
        const oldest = state.targets.values().next().value;
        if(oldest) removeTarget(oldest, 'expire');
      }
    }, spawnRate);
  }

  function destroy(){
    stop();
    clearAll();
    window.removeEventListener('hha:shoot', onShoot);
  }

  // auto start
  schedule();

  // return controller to caller
  return controller;
}