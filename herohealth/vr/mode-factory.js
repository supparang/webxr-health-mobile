// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — Spawn Targets (PRODUCTION) — LATEST
// ✅ export boot()
// ✅ FIX: no "controller before init"
// ✅ Supports decorateTarget(el, target)
// ✅ Supports hha:shoot (crosshair/tap-to-shoot from vr-ui.js)
// ✅ stop(): clears interval/listeners/DOM safely

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

function now(){
  try{ return performance.now(); }catch(_){ return Date.now(); }
}

function readSafeVars(){
  // expects these vars on :root (plate-vr.css sets them)
  const cs = getComputedStyle(DOC.documentElement);
  const top = parseFloat(cs.getPropertyValue('--plate-top-safe')) || 0;
  const bottom = parseFloat(cs.getPropertyValue('--plate-bottom-safe')) || 0;
  const left = parseFloat(cs.getPropertyValue('--plate-left-safe')) || 0;
  const right = parseFloat(cs.getPropertyValue('--plate-right-safe')) || 0;
  return { top, bottom, left, right };
}

function pickWeighted(rng, arr){
  const list = Array.isArray(arr) ? arr : [];
  if(!list.length) return { kind:'good', weight:1 };

  let sum = 0;
  for(const it of list) sum += (Number(it.weight) || 1);

  let x = rng() * sum;
  for(const it of list){
    x -= (Number(it.weight) || 1);
    if(x <= 0) return it;
  }
  return list[list.length - 1];
}

function clamp(v,a,b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,
  sizeRange = [44,64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,         // ✅ NEW
  shootCooldownMs = 90,          // for hha:shoot
  defaultLockPx = 28,
  ttlGoodMs = 2100,
  ttlJunkMs = 1700,
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive:true,
    spawnTimer:null,
    targets:new Set(),
    lastSpawnAt:0,
    cooldownUntil:0,
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
    try{ target.el.remove(); }catch(_){}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;
    state.targets.delete(target);
    removeTarget(target);
    try{
      onHit({ kind: target.kind, groupIndex: target.groupIndex, ...meta });
    }catch(err){
      console.warn('[mode-factory] onHit error', err);
    }
  }

  function onShoot(ev){
    if(!state.alive) return;
    const d = (ev && ev.detail) ? ev.detail : {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + (Number(shootCooldownMs) || 90);

    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = clamp(Number(d.lockPx || defaultLockPx), 6, 160);
    if(!isFinite(x) || !isFinite(y)) return;

    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      const r = target.el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(cx - x, cy - y);
      if(dist <= lockPx && dist < bestDist){
        bestDist = dist;
        best = target;
      }
    }

    if(best) hit(best, { source:'shoot' });
  }

  // ✅ Add listener once everything is defined (avoids "controller before init")
  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const size = Math.round(sizeRange[0] + rng() * (sizeRange[1] - sizeRange[0]));
    const pad = Math.max(10, Math.round(size * 0.55));

    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad * 2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad * 2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen && chosen.kind) ? String(chosen.kind) : 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // IMPORTANT: viewport coords (fixed in css)
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width  = `${size}px`;
    el.style.height = `${size}px`;

    const target = {
      el,
      kind,
      bornAt: now(),
      ttlMs: kind === 'junk' ? (Number(ttlJunkMs)||1700) : (Number(ttlGoodMs)||2100),
      groupIndex: Math.floor(rng() * 5), // 0..4 (game can map to 1..5)
      size,
      rng, // expose rng for deterministic emoji picks
    };
    el.__hhaTarget = target;

    // ✅ allow game decorate (emoji/icon/label)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(err){
      console.warn('[mode-factory] decorateTarget error', err);
    }

    el.addEventListener('pointerdown', (pev)=>{
      pev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // expire
    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      state.targets.delete(target);
      removeTarget(target);
      try{ onExpire({ ...target }); }catch(_){}
    }, target.ttlMs);
  }

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

      try{ clearInterval(state.spawnTimer); }catch(_){}
      try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}

      for(const target of state.targets){
        try{ removeTarget(target); }catch(_){}
      }
      state.targets.clear();
    }
  };
}