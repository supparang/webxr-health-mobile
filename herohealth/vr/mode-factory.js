// === /herohealth/vr/mode-factory.js ===
// HeroHealth DOM Target Spawner Factory (ESM)
// ✅ deterministic RNG with seed (string)
// ✅ spawn strategies: randomRing / grid9 / random
// ✅ minSeparation as fraction of min(width,height)
// ✅ excludeSelectors avoid HUD overlap
// ✅ stop() cleanup
// ✅ click/drag threshold on target

'use strict';

function clamp(v, a, b){ v = Number(v)||0; return v < a ? a : (v > b ? b : v); }

function hashStringToUint32(str){
  str = String(str||'');
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(arr, rnd){
  if (!arr || !arr.length) return null;
  return arr[(rnd()*arr.length) | 0];
}

function rectsFromSelectors(selectors){
  const out = [];
  try{
    (selectors||[]).forEach(sel=>{
      document.querySelectorAll(sel).forEach(el=>{
        const r = el.getBoundingClientRect();
        // ignore invisible
        if (r.width > 2 && r.height > 2) out.push(r);
      });
    });
  }catch{}
  return out;
}

function pointInRect(x,y,r){
  return x>=r.left && x<=r.right && y>=r.top && y<=r.bottom;
}

// returns {ok:boolean, penalty:number}
function allowedPoint(x,y, exclRects){
  let penalty = 0;
  for (const r of exclRects){
    if (pointInRect(x,y,r)) return { ok:false, penalty:1e9 };
    // soft penalty: near excluded zone (feels better)
    const dx = (x < r.left) ? (r.left-x) : (x > r.right ? (x-r.right) : 0);
    const dy = (y < r.top)  ? (r.top-y)  : (y > r.bottom? (y-r.bottom): 0);
    const d = Math.sqrt(dx*dx+dy*dy);
    if (d < 28) penalty += (28-d) * 2;
  }
  return { ok:true, penalty };
}

function dist(ax,ay,bx,by){
  const dx=ax-bx, dy=ay-by;
  return Math.sqrt(dx*dx+dy*dy);
}

function buildGrid9Points(cx, cy, rx, ry){
  // 3x3 points around center (normalized)
  const xs = [-0.66, 0, 0.66];
  const ys = [-0.66, 0, 0.66];
  const pts = [];
  for (const yy of ys){
    for (const xx of xs){
      pts.push({ x: cx + xx*rx, y: cy + yy*ry });
    }
  }
  return pts;
}

function candidateRandom(bounds, rx, ry, rnd){
  const cx = (bounds.left + bounds.right) * 0.5;
  const cy = (bounds.top + bounds.bottom) * 0.5;
  const x = cx + (rnd()*2-1) * rx;
  const y = cy + (rnd()*2-1) * ry;
  return { x, y };
}

function candidateRandomRing(bounds, rx, ry, rnd){
  const cx = (bounds.left + bounds.right) * 0.5;
  const cy = (bounds.top + bounds.bottom) * 0.5;

  // angle uniform
  const a = rnd() * Math.PI * 2;

  // radius: avoid center “pile” (ring-ish)
  // r in [0.35..1.00] with slight bias to outer ring
  const u = rnd();
  const r = 0.35 + 0.65 * Math.sqrt(u);

  const x = cx + Math.cos(a) * rx * r;
  const y = cy + Math.sin(a) * ry * r;
  return { x, y };
}

function chooseSpawnPoint(opts){
  const bounds = opts.boundsRect;
  const existing = opts.existing || [];
  const rnd = opts.rnd || Math.random;

  // usable radii
  const rx = (bounds.width  * clamp(opts.spawnRadiusX ?? 0.95, 0.2, 1)) * 0.5;
  const ry = (bounds.height * clamp(opts.spawnRadiusY ?? 0.95, 0.2, 1)) * 0.5;

  const exclRects = opts.exclRects || [];
  const minDim = Math.max(1, Math.min(bounds.width, bounds.height));

  // minSeparation fraction of minDim
  const sepFrac = clamp(opts.minSeparation ?? 0.28, 0.04, 0.95);
  const minSepPxBase = minDim * sepFrac;

  const maxTries = clamp(opts.maxSpawnTries ?? 20, 6, 80);

  const strategy = String(opts.spawnStrategy || 'randomRing');

  // helper to evaluate candidate
  function scoreCandidate(x,y, sepPx){
    // inside bounds padding
    const pad = 68; // approximate target size
    if (x < bounds.left+pad || x > bounds.right-pad) return null;
    if (y < bounds.top+pad  || y > bounds.bottom-pad) return null;

    const allow = allowedPoint(x,y, exclRects);
    if (!allow.ok) return null;

    // distance to existing
    let minD = 1e9;
    for (const p of existing){
      const d = dist(x,y,p.x,p.y);
      if (d < minD) minD = d;
      if (d < sepPx) return null; // hard reject
    }

    // bigger minD is better, lower penalty better
    const score = (minD * 1.0) - allow.penalty;
    return { x, y, score };
  }

  let best = null;
  let sepPx = minSepPxBase;

  // try with gradually relaxing separation (prevents “no spot then pile”)
  for (let pass=0; pass<3; pass++){
    for (let i=0;i<maxTries;i++){
      let c;
      if (strategy === 'grid9'){
        const cx = (bounds.left + bounds.right) * 0.5;
        const cy = (bounds.top + bounds.bottom) * 0.5;
        const pts = buildGrid9Points(cx, cy, rx, ry);
        c = pts[(rnd()*pts.length)|0];
        // add jitter
        c = { x: c.x + (rnd()*2-1)*24, y: c.y + (rnd()*2-1)*18 };
      } else if (strategy === 'random'){
        c = candidateRandom(bounds, rx, ry, rnd);
      } else {
        c = candidateRandomRing(bounds, rx, ry, rnd);
      }

      const s = scoreCandidate(c.x, c.y, sepPx);
      if (s){
        if (!best || s.score > best.score) best = s;
        // early accept if very good
        if (s.score > (sepPx*2.2)) return s;
      }
    }
    // relax separation and retry
    sepPx *= 0.82;
  }

  // absolute fallback: still avoid excluded rects by scanning random
  for (let i=0;i<maxTries;i++){
    const c = candidateRandomRing(bounds, rx, ry, rnd);
    const allow = allowedPoint(c.x, c.y, exclRects);
    if (allow.ok) return { x:c.x, y:c.y, score:0 };
  }

  return best || {
    x: (bounds.left + bounds.right) * 0.5,
    y: (bounds.top + bounds.bottom) * 0.5,
    score:-1
  };
}

function makeTargetEl(ch, kind){
  const el = document.createElement('div');
  el.className = 'hha-target ' + (kind ? ('t-' + kind) : '');
  el.textContent = ch;

  // inline safe style fallback (if page CSS missing)
  el.style.position = 'absolute';
  el.style.left = '50%';
  el.style.top  = '50%';
  el.style.transform = 'translate(-50%,-50%)';
  el.style.width = '132px';
  el.style.height = '132px';
  el.style.borderRadius = '999px';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.fontSize = '58px';
  el.style.userSelect = 'none';
  el.style.cursor = 'pointer';
  el.style.background =
    'radial-gradient(90px 80px at 35% 25%, rgba(255,255,255,.55), rgba(255,255,255,0) 60%),' +
    'radial-gradient(120px 120px at 50% 55%, rgba(255,255,255,.18), rgba(255,255,255,.06) 58%, rgba(255,255,255,.02) 100%),' +
    'linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.03))';
  el.style.border = '1px solid rgba(255,255,255,.18)';
  el.style.boxShadow = '0 18px 48px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.22)';
  el.style.filter = 'drop-shadow(0 10px 22px rgba(0,0,0,.35))';

  return el;
}

export async function boot(opts = {}){
  const spawnHost = (typeof opts.spawnHost === 'string')
    ? document.querySelector(opts.spawnHost)
    : (opts.spawnHost || null);

  if (!spawnHost) throw new Error('[mode-factory] spawnHost not found');

  const boundsHost = (opts.boundsHost && opts.boundsHost.getBoundingClientRect)
    ? opts.boundsHost
    : (typeof opts.boundsHost === 'string' ? document.querySelector(opts.boundsHost) : null);

  const boundsEl = boundsHost || spawnHost;

  // RNG
  const runMode = String(opts.runMode || 'play').toLowerCase();
  const seedStr = String(opts.seed || '').trim();
  const rnd = (runMode === 'research' && seedStr)
    ? mulberry32(hashStringToUint32(seedStr))
    : Math.random;

  // difficulty tuning
  const diff = String(opts.difficulty || 'easy').toLowerCase();
  const baseInterval = (diff==='hard') ? 560 : (diff==='normal' ? 650 : 760);
  const baseTTL      = (diff==='hard') ? 980 : (diff==='normal' ? 1150 : 1300);

  const spawnIntervalMul = (typeof opts.spawnIntervalMul === 'function') ? opts.spawnIntervalMul : (()=>1);

  // pools + rates
  const pools = opts.pools || {};
  const goodPool = pools.good || ['💧','🥛','🍉','🥥','🍊'];
  const badPool  = pools.bad  || ['🥤','🧋','🍟','🍔'];
  const powerups = Array.isArray(opts.powerups) ? opts.powerups : ['⭐','🛡️','⏱️'];

  const goodRate = clamp(opts.goodRate ?? 0.65, 0.2, 0.9);
  const powerRate = clamp(opts.powerRate ?? 0.12, 0, 0.35);
  const powerEvery = clamp(opts.powerEvery ?? 6, 2, 999);

  const judge = (typeof opts.judge === 'function') ? opts.judge : (()=>({}));
  const onExpire = (typeof opts.onExpire === 'function') ? opts.onExpire : (()=>{});

  const excludeSelectors = Array.isArray(opts.excludeSelectors) ? opts.excludeSelectors : [];
  const spawnStrategy = String(opts.spawnStrategy || 'randomRing');

  const spawnRadiusX = clamp(opts.spawnRadiusX ?? 0.95, 0.2, 1);
  const spawnRadiusY = clamp(opts.spawnRadiusY ?? 0.95, 0.2, 1);
  const minSeparation = clamp(opts.minSeparation ?? 0.28, 0.04, 0.95);
  const maxSpawnTries = clamp(opts.maxSpawnTries ?? 20, 6, 80);

  const dragThresholdPx = clamp(opts.dragThresholdPx ?? 10, 1, 60);

  let stopped = false;
  let tickTimer = null;

  const live = new Set(); // target records
  const points = [];      // for separation

  let spawnCount = 0;

  function boundsRect(){
    const r = boundsEl.getBoundingClientRect();
    return {
      left:r.left, top:r.top, right:r.right, bottom:r.bottom,
      width:r.width, height:r.height
    };
  }

  function cleanupPoint(rec){
    // remove its point
    for (let i=points.length-1;i>=0;i--){
      if (points[i].id === rec.id){
        points.splice(i,1);
        break;
      }
    }
  }

  function spawnOne(){
    if (stopped) return;

    const b = boundsRect();
    if (b.width < 120 || b.height < 180) return;

    const exclRects = rectsFromSelectors(excludeSelectors);

    // choose kind
    spawnCount++;
    const shouldPower = (powerups.length>0) && ((spawnCount % powerEvery)===0) && (rnd() < powerRate);
    const isGood = shouldPower ? true : (rnd() < goodRate);
    const isPower = !!shouldPower;

    const ch = isPower ? pick(powerups, rnd) : (isGood ? pick(goodPool, rnd) : pick(badPool, rnd));
    const kind = isPower ? 'power' : (isGood ? 'good' : 'bad');

    // pick point
    const chosen = chooseSpawnPoint({
      boundsRect: b,
      spawnRadiusX,
      spawnRadiusY,
      minSeparation,
      maxSpawnTries,
      spawnStrategy,
      exclRects,
      existing: points.map(p=>({x:p.x,y:p.y})),
      rnd
    });

    const el = makeTargetEl(ch, kind);

    // place with CSS vars if page wants it; also set left/top directly
    el.style.left = (chosen.x - b.left) + 'px';
    el.style.top  = (chosen.y - b.top)  + 'px';

    const id = 't' + Date.now().toString(36) + ((rnd()*1e6)|0).toString(36);
    const rec = {
      id,
      el,
      ch,
      isGood,
      isPower,
      born: performance.now(),
      ttl: baseTTL,
      dead:false,
      downX:0,
      downY:0,
      moved:false,
      expireTimer:null
    };

    // register point for separation (absolute client coords)
    points.push({ id, x:chosen.x, y:chosen.y });

    // input: ignore if drag
    el.addEventListener('pointerdown', (ev)=>{
      rec.downX = ev.clientX||0;
      rec.downY = ev.clientY||0;
      rec.moved = false;
      try{ el.setPointerCapture(ev.pointerId); }catch{}
    }, { passive:true });

    el.addEventListener('pointermove', (ev)=>{
      const x = ev.clientX||0, y = ev.clientY||0;
      const dx = x - rec.downX, dy = y - rec.downY;
      if (Math.abs(dx)+Math.abs(dy) > dragThresholdPx) rec.moved = true;
    }, { passive:true });

    el.addEventListener('pointerup', (ev)=>{
      if (rec.dead) return;
      if (rec.moved) return; // treat as look drag
      hit(rec, ev);
    }, { passive:true });

    spawnHost.appendChild(el);
    live.add(rec);

    // expire
    rec.expireTimer = setTimeout(()=>{
      if (rec.dead) return;
      rec.dead = true;
      try{ el.remove(); }catch{}
      live.delete(rec);
      cleanupPoint(rec);
      try{ onExpire({ ch:rec.ch, isGood:rec.isGood, isPower:rec.isPower }); }catch{}
    }, rec.ttl);

    return rec;
  }

  function hit(rec, ev){
    if (rec.dead) return;
    rec.dead = true;

    try{ if (rec.expireTimer) clearTimeout(rec.expireTimer); }catch{}
    rec.expireTimer = null;

    // remove early
    try{ rec.el.remove(); }catch{}

    live.delete(rec);
    cleanupPoint(rec);

    const ctx = {
      clientX: ev?.clientX ?? 0,
      clientY: ev?.clientY ?? 0,
      isGood: rec.isGood,
      isPower: rec.isPower
    };

    try{ judge(rec.ch, ctx); }catch{}
  }

  function scheduleNext(){
    if (stopped) return;
    const mul = clamp(spawnIntervalMul() || 1, 0.2, 3.5);
    const iv = clamp(baseInterval * mul, 120, 2200);

    tickTimer = setTimeout(()=>{
      spawnOne();
      scheduleNext();
    }, iv);
  }

  scheduleNext();

  function stop(){
    if (stopped) return;
    stopped = true;

    try{ if (tickTimer) clearTimeout(tickTimer); }catch{}
    tickTimer = null;

    for (const rec of live){
      try{ if (rec.expireTimer) clearTimeout(rec.expireTimer); }catch{}
      rec.expireTimer = null;
      try{ rec.el.remove(); }catch{}
    }
    live.clear();
    points.length = 0;
  }

  return { stop };
}

export default { boot };