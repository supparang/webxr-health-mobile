// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner (adaptive) สำหรับ HeroHealth VR/Quest — PRODUCTION
// ✅ spawnHost / boundsHost
// ✅ SAFEZONE (exclusion auto)
// ✅ EDGE-FIX: ignore spawnHost transform (ใช้ boundsHost rect)
// ✅ Seeded RNG (cfg.seed) + cfg.rng override (สำคัญสำหรับ research)
// ✅ crosshair shooting + perfect distance
// ✅ PATCH: auto-relax safezone เมื่อ playRect เล็กเกิน (กันอาการ "เป้าเกิดที่เดียว")
// ✅ EXPORT: boot(...)  (เพื่อให้ plate.safe.js import { boot as spawnBoot } ใช้ได้)
// ✅ FIX: avoid "Cannot access 'controller' before initialization"
// ------------------------------------------------------------

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function seededRng(seed){
  let t = (Number(seed)||0) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, items){
  let sum = 0;
  for(const it of items) sum += (Number(it.weight)||0);
  let x = rng() * (sum || 1);
  for(const it of items){
    x -= (Number(it.weight)||0);
    if(x <= 0) return it;
  }
  return items[items.length-1];
}

function rectOf(el){
  if(!el) return { left:0, top:0, right:0, bottom:0, width:0, height:0 };
  const r = el.getBoundingClientRect();
  return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
}

function createTargetEl(){
  const el = DOC.createElement('div');
  el.className = 'hhaTarget';
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  // game CSS can override: .plateTarget etc.
  return el;
}

// ------------------------------------------------------------
// EXPORT: boot
// ------------------------------------------------------------
export function boot(cfg = {}){
  if(!DOC) throw new Error('mode-factory: document missing');

  // ---- config defaults
  const mount = cfg.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  const boundsHost = cfg.boundsHost || mount;  // playRect reference
  const spawnHost  = cfg.spawnHost  || mount;  // where elements append

  const sizeRange = cfg.sizeRange || [44, 72];
  const spawnRate = clamp(cfg.spawnRate ?? 900, 120, 5000);

  const kinds = Array.isArray(cfg.kinds) && cfg.kinds.length
    ? cfg.kinds
    : [{ kind:'good', weight:0.7 }, { kind:'junk', weight:0.3 }];

  const onHit    = (typeof cfg.onHit === 'function') ? cfg.onHit : ()=>{};
  const onExpire = (typeof cfg.onExpire === 'function') ? cfg.onExpire : ()=>{};

  const ttlMs = clamp(cfg.ttlMs ?? 1600, 300, 12000);
  const maxAlive = clamp(cfg.maxAlive ?? 8, 1, 30);

  // SAFEZONE: exclude HUD / VR UI overlays if provided
  // cfg.safezoneEls: [el1, el2] or selector string
  let safezoneEls = [];
  if(typeof cfg.safezoneEls === 'string'){
    safezoneEls = Array.from(DOC.querySelectorAll(cfg.safezoneEls));
  }else if(Array.isArray(cfg.safezoneEls)){
    safezoneEls = cfg.safezoneEls.filter(Boolean);
  }else{
    // default: common overlays
    safezoneEls = [
      DOC.getElementById('hud'),
      DOC.querySelector('.hha-vrui'),
      DOC.getElementById('endOverlay')
    ].filter(Boolean);
  }

  // RNG
  const rng = (typeof cfg.rng === 'function')
    ? cfg.rng
    : seededRng(cfg.seed ?? Date.now());

  // ----------------------------------------------------------
  // Controller state (declare BEFORE any closures use it)
  // ----------------------------------------------------------
  const controller = {
    running: true,
    alive: new Set(),
    timers: new Set(),
    intervalId: null,
    destroy,
    spawnOnce,
  };

  // ----------------------------------------------------------
  // Spawn geometry helpers
  // ----------------------------------------------------------
  function safeRects(){
    const rs = [];
    for(const el of safezoneEls){
      if(!el) continue;
      const r = el.getBoundingClientRect();
      if(r.width > 0 && r.height > 0){
        rs.push({ left:r.left, top:r.top, right:r.right, bottom:r.bottom });
      }
    }
    return rs;
  }

  function intersectsAny(x,y,w,h, rects){
    const left=x-w/2, top=y-h/2, right=x+w/2, bottom=y+h/2;
    for(const r of rects){
      if(!(right < r.left || left > r.right || bottom < r.top || top > r.bottom)){
        return true;
      }
    }
    return false;
  }

  function choosePoint(playRect, w, h){
    // margin inside playRect
    const pad = 10;
    const minX = playRect.left + pad + w/2;
    const maxX = playRect.right - pad - w/2;
    const minY = playRect.top + pad + h/2;
    const maxY = playRect.bottom - pad - h/2;

    // if too small, allow tighter
    const rx = Math.max(minX, Math.min(maxX, minX + 1));
    const ry = Math.max(minY, Math.min(maxY, minY + 1));

    const x = (maxX > minX) ? (minX + rng() * (maxX - minX)) : rx;
    const y = (maxY > minY) ? (minY + rng() * (maxY - minY)) : ry;
    return { x, y };
  }

  function relaxRects(rects, playRect){
    // if playRect is small (mobile), relax by shrinking safe rects slightly
    const area = playRect.width * playRect.height;
    if(area > 320*520) return rects;
    const shrink = 10;
    return rects.map(r=>({
      left:r.left+shrink, top:r.top+shrink,
      right:r.right-shrink, bottom:r.bottom-shrink
    }));
  }

  // ----------------------------------------------------------
  // Spawn
  // ----------------------------------------------------------
  function spawnOnce(){
    if(!controller.running) return;
    if(controller.alive.size >= maxAlive) return;

    const playRect = rectOf(boundsHost);
    if(playRect.width < 40 || playRect.height < 40) return;

    const kindPick = pickWeighted(rng, kinds);
    const kind = String(kindPick.kind || 'good');

    const size = Math.round(
      clamp(sizeRange[0], 24, 240) + rng() * (clamp(sizeRange[1], 24, 240) - clamp(sizeRange[0], 24, 240))
    );

    const w = size, h = size;

    let rects = safeRects();
    rects = relaxRects(rects, playRect);

    let pos = null;
    for(let tries=0; tries<18; tries++){
      const p = choosePoint(playRect, w, h);
      if(!intersectsAny(p.x, p.y, w, h, rects)){
        pos = p; break;
      }
    }
    if(!pos){
      // fallback: accept first point even if intersects
      pos = choosePoint(playRect, w, h);
    }

    const el = createTargetEl();

    // If Plate CSS expects .plateTarget class, respect it:
    // - if caller passes cfg.targetClass, use it
    // - else: if mount id contains 'plate', default to plateTarget
    const cls = cfg.targetClass || (String(mount.id||'').includes('plate') ? 'plateTarget' : '');
    if(cls) el.className = cls;

    el.dataset.kind = kind;

    // allow caller enrich meta
    const meta = {
      kind,
      size,
      bornMs: Date.now()
    };

    // optional groupIndex generator for plate/groups
    if(typeof cfg.makeMeta === 'function'){
      try{
        const m2 = cfg.makeMeta({ kind, size, rng });
        if(m2 && typeof m2 === 'object') Object.assign(meta, m2);
      }catch(_){}
    }

    // position using CSS variables if present, else absolute
    el.style.position = 'absolute';
    el.style.left = `${Math.round(pos.x - playRect.left)}px`;
    el.style.top  = `${Math.round(pos.y - playRect.top)}px`;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.width  = `${w}px`;
    el.style.height = `${h}px`;

    // label (emoji) default
    if(!el.textContent){
      el.textContent = (kind === 'good') ? '🍽️' : '🍩';
    }

    spawnHost.appendChild(el);
    controller.alive.add(el);

    // hit handler (click/tap)
    const onClick = (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      if(!controller.running) return;
      cleanupEl(el);
      onHit(Object.assign({ el }, meta));
    };

    el.addEventListener('pointerdown', onClick, { passive:false });
    el.addEventListener('click', onClick, { passive:false });

    // crosshair shooting (vr-ui.js emits hha:shoot)
    const onShoot = (ev)=>{
      if(!controller.running) return;
      const d = ev.detail || {};
      const x = Number(d.x);
      const y = Number(d.y);
      if(!isFinite(x) || !isFinite(y)) return;

      const r = el.getBoundingClientRect();
      if(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom){
        cleanupEl(el);
        onHit(Object.assign({ el, source:'shoot' }, meta));
      }
    };

    WIN.addEventListener('hha:shoot', onShoot);

    // expiry
    const to = setTimeout(()=>{
      if(!controller.running) return;
      if(!controller.alive.has(el)) return;
      cleanupEl(el);
      onExpire(Object.assign({ el }, meta));
    }, ttlMs);

    controller.timers.add(to);

    function cleanupEl(node){
      if(!node) return;
      if(controller.alive.has(node)) controller.alive.delete(node);
      try{ node.remove(); }catch(_){}
      try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
      try{
        node.removeEventListener('pointerdown', onClick);
        node.removeEventListener('click', onClick);
      }catch(_){}
    }
  }

  // ----------------------------------------------------------
  // Destroy
  // ----------------------------------------------------------
  function destroy(){
    controller.running = false;

    if(controller.intervalId){
      clearInterval(controller.intervalId);
      controller.intervalId = null;
    }

    for(const to of controller.timers){
      try{ clearTimeout(to); }catch(_){}
    }
    controller.timers.clear();

    for(const el of controller.alive){
      try{ el.remove(); }catch(_){}
    }
    controller.alive.clear();
  }

  // ----------------------------------------------------------
  // Start spawner loop
  // ----------------------------------------------------------
  controller.intervalId = setInterval(()=>{
    if(!controller.running) return;
    spawnOnce();
  }, spawnRate);

  // also spawn immediately
  spawnOnce();

  return controller;
}