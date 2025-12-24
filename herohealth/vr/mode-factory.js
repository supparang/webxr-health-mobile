// === /herohealth/vr/mode-factory.js ===
// HeroHealth — DOM Emoji Target Spawner (Factory)
// FIX-ALL:
// ✅ boundsHost accepts selector OR element
// ✅ spawnStrategy: grid9 | randomRing | random
// ✅ true separation (anti-stack) + max tries fallback (still random, not center-lock)
// ✅ excludeSelectors respected (HUD/crosshair/end) + padding safe zone
// ✅ dragThresholdPx prevents drag-look counted as hit
// ✅ spawnIntervalMul() supported (storm speedup)
// Works with hydration.safe.js + other DOM games

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const doc = ROOT.document;

function clamp(v, min, max){ v = Number(v)||0; return v<min?min:(v>max?max:v); }
function rnd(a=1){ return Math.random()*a; }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function resolveEl(x){
  if (!doc) return null;
  if (!x) return null;
  if (typeof x === 'string') return doc.querySelector(x);
  if (x && x.nodeType === 1) return x;
  return null;
}

function rectOf(el){
  try{
    const r = el.getBoundingClientRect();
    return { x:r.left, y:r.top, w:r.width, h:r.height, r };
  }catch{
    return { x:0,y:0,w:0,h:0,r:null };
  }
}

function getExcludes(selectors){
  if (!doc) return [];
  const out = [];
  (selectors||[]).forEach(sel=>{
    try{
      doc.querySelectorAll(sel).forEach(el=>{
        const rr = rectOf(el);
        if (rr.w>6 && rr.h>6) out.push(rr);
      });
    }catch{}
  });
  return out;
}

function pointInRect(px, py, rr, pad=0){
  return (px >= (rr.x - pad) && px <= (rr.x + rr.w + pad) &&
          py >= (rr.y - pad) && py <= (rr.y + rr.h + pad));
}

function dist2(ax,ay,bx,by){
  const dx=ax-bx, dy=ay-by;
  return dx*dx+dy*dy;
}

// ---- placement strategies ----

function pickGrid9(bounds, rx=0.92, ry=0.92){
  // 3x3 grid across safe area
  // bounds: {x,y,w,h}
  const cx = bounds.x + bounds.w*0.5;
  const cy = bounds.y + bounds.h*0.5;

  const halfW = bounds.w*0.5*rx;
  const halfH = bounds.h*0.5*ry;

  const xs = [cx-halfW, cx, cx+halfW];
  const ys = [cy-halfH, cy, cy+halfH];

  const cells = [];
  for (let iy=0; iy<3; iy++){
    for (let ix=0; ix<3; ix++){
      cells.push([xs[ix], ys[iy]]);
    }
  }
  // bias away from absolute center a bit
  const c = pick(cells);
  const jx = (rnd(1)-0.5) * bounds.w*0.12;
  const jy = (rnd(1)-0.5) * bounds.h*0.12;
  return { x:c[0] + jx, y:c[1] + jy };
}

function pickRandom(bounds, rx=0.92, ry=0.92){
  const cx = bounds.x + bounds.w*0.5;
  const cy = bounds.y + bounds.h*0.5;
  const halfW = bounds.w*0.5*rx;
  const halfH = bounds.h*0.5*ry;
  return {
    x: cx + (rnd(1)-0.5)*2*halfW,
    y: cy + (rnd(1)-0.5)*2*halfH
  };
}

function pickRandomRing(bounds, rx=0.92, ry=0.92){
  // ring around center: good for “VR feel” (targets flow around gaze)
  const cx = bounds.x + bounds.w*0.5;
  const cy = bounds.y + bounds.h*0.5;

  const halfW = bounds.w*0.5*rx;
  const halfH = bounds.h*0.5*ry;

  // inner/outer radius (as fraction of min dimension)
  const minHalf = Math.min(halfW, halfH);
  const r0 = minHalf * 0.25;  // inner
  const r1 = minHalf * 0.92;  // outer

  const ang = rnd(Math.PI*2);
  // bias to mid ring (less center clustering)
  const t = Math.sqrt(rnd(1)); // 0..1 biased outward
  const rr = r0 + (r1-r0)*t;

  // ellipse ring to match screen
  const ex = (rr * Math.cos(ang)) * (halfW/minHalf);
  const ey = (rr * Math.sin(ang)) * (halfH/minHalf);

  // small jitter
  const jx = (rnd(1)-0.5) * bounds.w*0.06;
  const jy = (rnd(1)-0.5) * bounds.h*0.06;

  return { x: cx + ex + jx, y: cy + ey + jy };
}

function normalizeMinSep(minSep, bounds){
  // If minSep <= 1.5 treat as fraction of min dimension.
  // If minSep > 1.5 treat as pixels.
  const ms = Number(minSep);
  if (!Number.isFinite(ms) || ms <= 0) return Math.max(48, Math.min(bounds.w,bounds.h)*0.16);
  if (ms <= 1.5) return Math.max(42, Math.min(bounds.w,bounds.h) * ms * 0.28);
  return ms;
}

function makeEmojiTarget(ch, kind){
  const el = doc.createElement('div');
  el.className = 'hha-target';
  el.textContent = String(ch||'💧');
  if (kind==='good') el.classList.add('good');
  if (kind==='bad')  el.classList.add('bad');
  if (kind==='power') el.classList.add('power');
  el.style.setProperty('--s', '1');
  el.style.pointerEvents = 'auto';
  el.style.userSelect = 'none';
  el.dataset.hhaKind = kind;
  return el;
}

export async function boot(opts = {}){
  if (!doc) return { stop(){} };

  const spawnHostEl  = resolveEl(opts.spawnHost)  || resolveEl('#hvr-playfield') || doc.body;
  const boundsHostEl = resolveEl(opts.boundsHost) || spawnHostEl;

  const difficulty = String(opts.difficulty || 'easy').toLowerCase();

  const pools = opts.pools || { good:['💧'], bad:['🥤'] };
  const goodPool = Array.isArray(pools.good) ? pools.good : ['💧'];
  const badPool  = Array.isArray(pools.bad)  ? pools.bad  : ['🥤'];

  const powerups = Array.isArray(opts.powerups) ? opts.powerups : [];
  const powerRate = clamp(opts.powerRate ?? 0.12, 0, 0.5);
  const powerEvery = Math.max(1, opts.powerEvery || 6);

  const goodRate = clamp(opts.goodRate ?? 0.66, 0.05, 0.95);

  const spawnStrategy = String(opts.spawnStrategy || 'randomRing');
  const spawnRadiusX = clamp(opts.spawnRadiusX ?? 0.92, 0.2, 1.0);
  const spawnRadiusY = clamp(opts.spawnRadiusY ?? 0.92, 0.2, 1.0);
  const maxSpawnTries = Math.max(4, opts.maxSpawnTries || 18);

  // IMPORTANT: user used 0.92 (too high). We normalize to pixels smartly.
  const minSeparationPx = ()=> normalizeMinSep(opts.minSeparation ?? 0.28, rectOf(boundsHostEl));

  const excludeSelectors = Array.isArray(opts.excludeSelectors) ? opts.excludeSelectors : [];
  const excludePad = 10;

  const dragThresholdPx = Math.max(4, opts.dragThresholdPx || 10);

  const judge = (typeof opts.judge === 'function') ? opts.judge : ()=>({});
  const onExpire = (typeof opts.onExpire === 'function') ? opts.onExpire : ()=>{};

  const spawnIntervalMul = (typeof opts.spawnIntervalMul === 'function') ? opts.spawnIntervalMul : ()=>1;

  // timing (base)
  const baseInterval = (difficulty === 'hard') ? 760 : (difficulty === 'easy' ? 980 : 860);
  const lifeMsBase   = (difficulty === 'hard') ? 1200 : (difficulty === 'easy' ? 1550 : 1350);

  let tickTimer = null;
  let stopped = false;

  // active points for separation check
  const activePts = []; // {x,y,t}
  const MAX_ACTIVE_PTS = 10;

  function cleanPts(){
    const now = Date.now();
    for (let i=activePts.length-1; i>=0; i--){
      if (now - activePts[i].t > 1400) activePts.splice(i,1);
    }
  }

  function pickPos(){
    const b = rectOf(boundsHostEl);
    const bounds = { x:b.x, y:b.y, w:b.w, h:b.h };

    // if rect invalid -> fallback to viewport
    if (bounds.w < 50 || bounds.h < 50){
      bounds.x = 0; bounds.y = 0; bounds.w = innerWidth; bounds.h = innerHeight;
    }

    const excludes = getExcludes(excludeSelectors);

    const minSep = minSeparationPx();
    const minSep2 = minSep*minSep;

    cleanPts();

    for (let i=0; i<maxSpawnTries; i++){
      let p;
      if (spawnStrategy === 'grid9') p = pickGrid9(bounds, spawnRadiusX, spawnRadiusY);
      else if (spawnStrategy === 'random') p = pickRandom(bounds, spawnRadiusX, spawnRadiusY);
      else p = pickRandomRing(bounds, spawnRadiusX, spawnRadiusY);

      // keep inside bounds padding (target radius)
      const pad = 78;
      p.x = clamp(p.x, bounds.x + pad, bounds.x + bounds.w - pad);
      p.y = clamp(p.y, bounds.y + pad, bounds.y + bounds.h - pad);

      // exclude UI zones
      let bad = false;
      for (const rr of excludes){
        if (pointInRect(p.x, p.y, rr, excludePad)){ bad = true; break; }
      }
      if (bad) continue;

      // separation against recent spawns
      for (const q of activePts){
        if (dist2(p.x,p.y,q.x,q.y) < minSep2){ bad = true; break; }
      }
      if (bad) continue;

      // ok
      activePts.push({ x:p.x, y:p.y, t:Date.now() });
      if (activePts.length > MAX_ACTIVE_PTS) activePts.shift();
      return p;
    }

    // fallback: STILL random (not center), but ignore separation
    const p2 = pickRandom(bounds, spawnRadiusX, spawnRadiusY);
    activePts.push({ x:p2.x, y:p2.y, t:Date.now() });
    if (activePts.length > MAX_ACTIVE_PTS) activePts.shift();
    return p2;
  }

  function placeInHost(el, px, py){
    // convert from viewport coords -> spawnHost local coords
    const hr = rectOf(spawnHostEl);
    const x = px - hr.x;
    const y = py - hr.y;
    el.style.setProperty('--x', `${x.toFixed(1)}px`);
    el.style.setProperty('--y', `${y.toFixed(1)}px`);
  }

  function spawnOne(counter){
    if (stopped) return;

    const isPower = (powerups.length>0) && (counter % powerEvery === 0) && (Math.random() < powerRate);
    const isGood = !isPower && (Math.random() < goodRate);

    const ch = isPower ? pick(powerups) : (isGood ? pick(goodPool) : pick(badPool));
    const kind = isPower ? 'power' : (isGood ? 'good' : 'bad');

    const el = makeEmojiTarget(ch, kind);

    // choose position
    const p = pickPos();
    placeInHost(el, p.x, p.y);

    // lifetime
    const mul = clamp(spawnIntervalMul() || 1, 0.25, 2.5);
    const lifeMs = clamp(lifeMsBase / mul, 520, 2400);

    let downX=0, downY=0, downT=0, moved=false, alive=true;
    const expireAt = Date.now() + lifeMs;

    function kill(reason){
      if (!alive) return;
      alive=false;
      try{ el.remove(); }catch{}
      if (reason === 'expire'){
        try{ onExpire({ ch, isGood, isPower, kind }); }catch{}
      }
    }

    function onDown(ev){
      downX = ev.clientX||0;
      downY = ev.clientY||0;
      downT = Date.now();
      moved = false;
    }
    function onMove(ev){
      const x=ev.clientX||0, y=ev.clientY||0;
      if (Math.abs(x-downX) + Math.abs(y-downY) > dragThresholdPx) moved = true;
    }
    function onUp(ev){
      if (!alive) return;
      const x = ev.clientX||0, y = ev.clientY||0;

      // if dragging, ignore (look movement)
      if (moved) return;

      const ctx = {
        clientX:x, clientY:y,
        isGood: !!isGood,
        isPower: !!isPower
      };

      try{ judge(ch, ctx); }catch{}
      kill('hit');
    }

    el.addEventListener('pointerdown', onDown, { passive:true });
    el.addEventListener('pointermove', onMove, { passive:true });
    el.addEventListener('pointerup', onUp, { passive:true });
    el.addEventListener('pointercancel', onUp, { passive:true });

    spawnHostEl.appendChild(el);

    // expire tick
    const expireTimer = setTimeout(()=>{
      if (!alive) return;
      kill('expire');
    }, Math.max(220, expireAt - Date.now()));

    // hard cleanup if removed early
    const origKill = kill;
    kill = (reason)=>{
      try{ clearTimeout(expireTimer); }catch{}
      origKill(reason);
    };

    return el;
  }

  // main loop
  let counter = 0;
  function scheduleNext(){
    if (stopped) return;
    const mul = clamp(spawnIntervalMul() || 1, 0.25, 2.5);
    const interval = clamp(baseInterval / mul, 220, 1600);
    tickTimer = setTimeout(()=>{
      if (stopped) return;
      counter++;
      spawnOne(counter);
      scheduleNext();
    }, interval);
  }

  // start
  scheduleNext();

  function stop(){
    if (stopped) return;
    stopped = true;
    try{ if (tickTimer) clearTimeout(tickTimer); }catch{}
    tickTimer = null;

    // remove remaining targets
    try{
      spawnHostEl.querySelectorAll('.hha-target').forEach(el=>el.remove());
    }catch{}
  }

  return { stop };
}

export default { boot };