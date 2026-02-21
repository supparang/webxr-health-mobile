// === /herohealth/vr/mode-factory.js ===
// PATCH: onShotMiss callback + emits hha:judge(kind=shot_miss) + keep decorateTarget + hha:shoot
// Works with PC/Mobile tap + cVR/VR crosshair via vr-ui.js (hha:shoot)

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
  return (performance && performance.now) ? performance.now() : Date.now();
}

function readSafeVars(){
  const cs = getComputedStyle(DOC.documentElement);

  // รองรับหลายเกม (plate / goodjunk / hydration / groups ฯลฯ)
  const top =
    parseFloat(cs.getPropertyValue('--plate-top-safe')) ||
    parseFloat(cs.getPropertyValue('--gj-top-safe')) ||
    parseFloat(cs.getPropertyValue('--hy-top-safe')) ||
    parseFloat(cs.getPropertyValue('--groups-top-safe')) ||
    parseFloat(cs.getPropertyValue('--hw-top-safe')) || 0;

  const bottom =
    parseFloat(cs.getPropertyValue('--plate-bottom-safe')) ||
    parseFloat(cs.getPropertyValue('--gj-bottom-safe')) ||
    parseFloat(cs.getPropertyValue('--hy-bottom-safe')) ||
    parseFloat(cs.getPropertyValue('--groups-bottom-safe')) ||
    parseFloat(cs.getPropertyValue('--hw-bottom-safe')) || 0;

  const left =
    parseFloat(cs.getPropertyValue('--plate-left-safe')) ||
    parseFloat(cs.getPropertyValue('--gj-left-safe')) ||
    parseFloat(cs.getPropertyValue('--hy-left-safe')) ||
    parseFloat(cs.getPropertyValue('--groups-left-safe')) ||
    parseFloat(cs.getPropertyValue('--hw-left-safe')) || 0;

  const right =
    parseFloat(cs.getPropertyValue('--plate-right-safe')) ||
    parseFloat(cs.getPropertyValue('--gj-right-safe')) ||
    parseFloat(cs.getPropertyValue('--hy-right-safe')) ||
    parseFloat(cs.getPropertyValue('--groups-right-safe')) ||
    parseFloat(cs.getPropertyValue('--hw-right-safe')) || 0;

  return { top, bottom, left, right };
}

function pickWeighted(rng, arr){
  let sum = 0;
  for(const it of arr) sum += (it.weight ?? 1);
  let x = rng() * Math.max(0.0001, sum);

  for(const it of arr){
    x -= (it.weight ?? 1);
    if(x <= 0) return it;
  }
  return arr[arr.length - 1];
}

function emitJudge(detail){
  try{
    WIN.dispatchEvent(new CustomEvent('hha:judge', { detail }));
  }catch{}
}

export function boot({
  mount,
  seed = Date.now(),
  spawnRate = 900,
  sizeRange = [44,64],
  kinds = [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }],

  onHit = ()=>{},
  onExpire = ()=>{},
  onShotMiss = ()=>{},   // ✅ NEW callback
  decorateTarget = null,
} = {}){
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = seededRng(seed);

  const state = {
    alive: true,
    lastSpawnAt: 0,
    spawnTimer: null,
    targets: new Set(),
    cooldownUntil: 0,
    spawnSeq: 0
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
    if(!target) return;
    try{ target.el?.remove?.(); }catch{}
  }

  function hit(target, meta){
    if(!state.alive) return;
    if(!state.targets.has(target)) return;

    state.targets.delete(target);
    removeTarget(target);

    try{
      onHit({
        kind: target.kind,
        groupIndex: target.groupIndex,
        targetId: target.id,
        bornAt: target.bornAt,
        ttlMs: target.ttlMs,
        ...meta
      });
    }catch{}
  }

  function onShoot(ev){
    if(!state.alive) return;

    const d = ev?.detail || {};
    const t = now();

    // anti-double fire
    if(t < state.cooldownUntil) return;
    state.cooldownUntil = t + 90;

    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = Math.max(6, Number(d.lockPx || 28) || 28);

    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    let best = null;
    let bestDist = Infinity;

    for(const target of state.targets){
      const el = target.el;
      if(!el || !el.isConnected) continue;

      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dist = Math.hypot(cx - x, cy - y);

      if(dist <= lockPx && dist < bestDist){
        best = target;
        bestDist = dist;
      }
    }

    if(best){
      hit(best, {
        source: 'shoot',
        x, y,
        lockPx,
        distPx: Math.round(bestDist * 100) / 100
      });
      return;
    }

    // ✅ ยิงแล้วไม่โดนเป้า
    const missPayload = {
      kind: 'shot_miss',
      source: 'shoot',
      x, y, lockPx,
      t: Date.now()
    };

    // 1) callback path
    try{ onShotMiss(missPayload); }catch{}

    // 2) event path (fallback / telemetry)
    emitJudge(missPayload);
  }

  WIN.addEventListener('hha:shoot', onShoot, { passive: true });

  function spawnOne(){
    if(!state.alive) return;

    const rect = computeSpawnRect();
    if(rect.w < 80 || rect.h < 80) return;

    const minS = Math.min(sizeRange[0] ?? 44, sizeRange[1] ?? 64);
    const maxS = Math.max(sizeRange[0] ?? 44, sizeRange[1] ?? 64);
    const size = Math.round(minS + rng() * (maxS - minS));

    const pad = Math.max(10, Math.round(size * 0.55));
    const x = rect.left + pad + rng() * Math.max(1, (rect.w - pad * 2));
    const y = rect.top + pad + rng() * Math.max(1, (rect.h - pad * 2));

    const chosen = pickWeighted(rng, kinds || [{ kind:'good', weight:1 }]);
    const kind = chosen?.kind || 'good';

    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.kind = kind;
    el.style.position = 'fixed'; // robust even if CSS delayed
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = 'translate(-50%,-50%)';

    const target = {
      id: `t_${Date.now()}_${(++state.spawnSeq)}`,
      el,
      kind,
      bornAt: now(),
      ttlMs: kind === 'junk' ? 1700 : 2100,
      groupIndex: Math.floor(rng() * 5),
      size,
      rng
    };

    el.__hhaTarget = target;

    try{
      if(typeof decorateTarget === 'function') decorateTarget(el, target);
    }catch{}

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(target, { source:'tap' });
    }, { passive:false });

    mount.appendChild(el);
    state.targets.add(target);

    setTimeout(()=>{
      if(!state.alive) return;
      if(!state.targets.has(target)) return;

      state.targets.delete(target);
      removeTarget(target);

      try{
        onExpire({
          ...target,
          source: 'ttl'
        });
      }catch{}
    }, target.ttlMs);
  }

  state.spawnTimer = setInterval(()=>{
    if(!state.alive) return;

    const t = now();
    if((t - state.lastSpawnAt) >= spawnRate){
      state.lastSpawnAt = t;
      spawnOne();
    }
  }, 60);

  return {
    stop(){
      if(!state.alive) return;

      state.alive = false;

      try{ clearInterval(state.spawnTimer); }catch{}
      WIN.removeEventListener('hha:shoot', onShoot, { passive: true });

      for(const target of state.targets){
        removeTarget(target);
      }
      state.targets.clear();
    }
  };
}