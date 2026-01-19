// === /herohealth/vr/mode-factory.js ===
// HHA Mode Factory — DOM Target Spawner (PRODUCTION)
// ✅ export boot()
// ✅ Seeded RNG (cfg.seed)
// ✅ Spawn inside mount bounds (fixed viewport)
// ✅ Safe margins + anti-corner clump
// ✅ Click/tap hit + Crosshair shoot (hha:shoot from vr-ui.js)
// ✅ Controller: stop/pause/resume/setRate
//
// Expected target object:
//  - kind: 'good' | 'junk' | 'shield' | ...
//  - groupIndex?: 0..4  (optional)
//  - ttlMs?: number     (optional)
//  - score?: number     (optional)

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function seededRng(seed){
  let t = (Number(seed) || 0) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, arr){
  // arr: [{kind, weight}, ...]
  let sum = 0;
  for(const a of arr) sum += Math.max(0, Number(a.weight)||0);
  if(sum <= 0) return arr[0] || {kind:'good', weight:1};
  let t = rng() * sum;
  for(const a of arr){
    t -= Math.max(0, Number(a.weight)||0);
    if(t <= 0) return a;
  }
  return arr[arr.length-1];
}

function rectOf(el){
  const r = el.getBoundingClientRect();
  return {
    x: r.left, y: r.top, w: r.width, h: r.height,
    left:r.left, top:r.top, right:r.right, bottom:r.bottom
  };
}

function getSafeMargins(){
  // กันบนเผื่อ HUD / บนมือถือมี safe-area
  const sat = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sat')) || 0;
  const sab = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sab')) || 0;
  const sal = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sal')) || 0;
  const sar = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sar')) || 0;

  // margin base: เผื่อ HUD แถวบน/ล่าง
  return {
    top:  (12 + sat) + 120,
    bottom:(12 + sab) + 110,
    left: (12 + sal) + 10,
    right:(12 + sar) + 10
  };
}

function pointInRect(px, py, r){
  return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
}

function dist(a,b,c,d){
  const dx = a-c, dy=b-d;
  return Math.sqrt(dx*dx + dy*dy);
}

function defaultMakeEl(kind){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.dataset.kind = kind;
  el.textContent = '🍽️';
  return el;
}

// ------------------------------------------------------------
// boot(cfg)  => controller
// ------------------------------------------------------------
export function boot(cfg = {}){
  if(!DOC) throw new Error('mode-factory: document missing');

  const mount = cfg.mount;
  if(!mount) throw new Error('mode-factory: mount missing');

  const rng = (typeof cfg.rng === 'function') ? cfg.rng : seededRng(cfg.seed ?? Date.now());

  const kinds = Array.isArray(cfg.kinds) && cfg.kinds.length ? cfg.kinds : [
    {kind:'good', weight:0.7},
    {kind:'junk', weight:0.3},
  ];

  const sizeRange = Array.isArray(cfg.sizeRange) ? cfg.sizeRange : [44, 64];
  const minS = Math.max(24, Number(sizeRange[0])||44);
  const maxS = Math.max(minS, Number(sizeRange[1])||64);

  let spawnRate = Math.max(150, Number(cfg.spawnRate)||900);
  const maxAlive = Math.max(1, Number(cfg.maxAlive)||10);

  const ttlGood = Math.max(500, Number(cfg.ttlGoodMs)||1700);
  const ttlJunk = Math.max(500, Number(cfg.ttlJunkMs)||1600);

  const onHit = (typeof cfg.onHit === 'function') ? cfg.onHit : ()=>{};
  const onExpire = (typeof cfg.onExpire === 'function') ? cfg.onExpire : ()=>{};
  const makeEl = (typeof cfg.makeEl === 'function') ? cfg.makeEl : defaultMakeEl;

  // ------- internal state -------
  let alive = [];
  let running = true;
  let paused = false;
  let timer = null;

  // anti-clump memory (ล่าสุด 6 จุด)
  const recent = [];

  function computePlayRect(){
    const r = rectOf(mount);
    const m = getSafeMargins();

    // ถ้า mount เต็มจอ safe margins จะทำงานดี
    // ถ้า mount เล็ก ให้ relax safe นิดหน่อย
    let left = r.left + m.left;
    let right = r.right - m.right;
    let top = r.top + m.top;
    let bottom = r.bottom - m.bottom;

    // relax เมื่อคับเกิน
    const minW = 260, minH = 260;
    if(right - left < minW){
      const mid = (r.left + r.right)/2;
      left = mid - minW/2;
      right = mid + minW/2;
      left = Math.max(r.left+8, left);
      right = Math.min(r.right-8, right);
    }
    if(bottom - top < minH){
      const mid = (r.top + r.bottom)/2;
      top = mid - minH/2;
      bottom = mid + minH/2;
      top = Math.max(r.top+8, top);
      bottom = Math.min(r.bottom-8, bottom);
    }

    return { left, top, right, bottom, w:(right-left), h:(bottom-top) };
  }

  function placeEl(el, cx, cy, s){
    // absolute inside viewport
    el.style.position = 'fixed';
    el.style.left = `${cx - s/2}px`;
    el.style.top  = `${cy - s/2}px`;
    el.style.width = `${s}px`;
    el.style.height= `${s}px`;
    el.style.display = 'grid';
    el.style.placeItems = 'center';
    el.style.zIndex = '12';
  }

  function choosePoint(play, s){
    // 9-grid-ish bias เพื่อกระจาย ไม่ไปติดมุม
    const pad = Math.max(10, s/2 + 8);
    const x0 = play.left + pad;
    const x1 = play.right - pad;
    const y0 = play.top + pad;
    const y1 = play.bottom - pad;

    const cols = 3, rows = 3;
    const c = Math.floor(rng()*cols);
    const r = Math.floor(rng()*rows);

    const cellW = (x1 - x0) / cols;
    const cellH = (y1 - y0) / rows;

    let x = x0 + c*cellW + rng()*cellW;
    let y = y0 + r*cellH + rng()*cellH;

    // anti-clump: ถ้าใกล้ recent มากเกิน ให้สุ่มใหม่ 2 รอบ
    for(let k=0;k<2;k++){
      let tooClose = false;
      for(const p of recent){
        if(dist(x,y,p.x,p.y) < Math.max(70, s*1.1)){ tooClose = true; break; }
      }
      if(!tooClose) break;
      x = x0 + rng()*(x1-x0);
      y = y0 + rng()*(y1-y0);
    }
    recent.push({x,y});
    while(recent.length>6) recent.shift();

    return {x,y};
  }

  function mkTarget(){
    const pick = pickWeighted(rng, kinds);
    const kind = pick.kind || 'good';

    const s = Math.round(minS + rng()*(maxS - minS));
    const play = computePlayRect();
    const pt = choosePoint(play, s);

    const el = makeEl(kind, s);
    if(!el.classList.contains('plateTarget')) el.classList.add('plateTarget');
    el.dataset.kind = kind;

    // for plate: if good, random groupIndex
    if(kind === 'good'){
      const gi = Math.floor(rng()*5);
      el.dataset.groupIndex = String(gi);
    }

    placeEl(el, pt.x, pt.y, s);
    mount.appendChild(el);

    const ttl = (kind === 'junk') ? ttlJunk : ttlGood;
    const born = Date.now();

    const t = {
      el,
      kind,
      s,
      born,
      ttlMs: ttl,
      groupIndex: el.dataset.groupIndex != null ? Number(el.dataset.groupIndex) : undefined,
      dead:false
    };

    // click/tap hit
    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      hitTarget(t, {source:'tap'});
    }, { passive:false });

    // auto expire
    t.to = setTimeout(()=>{
      if(t.dead) return;
      killTarget(t, 'expire');
      onExpire(t);
    }, ttl);

    alive.push(t);
    // keep alive limit
    if(alive.length > maxAlive){
      const oldest = alive[0];
      if(oldest && !oldest.dead){
        killTarget(oldest, 'trim');
        onExpire(oldest);
      }
    }
  }

  function killTarget(t, why='kill'){
    if(!t || t.dead) return;
    t.dead = true;
    clearTimeout(t.to);
    try{ t.el?.remove(); }catch(_){}
    alive = alive.filter(x=>x!==t);
  }

  function hitTarget(t, meta={}){
    if(!running || paused) return;
    if(!t || t.dead) return;

    // tiny hit fx class (optional)
    try{
      t.el.classList.add('is-hit');
      setTimeout(()=>t.el && t.el.classList.remove('is-hit'), 140);
    }catch(_){}

    killTarget(t, 'hit');
    onHit(t, meta);
  }

  function findTargetNear(x, y, lockPx){
    // pick nearest whose center within radius
    let best = null;
    let bestD = 1e9;

    for(const t of alive){
      if(!t || t.dead) continue;
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const d = dist(x,y,cx,cy);

      const rad = Math.max(lockPx || 26, r.width*0.42);
      if(d <= rad && d < bestD){
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  function onShoot(ev){
    if(!running || paused) return;
    const d = ev?.detail || {};
    const x = Number(d.x) || (WIN.innerWidth/2);
    const y = Number(d.y) || (WIN.innerHeight/2);
    const lockPx = Number(d.lockPx) || 26;

    const t = findTargetNear(x,y,lockPx);
    if(t) hitTarget(t, {source:d.source || 'shoot'});
  }

  function tick(){
    if(!running) return;
    if(!paused) mkTarget();
    timer = setTimeout(tick, spawnRate);
  }

  // -------- controller (สำคัญ: ประกาศก่อนใช้งาน ปิด bug controller before init) --------
  const controller = {
    stop(){
      running = false;
      clearTimeout(timer);
      // clear all
      for(const t of alive.slice()){
        try{ clearTimeout(t.to); }catch(_){}
        try{ t.el?.remove(); }catch(_){}
      }
      alive = [];
      WIN.removeEventListener('hha:shoot', onShoot, {passive:true});
    },
    pause(){ paused = true; },
    resume(){ paused = false; },
    setRate(ms){
      spawnRate = Math.max(150, Number(ms)||spawnRate);
    },
    getState(){
      return { running, paused, alive: alive.length, spawnRate };
    }
  };

  // bind shoot
  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  // start loop
  tick();

  return controller;
}