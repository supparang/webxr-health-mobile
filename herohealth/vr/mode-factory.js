// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — PRODUCTION (DOM spawner)
// ✅ export boot (named) + default
// ✅ FIX: no "controller before init"
// ✅ Supports: decorateTarget(el, target)
// ✅ Supports: hha:shoot {x,y,lockPx} from vr-ui.js
// ✅ stop(): clears everything (interval/listener/timeouts/DOM)

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
  try{ return performance.now(); }catch(_){ return Date.now(); }
}

function readNumCssVar(name, fallback=0){
  try{
    const cs = getComputedStyle(DOC.documentElement);
    const v = parseFloat(cs.getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  }catch(_){ return fallback; }
}

// รองรับทั้งชื่อเดิมแบบ plate-* และชื่อกลางแบบ hha-*
function readSafeVars(){
  const top    = readNumCssVar('--plate-top-safe',    readNumCssVar('--hha-safe-top',    0));
  const bottom = readNumCssVar('--plate-bottom-safe', readNumCssVar('--hha-safe-bottom', 0));
  const left   = readNumCssVar('--plate-left-safe',   readNumCssVar('--hha-safe-left',   0));
  const right  = readNumCssVar('--plate-right-safe',  readNumCssVar('--hha-safe-right',  0));
  return { top, bottom, left, right };
}

function pickWeighted(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return { kind:'good', weight:1 };

  let sum = 0;
  for(const it of a) sum += (Number(it.weight) || 1);

  let x = rng() * sum;
  for(const it of a){
    x -= (Number(it.weight) || 1);
    if(x <= 0) return it;
  }
  return a[a.length - 1];
}

export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,
  sizeRange = [44,64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],
  onHit = ()=>{},
  onExpire = ()=>{},
  decorateTarget = null,
  cooldownMs = 90,
  lockPxDefault = 28,
}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    lastSpawnAt: 0,
    tickTimer: null,
    cooldownUntil: 0,
    targets: new Set(),          // store target objects
    timeouts: new Map(),         // target -> timeoutId
  };

  function computeSpawnRect(){
    const r = mount.getBoundingClientRect();
    const safe = readSafeVars();

    const left   = r.left + safe.left;
    const top    = r.top + safe.top;
    const right  = r.right - safe.right;
    const bottom = r.bottom - safe.bottom;

    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);

    return { left, top, right, bottom, w, h };
  }

  function cleanupTarget(target){
    if(!target) return;
    state.targets.delete(target);

    const to = state.timeouts.get(target);
    if(to) clearTimeout(to);
    state.timeouts.delete(target);

    try{ target.el && target.el.remove(); }catch(_){}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;

    cleanupTarget(target);
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

    const d = e.detail || {};
    const t = now();
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + (Number(d.cooldownMs) || cooldownMs);

    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = Number(d.lockPx || lockPxDefault);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      const r = target.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dist = Math.hypot(cx - x, cy - y);
      if(dist <= lockPx && dist < bestDist){
        best = target;
        bestDist = dist;
      }
    }

    if(best) hit(best, { source:'shoot' });
  }

  WIN.addEventListener('hha:shoot', onShoot);

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 90 || rect.h < 90) return;

    const minS = Math.max(18, Number(sizeRange[0]) || 44);
    const maxS = Math.max(minS, Number(sizeRange[1]) || 64);
    const size = Math.round(minS + rng() * (maxS - minS));

    const pad = Math.max(12, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad*2));
    const y = rect.top  + pad + rng() * Math.max(1, (rect.h - pad*2));

    const chosen = pickWeighted(rng, kinds);
    const kind = (chosen && chosen.kind) ? String(chosen.kind) : 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;

    // ✅ ทำให้โผล่ชัวร์ แม้ CSS ลืมใส่ position
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
      groupIndex: Math.floor(rng() * 5), // 0..4 (เกมเอาไป map เป็น 1..5 ได้)
      size,
      rng, // expose deterministic rng to decorateTarget/pickEmoji
    };

    el.__hhaTarget = target;

    // ✅ decorate hook (emoji/icon/text)
    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch(_){}

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    const to = setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;
      cleanupTarget(target);
      try{ onExpire({ ...target }); }catch(_){}
    }, target.ttlMs);

    state.timeouts.set(target, to);
  }

  // tick loop
  state.tickTimer = setInterval(()=>{
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

      clearInterval(state.tickTimer);
      WIN.removeEventListener('hha:shoot', onShoot);

      // clear all targets/timeouts
      for(const target of Array.from(state.targets)){
        cleanupTarget(target);
      }
      state.targets.clear();
      state.timeouts.clear();
    }
  };
}

export default boot;