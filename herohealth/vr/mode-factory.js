// =========================================================
// /herohealth/vr/mode-factory.js
// HHA Spawn Mode Factory — PRODUCTION (PATCH A4-4)
// - Exports: boot()
// - Spawns HTML targets into a mount layer
// - TTL ring progress: sets CSS var --p (1..0)
// - Supports click/tap + hha:shoot from vr-ui.js (crosshair)
// - Safe spawn zones: reads CSS vars --hud-top-safe / --hud-bottom-safe
// - Target separation: avoids overlap (minSeparationPx)
// =========================================================

'use strict';

export function boot(opts){
  const WIN = window;
  const DOC = document;
  if(!DOC) throw new Error('mode-factory: document missing');

  const mount = opts?.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  // ---------- config ----------
  const seed = Number(opts.seed ?? Date.now()) || Date.now();
  const rng = makeRng(seed);

  const spawnRate = clampNum(opts.spawnRate ?? 900, 120, 5000); // ms
  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [44, 64];
  const sizeMin = clampNum(sizeRange[0], 20, 220);
  const sizeMax = clampNum(sizeRange[1], sizeMin, 260);

  const lifetimeMs = clampNum(opts.lifetimeMs ?? 2600, 600, 12000); // TTL
  const maxAlive = clampNum(opts.maxAlive ?? 10, 1, 80);

  const minSeparationPx = clampNum(opts.minSeparationPx ?? 14, 0, 120);
  const maxTries = clampNum(opts.spawnTries ?? 16, 1, 80);

  const kinds = Array.isArray(opts.kinds) && opts.kinds.length
    ? opts.kinds
    : [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }];

  const onHit = typeof opts.onHit === 'function' ? opts.onHit : ()=>{};
  const onExpire = typeof opts.onExpire === 'function' ? opts.onExpire : ()=>{};

  // spawn safe margins (read from CSS vars on :root)
  function readSafePx(){
    const cs = getComputedStyle(DOC.documentElement);
    const topSafe = parsePx(cs.getPropertyValue('--hud-top-safe')) || 180;
    const botSafe = parsePx(cs.getPropertyValue('--hud-bottom-safe')) || 280;

    // safe-area insets
    const sat = parsePx(cs.getPropertyValue('--sat')) || 0;
    const sab = parsePx(cs.getPropertyValue('--sab')) || 0;

    return {
      top: topSafe + sat,
      bottom: botSafe + sab,
      left: 14 + (parsePx(cs.getPropertyValue('--sal')) || 0),
      right: 14 + (parsePx(cs.getPropertyValue('--sar')) || 0),
    };
  }

  // ---------- state ----------
  const state = {
    running: true,
    alive: new Map(), // id -> target object
    nextId: 1,
    spawnTO: null,
    tickRAF: null,
  };

  // ---------- helpers ----------
  function now(){ return performance.now(); }

  function pickKind(){
    const total = kinds.reduce((s,k)=>s + (Number(k.weight)||0), 0) || 1;
    let r = rng() * total;
    for(const k of kinds){
      r -= (Number(k.weight)||0);
      if(r <= 0) return k.kind || 'good';
    }
    return kinds[kinds.length-1].kind || 'good';
  }

  function isFarEnough(px, py, radius){
    if(minSeparationPx <= 0) return true;

    for(const [,t] of state.alive){
      if(!t.el) continue;
      // compare centers in screen px using cached px if available
      const dx = (t.cxPx ?? 0) - px;
      const dy = (t.cyPx ?? 0) - py;
      const dist2 = dx*dx + dy*dy;
      const need = (t.rPx ?? 0) + radius + minSeparationPx;
      if(dist2 < need*need) return false;
    }
    return true;
  }

  function spawnOne(){
    if(!state.running) return;
    if(state.alive.size >= maxAlive) return;

    const rect = mount.getBoundingClientRect();
    if(rect.width < 50 || rect.height < 50) return;

    const safe = readSafePx();

    // allowed area in pixels inside viewport
    const xMin = safe.left;
    const xMax = Math.max(xMin + 40, rect.width - safe.right);

    const yMin = safe.top;
    const yMax = Math.max(yMin + 40, rect.height - safe.bottom);

    // if too tight, fallback to full rect
    const fxMin = 20, fxMax = rect.width - 20;
    const fyMin = 20, fyMax = rect.height - 20;

    const useFallback = (xMax - xMin < 80) || (yMax - yMin < 80);

    // decide size first (affects separation)
    const s = Math.round(lerp(sizeMin, sizeMax, rng()));
    const radius = Math.max(16, s/2);

    let px = 0, py = 0;
    let ok = false;

    for(let i=0; i<maxTries; i++){
      px = useFallback ? lerp(fxMin, fxMax, rng()) : lerp(xMin, xMax, rng());
      py = useFallback ? lerp(fyMin, fyMax, rng()) : lerp(yMin, yMax, rng());
      if(isFarEnough(px, py, radius)){
        ok = true;
        break;
      }
    }

    if(!ok){
      // give up silently to avoid ugly overlaps
      return;
    }

    const kind = pickKind();

    // Build target payload
    const id = String(state.nextId++);
    const t = {
      id,
      kind,
      groupIndex: (kind === 'good') ? Math.floor(rng()*5) : null,
      bornAt: now(),
      dieAt: now() + lifetimeMs,

      // for separation compare in px
      cxPx: px,
      cyPx: py,
      rPx: radius,

      xPct: clampNum((px / rect.width) * 100, 0, 100),
      yPct: clampNum((py / rect.height) * 100, 0, 100),
      sizePx: s,
      el: null,
    };

    // Create DOM element
    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.id = id;
    el.dataset.kind = kind;

    // deterministic emoji (use rng)
    el.textContent = pickEmoji(kind, t.groupIndex, rng);

    // position + size via CSS vars
    el.style.setProperty('--x', String(t.xPct));
    el.style.setProperty('--y', String(t.yPct));
    el.style.setProperty('--s', String(t.sizePx));
    el.style.setProperty('--p', '1'); // TTL progress 1..0

    el.setAttribute('role','button');
    el.setAttribute('aria-label', kind === 'good' ? 'good target' : 'junk target');

    // tap/click hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      hitTarget(id, 'tap');
    }, { passive:false });

    mount.appendChild(el);
    t.el = el;
    state.alive.set(id, t);
  }

  function hitTarget(id, source='tap'){
    const t = state.alive.get(String(id));
    if(!t) return;

    state.alive.delete(String(id));
    if(t.el){
      t.el.classList.add('is-hit');
      const el = t.el;
      t.el = null;
      setTimeout(()=>{ try{ el.remove(); }catch{} }, 70);
    }

    onHit({
      id: t.id,
      kind: t.kind,
      groupIndex: t.groupIndex,
      source
    });
  }

  function expireTarget(id){
    const t = state.alive.get(String(id));
    if(!t) return;

    state.alive.delete(String(id));
    if(t.el){
      const el = t.el;
      t.el = null;
      try{ el.remove(); }catch{}
    }
    onExpire({ id: t.id, kind: t.kind, groupIndex: t.groupIndex });
  }

  function tick(){
    if(!state.running){
      state.tickRAF = null;
      return;
    }
    const tNow = now();

    for(const [id, t] of state.alive){
      const left = (t.dieAt - tNow);
      if(left <= 0){
        expireTarget(id);
        continue;
      }
      if(t.el){
        const p = clampNum(left / lifetimeMs, 0, 1);
        t.el.style.setProperty('--p', String(p));
      }
    }

    state.tickRAF = requestAnimationFrame(tick);
  }

  function scheduleSpawn(){
    if(!state.running) return;
    if(state.alive.size === 0) spawnOne();

    state.spawnTO = setInterval(()=>{
      if(!state.running) return;
      spawnOne();
    }, spawnRate);
  }

  // ---------- crosshair shoot support ----------
  function onShoot(ev){
    if(!state.running) return;

    const d = ev?.detail || {};
    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = clampNum(d.lockPx ?? 28, 6, 120);

    if(!isFinite(x) || !isFinite(y)) return;

    let bestId = null;
    let bestDist2 = Infinity;

    for(const [id, t] of state.alive){
      if(!t.el) continue;
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dx = cx - x;
      const dy = cy - y;
      const dist2 = dx*dx + dy*dy;
      if(dist2 < bestDist2){
        bestDist2 = dist2;
        bestId = id;
      }
    }

    if(bestId != null && bestDist2 <= (lockPx*lockPx)){
      hitTarget(bestId, d.source || 'shoot');
    }
  }

  // ---------- start ----------
  WIN.addEventListener('hha:shoot', onShoot);
  scheduleSpawn();
  state.tickRAF = requestAnimationFrame(tick);

  // ---------- controller ----------
  const controller = {
    stop(){
      if(!state.running) return;
      state.running = false;

      if(state.spawnTO){
        clearInterval(state.spawnTO);
        state.spawnTO = null;
      }
      if(state.tickRAF){
        cancelAnimationFrame(state.tickRAF);
        state.tickRAF = null;
      }

      WIN.removeEventListener('hha:shoot', onShoot);

      for(const [,t] of state.alive){
        try{ t.el?.remove(); }catch{}
      }
      state.alive.clear();
    }
  };

  return controller;
}

// =========================================================
// helpers
// =========================================================
function clampNum(v, a, b){
  v = Number(v);
  if(!isFinite(v)) v = a;
  return v < a ? a : (v > b ? b : v);
}
function lerp(a,b,t){ return a + (b-a)*t; }

function parsePx(s){
  if(!s) return 0;
  const n = parseFloat(String(s).trim().replace('px',''));
  return isFinite(n) ? n : 0;
}

// seeded RNG (mulberry32-ish)
function makeRng(seed){
  let t = (seed >>> 0);
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Plate emoji set (ปรับได้ภายหลังให้ “ไม่เบื่อ”)
function pickEmoji(kind, gi, rng){
  const rr = typeof rng === 'function' ? rng : Math.random;

  if(kind === 'junk'){
    const junk = ['🍩','🍟','🍔','🥤','🍰','🍫','🍿','🍗'];
    return junk[Math.floor(rr()*junk.length)];
  }

  const groups = [
    ['🍚','🍞','🥔','🌽'],     // carbs
    ['🥦','🥬','🥕','🍅'],     // veg
    ['🍎','🍌','🍇','🍉'],     // fruit
    ['🍗','🐟','🥚','🫘'],     // protein
    ['🥛','🧀','🍶','🧈'],     // dairy/fat
  ];
  const g = groups[Number(gi)||0] || groups[0];
  return g[Math.floor(rr()*g.length)];
}