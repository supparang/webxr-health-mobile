// === /herohealth/vr/mode-factory.js ===
// DOM Mode Factory — spawner + pan-to-look + crosshair shot
// ✅ drag to pan = เลื่อนมุมมอง (เป้าเลื่อนตาม)
// ✅ tap short = shootCrosshair (ยิงกลางจอ)
// ✅ PERFECT ring (heavy)
// ✅ safe zone clamp ไม่ทับ HUD (อ่านจาก excludeSelectors)
// ✅ ส่ง ctx ให้ judge(): {clientX,clientY, isGood, itemType, hitPerfect, isPower}

'use strict';

function clamp(v, a, b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function now(){ return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function rand(a,b){ return a + Math.random()*(b-a); }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function ensureStyle(){
  if (document.getElementById('hha-mode-factory-style')) return;
  const s = document.createElement('style');
  s.id = 'hha-mode-factory-style';
  s.textContent = `
  .hha-world{
    position:absolute;
    inset:0;
    z-index:18; /* targets under HUD (50), under postfx (46), but hit works */
    transform:translate3d(0,0,0);
    will-change:transform;
  }
  .hha-target{
    position:absolute;
    left:50%; top:50%;
    transform:translate3d(-50%,-50%,0);
    display:grid;
    place-items:center;
    user-select:none;
    -webkit-user-select:none;
    touch-action:none;
    cursor:pointer;
    filter: drop-shadow(0 18px 22px rgba(0,0,0,.35));
    will-change:transform, opacity;
  }
  .hha-emoji{
    font-size:42px;
    line-height:1;
    transform: translateZ(0);
  }
  .hha-bubble{
    position:absolute;
    inset:-16px;
    border-radius:999px;
    pointer-events:none;
    opacity:.0;
  }
  .hha-target[data-kind="good"] .hha-bubble{
    opacity:.42;
    background: radial-gradient(circle at 30% 30%,
      rgba(255,255,255,.28), rgba(80,230,255,.12) 40%, rgba(34,197,94,.12) 65%, rgba(255,255,255,0) 72%);
    border:1px solid rgba(160,220,255,.22);
  }
  .hha-target[data-kind="bad"] .hha-bubble{
    opacity:.38;
    background: radial-gradient(circle at 30% 30%,
      rgba(255,255,255,.22), rgba(255,64,96,.14) 45%, rgba(245,158,11,.10) 70%, rgba(255,255,255,0) 78%);
    border:1px solid rgba(255,120,140,.20);
  }
  .hha-target[data-kind="power"] .hha-bubble{
    opacity:.45;
    background: radial-gradient(circle at 35% 30%,
      rgba(255,255,255,.30), rgba(160,120,255,.18) 40%, rgba(80,230,255,.10) 70%, rgba(255,255,255,0) 78%);
    border:1px solid rgba(200,180,255,.22);
  }

  @keyframes hha-float{
    0%{ transform:translate3d(-50%,-50%,0) rotate(-0.6deg) }
    50%{ transform:translate3d(-50%,-55%,0) rotate(0.6deg) }
    100%{ transform:translate3d(-50%,-50%,0) rotate(-0.6deg) }
  }
  .hha-target{ animation: hha-float 1.55s ease-in-out infinite; }
  .hha-target[data-storm="1"]{ animation-duration: .75s; } /* storm = ส่ายเร็ว */
  .hha-target[data-storm="1"] .hha-emoji{ filter: drop-shadow(0 0 14px rgba(80,230,255,.22)); }

  /* PERFECT ring */
  .hha-perfect-ring{
    position:fixed;
    width:12px; height:12px;
    left:0; top:0;
    transform:translate(-50%,-50%);
    border-radius:999px;
    pointer-events:none;
    z-index:99970;
    box-shadow:
      0 0 0 2px rgba(255,255,255,.55),
      0 0 0 10px rgba(160,120,255,.18),
      0 0 34px rgba(80,230,255,.22);
    animation:hha-pr 420ms ease-out forwards;
  }
  @keyframes hha-pr{
    0%{ opacity:0; transform:translate(-50%,-50%) scale(.35); }
    15%{ opacity:1; }
    100%{ opacity:0; transform:translate(-50%,-50%) scale(3.6); }
  }
  `;
  document.head.appendChild(s);
}

function computeSafeRect(excludeSelectors = []) {
  const W = window.innerWidth || 1;
  const H = window.innerHeight || 1;

  // base margins
  let top = 10, left = 10, right = 10, bottom = 10;

  // bump margins from excluded HUD elements
  for (const sel of (excludeSelectors || [])) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (!r || !isFinite(r.left)) continue;

    // if element sits near top -> raise top safe
    if (r.top <= 40) top = Math.max(top, r.bottom + 10);
    // near bottom
    if (r.bottom >= H - 40) bottom = Math.max(bottom, (H - r.top) + 10);
    // left
    if (r.left <= 40) left = Math.max(left, r.right + 10);
    // right
    if (r.right >= W - 40) right = Math.max(right, (W - r.left) + 10);
  }

  return {
    left, top,
    right: W - right,
    bottom: H - bottom,
    width: Math.max(1, (W - right) - left),
    height: Math.max(1, (H - bottom) - top)
  };
}

function hitPerfectByPoint(targetEl, clientX, clientY){
  const r = targetEl.getBoundingClientRect();
  const cx = r.left + r.width/2;
  const cy = r.top + r.height/2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const rad = Math.min(r.width, r.height) * 0.28;
  return dist <= rad;
}

function spawnTarget(world, opt){
  const el = document.createElement('div');
  el.className = 'hha-target';
  el.dataset.kind = opt.kind;       // good/bad/power/fakeGood
  el.dataset.storm = opt.storm ? '1' : '0';

  // store base position in normalized (0..1) within safe rect
  el.__bx = opt.bx;
  el.__by = opt.by;
  el.__size = opt.size;

  // bubble + emoji
  const bub = document.createElement('div');
  bub.className = 'hha-bubble';
  const emo = document.createElement('div');
  emo.className = 'hha-emoji';
  emo.textContent = opt.emoji;

  el.appendChild(bub);
  el.appendChild(emo);

  el.style.width = opt.size + 'px';
  el.style.height = opt.size + 'px';

  // lifespan
  el.__born = now();
  el.__ttl = opt.ttl;

  // slight per target phase
  el.__ph = Math.random()*Math.PI*2;

  world.appendChild(el);
  return el;
}

function drawPerfectRing(x,y){
  const ring = document.createElement('div');
  ring.className = 'hha-perfect-ring';
  ring.style.left = x + 'px';
  ring.style.top  = y + 'px';
  document.body.appendChild(ring);
  setTimeout(()=>{ try{ ring.remove(); }catch{} }, 520);
}

export async function boot(cfg = {}) {
  ensureStyle();

  const spawnHost = cfg.spawnHost || document.body;
  const pools = cfg.pools || { good:['💧'], bad:['🥤'], trick:['💧'] };

  const excludeSelectors = Array.isArray(cfg.excludeSelectors) ? cfg.excludeSelectors : [];
  const allowAdaptive = !!cfg.allowAdaptive;

  const duration = Math.max(20, Number(cfg.duration || 90));
  const goodRate = clamp(cfg.goodRate ?? 0.68, 0.1, 0.95);
  const powerRate = clamp(cfg.powerRate ?? 0.10, 0, 0.30);
  const trickRate = clamp(cfg.trickRate ?? 0.08, 0, 0.35);

  const spawnIntervalBase = 900; // ms
  const ttlBase = 1500;          // ms
  const maxActive = 6;

  // world layer
  let world = spawnHost.querySelector('.hha-world');
  if (!world) {
    world = document.createElement('div');
    world.className = 'hha-world';
    spawnHost.appendChild(world);
  }

  // pan-to-look state
  let panX = 0, panY = 0;
  let drag = { on:false, id:null, sx:0, sy:0, ox:0, oy:0, moved:0, downAt:0, onTarget:false };
  const panMaxX = ()=> (window.innerWidth || 1) * 0.22;
  const panMaxY = ()=> (window.innerHeight || 1) * 0.18;

  // storm (from game logic)
  let storm = false;

  // runtime
  let stopped = false;
  let timeLeft = duration;
  let tAcc = 0;
  let lastTick = now();
  let lastSpawn = 0;

  const targets = new Set();

  function updateWorldTransform(){
    // move world
    world.style.transform = `translate3d(${panX.toFixed(2)}px, ${panY.toFixed(2)}px, 0)`;
  }

  function placeTargets(){
    const safe = computeSafeRect(excludeSelectors);
    for (const el of targets){
      if (!el.isConnected) continue;
      const bx = clamp(el.__bx, 0, 1);
      const by = clamp(el.__by, 0, 1);

      // position within safe (screen space)
      let x = safe.left + bx * safe.width;
      let y = safe.top + by * safe.height;

      // apply a small per-target sway (so it "ลอย/ส่าย")
      const age = (now() - el.__born) * 0.001;
      const sway = (storm ? 10 : 5);
      x += Math.sin(age* (storm ? 9.2 : 4.8) + el.__ph) * sway;
      y += Math.cos(age* (storm ? 8.7 : 4.2) + el.__ph) * sway;

      // clamp final with size
      const r = (el.__size || 48) * 0.45;
      x = clamp(x, safe.left + r, safe.right - r);
      y = clamp(y, safe.top + r, safe.bottom - r);

      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      el.dataset.storm = storm ? '1' : '0';
    }
  }

  function chooseKind(){
    const r = Math.random();
    if (r < powerRate) return 'power';
    if (r < powerRate + trickRate) return 'fakeGood';
    return (Math.random() < goodRate) ? 'good' : 'bad';
  }

  function spawnOne(){
    if (targets.size >= maxActive) return;
    const safe = computeSafeRect(excludeSelectors);

    // normalized
    const bx = Math.random();
    const by = Math.random();

    const kind = chooseKind();
    const emoji =
      kind === 'good' ? pick(pools.good) :
      kind === 'bad' ? pick(pools.bad) :
      kind === 'fakeGood' ? pick(pools.trick || pools.good) :
      pick((cfg.powerups && cfg.powerups.length) ? cfg.powerups : ['⭐','🛡️']);

    // size by difficulty-ish
    const sizeBase = clamp(cfg.sizeBase ?? 56, 42, 78);
    const scaleMul = clamp(cfg.scaleMul ?? 1.0, 0.75, 1.35);
    const size = Math.round(sizeBase * scaleMul * (kind==='power' ? 1.05 : 1.0));

    // ttl varies
    const ttl = Math.round(ttlBase * (storm ? 0.85 : 1.0) * rand(0.90, 1.18));

    const el = spawnTarget(world, { kind, emoji, bx, by, size, ttl, storm });
    targets.add(el);

    // hit handler
    const onHit = (ev)=>{
      if (stopped) return;
      ev.preventDefault();
      ev.stopPropagation();

      const cx = ev.clientX ?? (ev.touches && ev.touches[0] && ev.touches[0].clientX) ?? 0;
      const cy = ev.clientY ?? (ev.touches && ev.touches[0] && ev.touches[0].clientY) ?? 0;

      const hitPerfect = hitPerfectByPoint(el, cx, cy);
      if (hitPerfect) drawPerfectRing(cx, cy);

      const ctx = {
        clientX: cx,
        clientY: cy,
        isGood: (kind === 'good' || kind === 'fakeGood' || kind === 'power'),
        itemType: kind,
        hitPerfect,
        isPower: (kind === 'power')
      };

      try{ cfg.judge && cfg.judge(emoji, ctx); }catch(e){ console.warn(e); }

      // remove target
      try{ el.remove(); }catch{}
      targets.delete(el);
    };

    el.addEventListener('pointerdown', onHit, { passive:false });
    el.addEventListener('touchstart', onHit, { passive:false });

    return el;
  }

  function expireTargets(){
    const t = now();
    for (const el of targets){
      if (!el.isConnected){ targets.delete(el); continue; }
      if (t - el.__born >= el.__ttl){
        const kind = el.dataset.kind || 'good';
        try{ cfg.onExpire && cfg.onExpire({ itemType: kind }); }catch{}
        try{ el.remove(); }catch{}
        targets.delete(el);
      }
    }
  }

  // -------- pan + tap-to-shoot (empty area only) --------
  function isTargetEl(node){
    if (!node) return false;
    return !!(node.closest && node.closest('.hha-target'));
  }

  function onDown(e){
    if (stopped) return;
    const pt = (e.touches && e.touches[0]) ? e.touches[0] : e;
    const x = pt.clientX || 0;
    const y = pt.clientY || 0;

    drag.onTarget = isTargetEl(e.target);
    // กดบนเป้า -> ให้เป้าจัดการ hit เอง ไม่เริ่ม drag
    if (drag.onTarget) return;

    drag.on = true;
    drag.id = e.pointerId ?? 'touch';
    drag.sx = x; drag.sy = y;
    drag.ox = panX; drag.oy = panY;
    drag.moved = 0;
    drag.downAt = now();
  }

  function onMove(e){
    if (!drag.on || stopped) return;
    const pt = (e.touches && e.touches[0]) ? e.touches[0] : e;
    const x = pt.clientX || 0;
    const y = pt.clientY || 0;

    const dx = x - drag.sx;
    const dy = y - drag.sy;
    drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));

    // pan
    panX = clamp(drag.ox + dx, -panMaxX(), +panMaxX());
    panY = clamp(drag.oy + dy, -panMaxY(), +panMaxY());
    updateWorldTransform();
  }

  function onUp(e){
    if (!drag.on || stopped) return;
    drag.on = false;

    // tap short on empty area -> shoot crosshair
    const dt = now() - drag.downAt;
    const isTap = (drag.moved <= 10) && (dt <= 260);
    if (isTap && typeof inst.shootCrosshair === 'function') {
      try{ inst.shootCrosshair(); }catch{}
    }
  }

  spawnHost.addEventListener('pointerdown', onDown, { passive:false });
  spawnHost.addEventListener('pointermove', onMove, { passive:false });
  spawnHost.addEventListener('pointerup', onUp, { passive:false });
  spawnHost.addEventListener('pointercancel', onUp, { passive:false });

  spawnHost.addEventListener('touchstart', onDown, { passive:false });
  spawnHost.addEventListener('touchmove', onMove, { passive:false });
  spawnHost.addEventListener('touchend', onUp, { passive:false });
  spawnHost.addEventListener('touchcancel', onUp, { passive:false });

  function shootCrosshair(){
    // ยิงกลางจอ: หาเป้าที่ใกล้จุดกลางสุด แล้วนับเป็น hit แบบ "ประมาณ"
    if (targets.size <= 0) return false;

    const cx = (window.innerWidth||1)/2;
    const cy = (window.innerHeight||1)/2;

    let best = null;
    let bestD = Infinity;
    for (const el of targets){
      const r = el.getBoundingClientRect();
      const tx = r.left + r.width/2;
      const ty = r.top + r.height/2;
      const dx = tx - cx, dy = ty - cy;
      const d = dx*dx + dy*dy;
      if (d < bestD){ bestD = d; best = el; }
    }
    if (!best) return false;

    // simulate pointer hit at center
    const rect = best.getBoundingClientRect();
    const px = rect.left + rect.width/2;
    const py = rect.top  + rect.height/2;

    const kind = best.dataset.kind || 'good';
    const emoji = best.querySelector('.hha-emoji')?.textContent || '💧';
    const hitPerfect = true; // ยิงกลางจอให้เป็น PERFECT เพื่อสนุก

    drawPerfectRing(px, py);

    const ctx = {
      clientX: px, clientY: py,
      isGood: (kind==='good'||kind==='fakeGood'||kind==='power'),
      itemType: kind,
      hitPerfect,
      isPower: (kind==='power')
    };

    try{ cfg.judge && cfg.judge(emoji, ctx); }catch{}
    try{ best.remove(); }catch{}
    targets.delete(best);
    return true;
  }

  // main loop
  function tick(){
    if (stopped) return;

    const t = now();
    const dt = Math.min(0.05, (t - lastTick)/1000);
    lastTick = t;

    // countdown (emit per sec)
    tAcc += dt;
    if (tAcc >= 1.0){
      tAcc = 0;
      timeLeft = Math.max(0, timeLeft - 1);
      window.dispatchEvent(new CustomEvent('hha:time', { detail: { sec: timeLeft } }));
    }

    // spawn schedule (allow storm multiplier from cfg.spawnIntervalMul())
    const mul = (typeof cfg.spawnIntervalMul === 'function') ? clamp(cfg.spawnIntervalMul(), 0.35, 2.2) : 1.0;
    const interval = spawnIntervalBase * mul;

    if (t - lastSpawn >= interval){
      lastSpawn = t;
      spawnOne();
    }

    expireTargets();
    placeTargets();

    if (timeLeft <= 0){
      stopped = true;
      // cleanup targets
      for (const el of targets){ try{ el.remove(); }catch{} }
      targets.clear();
      return;
    }

    requestAnimationFrame(tick);
  }

  // start
  updateWorldTransform();
  placeTargets();
  requestAnimationFrame(tick);

  const inst = {
    stop(){
      stopped = true;
      try{
        spawnHost.removeEventListener('pointerdown', onDown);
        spawnHost.removeEventListener('pointermove', onMove);
        spawnHost.removeEventListener('pointerup', onUp);
        spawnHost.removeEventListener('pointercancel', onUp);
        spawnHost.removeEventListener('touchstart', onDown);
        spawnHost.removeEventListener('touchmove', onMove);
        spawnHost.removeEventListener('touchend', onUp);
        spawnHost.removeEventListener('touchcancel', onUp);
      }catch{}
      try{ world.remove(); }catch{}
    },
    shootCrosshair,
    setStorm(on){
      storm = !!on;
      // mark existing
      for (const el of targets){ el.dataset.storm = storm ? '1' : '0'; }
    }
  };

  return inst;
}

export default { boot };
