// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — PRODUCTION (DOM spawn engine)
// --------------------------------------------------
// ✅ export boot(...)
// ✅ FIX: “controller before init” (จัดลำดับตัวแปร/ฟังก์ชันใหม่ ไม่อ้างก่อนประกาศ)
// ✅ Supports: decorateTarget(el, target) for emoji/icon UI
// ✅ Supports: tap (pointerdown) + crosshair shoot via vr-ui.js => hha:shoot {x,y,lockPx}
// ✅ stop(): clears timers, removes listeners, removes targets (no “แว๊บๆ”)
// --------------------------------------------------

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

function now(){
  try{ return performance.now(); }catch{ return Date.now(); }
}

function clamp(v,a,b){
  v = Number(v)||0;
  return v < a ? a : (v > b ? b : v);
}

function readSafeVars(prefix='plate'){
  // ใช้ตัวแปร CSS แบบ per-game ได้ (เช่น --plate-top-safe, --groups-top-safe)
  const cs = getComputedStyle(DOC.documentElement);
  const top    = parseFloat(cs.getPropertyValue(`--${prefix}-top-safe`))    || 0;
  const bottom = parseFloat(cs.getPropertyValue(`--${prefix}-bottom-safe`)) || 0;
  const left   = parseFloat(cs.getPropertyValue(`--${prefix}-left-safe`))   || 0;
  const right  = parseFloat(cs.getPropertyValue(`--${prefix}-right-safe`))  || 0;
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
 * boot({
 *   mount,
 *   seed,
 *   spawnRate,
 *   sizeRange,
 *   kinds: [{kind:'good',weight:0.7},{kind:'junk',weight:0.3}],
 *   onHit({kind,groupIndex,source}),
 *   onExpire(target),
 *   decorateTarget(el,target),
 *   safePrefix: 'plate' (default)
 * })
 */
export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,
  sizeRange = [44,64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,
  safePrefix = 'plate'
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    targets: new Set(),
    shootCooldownUntil: 0,
    expireTimers: new Map(), // target -> timeoutId
  };

  function computeSpawnRect(){
    const r = mount.getBoundingClientRect();
    const safe = readSafeVars(safePrefix);

    const left   = r.left   + safe.left;
    const top    = r.top    + safe.top;
    const right  = r.right  - safe.right;
    const bottom = r.bottom - safe.bottom;

    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);

    return { left, top, right, bottom, w, h };
  }

  function removeTarget(target){
    // ลบจากเซ็ต + เคลียร์ timeout ของเป้านั้น
    if(!target) return;
    if(state.targets.has(target)) state.targets.delete(target);

    const to = state.expireTimers.get(target);
    if(to){
      clearTimeout(to);
      state.expireTimers.delete(target);
    }

    try{ target.el && target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;

    removeTarget(target);

    try{
      onHit({
        kind: target.kind,
        groupIndex: target.groupIndex,
        ...meta
      });
    }catch(err){
      console.error('[mode-factory] onHit error', err);
    }
  }

  function handleShoot(e){
    if(!state.alive) return;

    const d = e.detail || {};
    const t = now();
    if(t < state.shootCooldownUntil) return;

    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = clamp(d.lockPx ?? 28, 8, 120);

    if(!isFinite(x) || !isFinite(y)) return;

    // cooldown (match vr-ui default-ish)
    state.shootCooldownUntil = t + clamp(d.cooldownMs ?? 90, 30, 500);

    // หาเป้าที่ใกล้ที่สุดในระยะ lockPx
    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      const el = target.el;
      if(!el) continue;

      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;
      const dist = Math.hypot(cx - x, cy - y);

      if(dist <= lockPx && dist < bestDist){
        bestDist = dist;
        best = target;
      }
    }

    if(best) hit(best, { source:'shoot' });
  }

  // ✅ ยิงด้วย crosshair (vr-ui.js ส่ง hha:shoot)
  WIN.addEventListener('hha:shoot', handleShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const size = Math.round(sizeRange[0] + rng() * (sizeRange[1] - sizeRange[0]));
    const pad  = Math.max(10, Math.round(size * 0.55));

    const x = rect.left + pad + rng() * Math.max(1, rect.w - pad*2);
    const y = rect.top  + pad + rng() * Math.max(1, rect.h - pad*2);

    const chosen = pickWeighted(rng, kinds);
    const kind = String(chosen.kind || 'good');

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    el.style.position = 'absolute';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width  = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el,
      kind,
      bornAt: now(),
      ttlMs: (kind === 'junk') ? 1700 : 2100,
      groupIndex: Math.floor(rng() * 5),
      size,
      rng // expose rng for deterministic emoji picks
    };

    el.__hhaTarget = target;

    // ✅ allow game to decorate (emoji/icon/label)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(err){
      console.error('[mode-factory] decorateTarget error', err);
    }

    // tap/click
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // expiry
    const tid = setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;

      removeTarget(target);

      try{ onExpire({ ...target }); }catch(err){
        console.error('[mode-factory] onExpire error', err);
      }
    }, target.ttlMs);

    state.expireTimers.set(target, tid);
  }

  // main loop
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
      WIN.removeEventListener('hha:shoot', handleShoot);

      // remove all targets safely
      for(const target of Array.from(state.targets)){
        removeTarget(target);
      }
      state.targets.clear();

      // clear any leftover timers
      for(const tid of state.expireTimers.values()){
        try{ clearTimeout(tid); }catch{}
      }
      state.expireTimers.clear();
    }
  };
}