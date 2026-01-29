// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — Target Spawner (PRODUCTION) — LATEST
// ------------------------------------------------------
// ✅ EXPORT: boot({ ... })  (ให้ plate.safe.js import { boot as spawnBoot } ได้ชัวร์)
// ✅ FIX: “controller before init” (ลำดับประกาศตัวแปร/คืนค่า controller ให้ถูก)
// ✅ NEW: decorateTarget(el, target) สำหรับตกแต่ง UI เป้า (emoji/icon/label)
// ✅ Supports tap + crosshair shoot via vr-ui.js => window event: hha:shoot {x,y,lockPx,source}
// ✅ stop(): clear interval + remove listener + clear DOM targets
// ✅ deterministic: seededRng(seed) + target.rng ให้ใช้ pickEmoji แบบ reproducible
// ------------------------------------------------------

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
  return v<a ? a : (v>b ? b : v);
}

/* ------------------------------------------------
 * Safe-area vars (per-game defines these CSS vars)
 * Default: 0 if not provided
 * ------------------------------------------------ */
function readSafeVars(){
  const cs = getComputedStyle(DOC.documentElement);

  // plate-safe vars (PlateVR). Games can define their own naming; keep fallback = 0.
  const top = parseFloat(cs.getPropertyValue('--plate-top-safe')) || 0;
  const bottom = parseFloat(cs.getPropertyValue('--plate-bottom-safe')) || 0;
  const left = parseFloat(cs.getPropertyValue('--plate-left-safe')) || 0;
  const right = parseFloat(cs.getPropertyValue('--plate-right-safe')) || 0;

  return { top, bottom, left, right };
}

function pickWeighted(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return { kind:'good', weight:1 };

  let sum = 0;
  for(const it of a) sum += (Number(it.weight) || 0) || 1;

  let x = rng() * sum;
  for(const it of a){
    x -= (Number(it.weight) || 0) || 1;
    if(x <= 0) return it;
  }
  return a[a.length - 1];
}

/* ------------------------------------------------
 * Exported boot()
 * ------------------------------------------------ */
export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,
  sizeRange = [44, 64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],

  onHit = ()=>{},
  onExpire = ()=>{},

  decorateTarget = null,        // ✅ NEW
  cooldownMs = 90,              // shoot cooldown
  lockPxDefault = 28,           // aim assist radius default
  ttlGoodMs = 2100,
  ttlJunkMs = 1700,
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  // FIX “controller before init”: ประกาศ state + controller ก่อนให้ stop เรียกได้ชัวร์
  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    cooldownUntil: 0,
    targets: new Set(),
  };

  // controller object returned
  const controller = {
    stop(){
      if(!state.alive) return;
      state.alive = false;

      try{ clearInterval(state.spawnTimer); }catch{}
      try{ WIN.removeEventListener('hha:shoot', onShoot); }catch{}

      for(const t of state.targets){
        try{ t.el.remove(); }catch{}
      }
      state.targets.clear();
    }
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
    if(!state.targets.has(target)) return;
    state.targets.delete(target);
    try{ target.el.remove(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;

    removeTarget(target);

    // call game callback
    try{
      onHit({
        kind: target.kind,
        groupIndex: target.groupIndex,
        size: target.size,
        bornAt: target.bornAt,
        ttlMs: target.ttlMs,
        ...meta
      });
    }catch(err){
      console.error('[mode-factory] onHit error', err);
    }
  }

  function onShoot(e){
    if(!state.alive) return;

    const d = e.detail || {};
    const t = now();

    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + (Number(d.cooldownMs)||0) || cooldownMs;

    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = clamp(Number(d.lockPx || lockPxDefault), 6, 120);

    if(!isFinite(x) || !isFinite(y)) return;

    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      const r = target.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dist = Math.hypot(cx - x, cy - y);

      if(dist <= lockPx && dist < bestDist){
        bestDist = dist;
        best = target;
      }
    }

    if(best) hit(best, { source: d.source || 'shoot', x, y, lockPx });
  }

  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const minS = Math.min(sizeRange[0], sizeRange[1]);
    const maxS = Math.max(sizeRange[0], sizeRange[1]);

    const size = Math.round(minS + rng() * (maxS - minS));
    const pad = Math.max(10, Math.round(size * 0.55));

    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen && chosen.kind) ? String(chosen.kind) : 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;
    el.style.position = 'absolute';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el,
      kind,
      size,
      bornAt: now(),
      ttlMs: (kind === 'junk') ? ttlJunkMs : ttlGoodMs,
      groupIndex: Math.floor(rng() * 5),   // 0..4
      rng,                                 // deterministic picks
    };

    // attach for debugging
    try{ el.__hhaTarget = target; }catch{}

    // ✅ decorate hook
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(err){
      console.warn('[mode-factory] decorateTarget error', err);
    }

    // tap/click
    el.addEventListener('pointerdown', (ev)=>{
      if(!state.alive) return;
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // expire timer
    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;

      removeTarget(target);

      try{
        onExpire({
          kind: target.kind,
          groupIndex: target.groupIndex,
          size: target.size,
          bornAt: target.bornAt,
          ttlMs: target.ttlMs,
        });
      }catch(err){
        console.error('[mode-factory] onExpire error', err);
      }
    }, target.ttlMs);
  }

  // spawn loop
  const tickMs = 60;
  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;
    const t = now();
    if(t - state.lastSpawnAt >= spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, tickMs);

  return controller;
}