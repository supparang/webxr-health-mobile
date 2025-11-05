// === Hero Health Academy — game/modes/goodjunk.js
// spawn-burst after GO + fallback interval + mobile-safe cadence

export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐'];

let host, items=[], alive=0, running=false, spawnAcc=0, cfg, BUSRef=null;
let tickIntervalId=null, kickIntervalId=null;

const PRESET = {
  Easy:   { spawnEvery: 0.70, maxAlive: 7, life: 3.8, size: 72, goldenProb: 0.10 },
  Normal: { spawnEvery: 0.60, maxAlive: 8, life: 3.6, size: 64, goldenProb: 0.14 },
  Hard:   { spawnEvery: 0.50, maxAlive: 9, life: 3.2, size: 58, goldenProb: 0.18 },
};

function pick(a){ return a[(Math.random()*a.length)|0]; }
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

/* ---------- HUD-safe zones (เบากว่าเดิม: ไม่ block ทั้งหน้าจอ) ---------- */
function rectOf(sel){
  const el = document.querySelector(sel); if(!el) return null;
  const r = el.getBoundingClientRect();
  return (r.width>0 && r.height>0) ? r : null;
}
function collectHudRects(){
  const rects=[];
  const add=(r)=>{ if(r) rects.push(r); };
  add(rectOf('#questChips'));
  add(rectOf('#powerBarWrap'));
  add(rectOf('#resultModal'));
  // ไม่ใส่ #hud ทั้งจอ เพื่อลด false-positive
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
  const padX = Math.max(60, size*1.1), padY = Math.max(60, size*1.1);
  const rects = collectHudRects();
  for(let i=0;i<20;i++){
    const x = clamp(Math.random()*ww, padX, ww-padX);
    const y = clamp(Math.random()*hh, padY, hh-padY);
    if(!overlaps(x,y,size+12,rects)) return {x,y};
  }
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
  const r = Math.random();
  if (r < (cfg.goldenProb||0.12)) return 'gold';
  if (r < (cfg.goldenProb||0.12) + 0.35) return 'junk';
  return 'good';
}
function spawnOne(){
  if (!running || alive >= cfg.maxAlive) return;

  const kind  = decideKind();
  const emoji = (kind==='gold' ? pick(GOLD) : kind==='junk' ? pick(JUNK) : pick(GOOD));

  const s = cfg.size;
  const {x,y} = findFreeSpot(s);
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
  const life = cfg.life * (0.92 + Math.random()*0.22);
  const obj = { el, x, y, t:0, life, kind, dead:false };

  el.addEventListener('pointerdown', (ev)=>{
    if (!running || obj.dead) return;
    obj.dead = true; alive = Math.max(0, alive-1);
    el.style.transform='translate(-50%,-50%) scale(0.84)'; setTimeout(()=>{ el.style.opacity='0'; }, 30);
    setTimeout(()=>{ try{el.remove();}catch{} }, 160);
    const uiX = ev.clientX || x, uiY = ev.clientY || y;
    boomEffect(uiX, uiY, emoji);

    const ui = {x:uiX, y:uiY};
    if (kind==='junk'){ BUSRef?.bad?.({source:obj,ui}); BUSRef?.sfx?.bad?.(); }
    else{
      const isGold = (kind==='gold'); const pts = isGold ? 150 : 100;
      BUSRef?.hit?.({points:pts, kind:isGold?'perfect':'good', ui, meta:{golden:isGold}});
      if (isGold) BUSRef?.sfx?.power?.(); else BUSRef?.sfx?.good?.();
    }
  }, {passive:true});

  host.appendChild(el);
  items.push(obj); alive++;
}

function ageAll(dt){
  for(let i=items.length-1;i>=0;i--){
    const it=items[i];
    if(it.dead){ items.splice(i,1); continue; }
    it.t += dt;
    if (it.t >= it.life){
      it.dead=true; alive=Math.max(0,alive-1);
      try{ it.el.style.opacity='0'; }catch{}
      setTimeout(()=>{ try{ it.el.remove(); }catch{} }, 140);
      if (it.kind!=='junk') BUSRef?.miss?.({source:it});
      items.splice(i,1);
    }
  }
}

/* ---------- Public API ---------- */
export function start({difficulty='Normal'}={}){
  ensureHost();
  // reset
  running=true; items=[]; alive=0; spawnAcc=0;
  try{ host.innerHTML=''; }catch{}
  cfg = PRESET[difficulty] || PRESET.Normal;

  // canvases ไม่บังคลิก
  document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} });

  // 1) Burst ทันทีหลัง GO (เห็นเลย 4 ชิ้น)
  const burst = Math.min(4, cfg.maxAlive);
  for(let i=0;i<burst;i++) spawnOne();

  // 2) rAF-driven tick (ถ้าเบราว์เซอร์อนุญาต)
  //    ใช้ main.js เรียก update(dt) อยู่แล้ว

  // 3) Fallback: setInterval ทุก 120ms → เดินเกมแน่ ๆ บนมือถือ
  clearInterval(tickIntervalId);
  tickIntervalId = setInterval(()=>{
    if (!running) return;
    spawnAcc += 0.12;                 // ~120ms
    if (spawnAcc >= cfg.spawnEvery){  // cadence
      spawnAcc = 0; spawnOne();
    }
    ageAll(0.12);
  }, 120);

  // 4) Watchdog ชั้นใน: ถ้า 1.2s ไม่มี .gj-it ให้สั่ง burst อีกครั้ง
  clearInterval(kickIntervalId);
  kickIntervalId = setInterval(()=>{
    if(!running) return;
    if (!host.querySelector('.gj-it')){
      for(let i=0;i<Math.min(3, cfg.maxAlive-alive); i++) spawnOne();
    }
  }, 1200);

  // 5) ผูก resize
  window.addEventListener('resize', onViewportChange, {passive:true});
  window.addEventListener('orientationchange', onViewportChange, {passive:true});
}

export function update(dt,bus){
  BUSRef = bus || BUSRef;
  // rAF path (ถ้าได้ dt ปกติ ก็ช่วยให้แอนิเมชันเนียนขึ้น)
  if (!(dt>0) || dt>1.2) return;
  spawnAcc += dt;
  if (spawnAcc >= cfg.spawnEvery){ spawnAcc = 0; spawnOne(); }
  ageAll(dt);
}

export function stop(){
  running=false;
  clearInterval(tickIntervalId); tickIntervalId=null;
  clearInterval(kickIntervalId); kickIntervalId=null;
  window.removeEventListener('resize', onViewportChange);
  window.removeEventListener('orientationchange', onViewportChange);
}
export function cleanup(){
  stop();
  try{ if(host) host.innerHTML=''; }catch{}
  items=[]; alive=0; spawnAcc=0;
}
export function onViewportChange(){
  const rects = collectHudRects();
  for(const it of items){
    const s = cfg?.size || 64;
    it.x = clamp(it.x, s, window.innerWidth - s);
    it.y = clamp(it.y, s, window.innerHeight - s);
    if (overlaps(it.x,it.y,s+12,rects)){
      const pos = findFreeSpot(s); it.x = pos.x; it.y = pos.y;
    }
    if (it.el){ it.el.style.left = it.x + 'px'; it.el.style.top = it.y + 'px'; }
  }
}
