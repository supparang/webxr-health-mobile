// === Hero Health Academy — game/modes/goodjunk.js
// (diff-tuned golden + HUD-safe spawn + resize-safe)

export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐'];

let host, items=[], alive=0, running=false, spawnAcc=0, cfg;

const PRESET = {
  Easy:   { spawnEvery: 1.50, maxAlive: 6, life: 4.2, size: 72, goldenProb: 0.10 },
  Normal: { spawnEvery: 1.25, maxAlive: 7, life: 3.8, size: 64, goldenProb: 0.14 },
  Hard:   { spawnEvery: 1.00, maxAlive: 8, life: 3.4, size: 58, goldenProb: 0.18 },
};

function pick(a){ return a[(Math.random()*a.length) | 0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

function ensureHost(){
  host = document.getElementById('spawnHost');
  if(!host){
    host = document.createElement('div');
    host.id='spawnHost';
    host.style.cssText='position:fixed;inset:0;z-index:5000;pointer-events:auto';
    document.body.appendChild(host);
  }
}

/* ---------- HUD-safe zones ---------- */
function collectHudRects(){
  const rects=[];
  const push=(el)=>{
    if(!el) return;
    const r = el.getBoundingClientRect();
    if (r.width>0 && r.height>0) rects.push(r);
  };
  push(document.querySelector('#hud')); // top bars live inside
  push(document.querySelector('#questChips'));
  push(document.querySelector('#powerBarWrap'));
  push(document.querySelector('#feverGauge')); // ถ้ายังมีมุมล่างขวา
  push(document.querySelector('#resultModal'));
  return rects;
}
function overlaps(x,y,sz,rects){
  const r = { left:x-sz/2, top:y-sz/2, right:x+sz/2, bottom:y+sz/2 };
  for(const b of rects){
    const hit = !(r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom);
    if (hit) return true;
  }
  return false;
}
function findFreeSpot(size){
  const ww = window.innerWidth, hh = window.innerHeight;
  const padX = Math.max(70, size*1.2);
  const padY = Math.max(70, size*1.2);
  const rects = collectHudRects();
  for(let i=0;i<18;i++){
    const x = clamp(Math.random()*ww, padX, ww-padX);
    const y = clamp(Math.random()*hh, padY, hh-padY);
    if(!overlaps(x,y,size+12,rects)) return {x,y};
  }
  // fallback: random in safe padding; HUD ทับก็ยอม
  return {
    x: clamp(Math.random()*ww, padX, ww-padX),
    y: clamp(Math.random()*hh, padY, hh-padY),
  };
}

/* ---------- FX ---------- */
function boomEffect(x,y,emoji){
  const p=document.createElement('div');
  p.textContent=emoji;
  p.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(1);
    font-size:42px;opacity:1;transition:all .35s ease;z-index:9000;pointer-events:none`;
  document.body.appendChild(p);
  requestAnimationFrame(()=>{ p.style.transform='translate(-50%,-50%) scale(1.8)'; p.style.opacity='0'; });
  setTimeout(()=>{ try{p.remove();}catch{}; }, 360);
}

/* ---------- Spawn ---------- */
function decideKind(){
  // golden ตาม diff
  const r = Math.random();
  if (r < (cfg.goldenProb||0.12)) return 'gold';
  // ให้ junk ~35%
  if (r < (cfg.goldenProb||0.12) + 0.35) return 'junk';
  return 'good';
}

function spawnOne(BUS){
  if (alive >= cfg.maxAlive) return;

  const kind = decideKind();
  const emoji = (kind==='gold' ? pick(GOLD) : kind==='junk' ? pick(JUNK) : pick(GOOD));

  const s = cfg.size;
  const pos = findFreeSpot(s);
  const x=pos.x, y=pos.y;

  const glow = (kind==='gold') ? '0 0 28px rgba(255,205,80,.85)'
             : (kind==='good') ? '0 0 18px rgba(80,200,255,.35)'
             : '0 0 18px rgba(255,120,120,.25)';

  const el = document.createElement('div');
  el.className='gj-it';
  el.textContent=emoji;
  el.style.cssText = `
    position:fixed; left:${x}px; top:${y}px; transform:translate(-50%,-50%) scale(1);
    width:${s}px; height:${s}px; display:flex; align-items:center; justify-content:center;
    font-size:${s-6}px; user-select:none; cursor:pointer; pointer-events:auto;
    filter:drop-shadow(${glow}); transition: transform .12s ease, opacity .24s ease;`;
  const life = cfg.life * (0.93 + Math.random()*0.2);
  const obj = { el, x, y, t:0, life, kind, dead:false };

  el.addEventListener('pointerdown', (ev)=>{
    if (obj.dead) return;
    obj.dead = true;
    alive = Math.max(0, alive-1);
    el.style.transform='translate(-50%,-50%) scale(0.84)';
    setTimeout(()=>{ el.style.opacity='0'; }, 30);
    setTimeout(()=>{ try{el.remove();}catch{} }, 160);
    boomEffect(ev.clientX || x, ev.clientY || y, emoji);

    const ui={x:ev.clientX||x, y:ev.clientY||y};
    if (kind==='junk'){
      BUS.bad?.({source:obj,ui});
      BUS.sfx?.bad?.();
    }else{
      const isGold = (kind==='gold');
      const base = isGold ? 50 : 10;
      BUS.hit?.({points:base, kind:isGold?'perfect':'good', ui, meta:{golden:isGold}});
      if (isGold) BUS.sfx?.power?.(); else BUS.sfx?.good?.();
    }
  }, {passive:true});

  host.appendChild(el);
  items.push(obj);
  alive++;
}

function tick(dt,BUS){
  if(!running) return;
  spawnAcc += dt;
  const need = Math.floor(spawnAcc / cfg.spawnEvery);
  if (need>0){
    spawnAcc -= need*cfg.spawnEvery;
    for(let i=0;i<need;i++) spawnOne(BUS);
  }
  // อายุของชิ้น
  for(let i=items.length-1;i>=0;i--){
    const it=items[i];
    if(it.dead){ items.splice(i,1); continue; }
    it.t += dt;
    if (it.t >= it.life){
      it.dead=true; alive=Math.max(0,alive-1);
      try{ it.el.style.opacity='0'; }catch{}
      setTimeout(()=>{ try{ it.el.remove(); }catch{} }, 140);
      if (it.kind!=='junk') BUS.miss?.({source:it});
      items.splice(i,1);
    }
  }
}

/* ---------- Public API ---------- */
export function start({difficulty='Normal'}={}){
  ensureHost();
  running = true; items=[]; alive=0; spawnAcc=0;
  cfg = PRESET[difficulty] || PRESET.Normal;

  // canvases ไม่บังคลิก
  document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} });

  // เริ่มของตั้งต้น
  for(let i=0;i<Math.min(4, cfg.maxAlive); i++) spawnOne({hit:()=>{},bad:()=>{},sfx:{}});
}
export function update(dt,BUS){ if(!(dt>0) || dt>1.5) dt=0.016; tick(dt,BUS); }
export function stop(){ running=false; }
export function cleanup(){ running=false; try{ if(host) host.innerHTML=''; }catch{} items=[]; alive=0; }
export function onViewportChange(){
  // บีบให้อยู่ในจอ และหลบ HUD เพิ่มเติม
  const rects = collectHudRects();
  for(const it of items){
    const s = cfg?.size || 64;
    it.x = clamp(it.x, s, window.innerWidth - s);
    it.y = clamp(it.y, s, window.innerHeight - s);
    if (overlaps(it.x,it.y,s+12,rects)){
      const pos = findFreeSpot(s);
      it.x = pos.x; it.y = pos.y;
    }
    if (it.el){
      it.el.style.left = it.x + 'px';
      it.el.style.top  = it.y + 'px';
    }
  }
}
