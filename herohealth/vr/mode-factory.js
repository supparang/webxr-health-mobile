// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory (DOM Spawner) — PRODUCTION
// ✅ Named export: boot  (fix import { boot as spawnBoot } ...)
// ✅ FIX: “controller before init” (no TDZ / no premature refs)
// ✅ Supports decorateTarget(el, target)
// ✅ Tap-to-shoot via vr-ui.js: listens hha:shoot {x,y,lockPx,source}
// ✅ Safe-area spawn rect via CSS vars (plate-*, hha-safe-*, sat/sab/sal/sar)

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
  try { return performance.now(); } catch { return Date.now(); }
}

function readCssNumber(cs, ...names){
  for(const name of names){
    const v = parseFloat(cs.getPropertyValue(name));
    if(Number.isFinite(v) && v !== 0) return v;
  }
  // allow explicit 0 to be used (if author sets 0px)
  for(const name of names){
    const raw = (cs.getPropertyValue(name) || '').trim();
    if(raw === '0' || raw === '0px') return 0;
  }
  return 0;
}

function readSafeVars(){
  const cs = getComputedStyle(DOC.documentElement);

  // Prefer generic vars, fall back to plate vars, then to env-based sat/sab/sal/sar
  const top = readCssNumber(cs, '--hha-safe-top', '--plate-top-safe', '--sat');
  const bottom = readCssNumber(cs, '--hha-safe-bottom', '--plate-bottom-safe', '--sab');
  const left = readCssNumber(cs, '--hha-safe-left', '--plate-left-safe', '--sal');
  const right = readCssNumber(cs, '--hha-safe-right', '--plate-right-safe', '--sar');

  return { top, bottom, left, right };
}

function pickWeighted(rng, arr){
  const list = Array.isArray(arr) ? arr : [];
  if(!list.length) return { kind:'good', weight:1 };

  let sum = 0;
  for(const it of list) sum += (Number(it.weight) || 0) > 0 ? Number(it.weight) : 0;
  if(sum <= 0) return list[list.length - 1];

  let x = rng() * sum;
  for(const it of list){
    x -= (Number(it.weight) || 0) > 0 ? Number(it.weight) : 0;
    if(x <= 0) return it;
  }
  return list[list.length - 1];
}

/**
 * boot({ mount, seed, spawnRate, sizeRange, kinds, onHit, onExpire, decorateTarget, cooldownMs })
 */
export function boot({
  mount,
  seed = Date.now(),

  spawnRate = 900,          // ms between spawns (approx)
  sizeRange = [44, 64],     // px
  kinds = [
    { kind: 'good', weight: 0.7 },
    { kind: 'junk', weight: 0.3 }
  ],

  onHit = () => {},
  onExpire = () => {},

  decorateTarget = null,    // (el, target) => void

  cooldownMs = 90,          // for hha:shoot lock
} = {}){
  if(!mount) throw new Error('mode-factory: mount missing');
  if(!DOC) throw new Error('mode-factory: document missing');

  const rng = seededRng(seed);

  // state (declare BEFORE any closures use it)
  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    targets: new Set(),
    cooldownUntil: 0
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
    try{ target.el && target.el.remove(); }catch{}
    state.targets.delete(target);
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;

    removeTarget(target);

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

  // ---- Shoot handler (from vr-ui.js) ----
  function onShoot(e){
    if(!state.alive) return;

    const d = (e && e.detail) ? e.detail : {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + (Number(cooldownMs) || 90);

    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = Number(d.lockPx || 28);

    if(!Number.isFinite(x) || !Number.isFinite(y)) return;
    if(!(lockPx > 0)) return;

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

    if(best) hit(best, { source: d.source || 'shoot' });
  }

  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 120 || rect.h < 120) return;

    const minS = Math.max(18, Number(sizeRange[0]) || 44);
    const maxS = Math.max(minS + 1, Number(sizeRange[1]) || 64);
    const size = Math.round(minS + rng() * (maxS - minS));

    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad * 2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad * 2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen && chosen.kind) ? String(chosen.kind) : 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // Ensure visible even if CSS forgets positioning
    el.style.position = 'fixed';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el,
      kind,
      bornAt: now(),
      ttlMs: (kind === 'junk') ? 1700 : 2100,
      groupIndex: Math.floor(rng() * 5), // 0..4 (game maps to 1..5 if needed)
      size,
      rng // expose rng for deterministic emoji/icon selection
    };

    el.__hhaTarget = target;

    // Allow game layer to decorate UI (emoji/icon/etc.)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(err){
      console.warn('[mode-factory] decorateTarget error', err);
    }

    // Tap / click
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source: 'tap' });
    }, { passive: false });

    mount.appendChild(el);
    state.targets.add(target);

    // Expire
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

  // Main loop: lightweight interval
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
      WIN.removeEventListener('hha:shoot', onShoot);

      for(const target of state.targets){
        try{ target.el.remove(); }catch{}
      }
      state.targets.clear();
    }
  };
}