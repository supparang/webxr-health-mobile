// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — PRODUCTION (DOM spawn engine)
// ✅ FIX: export boot (ESM) ให้ import ได้ชัวร์
// ✅ FIX: ไม่มี “controller before init” (ตัดโค้ดเสี่ยงออกหมด)
// ✅ รองรับ decorateTarget(el, target) สำหรับทำ emoji/icon/สี/ป้าย
// ✅ รองรับยิงจาก vr-ui.js ผ่าน event: hha:shoot {x,y,lockPx,source}
// ✅ stop() เคลียร์ interval/listener/targets/timeout ครบ ป้องกันเป้า “แว๊บๆ” หลังจบเกม
//
// Usage:
//   import { boot as spawnBoot } from '../vr/mode-factory.js';
//   const spawner = spawnBoot({ mount, seed, decorateTarget, onHit, onExpire, ... });
//   spawner.stop();

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

function num(v, d=0){
  v = Number(v);
  return Number.isFinite(v) ? v : d;
}

function clamp(v, a, b){
  v = num(v, 0);
  return v < a ? a : (v > b ? b : v);
}

function pickWeighted(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return { kind:'good', weight:1 };

  let sum = 0;
  for(const it of a) sum += num(it.weight, 1);

  let x = rng() * sum;
  for(const it of a){
    x -= num(it.weight, 1);
    if(x <= 0) return it;
  }
  return a[a.length - 1];
}

function readSafeVars(prefix){
  // อ่านจาก CSS vars เช่น:
  //   --plate-top-safe / --plate-bottom-safe / --plate-left-safe / --plate-right-safe
  // ถ้าไม่มี จะ fallback เป็น 0
  const p = (prefix || 'plate').trim();
  try{
    const cs = getComputedStyle(DOC.documentElement);
    const top = num(cs.getPropertyValue(`--${p}-top-safe`), 0);
    const bottom = num(cs.getPropertyValue(`--${p}-bottom-safe`), 0);
    const left = num(cs.getPropertyValue(`--${p}-left-safe`), 0);
    const right = num(cs.getPropertyValue(`--${p}-right-safe`), 0);
    return { top, bottom, left, right };
  }catch(_){
    return { top:0, bottom:0, left:0, right:0 };
  }
}

/**
 * boot()
 * @param {Object} opts
 * @param {HTMLElement} opts.mount              - container ที่จะ append เป้า
 * @param {number} opts.seed
 * @param {number} opts.spawnRate               - ms ต่อ 1 spawn
 * @param {[number,number]} opts.sizeRange      - [min,max] px
 * @param {Array} opts.kinds                    - [{kind:'good'|'junk', weight:number}, ...]
 * @param {Function} opts.onHit                 - ({kind, groupIndex, source, ...})
 * @param {Function} opts.onExpire              - ({kind, groupIndex, ...})
 * @param {Function|null} opts.decorateTarget   - (el, target)=>void
 * @param {string} opts.targetClass             - CSS class ของเป้า (default 'plateTarget')
 * @param {string} opts.safeVarPrefix           - prefix ของ safe vars (default 'plate')
 * @param {number} opts.cooldownMs              - กันยิงรัว (default 90)
 * @param {Object} opts.ttl                     - {goodMs, junkMs} อายุเป้า
 */
export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,
  sizeRange = [44, 64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,

  targetClass = 'plateTarget',
  safeVarPrefix = 'plate',

  cooldownMs = 90,
  ttl = { goodMs: 2100, junkMs: 1700 },
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    cooldownUntil: 0,
    targets: new Set(),          // target objects
    timeouts: new Set(),         // TTL timeouts
    safePrefix: safeVarPrefix
  };

  function computeSpawnRect(){
    const r = mount.getBoundingClientRect();

    // NOTE: ใช้ safe vars ที่เกมตั้งเอง (กัน HUD ทับ)
    const safe = readSafeVars(state.safePrefix);

    const left   = r.left   + safe.left;
    const top    = r.top    + safe.top;
    const right  = r.right  - safe.right;
    const bottom = r.bottom - safe.bottom;

    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);

    return { left, top, right, bottom, w, h };
  }

  function removeTarget(target){
    if(!target) return;
    if(state.targets.has(target)) state.targets.delete(target);
    try{ target.el && target.el.remove(); }catch(_){}
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
    }catch(_){}
  }

  function onShoot(e){
    if(!state.alive) return;

    const d = (e && e.detail) || {};
    const t = now();

    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + num(cooldownMs, 90);

    const x = num(d.x, NaN);
    const y = num(d.y, NaN);
    const lockPx = clamp(d.lockPx ?? 28, 6, 120);

    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      const el = target.el;
      if(!el) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top  + r.height / 2;
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
    if(rect.w < 80 || rect.h < 80) return;

    const minS = num(sizeRange[0], 44);
    const maxS = num(sizeRange[1], 64);
    const size = Math.round(minS + rng() * Math.max(1, (maxS - minS)));

    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad * 2));
    const y = rect.top  + pad + rng() * Math.max(1, (rect.h - pad * 2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen && chosen.kind) ? String(chosen.kind) : 'good';

    const el = DOC.createElement('div');
    el.className = targetClass;
    el.dataset.kind = kind;

    // ✅ สำคัญ: บังคับ position ที่นี่เลย (กันเคส CSS ลืมใส่ -> เป้าไม่โผล่)
    el.style.position = 'fixed';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width  = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      el,
      kind,
      size,
      bornAt: now(),
      ttlMs: kind === 'junk' ? num(ttl.junkMs, 1700) : num(ttl.goodMs, 2100),
      groupIndex: Math.floor(rng() * 5), // 0..4 (เกมจะ map เป็น 1..5 เองได้)
      rng, // expose seeded rng for deterministic emoji picks
    };

    el.__hhaTarget = target;

    // ✅ decorateTarget hook (emoji/icon/text)
    try{
      if(typeof decorateTarget === 'function'){
        decorateTarget(el, target);
      }
    }catch(_){}

    // tap/click hit
    el.addEventListener('pointerdown', (ev)=>{
      if(!state.alive) return;
      try{ ev.preventDefault(); }catch(_){}
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    // TTL expire
    const to = setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;

      removeTarget(target);
      try{
        onExpire({
          kind: target.kind,
          groupIndex: target.groupIndex,
          size: target.size,
          bornAt: target.bornAt,
          ttlMs: target.ttlMs
        });
      }catch(_){}
    }, clamp(target.ttlMs, 200, 30000));

    state.timeouts.add(to);
  }

  // spawn loop
  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;

    const t = now();
    if(t - state.lastSpawnAt >= num(spawnRate, 900)){
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

      // clear TTL timeouts
      for(const to of state.timeouts){
        try{ clearTimeout(to); }catch(_){}
      }
      state.timeouts.clear();

      // remove targets
      for(const target of state.targets){
        try{ target.el && target.el.remove(); }catch(_){}
      }
      state.targets.clear();
    }
  };
}