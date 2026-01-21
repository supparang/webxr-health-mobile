// === /herohealth/vr/mode-factory.js ===
// HHA Spawn Mode Factory — PRODUCTION (TDZ-safe)
// ✅ Exports: boot (named) + default (alias)
// ✅ Creates DOM targets in a safe playfield rect
// ✅ Supports click/touch + hha:shoot (crosshair/tap-to-shoot from vr-ui.js)
// ✅ Seeded RNG, weighted kinds, size range
// ✅ onHit / onExpire callbacks
// ✅ No "controller before initialization" (TDZ safe)

'use strict';

const WIN = window;
const DOC = document;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
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

function pickWeighted(rng, items){
  // items: [{kind, weight, ...}]
  let sum = 0;
  for(const it of items) sum += Math.max(0, Number(it.weight)||0);
  if(sum <= 0) return items[0] || null;

  let x = rng() * sum;
  for(const it of items){
    x -= Math.max(0, Number(it.weight)||0);
    if(x <= 0) return it;
  }
  return items[items.length-1] || null;
}

function getRectSafe(mount){
  const r = mount.getBoundingClientRect();

  // safe insets (mobile notch)
  const sat = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sat')) || 0;
  const sar = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sar')) || 0;
  const sab = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sab')) || 0;
  const sal = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sal')) || 0;

  // keep away from edges a bit (avoid HUD overlap)
  const pad = 10;
  const topPad = pad + sat + 86; // ✅ reserve top HUD space
  const botPad = pad + sab + 18;

  const left = r.left + pad + sal;
  const top  = r.top  + topPad;
  const right = r.right - pad - sar;
  const bottom = r.bottom - botPad;

  const w = Math.max(0, right - left);
  const h = Math.max(0, bottom - top);

  return { left, top, right, bottom, w, h };
}

function makeTargetEl(t){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.dataset.kind = t.kind;

  // optional: plate/group label support
  if(t.groupIndex != null) el.dataset.group = String(t.groupIndex);

  // default visual content (engine may override by setting t.html or t.text)
  if(t.html){
    el.innerHTML = t.html;
  }else if(t.text){
    el.textContent = t.text;
  }else{
    el.textContent = (t.kind === 'junk') ? '🍩' : '🍽️';
  }

  // positioning
  el.style.position = 'absolute';
  el.style.left = `${t.x}px`;
  el.style.top  = `${t.y}px`;
  el.style.width = `${t.size}px`;
  el.style.height= `${t.size}px`;

  return el;
}

export function boot(opts = {}){
  const mount = opts.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = opts.rng || seededRng(opts.seed || Date.now());

  const spawnRate = clamp(opts.spawnRate ?? 900, 180, 5000);
  const ttlMs     = clamp(opts.ttlMs ?? 1600, 350, 6000);
  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [44, 64];
  const minS = clamp(sizeRange[0] ?? 44, 18, 280);
  const maxS = clamp(sizeRange[1] ?? 64, minS, 320);

  const kinds = Array.isArray(opts.kinds) && opts.kinds.length
    ? opts.kinds
    : [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }];

  const onHit = typeof opts.onHit === 'function' ? opts.onHit : ()=>{};
  const onExpire = typeof opts.onExpire === 'function' ? opts.onExpire : ()=>{};

  // ✅ TDZ-safe controller
  let controller = null;

  // internal state
  let running = true;
  let timerSpawn = null;

  const active = new Map(); // id -> {t, el, to}

  function now(){ return performance.now ? performance.now() : Date.now(); }

  function spawnOne(){
    if(!running) return;

    const safe = getRectSafe(mount);
    if(safe.w < 60 || safe.h < 60){
      // playfield too small => try later
      return;
    }

    const pick = pickWeighted(rng, kinds);
    if(!pick) return;

    const size = Math.round(minS + rng() * (maxS - minS));
    const x = Math.round((rng() * (safe.w - size)) + safe.left - mount.getBoundingClientRect().left);
    const y = Math.round((rng() * (safe.h - size)) + safe.top  - mount.getBoundingClientRect().top);

    const t = {
      id: `t_${Math.floor(now())}_${Math.floor(rng()*1e6)}`,
      kind: pick.kind || 'good',
      size,
      x,
      y,
      born: now(),
      ttlMs
    };

    // optional: groupIndex (Plate/Groups can set externally after hit; here random if asked)
    if(typeof opts.assignGroupIndex === 'function'){
      t.groupIndex = opts.assignGroupIndex({ rng, t });
    }

    // optional: per-target visuals
    if(typeof opts.decorateTarget === 'function'){
      const decorated = opts.decorateTarget({ rng, t }) || t;
      Object.assign(t, decorated);
    }

    const el = makeTargetEl(t);
    mount.appendChild(el);

    // expire timer
    const to = setTimeout(()=>{
      if(!active.has(t.id)) return;
      active.delete(t.id);
      try{ mount.removeChild(el); }catch(_){}
      onExpire(t);
    }, ttlMs);

    active.set(t.id, { t, el, to });

    // direct hit (tap/click)
    const hit = (ev)=>{
      ev.preventDefault?.();
      if(!active.has(t.id)) return;
      const rec = active.get(t.id);
      active.delete(t.id);
      clearTimeout(rec.to);
      try{ mount.removeChild(el); }catch(_){}
      onHit(rec.t);
    };

    el.addEventListener('pointerdown', hit, { passive:false });
    el.addEventListener('click', hit, { passive:false });
  }

  function spawnLoop(){
    spawnOne();
  }

  function start(){
    if(timerSpawn) return;
    timerSpawn = setInterval(spawnLoop, spawnRate);
  }

  function stop(){
    running = false;
    if(timerSpawn){
      clearInterval(timerSpawn);
      timerSpawn = null;
    }
    // clear active
    for(const [id, rec] of active.entries()){
      clearTimeout(rec.to);
      try{ mount.removeChild(rec.el); }catch(_){}
      active.delete(id);
    }
  }

  // hha:shoot support (vr-ui.js)
  function onShoot(e){
    if(!running) return;
    const d = e.detail || {};
    const lockPx = clamp(d.lockPx ?? 28, 8, 120);

    // screen center -> mount local point
    const mr = mount.getBoundingClientRect();
    const sx = (Number(d.x) || (WIN.innerWidth/2));
    const sy = (Number(d.y) || (WIN.innerHeight/2));

    const mx = sx - mr.left;
    const my = sy - mr.top;

    // find closest target within lock radius
    let best = null;
    let bestDist = 1e9;

    for(const rec of active.values()){
      const t = rec.t;
      const cx = t.x + (t.size/2);
      const cy = t.y + (t.size/2);
      const dx = cx - mx;
      const dy = cy - my;
      const dist = Math.hypot(dx, dy);
      if(dist < bestDist){
        bestDist = dist;
        best = rec;
      }
    }

    if(best && bestDist <= lockPx){
      // hit it
      const t = best.t;
      if(active.has(t.id)){
        active.delete(t.id);
        clearTimeout(best.to);
        try{ mount.removeChild(best.el); }catch(_){}
        onHit(t);
      }
    }
  }

  WIN.addEventListener('hha:shoot', onShoot);

  // build controller only after functions exist (TDZ-safe)
  controller = {
    start,
    stop,
    setSpawnRate(ms){
      const next = clamp(ms, 180, 5000);
      if(timerSpawn){
        clearInterval(timerSpawn);
        timerSpawn = setInterval(spawnLoop, next);
      }
    },
    destroy(){
      stop();
      WIN.removeEventListener('hha:shoot', onShoot);
    }
  };

  // auto start
  start();

  return controller;
}

// default export alias (in case some engine uses default)
export default { boot };