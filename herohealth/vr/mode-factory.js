// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — DOM Target Spawner (NO A-Frame deps) — PRODUCTION v20260215a
// ✅ Works PC/Mobile/cVR (tap/pointer + optional crosshair shoot emits hha:shoot)
// ✅ HUD-safe spawn: respects CSS vars --hw-top-safe / --hw-bottom-safe (and safe-area insets)
// ✅ Stable seeded RNG (xmur3 + sfc32) per run
// ✅ onHit / onExpire / onShotMiss hooks (shot_miss = ยิงแล้วไม่โดนเป้า)
// ✅ target TTL, cap, cheap cleanup (no sort in hot loop)
// ✅ never crashes if mount missing; safe stop()
// Exports: boot(cfg) => controller { stop() }

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

function cssNumPx(el, name, fallback){
  try{
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    if(!v) return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }catch{
    return fallback;
  }
}

// --- deterministic RNG (xmur3 + sfc32) ---
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for(let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function sfc32(a,b,c,d){
  return function(){
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
function makeRng(seed){
  const s = String(seed ?? Date.now());
  const h = xmur3(s);
  const a=h(), b=h(), c=h(), d=h();
  return sfc32(a,b,c,d);
}

// --- geometry helpers ---
function rectOf(el){
  const r = el.getBoundingClientRect();
  return { left:r.left, top:r.top, width:r.width, height:r.height, right:r.right, bottom:r.bottom };
}
function within(n, lo, hi){ return n>=lo && n<=hi; }

function chooseWeighted(rng, kinds){
  let sum = 0;
  for(const k of kinds) sum += (Number(k.weight)||0);
  if(sum <= 0) return kinds[0];
  let roll = rng() * sum;
  for(const k of kinds){
    roll -= (Number(k.weight)||0);
    if(roll <= 0) return k;
  }
  return kinds[kinds.length-1];
}

function once(fn){
  let done=false;
  return (...args)=>{ if(done) return; done=true; fn(...args); };
}

// --- main boot ---
export function boot(cfg){
  const mount = cfg?.mount;
  if(!mount || !(mount instanceof Element)){
    console.warn('[mode-factory] mount missing');
    return { stop(){ } };
  }

  const rng = makeRng(cfg.seed ?? Date.now());
  const kinds = Array.isArray(cfg.kinds) && cfg.kinds.length ? cfg.kinds : [
    { kind:'good', weight:.75 },
    { kind:'junk', weight:.25 }
  ];

  const sizeRange = Array.isArray(cfg.sizeRange) ? cfg.sizeRange : [44, 64];
  const spawnRate = clamp(cfg.spawnRate ?? 900, 240, 4000);

  const maxTargets = clamp(cfg.maxTargets ?? 18, 6, 40);
  const ttlMs = clamp(cfg.ttlMs ?? 1700, 500, 6000);

  const onHit = typeof cfg.onHit === 'function' ? cfg.onHit : null;
  const onExpire = typeof cfg.onExpire === 'function' ? cfg.onExpire : null;
  const onShotMiss = typeof cfg.onShotMiss === 'function' ? cfg.onShotMiss : null;
  const decorateTarget = typeof cfg.decorateTarget === 'function' ? cfg.decorateTarget : null;

  // view hint (optional): html[data-view="cvr"] or ?view=cvr handled by run page
  const isCVR = (document.documentElement.dataset.view || '').toLowerCase() === 'cvr';

  // HUD-safe zones
  const topSafe = cssNumPx(DOC.documentElement, '--hw-top-safe', 150);
  const bottomSafe = cssNumPx(DOC.documentElement, '--hw-bottom-safe', 150);

  // Internal state
  let alive = true;
  let spawnTimer = null;
  let tickTimer = null;

  let targets = []; // { el, kind, bornAt, ttlAt, groupIndex? }
  let lastSpawnAt = 0;

  // --- create target element ---
  function makeTarget(){
    const pick = chooseWeighted(rng, kinds);
    const t = {
      kind: String(pick.kind || 'good'),
      bornAt: performance.now(),
      ttlAt: performance.now() + ttlMs,
      rng,
      groupIndex: 0
    };

    const el = DOC.createElement('div');
    el.className = 'hha-target';
    el.style.position = 'absolute';
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.transform = 'translate(-9999px,-9999px)';
    el.style.width = '52px';
    el.style.height = '52px';
    el.style.borderRadius = '999px';
    el.style.display = 'grid';
    el.style.placeItems = 'center';
    el.style.fontSize = '30px';
    el.style.cursor = 'pointer';
    el.style.userSelect = 'none';
    el.style.webkitTapHighlightColor = 'transparent';
    el.style.touchAction = 'none';

    // ensure mount is interaction layer
    mount.style.pointerEvents = 'auto';
    mount.style.touchAction = 'none';

    // decorate (emoji / dataset / groupIndex etc.)
    try{
      if(decorateTarget) decorateTarget(el, t);
    }catch(e){
      console.warn('[mode-factory] decorateTarget failed', e);
    }

    // place
    placeTarget(el);

    // hit handler (pointerdown is best for mobile)
    const onDown = (ev)=>{
      if(!alive) return;
      ev.preventDefault?.();
      ev.stopPropagation?.();

      // consume hit only once
      cleanupTarget(t, el, 'hit');

      // callback
      try{
        onHit && onHit({ kind:t.kind, groupIndex:t.groupIndex, el });
      }catch(e){}

      // optional fx event for listeners
      try{
        WIN.dispatchEvent(new CustomEvent('hha:hit', { detail:{ kind:t.kind, groupIndex:t.groupIndex } }));
      }catch{}
    };

    el.addEventListener('pointerdown', onDown, { passive:false });

    // store to allow cleanup
    t.el = el;
    return t;
  }

  // --- placement with HUD-safe ---
  function placeTarget(el){
    const layer = rectOf(mount);

    const pad = 12;
    const size = clamp(Math.round(sizeRange[0] + rng()*(sizeRange[1]-sizeRange[0])), 24, 120);
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.fontSize = Math.max(20, Math.floor(size*0.52)) + 'px';

    const safeTop = layer.top + pad + topSafe;
    const safeBottom = layer.bottom - pad - bottomSafe;

    const minY = safeTop;
    const maxY = Math.max(minY + 10, safeBottom);

    const x = layer.left + pad + rng() * Math.max(10, (layer.width - pad*2 - size));
    const y = minY + rng() * Math.max(10, (maxY - minY - size));

    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.transform = 'translate(0,0)';
  }

  // --- cleanup target ---
  function cleanupTarget(t, el, why){
    if(!el || !el.parentNode) return;
    try{ el.remove(); }catch{}
    // remove from targets list cheap
    for(let i=0;i<targets.length;i++){
      if(targets[i] === t){
        targets.splice(i,1);
        break;
      }
    }
    if(why === 'expire'){
      try{
        onExpire && onExpire(t);
      }catch(e){}
    }
  }

  // --- expire sweep ---
  function tick(){
    if(!alive) return;
    const tNow = performance.now();

    // expire by ttl
    for(let i=targets.length-1;i>=0;i--){
      const t = targets[i];
      if(tNow >= t.ttlAt){
        cleanupTarget(t, t.el, 'expire');
      }
    }

    // spawn pacing
    if(tNow - lastSpawnAt >= spawnRate){
      spawnOne();
      lastSpawnAt = tNow;
    }
  }

  function spawnOne(){
    if(!alive) return;

    // cap
    if(targets.length >= maxTargets){
      // cheap cleanup of oldest
      const oldest = targets[0];
      if(oldest) cleanupTarget(oldest, oldest.el, 'expire');
    }

    const t = makeTarget();
    targets.push(t);
    mount.appendChild(t.el);
  }

  // --- Shot miss detector (ยิงแล้วไม่โดนเป้า) ---
  // We treat a "shot" event as intent to hit. If no target center is within lockPx, it's a miss.
  // vr-ui.js emits hha:shoot {x,y,lockPx}; also allow click/tap on empty mount to count as miss.
  function nearestTargetD2(x,y){
    let bestD2 = Infinity;
    let best = null;
    for(const t of targets){
      const el = t.el;
      if(!el || !el.isConnected) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dx = x - cx, dy = y - cy;
      const d2 = dx*dx + dy*dy;
      if(d2 < bestD2){ bestD2 = d2; best = t; }
    }
    return { best, bestD2 };
  }

  function reportShotMiss(meta){
    if(!onShotMiss) return;
    try{ onShotMiss(meta || {}); }catch{}
  }

  // 1) hha:shoot (from vr-ui.js crosshair)
  const onShoot = (ev)=>{
    if(!alive) return;
    const d = ev?.detail || {};
    const x = Number(d.x); const y = Number(d.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    const lockPx = clamp(Number(d.lockPx ?? 28) || 28, 8, 90);
    const { bestD2 } = nearestTargetD2(x,y);

    if(!(bestD2 <= lockPx*lockPx)){
      reportShotMiss({ kind:'shot_miss', via:'hha:shoot', x, y, lockPx, cvr:isCVR });
      try{
        WIN.dispatchEvent(new CustomEvent('hha:judge', { detail:{ kind:'shot_miss', via:'hha:shoot' } }));
      }catch{}
    }
  };
  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  // 2) pointerdown on empty layer (optional)
  const onEmptyDown = (ev)=>{
    if(!alive) return;
    // if user tapped empty area (not a target) -> miss
    const path = ev.composedPath ? ev.composedPath() : [];
    const hitTarget = path.some(n=> n && n.classList && n.classList.contains('hha-target'));
    if(hitTarget) return;

    const x = ev.clientX, y = ev.clientY;
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    reportShotMiss({ kind:'shot_miss', via:'empty_tap', x, y, lockPx:0, cvr:isCVR });
    try{
      WIN.dispatchEvent(new CustomEvent('hha:judge', { detail:{ kind:'shot_miss', via:'empty_tap' } }));
    }catch{}
  };
  mount.addEventListener('pointerdown', onEmptyDown, { passive:true });

  // --- start timers ---
  lastSpawnAt = performance.now();
  tickTimer = setInterval(tick, 50); // cheap sweep + pacing

  // spawn a few immediately
  const warm = clamp(cfg.warmStart ?? 6, 0, 12);
  for(let i=0;i<warm;i++) spawnOne();

  // --- stop ---
  const stopOnce = once(()=>{
    alive = false;
    try{ clearInterval(tickTimer); }catch{}
    tickTimer = null;

    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch{}
    try{ mount.removeEventListener('pointerdown', onEmptyDown); }catch{}

    // remove all targets
    for(const t of targets){
      try{ t.el?.remove(); }catch{}
    }
    targets.length = 0;
  });

  return { stop: stopOnce };
}